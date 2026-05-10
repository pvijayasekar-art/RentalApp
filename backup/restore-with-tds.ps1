# Rental Manager Restore Script with TDS Support
# This script restores data from backup including TDS data
# WARNING: This will replace all existing data!

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

Write-Host "=== Rental Manager Restore (with TDS) ===" -ForegroundColor Green
Write-Host ""

# Validate backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "ERROR: Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

# Check if Docker containers are running
Write-Host "Checking Docker containers..." -ForegroundColor Yellow
$containers = docker ps --format "{{.Names}}" | Select-String -Pattern "rental-mysql|rental-backend|rental-frontend"

if ($containers.Count -lt 3) {
    Write-Host "ERROR: Not all containers are running!" -ForegroundColor Red
    Write-Host "Starting containers..." -ForegroundColor Yellow
    docker-compose up -d
    Start-Sleep -Seconds 10
}

Write-Host "Containers status:" -ForegroundColor Green
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""

# Wait for MySQL to be ready
Write-Host "Waiting for MySQL to be ready..." -ForegroundColor Yellow
$mysqlReady = $false
$retries = 0
while (-not $mysqlReady -and $retries -lt 10) {
    try {
        $result = docker exec rental-mysql mysql -uroot -prentalpass123 -e "SELECT 1" 2>&1
        if ($result -match "1") {
            $mysqlReady = $true
            Write-Host "MySQL is ready!" -ForegroundColor Green
        }
    } catch {
        Write-Host "MySQL not ready yet, retrying... ($retries/10)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        $retries++
    }
}

if (-not $mysqlReady) {
    Write-Host "ERROR: MySQL failed to start!" -ForegroundColor Red
    exit 1
}

# Show current database state before restore
Write-Host "Current database state before restore:" -ForegroundColor Cyan
docker exec rental-mysql mysql -uroot -prentalpass123 rental_db -e "
    SELECT 
        'Properties' as table_name, COUNT(*) as count FROM properties
    UNION ALL
    SELECT 'Tenants', COUNT(*) FROM tenants
    UNION ALL
    SELECT 'Tenants with TDS', COUNT(*) FROM tenants WHERE tds_applicable = TRUE
    UNION ALL
    SELECT 'Collections', COUNT(*) FROM collections
    UNION ALL
    SELECT 'Expenses', COUNT(*) FROM expenses
    UNION ALL
    SELECT 'TDS Deposits', COUNT(*) FROM tds_deposits;
" 2>&1

# Confirm restore
Write-Host ""
Write-Host "WARNING: This will replace ALL existing data!" -ForegroundColor Red
Write-Host "Backup file: $BackupFile" -ForegroundColor Yellow
$confirm = Read-Host "Do you want to continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Restore cancelled." -ForegroundColor Yellow
    exit 0
}

# Load backup file
try {
    $backupData = Get-Content $BackupFile | ConvertFrom-Json
    Write-Host "Backup loaded successfully" -ForegroundColor Green
    Write-Host "Version: $($backupData.version)" -ForegroundColor White
    Write-Host "Exported at: $($backupData.exported_at)" -ForegroundColor White
} catch {
    Write-Host "ERROR: Failed to load backup file!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Perform restore via API
Write-Host "Restoring data..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/backup/restore" -Method Post -Body ($backupData | ConvertTo-Json -Depth 10) -ContentType "application/json" -TimeoutSec 60
    
    if ($response.StatusCode -eq 200) {
        Write-Host ""
        Write-Host "=== Restore Completed Successfully! ===" -ForegroundColor Green
        Write-Host ""
        
        # Show restored data summary
        Write-Host "Restored data summary:" -ForegroundColor Cyan
        Write-Host "  Properties: $($backupData.tables.properties.Count)" -ForegroundColor White
        Write-Host "  Tenants: $($backupData.tables.tenants.Count)" -ForegroundColor White
        Write-Host "  Tenants with TDS: $($backupData.tables.tenants.Where({$_.tds_applicable}).Count)" -ForegroundColor White
        Write-Host "  Collections: $($backupData.tables.collections.Count)" -ForegroundColor White
        Write-Host "  Expenses: $($backupData.tables.expenses.Count)" -ForegroundColor White
        
        if ($backupData.tables.tds_deposits) {
            Write-Host "  TDS Deposits: $($backupData.tables.tds_deposits.Count)" -ForegroundColor White
        }
        
        # Calculate financial totals
        $totalCollections = ($backupData.tables.collections | Measure-Object -Property amount -Sum).Sum
        $totalExpenses = ($backupData.tables.expenses | Measure-Object -Property amount -Sum).Sum
        $totalTDS = if ($backupData.tables.tds_deposits) { ($backupData.tables.tds_deposits | Measure-Object -Property tds_amount -Sum).Sum } else { 0 }
        
        Write-Host ""
        Write-Host "Financial summary restored:" -ForegroundColor Cyan
        Write-Host "  Total Collections: ₹$($totalCollections:N2)" -ForegroundColor Green
        Write-Host "  Total Expenses: ₹$($totalExpenses:N2)" -ForegroundColor Red
        Write-Host "  Total TDS Amount: ₹$($totalTDS:N2)" -ForegroundColor Yellow
        Write-Host "  Net Income: ₹$(($totalCollections - $totalExpenses):N2)" -ForegroundColor White
        
        # Verify restore
        Write-Host ""
        Write-Host "Verifying restore..." -ForegroundColor Yellow
        docker exec rental-mysql mysql -uroot -prentalpass123 rental_db -e "
            SELECT 
                'Properties' as table_name, COUNT(*) as count FROM properties
            UNION ALL
            SELECT 'Tenants', COUNT(*) FROM tenants
            UNION ALL
            SELECT 'Tenants with TDS', COUNT(*) FROM tenants WHERE tds_applicable = TRUE
            UNION ALL
            SELECT 'Collections', COUNT(*) FROM collections
            UNION ALL
            SELECT 'Expenses', COUNT(*) FROM expenses
            UNION ALL
            SELECT 'TDS Deposits', COUNT(*) FROM tds_deposits;
        " 2>&1
        
        Write-Host ""
        Write-Host "Restore completed successfully!" -ForegroundColor Green
        Write-Host "Please restart the backend container to ensure all data is loaded:" -ForegroundColor Cyan
        Write-Host "  docker-compose restart backend" -ForegroundColor White
        
    } else {
        Write-Host "ERROR: Restore failed with status code $($response.StatusCode)" -ForegroundColor Red
        Write-Host "Response: $($response.Content)" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to restore data!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
