#!/bin/bash
# Build Android APK in Docker and extract it

set -e

echo "========================================="
echo "RentalManager Android APK Builder"
echo "========================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running or not installed"
    exit 1
fi

# Build the Android builder image
echo ""
echo "Building Android build environment..."
docker build -f android-builder.multistage.Dockerfile -t rentalmanager-android-builder .

# Create a container to extract the APK
echo ""
echo "Extracting built APK..."
CONTAINER_ID=$(docker create rentalmanager-android-builder)
docker cp $CONTAINER_ID:/output/rentalmanager.apk ./rentalmanager.apk
docker rm $CONTAINER_ID

# Check if APK was created
if [ -f "rentalmanager.apk" ]; then
    echo ""
    echo "========================================="
    echo "✓ APK built successfully!"
    echo "Location: ./rentalmanager.apk"
    echo "Size: $(ls -lh rentalmanager.apk | awk '{print $5}')"
    echo "========================================="
    echo ""
    echo "To install on device:"
    echo "  adb install rentalmanager.apk"
    echo ""
    echo "Or transfer to your Android device and install manually"
else
    echo "Error: APK build failed"
    exit 1
fi
