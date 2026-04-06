# Docker Android Build Environment

## Overview
Build and run the RentalManager Android APK entirely within Docker containers. No need to install Android Studio or SDK locally.

## Services

### 1. Web Application (Existing)
- **mysql**: Database service
- **backend**: Node.js API server (port 5000)
- **frontend**: React web app (port 3000)

### 2. Android Services (New)
- **android-builder**: Builds APK from React/Capacitor code
- **android-emulator** (optional): Runs Android emulator with VNC access

## Quick Start

### Build APK Only
```bash
# Build the APK in Docker
docker-compose up android-builder

# Or use the build script
./build-apk.sh        # Linux/Mac
./build-apk.bat       # Windows
```

The APK will be available at: `./android-output/rentalmanager.apk`

### Run Web + Android Builder
```bash
# Start all services including Android builder
docker-compose up -d mysql backend frontend android-builder

# Check Android build logs
docker-compose logs -f android-builder
```

### Run Android Emulator (For Testing)
```bash
# Start emulator with web interface
docker-compose --profile emulator up -d android-emulator

# Access Android emulator in browser
open http://localhost:6080

# Install the built APK into emulator
adb -H localhost -P 5555 install android-output/rentalmanager.apk
```

## Accessing Services

| Service | URL | Description |
|---------|-----|-------------|
| Web App | http://localhost:3000 | React frontend |
| API | http://localhost:5000 | Backend API |
| Android VNC | http://localhost:6080 | Android emulator (if running) |
| APK Output | ./android-output/ | Built APK file |

## Commands Reference

### Build APK
```bash
docker-compose up android-builder
```

### Build Release APK
```bash
docker-compose run --rm android-builder sh -c "
  cd /app/frontend/android &&
  ./gradlew assembleRelease
"
```

### Copy APK to device
```bash
# Via ADB
adb install android-output/rentalmanager.apk

# Or manually transfer to Android device
```

### Clean Android build
```bash
docker-compose down -v
docker volume rm rentalmanager_android_output
rm -rf android-output/
```

## Troubleshooting

### Build fails with "SDK not found"
The android-builder container includes the full Android SDK. If builds fail:
```bash
docker-compose build --no-cache android-builder
docker-compose up android-builder
```

### APK not created
Check the build logs:
```bash
docker-compose logs android-builder
```

### Emulator won't start
The emulator requires:
1. Linux host with KVM support, OR
2. Windows with WSL2 and virtualization enabled
3. macOS with virtualization framework

Alternative: Use the built APK on a physical device instead.

### Out of disk space
Android builds require significant space. Clean up:
```bash
docker system prune -a
docker volume prune
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Environment                        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  mysql   │  │ backend  │  │ frontend │                 │
│  │  :3306   │  │  :5000   │  │  :3000   │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
│                                                              │
│  ┌────────────────────────────────────────┐                │
│  │      android-builder                   │                │
│  │  ┌─────────────┐  ┌──────────────┐    │                │
│  │  │ Node.js     │  │ Android SDK  │    │                │
│  │  │ Build web   │  │ Build APK    │───▶│───▶ ./android-output/
│  │  └─────────────┘  └──────────────┘    │                │
│  └────────────────────────────────────────┘                │
│                                                              │
│  ┌────────────────────────────────────────┐  (Optional)    │
│  │      android-emulator                  │                │
│  │  ┌──────────────────────────────────┐  │                │
│  │  │ Android Emulator (Samsung S10) │  │                │
│  │  │ VNC Web Interface :6080          │  │                │
│  │  └──────────────────────────────────┘  │                │
│  └────────────────────────────────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Notes

- The android-builder creates a debug APK by default
- Release builds require signing keystore configuration
- APK is compatible with Android 6.0+ (API level 23+)
- The android-emulator is optional and disabled by default
- Total build time: ~10-15 minutes first time (downloads SDK)
