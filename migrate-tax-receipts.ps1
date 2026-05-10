# Rental Manager Tax & Receipts Migration Script
# This script adds new tables for tax filings and receipts while preserving existing data

param(
    [string]$DbHost = "localhost",
    [int]$DbPort = 3316,
    [string]$DbName = "rental_db",
    [string]$DbUser = "root",
    [string]$DbPass = "rentalpass123"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Rental Manager Migration Script" -ForegroundColor Cyan
Write-Host "Adding Tax Filings & Receipts Tables" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to execute SQL
function Execute-SQL {
    param([string]$Query)
    $result = docker exec rental-mysql mysql -u$DbUser -p$DbPass $DbName -e "$Query" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "SQL Error: $result"
        return $false
    }
    return $true
}

# Check if MySQL is running
Write-Host "Step 1: Checking MySQL container..." -ForegroundColor Yellow
$mysqlStatus = docker ps --format "{{.Names}}" | Select-String "rental-mysql"
if (-not $mysqlStatus) {
    Write-Host "Starting MySQL container..." -ForegroundColor Yellow
    docker start rental-mysql
    Start-Sleep -Seconds 10
}

# Wait for MySQL to be ready
Write-Host "Step 2: Waiting for MySQL to be ready..." -ForegroundColor Yellow
$maxRetries = 30
$retry = 0
$connected = $false

while ($retry -lt $maxRetries -and -not $connected) {
    try {
        $test = docker exec rental-mysql mysql -u$DbUser -p$DbPass -e "SELECT 1" 2>&1
        if ($test -match "1") {
            $connected = $true
            Write-Host "MySQL is ready!" -ForegroundColor Green
        }
    } catch {
        $retry++
        Write-Host "Waiting for MySQL... ($retry/$maxRetries)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $connected) {
    Write-Error "Failed to connect to MySQL after $maxRetries retries"
    exit 1
}

Write-Host ""
Write-Host "Step 3: Checking existing tables..." -ForegroundColor Yellow
$tables = docker exec rental-mysql mysql -u$DbUser -p$DbPass $DbName -e "SHOW TABLES;" 2>&1

# Check if new tables already exist
$newTables = @("tax_filings", "receipts", "receipts_history", "tax_filing_properties")
$existingNewTables = @()

foreach ($table in $newTables) {
    if ($tables -match $table) {
        $existingNewTables += $table
    }
}

if ($existingNewTables.Count -gt 0) {
    Write-Host "WARNING: Some tables already exist: $($existingNewTables -join ', ')" -ForegroundColor Yellow
    $continue = Read-Host "Do you want to continue and skip existing tables? (y/n)"
    if ($continue -ne 'y') {
        Write-Host "Migration aborted by user." -ForegroundColor Red
        exit 0
    }
}

Write-Host ""
Write-Host "Step 4: Running migration SQL..." -ForegroundColor Yellow

# Read and execute migration SQL
$sqlFile = Join-Path $PSScriptRoot "backend\add_tax_receipts_schema.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Error "Migration file not found: $sqlFile"
    exit 1
}

# Execute SQL file
Write-Host "Executing migration script..." -ForegroundColor Yellow
$cmd = "docker exec -i rental-mysql mysql -u$DbUser -p$DbPass $DbName < `"$sqlFile`""
Invoke-Expression $cmd 2>&1 | ForEach-Object {
    if ($_ -match "ERROR") {
        Write-Error $_
    } else {
        Write-Host $_ -ForegroundColor Gray
    }
}

# Verify tables were created
Write-Host ""
Write-Host "Step 5: Verifying migration..." -ForegroundColor Yellow
$tablesAfter = docker exec rental-mysql mysql -u$DbUser -p$DbPass $DbName -e "SHOW TABLES;" 2>&1

$allTablesCreated = $true
foreach ($table in $newTables) {
    if ($tablesAfter -match $table) {
        Write-Host "  [OK] Table '$table' exists" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] Table '$table' not found" -ForegroundColor Red
        $allTablesCreated = $false
    }
}

Write-Host ""
Write-Host "Step 6: Checking data integrity..." -ForegroundColor Yellow

# Count existing records
$dataCheck = @{
    "properties" = docker exec rental-mysql mysql -u$DbUser -p$DbPass $DbName -e "SELECT COUNT(*) FROM properties;" 2>&1 | Select-Object -Last 1
    "tenants" = docker exec rental-mysql mysql -u$DbUser -p$DbPass $DbName -e "SELECT COUNT(*) FROM tenants;" 2>&1 | Select-Object -Last 1
    "collections" = docker exec rental-mysql mysql -u$DbUser -p$DbPass $DbName -e "SELECT COUNT(*) FROM collections;" 2>&1 | Select-Object -Last 1
    "tax_filings" = docker exec rental-mysql mysql -u$DbUser -p$DbPass $DbName -e "SELECT COUNT(*) FROM tax_filings;" 2>&1 | Select-Object -Last 1
}

Write-Host ""
Write-Host "Data Summary:" -ForegroundColor Cyan
foreach ($table in $dataCheck.Keys) {
    Write-Host "  $table : $($dataCheck[$table]) records"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allTablesCreated) {
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "New API endpoints available:" -ForegroundColor Cyan
    Write-Host "  - GET /api/tax/calculate/:assessmentYear" -ForegroundColor White
    Write-Host "  - POST /api/tax/filing" -ForegroundColor White
    Write-Host "  - GET /api/tax/filings" -ForegroundColor White
    Write-Host "  - POST /api/receipts/generate" -ForegroundColor White
    Write-Host "  - POST /api/receipts/generate-bulk" -ForegroundColor White
    Write-Host "  - GET /api/receipts" -ForegroundColor White
    Write-Host "  - GET /api/tds-report-detailed" -ForegroundColor White
} else {
    Write-Host "Migration completed with warnings!" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Next steps
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Rebuild Docker containers: docker-compose up -d --build" -ForegroundColor White
Write-Host "2. Test API endpoints" -ForegroundColor White
Write-Host "3. Run backup to test new tables: Invoke-WebRequest http://localhost:5000/api/backup/export" -ForegroundColor White
