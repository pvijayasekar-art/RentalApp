#!/bin/bash
# Install APK into Android Emulator

echo "========================================="
echo "Installing RentalManager APK into Emulator"
echo "========================================="
echo ""

# Check if emulator is running
if ! docker ps | grep -q "rental-android-emulator"; then
    echo "Error: Emulator is not running"
    echo "Start it first with: ./start-emulator.sh"
    exit 1
fi

# Check if APK exists
if [ ! -f "rentalmanager.apk" ]; then
    echo "Error: rentalmanager.apk not found"
    echo "Build it first with: docker-compose up android-builder"
    exit 1
fi

echo "Waiting for emulator to be fully booted..."
for i in {1..60}; do
    if docker exec rental-android-emulator adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
        echo "✓ Emulator fully booted"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "Installing APK..."
docker exec rental-android-emulator adb install -r /apk/rentalmanager.apk

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✓ APK installed successfully!"
    echo ""
    echo "Access the emulator at:"
    echo "  http://localhost:6080"
    echo ""
    echo "The app should appear on the emulator home screen"
    echo "Look for 'RentalManager' app icon"
    echo "========================================="
else
    echo ""
    echo "Error: Failed to install APK"
    echo "Check emulator status: docker logs rental-android-emulator"
    exit 1
fi
