@echo off
REM Build Android APK in Docker and extract it

echo =========================================
echo RentalManager Android APK Builder
echo =========================================

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not running or not installed
    exit /b 1
)

REM Build the Android builder image
echo.
echo Building Android build environment...
docker build -f android-builder.multistage.Dockerfile -t rentalmanager-android-builder .
if %errorlevel% neq 0 (
    echo Error: Docker build failed
    exit /b 1
)

REM Create a container to extract the APK
echo.
echo Extracting built APK...
for /f "tokens=*" %%a in ('docker create rentalmanager-android-builder') do set CONTAINER_ID=%%a

docker cp %CONTAINER_ID%:/output/rentalmanager.apk rentalmanager.apk
docker rm %CONTAINER_ID%

REM Check if APK was created
if exist "rentalmanager.apk" (
    echo.
    echo =========================================
    echo [OK] APK built successfully!
    echo Location: rentalmanager.apk
    for %%I in (rentalmanager.apk) do echo Size: %%~zI bytes
    echo =========================================
    echo.
    echo To install on device:
    echo   adb install rentalmanager.apk
    echo.
    echo Or transfer to your Android device and install manually
) else (
    echo Error: APK build failed
    exit /b 1
)
