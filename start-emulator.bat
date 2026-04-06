@echo off
REM Start Android Emulator with all services

echo =========================================
echo Starting RentalManager with Android Emulator
echo =========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not running
    exit /b 1
)

REM Start core services
echo Starting MySQL, Backend, and Frontend...
docker-compose up -d mysql backend frontend

REM Wait for backend
echo.
echo Waiting for backend to be ready...
timeout /t 5 /nobreak >nul

REM Start Android emulator
echo.
echo Starting Android Emulator (Samsung Galaxy S10)...
echo This may take 2-3 minutes on first run...
docker-compose --profile emulator up -d android-emulator

REM Wait for emulator
echo.
echo Waiting for emulator to boot...
echo You can watch the boot progress at: http://localhost:6080
echo.
timeout /t 10 /nobreak >nul

echo Checking emulator status...
:check_loop
for /f "tokens=*" %%a in ('docker exec rental-android-emulator adb devices 2^>nul ^| findstr emulator') do (
    echo [OK] Emulator is ready!
    goto :done
)
echo|set /p=."
timeout /t 5 /nobreak >nul
goto :check_loop

:done
echo.
echo =========================================
echo Services Started:
echo   - Web App:      http://localhost:3000
echo   - Backend API:  http://localhost:5000
echo   - Emulator VNC: http://localhost:6080
echo.
echo Install APK:
echo   install-apk-emulator.bat
echo =========================================
