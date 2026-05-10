# Safe TDS Migration Script
# This script applies TDS schema changes without corrupting existing data

Write-Host "=== Rental Manager TDS Migration ===" -ForegroundColor Green
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
        $result = docker exec rental-mysql mysql -uroot -prootpassword -e "SELECT 1" 2>&1
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

# Check current tenant count
Write-Host ""
Write-Host "Current database status:" -ForegroundColor Green
docker exec rental-mysql mysql -uroot -prootpassword rental_db -e "SELECT COUNT(*) as total_tenants FROM tenants;" 2>&1
docker exec rental-mysql mysql -uroot -prootpassword rental_db -e "SELECT COUNT(*) as tds_applicable FROM tenants WHERE monthly_rent > 50000;" 2>&1
Write-Host ""

# Run the safe migration
Write-Host "Applying TDS migration..." -ForegroundColor Yellow
docker exec -i rental-mysql mysql -uroot -prootpassword rental_db < D:\Learnings\claude\RentalManager\backend\migration_tds.sql 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Migration Completed Successfully! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Cyan
    docker exec rental-mysql mysql -uroot -prootpassword rental_db -e "
        SELECT 
            COUNT(*) as total_tenants,
            SUM(CASE WHEN tds_applicable = TRUE THEN 1 ELSE 0 END) as tds_tenants,
            SUM(CASE WHEN monthly_rent > 50000 AND tds_applicable = FALSE THEN 1 ELSE 0 END) as needs_manual_update
        FROM tenants;
    " 2>&1
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Open http://localhost:3000 in your browser" -ForegroundColor White
    Write-Host "2. Edit tenants with rent > 50,000 to enable TDS tracking" -ForegroundColor White
    Write-Host "3. Use the 'TDS Report' menu to track deposits" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "ERROR: Migration failed!" -ForegroundColor Red
    Write-Host "Check the error messages above." -ForegroundColor Red
}
