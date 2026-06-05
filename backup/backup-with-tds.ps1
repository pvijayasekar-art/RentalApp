# Rental Manager Backup Script with TDS Support
# This script creates a complete backup including TDS data

Write-Host "=== Rental Manager Backup (with TDS) ===" -ForegroundColor Green
Write-Host ""

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

# Create backup directory
$backupDir = "D:\Learnings\claude\RentalManager\backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

# Generate timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = "$backupDir\rental-backup-$timestamp.json"
$backupSql = "$backupDir\backup-with-tds.sql"

Write-Host "Creating backup..." -ForegroundColor Yellow

# Get current statistics before backup
Write-Host "Current database statistics:" -ForegroundColor Cyan
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
    SELECT 'TDS Deposits', COUNT(*) FROM tds_deposits
    UNION ALL
    SELECT 'Handover Items', COUNT(*) FROM tenant_handover_items;
" 2>&1

# Run SQL backup script
Write-Host "Creating SQL backup..." -ForegroundColor Yellow
docker exec -i rental-mysql mysql -uroot -prentalpass123 rental_db < D:\Learnings\claude\RentalManager\backup\backup_with_tds.sql 2>&1

# Create JSON backup via API
Write-Host "Creating JSON backup..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/backup/export" -Method Get -TimeoutSec 30
    $backupData = $response.Content | ConvertFrom-Json
    
    # Save backup to file
    $backupData | ConvertTo-Json -Depth 10 | Out-File -FilePath $backupFile -Encoding utf8
    
    Write-Host ""
    Write-Host "=== Backup Completed Successfully! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backup files created:" -ForegroundColor Cyan
    Write-Host "  SQL: $backupSql" -ForegroundColor White
    Write-Host "  JSON: $backupFile" -ForegroundColor White
    Write-Host ""
    Write-Host "Backup summary:" -ForegroundColor Cyan
    Write-Host "  Version: $($backupData.version)" -ForegroundColor White
    Write-Host "  Exported at: $($backupData.exported_at)" -ForegroundColor White
    Write-Host "  Properties: $($backupData.tables.properties.Count)" -ForegroundColor White
    Write-Host "  Tenants: $($backupData.tables.tenants.Count)" -ForegroundColor White
    Write-Host "  Tenants with TDS: $($backupData.tables.tenants.Where({$_.tds_applicable}).Count)" -ForegroundColor White
    Write-Host "  Collections: $($backupData.tables.collections.Count)" -ForegroundColor White
    Write-Host "  Expenses: $($backupData.tables.expenses.Count)" -ForegroundColor White
    Write-Host "  TDS Deposits: $($backupData.tables.tds_deposits.Count)" -ForegroundColor White
    Write-Host "  Handover Items: $($backupData.tables.tenant_handover_items.Count)" -ForegroundColor White
    
    # Calculate totals
    $totalCollections = ($backupData.tables.collections | Measure-Object -Property amount -Sum).Sum
    $totalExpenses = ($backupData.tables.expenses | Measure-Object -Property amount -Sum).Sum
    $totalTDS = ($backupData.tables.tds_deposits | Measure-Object -Property tds_amount -Sum).Sum
    
    Write-Host ""
    Write-Host "Financial summary:" -ForegroundColor Cyan
    Write-Host "  Total Collections: ₹$($totalCollections:N2)" -ForegroundColor Green
    Write-Host "  Total Expenses: ₹$($totalExpenses:N2)" -ForegroundColor Red
    Write-Host "  Total TDS Amount: ₹$($totalTDS:N2)" -ForegroundColor Yellow
    Write-Host "  Net Income: ₹$(($totalCollections - $totalExpenses):N2)" -ForegroundColor White
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to create JSON backup!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Backup files are saved in: $backupDir" -ForegroundColor White
Write-Host "2. Use restore-with-tds.ps1 to restore from backup" -ForegroundColor White
Write-Host "3. Keep backup files in a safe location" -ForegroundColor White
