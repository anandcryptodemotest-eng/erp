$BASE = "http://localhost:3010"
$ts = [int][System.DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$results = [System.Collections.ArrayList]::new()
function T { param($name, [bool]$cond, $detail="")
    $status = if($cond){"PASS"}else{"FAIL"}
    $null=$results.Add([PSCustomObject]@{Test=$name;Status=$status;Detail=$detail})
    Write-Host "$(if($cond){'[PASS]'}else{'[FAIL]'}) $name $detail"
}
function Req { param($method,$path,$body=$null,$token="",$tid="")
    $h=@{"Content-Type"="application/json"}
    if($token){$h["Authorization"]="Bearer $token"}
    if($tid){$h["x-tenant-id"]=$tid}
    try{
        $p2=@{Uri="$BASE$path";Method=$method;Headers=$h;ErrorAction="SilentlyContinue"}
        if($body-ne$null){$p2["Body"]=$body|ConvertTo-Json -Depth 10}
        Invoke-RestMethod @p2
    }catch{$null}
}
$login=Req POST "/api/auth" @{action="login";email="admin@simhapurifresh.com";password="Admin@123";tenantSlug="simhapuri-fresh"}
if(!$login.data.accessToken){Write-Host "LOGIN FAILED";exit 1}
T "Login" $true; $tok=$login.data.accessToken;$tid=$login.data.tenant.id

Write-Host "=== INVENTORY ==="
$prods=Req GET "/api/products" -token $tok -tid $tid
T "List Products" ($prods.data.Count-gt 0) "$($prods.data.Count)"
$p=$prods.data[0]
$r=Req POST "/api/stock/receive" @{items=@(@{productId=$p.id;warehouseId="seed-warehouse-main";quantity=500});reference="E2E"} $tok $tid
T "Stock Receive" ($null-ne $r.data)

Write-Host "=== UC2 LEAD-TO-CASH ==="
$now=(Get-Date).ToUniversalTime().ToString("o")
$fut=(Get-Date).AddDays(30).ToUniversalTime().ToString("o")
$lead=Req POST "/api/leads" @{name="B2B Lead";phone="9876543210";source="WEBSITE"} $tok $tid
T "Create Lead" ($null-ne $lead.data.id)
$cust=Req POST "/api/customers" @{name="E2E Customer $ts";phone="9111111111";email="e2e$ts@test.com"} $tok $tid
T "Create Customer" ($null-ne $cust.data.id)
$cId=$cust.data.id
$qt=Req POST "/api/quotes" @{customerId=$cId;date=$now;validUntil=$fut;items=@(@{productId=$p.id;productName=$p.name;quantity=2;unitPrice=$p.sellPrice;discount=0})} $tok $tid
T "Create Quote" ($null-ne $qt.data.id) $qt.data.quoteNumber
$ord=Req POST "/api/orders" @{customerId=$cId;date=$now;paymentMethod="UPI";items=@(@{productId=$p.id;productName=$p.name;quantity=5;unitPrice=$p.sellPrice})} $tok $tid
T "Create Order" ($null-ne $ord.data.id) "$($ord.data.orderNumber)"
$oId=$ord.data.id
if($ord.data.items){$oItem=$ord.data.items[0].id}else{$oItem=$null}
$r=Req PATCH "/api/orders/$oId`?action=confirm" @{warehouseId="seed-warehouse-main"} $tok $tid
T "Confirm Order (PATCH?action=confirm + warehouseId)" ($r.data.status-eq"CONFIRMED") "status=$($r.data.status)"
$r=Req PATCH "/api/orders/$oId`?action=ship" @{warehouseId="seed-warehouse-main";items=@(@{orderItemId=$oItem;shippedQty=5})} $tok $tid
T "Ship Order (PATCH?action=ship + items[])" ($r.data.status-eq"SHIPPED") "status=$($r.data.status)"
$r=Req PATCH "/api/orders/$oId`?action=invoice" @{} $tok $tid
T "Invoice Order (PATCH?action=invoice)" ($r.data.status-eq"INVOICED") "status=$($r.data.status)"
Start-Sleep -Milliseconds 500
$arInv=(Req GET "/api/invoices" -token $tok -tid $tid).data|Where-Object{$_.sourceRef-eq$oId}|Select-Object -First 1
T "AR Invoice Auto-Created" ($null-ne $arInv) "num=$($arInv.number) status=$($arInv.status)"
if($arInv){
    $r=Req PATCH "/api/invoices/$($arInv.id)?action=issue" @{} $tok $tid
    T "Issue Invoice (DRAFT->ISSUED)" ($r.data.status-eq"ISSUED") "status=$($r.data.status)"
    $r=Req PATCH "/api/invoices/$($arInv.id)?action=pay" @{amount=$arInv.total;method="BANK_TRANSFER";date=$now} $tok $tid
    T "Pay AR Invoice (amount+method+date)" ($r.data.status-eq"PAID") "status=$($r.data.status)"
}

Write-Host "=== UC10 SALES RETURN ==="
$ret=Req POST "/api/returns" @{orderId=$oId;reason="DAMAGED";items=@(@{orderItemId=$oItem;productId=$p.id;productName=$p.name;quantity=1;unitPrice=$p.sellPrice})} $tok $tid
T "Create Sales Return" ($null-ne $ret.data.id) "$($ret.data.returnNumber)"

Write-Host "=== UC3 PROCURE-TO-PAY ==="
$vend=Req POST "/api/vendors" @{name="AgroFresh $ts";phone="8800000001";email="v$ts@test.com"} $tok $tid
T "Create Vendor" ($null-ne $vend.data.id)
$vId=$vend.data.id
$po=Req POST "/api/purchase-orders" @{vendorId=$vId;date=$now;items=@(@{productId=$p.id;productName=$p.name;quantity=100;unitPrice=$p.costPrice})} $tok $tid
T "Create PO" ($null-ne $po.data.id) $po.data.orderNumber
$poId=$po.data.id;$poItem=$po.data.items[0].id
$r=Req PATCH "/api/purchase-orders/$poId`?action=submit" @{} $tok $tid
T "Submit PO (PATCH?action=submit)" ($r.data.status-eq"SUBMITTED") "status=$($r.data.status)"
$r=Req PATCH "/api/purchase-orders/$poId`?action=approve" @{} $tok $tid
T "Approve PO (PATCH?action=approve)" ($r.data.status-eq"APPROVED") "status=$($r.data.status)"
$r=Req PATCH "/api/purchase-orders/$poId`?action=receive" @{warehouseId="seed-warehouse-main";items=@(@{orderItemId=$poItem;receivedQty=100})} $tok $tid
T "Receive PO (PATCH?action=receive + items[])" ($r.data.status-eq"RECEIVED") "status=$($r.data.status)"
Start-Sleep -Milliseconds 500
$apInv=(Req GET "/api/invoices" -token $tok -tid $tid).data|Where-Object{$_.sourceRef-eq$poId}|Select-Object -First 1
T "AP Invoice Auto-Created" ($null-ne $apInv) "status=$($apInv.status)"

Write-Host "=== UC4 HIRE-TO-PAYROLL ==="
$emp=Req POST "/api/employees" @{employeeId="EMP-$ts";firstName="Ramesh";lastName="Nair";email="ramesh$ts@test.com";department="Delivery";position="Driver";hireDate="2026-01-01";salary=22000} $tok $tid
T "Create Employee (position,hireDate,salary)" ($null-ne $emp.data.id) "err=$($emp.error)"
$eId=$emp.data.id
$pr=Req POST "/api/payroll" @{employeeId=$eId;period="2026-05";allowances=1500;deductions=300} $tok $tid
T "Create Payroll (period string)" ($null-ne $pr.data.id) "net=$($pr.data.netPay) err=$($pr.error)"
$prId=$pr.data.id
$r=Req PATCH "/api/payroll/$prId`?action=process" @{} $tok $tid
T "Process Payroll -> journal" ($r.data.status-eq"PROCESSED") "status=$($r.data.status)"
$r=Req PATCH "/api/payroll/$prId`?action=pay" @{} $tok $tid
T "Pay Payroll -> bank journal" ($r.data.status-eq"PAID") "status=$($r.data.status)"

Write-Host "=== GROCERY DELIVERY FLOW ==="
$c2=Req POST "/api/customers" @{name="Online Buyer $ts";phone="9200000001"} $tok $tid
$o2=Req POST "/api/orders" @{customerId=$c2.data.id;date=$now;isOnlineOrder=$true;paymentMethod="COD";items=@(@{productId=$p.id;productName=$p.name;quantity=2;unitPrice=$p.sellPrice})} $tok $tid
$o2Id=$o2.data.id
if($o2.data.items){$o2Item=$o2.data.items[0].id}else{$o2Item=$null}
Req PATCH "/api/orders/$o2Id`?action=confirm" @{warehouseId="seed-warehouse-main"} $tok $tid|Out-Null
$r=Req PATCH "/api/orders/$o2Id`?action=awaiting_pickup" @{} $tok $tid
T "Order->AWAITING_PICKUP" ($r.data.status-eq"AWAITING_PICKUP") "status=$($r.data.status)"
$r=Req PATCH "/api/orders/$o2Id`?action=out_for_delivery" @{} $tok $tid
T "Order->OUT_FOR_DELIVERY" ($r.data.status-eq"OUT_FOR_DELIVERY") "status=$($r.data.status)"
$r=Req PATCH "/api/orders/$o2Id`?action=delivered" @{} $tok $tid
T "Order->DELIVERED" ($r.data.status-eq"DELIVERED") "payStatus=$($r.data.paymentStatus)"

Write-Host "`nSUMMARY"
$pass=($results|Where-Object {$_.Status -eq "PASS"}).Count
$fail=($results|Where-Object {$_.Status -eq "FAIL"}).Count
Write-Host "PASSED=$pass FAILED=$fail TOTAL=$($results.Count)"
$results|Where-Object {$_.Status -eq "FAIL"}|ForEach-Object{"  FAIL: $($_.Test) -- $($_.Detail)"}
