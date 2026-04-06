# Testing RentalManager APK on Windows

Since Docker Android emulators require Linux KVM (not available on Windows), use these Windows-compatible alternatives to test your APK.

## Built APK Location
```
C:\Users\pveja\Downloads\rentalmanager.apk
```

---

## Option 1: MEMU Play (Recommended)
**MEMU** is a free Android emulator for Windows that works without KVM.

### Installation
1. Download MEMU from: https://www.memuplay.com/
2. Install MEMU Play
3. Launch MEMU Play

### Install APK in MEMU
**Method A: Drag & Drop**
1. Drag `rentalmanager.apk` onto the MEMU window
2. APK installs automatically

**Method B: ADB**
```powershell
# MEMU ADB runs on port 21503 by default
adb connect 127.0.0.1:21503
adb install C:\Users\pveja\Downloads\rentalmanager.apk
```

**Method C: Built-in APK Installer**
1. In MEMU, click "APK" icon on sidebar
2. Browse to `Downloads\rentalmanager.apk`
3. Select and install

### Configure Backend IP in MEMU
The Android app needs to connect to your backend. Since MEMU is on the same computer:

**Option A: Use 10.0.2.2 (MEMU localhost)**
The app already uses `10.131.144.64:5000`. For MEMU, update to use your actual IP or `10.0.2.2` for MEMU's localhost.

**Option B: Use your computer's IP**
The current APK uses `10.131.144.64:5000` - make sure this IP is still correct:
```powershell
ipconfig | findstr "IPv4"
```

---

## Option 2: BlueStacks (Popular)
BlueStacks is another free Android emulator for Windows.

### Installation
1. Download from: https://www.bluestacks.com/
2. Install and launch BlueStacks

### Install APK
- Drag `rentalmanager.apk` onto BlueStacks window
- Or use BlueStacks built-in APK installer

---

## Option 3: Android Studio (Official)
Official Android emulator with Intel HAXM support.

### Requirements
- Windows 10/11
- Intel CPU with VT-x or AMD with AMD-V

### Installation
1. Download Android Studio: https://developer.android.com/studio
2. Install → Tools → SDK Manager → SDK Tools
3. Install "Intel x86 Emulator Accelerator (HAXM installer)"
4. Tools → Device Manager → Create Device → Pixel 4

### Install APK
```powershell
# Start emulator, then:
adb devices
adb install C:\Users\pveja\Downloads\rentalmanager.apk
```

---

## Option 4: Windows Subsystem for Android (WSA)
For Windows 11 only - Microsoft's official Android layer.

### Installation
1. Open Microsoft Store
2. Install "Amazon Appstore" (includes WSA)
3. Enable developer mode in WSA settings

### Install APK
```powershell
adb connect 127.0.0.1:58526
adb install C:\Users\pveja\Downloads\rentalmanager.apk
```

---

## Option 5: Physical Android Device
Most reliable method - use your actual phone.

### Setup
1. Enable "Developer options" on Android:
   - Settings → About phone → Tap "Build number" 7 times
2. Enable "USB debugging":
   - Settings → Developer options → USB debugging
3. Connect phone via USB

### Install APK
```powershell
# Verify connection
adb devices

# Install APK
adb install C:\Users\pveja\Downloads\rentalmanager.apk
```

---

## Option 6: Online Emulator (No Install)
Test APK instantly in browser without installing anything.

### Appetize.io
1. Go to: https://appetize.io/upload
2. Upload `rentalmanager.apk`
3. Test in browser instantly

**Note:** Free tier has time limits.

---

## Backend Connectivity

Make sure backend is accessible from the emulator:

### Check Backend is Running
```powershell
docker-compose ps backend
curl http://10.131.144.64:5000/api/dashboard
```

### Firewall (If needed)
```powershell
# Run as Administrator
netsh advfirewall firewall add rule name="RentalManager API" dir=in action=allow protocol=tcp localport=5000
```

### For Emulators on Same Computer
Use `10.0.2.2` as the backend IP - this is the emulator's localhost pointing to your computer.

Update `frontend/src/App.mobile.jsx`:
```javascript
const API_BASE = isAndroid 
  ? "http://10.0.2.2:5000"  // For emulators on same computer
  : "/api";
```

Then rebuild APK.

---

## Quick Commands

### Build APK
```powershell
docker-compose build android-builder
```

### Copy to Downloads
```powershell
Copy-Item rentalmanager.apk $env:USERPROFILE\Downloads\rentalmanager.apk -Force
```

### Check APK
```powershell
Get-Item $env:USERPROFILE\Downloads\rentalmanager.apk
```

---

## Troubleshooting

### "App not installed" error
- APK may be incompatible with emulator Android version
- Try different emulator (Android 11+ recommended)

### "Cannot connect to backend"
- Verify backend IP in `App.mobile.jsx`
- Check firewall settings
- Ensure phone/emulator is on same network

### MEMU/BlueStacks slow
- Enable virtualization in BIOS (Intel VT-x / AMD-V)
- Allocate more RAM to emulator
- Close other applications

---

## Summary

| Emulator | KVM Required | Best For |
|----------|-------------|----------|
| **MEMU Play** | ❌ No | Windows users (recommended) |
| **BlueStacks** | ❌ No | Gaming, general use |
| **Android Studio** | ❌ No* | Developers |
| **WSA** | ❌ No | Windows 11 users |
| **Physical Device** | ❌ No | Most reliable testing |
| **Docker Emulator** | ✅ Yes | Linux only (not Windows) |

*Android Studio uses Intel HAXM instead

**Recommendation:** Use **MEMU Play** or **BlueStacks** for easy Windows testing.
