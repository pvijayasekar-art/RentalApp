@echo off
REM Install APK into Android Emulator

echo =========================================
echo Installing RentalManager APK into Emulator
echo =========================================
echo.

REM Check if emulator is running
docker ps | findstr "rental-android-emulator" >nul
if %errorlevel% neq 0 (
    echo Error: Emulator is not running
    echo Start it first with: start-emulator.bat
    exit /b 1
)

REM Check if APK exists
if not exist "rentalmanager.apk" (
    echo Error: rentalmanager.apk not found
    echo Build it first with: docker-compose up android-builder
    exit /b 1
)

echo Waiting for emulator to be fully booted...
:wait_loop
for /f "tokens=*" %%a in ('docker exec rental-android-emulator adb shell getprop sys.boot_completed 2^>nul') do (
    if "%%a"=="1" goto :booted
)
echo|set /p=."
timeout /t 2 /nobreak >nul
goto :wait_loop

:booted
echo.
echo [OK] Emulator fully booted
echo.
echo Installing APK...
docker exec rental-android-emulator adb install -r /apk/rentalmanager.apk

if %errorlevel% equ 0 (
    echo.
    echo =========================================
    echo [OK] APK installed successfully!
    echo.
    echo Access the emulator at:
    echo   http://localhost:6080
    echo.
    echo The app should appear on the emulator home screen
    echo Look for 'RentalManager' app icon
    echo =========================================
) else (
    echo.
    echo Error: Failed to install APK
    echo Check emulator status: docker logs rental-android-emulator
    exit /b 1
)
