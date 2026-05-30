$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
$hba  = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$bak  = "$hba.bak"
$enc  = New-Object System.Text.UTF8Encoding $false   # no BOM

function Write-NoBom($path, $text) {
    [System.IO.File]::WriteAllText($path, $text, $enc)
}

# Step 1: Restore clean backup (no BOM) so service can start
$original = [System.IO.File]::ReadAllText($bak)
Write-NoBom $hba $original
Write-Output "Restored pg_hba.conf from backup (no BOM)"

Start-Service postgresql-x64-18
Start-Sleep -Seconds 5
Write-Output "Service started"

# Step 2: Temporarily trust local connections, then reload without restart
$trusted = $original -replace "scram-sha-256", "trust"
Write-NoBom $hba $trusted
psql -U postgres -h localhost -c "SELECT pg_reload_conf();" 2>&1
Start-Sleep -Seconds 2
Write-Output "Auth switched to trust"

# Step 3: Create erp user and databases (ignore 'already exists' errors)
psql -U postgres -h localhost -c "CREATE USER erp WITH PASSWORD 'erp_dev_password';" 2>&1
psql -U postgres -h localhost -c "CREATE DATABASE erp_gateway    OWNER erp;" 2>&1
psql -U postgres -h localhost -c "CREATE DATABASE erp_sales      OWNER erp;" 2>&1
psql -U postgres -h localhost -c "CREATE DATABASE erp_inventory  OWNER erp;" 2>&1
psql -U postgres -h localhost -c "CREATE DATABASE erp_accounting OWNER erp;" 2>&1
psql -U postgres -h localhost -c "CREATE DATABASE erp_hr         OWNER erp;" 2>&1
psql -U postgres -h localhost -c "CREATE DATABASE erp_procurement OWNER erp;" 2>&1
psql -U postgres -h localhost -c "CREATE DATABASE erp_delivery   OWNER erp;" 2>&1
Write-Output "Databases created"

# Step 4: Revert to scram-sha-256 via reload (no restart)
Write-NoBom $hba $original
psql -U postgres -h localhost -c "SELECT pg_reload_conf();" 2>&1
Write-Output "Auth reverted to scram-sha-256"

Write-Output "SUCCESS: All done."
Read-Host "Press Enter to close"
