@echo off
REM RentalManager Android APK Build Script
REM Run this in the frontend directory after npm install

echo Building RentalManager Android App...

REM Install dependencies
call npm install

REM Build the React app for production
call npm run build

REM Initialize Capacitor (if not already done)
if not exist "android" (
  echo Adding Android platform...
  call npx cap add android
)

REM Sync web code to Android project
call npx cap sync

echo.
echo Android project ready at: frontend\android\
echo.
echo To build APK:
echo 1. Open Android Studio
echo 2. Open folder: frontend\android
echo 3. Build ^> Build Bundle(s) / APK(s) ^> Build APK(s)
echo.
echo Or run: cd android ^&^& .\gradlew assembleRelease
pause
