#!/bin/bash
# RentalManager Android APK Build Script
# Run this in the frontend directory after npm install

echo "Building RentalManager Android App..."

# Install dependencies
npm install

# Build the React app for production
npm run build

# Initialize Capacitor (if not already done)
if [ ! -d "android" ]; then
  echo "Adding Android platform..."
  npx cap add android
fi

# Sync web code to Android project
npx cap sync

echo ""
echo "Android project ready at: frontend/android/"
echo ""
echo "To build APK:"
echo "1. Open Android Studio"
echo "2. Open folder: frontend/android"
echo "3. Build > Build Bundle(s) / APK(s) > Build APK(s)"
echo ""
echo "Or run: cd android && ./gradlew assembleRelease"
