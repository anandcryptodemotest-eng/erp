$base = 'http://localhost:3008'
$results = @()

function Add-Result([string]$name, [int]$status, [string]$note) {
  $script:results += [pscustomobject]@{ Test = $name; Status = $status; Note = $note }
}

function Invoke-Json([string]$name, [string]$method, [string]$url, [hashtable]$headers, $bodyObj) {
  try {
    $body = if ($null -ne $bodyObj) { $bodyObj | ConvertTo-Json -Depth 10 } else { $null }
    $resp = Invoke-WebRequest -Uri $url -Method $method -Headers $headers -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 30
    Add-Result $name ([int]$resp.StatusCode) 'OK'
    return ($resp.Content | ConvertFrom-Json)
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $txt = $sr.ReadToEnd()
      Add-Result $name $status $txt
    } else {
      Add-Result $name -1 $_.Exception.Message
    }
    return $null
  }
}

$loginBody = @{ email = 'admin@simhapurifresh.com'; password = 'Admin@123'; tenantSlug = 'simhapuri-fresh' }
$login = Invoke-Json 'Auth Login' 'POST' "$base/_svc/gateway/api/auth" @{} $loginBody
if ($null -eq $login) {
  $results | Format-Table -AutoSize
  exit 1
}

$token = $login.data.accessToken
$tenantId = $login.data.tenant.id
$userId = $login.data.user.id
$authHeaders = @{ Authorization = "Bearer $token"; 'x-tenant-id' = $tenantId }

$openShifts = Invoke-Json 'Shift List OPEN' 'GET' "$base/_svc/accounting/api/shifts?status=OPEN&cashierId=$userId&limit=1" $authHeaders $null
$shiftId = $null
if ($openShifts -and $openShifts.data.Count -gt 0) { $shiftId = $openShifts.data[0].id }
if (-not $shiftId) {
  $createShift = Invoke-Json 'Shift Create' 'POST' "$base/_svc/accounting/api/shifts" $authHeaders @{ cashierId = $userId; openingBalance = 1000 }
  if ($createShift) { $shiftId = $createShift.data.id }
}

if ($shiftId) {
  [void](Invoke-Json 'Shift Detail' 'GET' "$base/_svc/accounting/api/shifts/$shiftId" $authHeaders $null)
}

$wh = Invoke-Json 'Warehouses List' 'GET' "$base/_svc/inventory/api/warehouses?limit=50" $authHeaders $null
$warehouseId = if ($wh -and $wh.data.Count -gt 0) { $wh.data[0].id } else { $null }
$barcodeA = Invoke-Json 'Barcode Lookup Tomato' 'GET' "$base/_svc/inventory/api/products?barcode=8901234560001&limit=1" $authHeaders $null
$barcodeB = Invoke-Json 'Barcode Lookup Milk' 'GET' "$base/_svc/inventory/api/products?barcode=8901234560003&limit=1" $authHeaders $null
$productA = if ($barcodeA -and $barcodeA.data.Count -gt 0) { $barcodeA.data[0] } else { $null }
$productB = if ($barcodeB -and $barcodeB.data.Count -gt 0) { $barcodeB.data[0] } else { $null }

if (-not $productA) {
  $products = Invoke-Json 'Products Search' 'GET' "$base/_svc/inventory/api/products?search=rice&limit=1" $authHeaders $null
  $productA = if ($products -and $products.data.Count -gt 0) { $products.data[0] } else { $null }
}

if (-not $warehouseId -or -not $shiftId -or -not $productA) {
  Add-Result 'Preconditions' 500 'Missing warehouse/shift/product for bill flow'
  $results | Format-Table -AutoSize
  exit 1
}

$item = @{ productId = $productA.id; productName = $productA.name; sku = $productA.sku; quantity = 1; unitPrice = [decimal]$productA.sellPrice; discount = 0 }
$billItems = @($item)
if ($productB) {
  $billItems += @{ productId = $productB.id; productName = $productB.name; sku = $productB.sku; quantity = 1; unitPrice = [decimal]$productB.sellPrice; discount = 0 }
}

$billCompleted = Invoke-Json 'Bill Create COMPLETED' 'POST' "$base/_svc/accounting/api/bills" $authHeaders @{ shiftId = $shiftId; warehouseId = $warehouseId; paymentMethod = 'CASH'; status = 'COMPLETED'; countryCode = 'IN'; currency = 'INR'; items = $billItems }
$completedBillId = if ($billCompleted) { $billCompleted.data.id } else { $null }
$completedBillNumber = if ($billCompleted) { $billCompleted.data.billNumber } else { $null }

$billHeld = Invoke-Json 'Bill Create HELD' 'POST' "$base/_svc/accounting/api/bills" $authHeaders @{ shiftId = $shiftId; warehouseId = $warehouseId; paymentMethod = 'CASH'; status = 'HELD'; countryCode = 'IN'; currency = 'INR'; items = @($item) }
$heldBillId = if ($billHeld) { $billHeld.data.id } else { $null }

[void](Invoke-Json 'Bill List HELD' 'GET' "$base/_svc/accounting/api/bills?status=HELD&limit=20" $authHeaders $null)

if ($heldBillId) {
  [void](Invoke-Json 'Held Resume PATCH' 'PATCH' "$base/_svc/accounting/api/bills/$heldBillId" $authHeaders @{ status = 'COMPLETED'; warehouseId = $warehouseId })
}

if ($completedBillNumber) {
  [void](Invoke-Json 'Bill Lookup Number' 'GET' "$base/_svc/accounting/api/bills?billNumber=$completedBillNumber&limit=1" $authHeaders $null)
}

if ($completedBillId) {
  $billDetail = Invoke-Json 'Bill Detail' 'GET' "$base/_svc/accounting/api/bills/$completedBillId" $authHeaders $null
  if ($billDetail -and $billDetail.data.items.Count -gt 0) {
    $taxRates = @($billDetail.data.items | ForEach-Object { $_.taxRate })
    $distinctTaxRates = @($taxRates | Sort-Object -Unique)
    if ($billDetail.data.taxAmount -gt 0) {
      Add-Result 'Tax Applied On Bill' 200 ("taxAmount=" + [string]$billDetail.data.taxAmount)
    } else {
      Add-Result 'Tax Applied On Bill' 409 'taxAmount is zero'
    }
    if ($distinctTaxRates.Count -gt 1) {
      Add-Result 'Mixed Product Tax Rates' 200 ("rates=" + (($distinctTaxRates -join ',')))
    } else {
      Add-Result 'Mixed Product Tax Rates' 409 'expected multiple tax rates'
    }

    $item0 = $billDetail.data.items[0]
    $returnItem = @{ productId = $item0.productId; productName = $item0.productName; quantity = 1; unitPrice = [decimal]$item0.unitPrice }
    if ($item0.variantId) { $returnItem["variantId"] = $item0.variantId }
    [void](Invoke-Json 'Bill Return POST' 'POST' "$base/_svc/accounting/api/bills/$completedBillId/returns" $authHeaders @{ warehouseId = $warehouseId; refundMethod = 'CASH'; reason = 'smoke-test'; items = @($returnItem) })
  }
}

$results | Format-Table -AutoSize
