### test-product-features.ps1
### Tests: CSV Import, Barcode Lookup, PO auto-create product
### Prerequisites: all services running (pnpm turbo dev)

$BASE  = "http://localhost:3010"
$ts    = [int][System.DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$PASS  = 0; $FAIL = 0

function T { param($name, [bool]$cond, $detail="")
    if ($cond) { $script:PASS++ ; Write-Host "[PASS] $name $detail" -ForegroundColor Green }
    else        { $script:FAIL++ ; Write-Host "[FAIL] $name $detail" -ForegroundColor Red }
}

function Req { param($method,$path,$body=$null,$token="",$tid="")
    $h = @{"Content-Type"="application/json"}
    if ($token) { $h["Authorization"] = "Bearer $token" }
    if ($tid)   { $h["x-tenant-id"]   = $tid }
    try {
        $p2 = @{ Uri="$BASE$path"; Method=$method; Headers=$h; ErrorAction="SilentlyContinue" }
        if ($body -ne $null) { $p2["Body"] = $body | ConvertTo-Json -Depth 10 }
        Invoke-RestMethod @p2
    } catch { $null }
}

# ─── Auth ────────────────────────────────────────────────────────────────────
$login = Req POST "/api/auth" @{action="login";email="admin@simhapurifresh.com";password="Admin@123";tenantSlug="simhapuri-fresh"}
if (!$login.data.accessToken) { Write-Host "LOGIN FAILED - is gateway running on :3010?" -ForegroundColor Red; exit 1 }
$tok = $login.data.accessToken
$tid = $login.data.tenant.id
Write-Host "Logged in. tenantId=$tid`n" -ForegroundColor Cyan

# ─── 1. CSV Import ────────────────────────────────────────────────────────────
Write-Host "=== 1. CSV IMPORT ===" -ForegroundColor Yellow
$csvProducts = @(
    @{ sku="TEST-CSV-$ts-1"; name="Test Capsicum $ts"; unit="kg"; costPrice=30; sellPrice=45; reorderLevel=20; initialStock=100 }
    @{ sku="TEST-CSV-$ts-2"; name="Test Onion $ts";    unit="kg"; costPrice=25; sellPrice=35; reorderLevel=50; initialStock=200 }
    @{ sku="TEST-CSV-$ts-1"; name="Test Capsicum $ts"; unit="kg"; costPrice=30; sellPrice=45; reorderLevel=20; initialStock=100 }  # duplicate → should be skipped
)

$importResult = Req POST "/api/products/import" @{ products=$csvProducts } $tok $tid
T "CSV Import returns data"   ($null -ne $importResult.data)
T "CSV created = 2"           ($importResult.data.created -eq 2) "created=$($importResult.data.created)"
T "CSV skipped = 1 (dup SKU)" ($importResult.data.skipped -ge 1) "skipped=$($importResult.data.skipped)"
T "CSV total = 3"             ($importResult.data.total   -eq 3) "total=$($importResult.data.total)"

# Verify they appear in product list
Start-Sleep -Milliseconds 500
$prods = Req GET "/api/products?limit=200" -token $tok -tid $tid
$imported = $prods.data | Where-Object { $_.sku -like "TEST-CSV-$ts*" }
T "Imported products in list (2)" ($imported.Count -eq 2) "count=$($imported.Count)"

# Check initial stock
$withStock = $imported | Where-Object { ($_.stocks | Measure-Object -Property quantity -Sum).Sum -gt 0 }
T "Imported products have initial stock" ($withStock.Count -eq 2) "with_stock=$($withStock.Count)"

# ─── 2. Barcode Lookup ────────────────────────────────────────────────────────
Write-Host "`n=== 2. BARCODE LOOKUP ===" -ForegroundColor Yellow

# 2a. Unknown barcode (Open Food Facts)
$knownBarcode = "8901030929024"   # Britannia Bourbon biscuit
$barcodeResult = Req GET "/api/products/barcode?code=$knownBarcode" -token $tok -tid $tid
T "Barcode lookup returns response"        ($null -ne $barcodeResult)
T "Barcode not in local DB (exists=false)" ($barcodeResult.data.exists -ne $true)

# 2b. Create a product with a barcode, then look it up
$barcodeTest = "9999999999$ts"
$newProd = Req POST "/api/products" @{
    sku="BTEST-$ts"; name="Barcode Product $ts"; unit="pcs";
    costPrice=50; sellPrice=75; barcode=$barcodeTest
} $tok $tid
T "Create product with barcode" ($null -ne $newProd.data.id) "id=$($newProd.data.id)"

$localResult = Req GET "/api/products/barcode?code=$barcodeTest" -token $tok -tid $tid
T "Barcode found locally"          ($localResult.data.exists -eq $true) "exists=$($localResult.data.exists)"
T "Barcode local source"           ($localResult.data.source -eq "local") "source=$($localResult.data.source)"
T "Barcode local correct name"     ($localResult.data.name -eq "Barcode Product $ts") "name=$($localResult.data.name)"

# ─── 3. PO auto-create product ────────────────────────────────────────────────
Write-Host "`n=== 3. PO AUTO-CREATE PRODUCT ===" -ForegroundColor Yellow

# Get a vendor
$vendors = Req GET "/api/vendors?limit=10" -token $tok -tid $tid
if (!$vendors.data -or $vendors.data.Count -eq 0) {
    # Create a vendor first
    $v = Req POST "/api/vendors" @{ name="AutoTest Vendor $ts"; email="vendor$ts@test.com"; phone="9000000000" } $tok $tid
    $vid = $v.data.id
    T "Create vendor for test" ($null -ne $vid) "id=$vid"
} else {
    $vid = $vendors.data[0].id
    T "Use existing vendor" ($null -ne $vid) "id=$vid"
}

$newProductName = "PO AutoProduct $ts"
$newProductSku  = "AUTO-PO-$ts"

$po = Req POST "/api/purchase-orders" @{
    vendorId = $vid
    date     = (Get-Date -Format "yyyy-MM-dd")
    items    = @(
        @{
            productName      = $newProductName
            productSku       = $newProductSku
            productUnit      = "kg"
            productCostPrice = 40
            quantity         = 50
            unitPrice        = 40
        }
    )
} $tok $tid

T "PO created"         ($null -ne $po.data.id)                       "id=$($po.data.id)"
T "PO status is DRAFT" ($po.data.status -eq "DRAFT")                 "status=$($po.data.status)"
$poItem = if ($po.data.items) { $po.data.items[0] } else { $null }
T "PO item has productId" ($poItem -ne $null -and $poItem.productId -ne "") "productId=$($poItem.productId)"

# Verify product was created in inventory
$autoProductId = if ($poItem) { $poItem.productId } else { $null }
if ($autoProductId) {
    $invProd = Req GET "/api/products/$autoProductId" -token $tok -tid $tid
    T "Auto-created product exists in inventory" ($invProd.data.id -eq $autoProductId) "sku=$($invProd.data.sku)"
    T "Auto-created product has correct SKU"     ($invProd.data.sku -eq $newProductSku) "sku=$($invProd.data.sku)"
    T "Auto-created product has correct name"    ($invProd.data.name -eq $newProductName) "name=$($invProd.data.name)"
}

# Full workflow: submit → approve → receive → stock appears
$poId = $po.data.id
Req PATCH "/api/purchase-orders/$poId`?action=submit"  @{} $tok $tid | Out-Null
Req PATCH "/api/purchase-orders/$poId`?action=approve" @{} $tok $tid | Out-Null

$detail = Req GET "/api/purchase-orders/$poId" -token $tok -tid $tid
$remaining = @($detail.data.items | ForEach-Object { @{ orderItemId=$_.id; receivedQty=($_.quantity - $_.receivedQty) } } | Where-Object { $_.receivedQty -gt 0 })
$received = Req PATCH "/api/purchase-orders/$poId`?action=receive" @{ warehouseId="seed-warehouse-main"; items=$remaining } $tok $tid
T "PO receive succeeds" ($received.data.status -eq "RECEIVED" -or $received.data.status -eq "PARTIALLY_RECEIVED") "status=$($received.data.status)"

# Confirm stock was added to the auto-created product
Start-Sleep -Milliseconds 500
$updatedProd = Req GET "/api/products/$autoProductId" -token $tok -tid $tid
$stockQty = ($updatedProd.data.stocks | Measure-Object -Property quantity -Sum).Sum
T "Stock added for auto-created product" ($stockQty -gt 0) "qty=$stockQty"

# ─── Summary ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " RESULT: $PASS PASS  |  $FAIL FAIL" -ForegroundColor $(if($FAIL -eq 0){"Green"}else{"Red"})
Write-Host "============================================" -ForegroundColor Cyan
if ($FAIL -gt 0) { exit 1 }
