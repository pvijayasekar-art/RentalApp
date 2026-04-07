# Rental Manager - Android App

A Jetpack Compose-based Android application for managing rental properties, built to work with the Rental Manager backend API.

## Features

- **Dashboard**: Overview of your rental portfolio with stats, recent collections, expenses, and monthly trends
- **Properties**: Manage properties with details like type, units, rent, and status
- **Tenants**: Track tenant information, lease dates, documents, and emergency contacts
- **Collections**: Record rent payments with support for different payment methods
- **Expenses**: Track maintenance, repairs, utilities, and other property expenses
- **Predictions**: AI-powered forecasts for income, expenses, and recommendations
- **Ledger**: Comprehensive financial records with GST and TDS tracking

## Tech Stack

- **UI Framework**: Jetpack Compose with Material Design 3
- **Architecture**: MVVM with Hilt for dependency injection
- **Networking**: Retrofit + OkHttp with Gson serialization
- **Async**: Kotlin Coroutines
- **Charts**: Vico for data visualization
- **API**: Connects to Rental Manager backend at `http://10.0.2.2:5000` (Android emulator localhost)

## Project Structure

```
android-app/
├── app/
│   ├── src/main/java/com/rentalmanager/app/
│   │   ├── MainActivity.kt              # App entry point
│   │   ├── RentalManagerApplication.kt   # Application class
│   │   ├── data/
│   │   │   ├── api/                     # API service interfaces
│   │   │   ├── model/                   # Data models
│   │   │   └── repository/              # Data repositories
│   │   ├── di/
│   │   │   └── NetworkModule.kt         # Hilt DI configuration
│   │   ├── ui/
│   │   │   ├── navigation/              # Navigation setup
│   │   │   ├── screens/                 # UI screens
│   │   │   ├── theme/                   # App theme & colors
│   │   │   └── viewmodel/               # ViewModels
│   │   └── ...
│   └── build.gradle                     # App-level build config
├── build.gradle                         # Project-level build config
├── settings.gradle                      # Project settings
└── gradle/                              # Gradle wrapper
```

## Getting Started

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17 or newer
- Android SDK 34
- Backend server running (see main project README)

### Setup

1. **Open in Android Studio**:
   - File → Open → Select `android-app` folder
   - Let Gradle sync complete

2. **Configure Backend URL** (if needed):
   - Edit `app/src/main/java/com/rentalmanager/app/di/NetworkModule.kt`
   - Update `BASE_URL` to match your backend IP/hostname
   - Default: `http://10.0.2.2:5000` (Android emulator localhost)

3. **Run the app**:
   - Select emulator or device
   - Click Run (▶) or press Shift+F10

### For Physical Device

If running on a physical device, update the BASE_URL in NetworkModule.kt:

```kotlin
private const val BASE_URL = "http://YOUR_BACKEND_IP:5000"
```

Also ensure your AndroidManifest.xml has:
```xml
android:usesCleartextTraffic="true"
```

## Navigation

The app uses bottom navigation with 5 main sections:
- **Dashboard** - Portfolio overview
- **Properties** - Property management
- **Tenants** - Tenant management
- **Collections** - Payment tracking
- **Forecast** - Predictions & analytics

## UI Design

The app follows Material Design 3 principles with:
- Dynamic color support (Android 12+)
- Light & Dark themes
- Responsive layouts for phones and tablets
- Smooth animations and transitions
- Consistent with web app styling

## Screenshots

(Coming soon)

## Building Release APK

```bash
./gradlew assembleRelease
```

The APK will be at: `app/build/outputs/apk/release/app-release.apk`

## Contributing

This Android app is part of the Rental Manager project. Web changes should not affect this codebase.

## License

Same as main project
