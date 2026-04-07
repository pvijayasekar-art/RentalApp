# RentalManager Android App Build Guide

## Overview
This Android app is built using **Capacitor** to wrap the existing React web app into a native Android application. The app supports Android 6.0+ (API level 23+) devices.

## Prerequisites

### Required Software
1. **Node.js 18+** with npm - [Download](https://nodejs.org/)
2. **Android Studio** (latest version) - [Download](https://developer.android.com/studio)
3. **Java JDK 17** - Download and install OpenJDK or Oracle JDK
4. **Android SDK** (installed via Android Studio)

### Environment Variables
Set these system environment variables:
```
ANDROID_HOME=C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk
JAVA_HOME=C:\Program Files\Java\jdk-17
```

Add to PATH:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
%JAVA_HOME%\bin
```

## Quick Build Instructions

### Option 1: Using Build Script (Recommended)

1. Open PowerShell or Command Prompt
2. Navigate to the frontend directory:
   ```powershell
   cd d:\Learnings\claude\RentalManager\frontend
   ```

3. Run the build script:
   ```powershell
   .\build-android.bat
   ```

### Option 2: Manual Build Steps

1. **Install dependencies:**
   ```powershell
   cd d:\Learnings\claude\RentalManager\frontend
   npm install
   ```

2. **Build the React app:**
   ```powershell
   npm run build
   ```

3. **Sync Capacitor:**
   ```powershell
   npx cap sync
   ```

4. **Open in Android Studio:**
   ```powershell
   npx cap open android
   ```

5. **Build APK in Android Studio:**
   - Wait for Gradle sync to complete
   - Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
   - APK will be generated at: `android/app/build/outputs/apk/debug/app-debug.apk`

## Build Release APK (For Distribution)

### Step 1: Generate Signing Key
```powershell
cd android
keytool -genkey -v -keystore rentalmanager.keystore -alias rentalmanager -keyalg RSA -keysize 2048 -validity 10000
```

### Step 2: Configure Signing
Create `android/app/rentalmanager.properties`:
```
storeFile=../rentalmanager.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=rentalmanager
keyPassword=YOUR_KEY_PASSWORD
```

### Step 3: Build Release APK
In Android Studio:
- **Build** → **Generate Signed Bundle / APK**
- Select **APK**
- Choose your keystore
- Select **release** build type
- Click **Finish**

Or via command line:
```powershell
cd android
.\gradlew assembleRelease
```

Release APK location: `android/app/build/outputs/apk/release/app-release.apk`

## App Configuration

### Backend API Connection
The Android app connects to your backend API. Update the API URL in `src/App.jsx`:

```javascript
// For local development with Android emulator
const API = 'http://10.0.2.2:5000';  // Android emulator localhost

// For physical device on same network
const API = 'http://YOUR_COMPUTER_IP:5000';

// For production server
const API = 'https://your-api-server.com';
```

### Android Permissions
The following permissions are configured in `AndroidManifest.xml`:
- **INTERNET** - Required for API communication
- **CAMERA** - For document scanning/upload
- **READ_EXTERNAL_STORAGE** - For file uploads (Android 6-12)
- **WRITE_EXTERNAL_STORAGE** - For file downloads (Android 6-9)
- **READ_MEDIA_IMAGES** - For file uploads (Android 13+)

### Supported Android Versions
- **Minimum SDK**: 23 (Android 6.0 Marshmallow)
- **Target SDK**: 34 (Android 14)
- **Compile SDK**: 34

## Troubleshooting

### Build Errors

**Error: "SDK location not found"**
- Set `ANDROID_HOME` environment variable
- Restart Android Studio

**Error: "Gradle sync failed"**
```powershell
cd android
.\gradlew clean
.\gradlew build
```

**Error: "Cannot find module '@capacitor/...'"**
```powershell
npm install @capacitor/core @capacitor/android @capacitor/camera @capacitor/filesystem
npx cap sync
```

### Device Connection

**Physical Device:**
1. Enable **Developer Options** on Android device
2. Enable **USB Debugging**
3. Connect via USB
4. Allow computer's RSA key fingerprint
5. Select device in Android Studio

**Emulator:**
- Use Android Studio's AVD Manager
- Create device with API 23+ (Android 6.0+)
- Recommended: Pixel 4 with Android 13/14

### Network Issues

If the app can't connect to backend:
1. Ensure backend is running: `docker-compose up -d backend`
2. Check Windows Firewall allows port 5000
3. For physical device: use computer's actual IP address
4. For emulator: use `10.0.2.2` for localhost

## Installing the APK

### Method 1: Android Studio
- Connect device or start emulator
- Click **Run** button (green play icon)

### Method 2: ADB Command
```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

### Method 3: Manual Install
1. Transfer APK to device (USB, email, cloud storage)
2. On device, enable **Install unknown apps** for file manager
3. Open APK file and install

## App Features

The Android app includes all web features:
- ✅ Property Management
- ✅ Tenant Management with KYC
- ✅ Document Upload (Camera & Gallery)
- ✅ OCR Document Scanning
- ✅ Rent Collections
- ✅ Expense Tracking
- ✅ General Ledger
- ✅ AI Predictions
- ✅ Dashboard & Analytics
- ✅ Offline support (with sync)

## Updating the App

After making changes to the web app:
1. Rebuild: `npm run build`
2. Sync: `npx cap sync`
3. Rebuild APK in Android Studio

## File Structure

```
frontend/
├── android/                    # Android project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/rentalmanager/app/
│   │   │   │   └── MainActivity.java
│   │   │   ├── res/           # Android resources
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle       # App-level build config
│   ├── build.gradle           # Project-level build config
│   └── settings.gradle
├── src/
│   └── App.jsx               # React app
├── capacitor.config.json     # Capacitor configuration
├── build-android.bat         # Windows build script
├── build-android.sh          # Linux/Mac build script
└── package.json
```

## Support

For issues:
1. Check Android Studio's **Build** output
2. Review `android/app/build/outputs/logs/`
3. Test web app first: `npm run dev`
4. Verify backend API is accessible
