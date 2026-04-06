#!/bin/bash
# Start Android Emulator with all services

echo "========================================="
echo "Starting RentalManager with Android Emulator"
echo "========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running"
    exit 1
fi

# Start core services
echo "Starting MySQL, Backend, and Frontend..."
docker-compose up -d mysql backend frontend

# Wait for backend to be ready
echo ""
echo "Waiting for backend to be ready..."
sleep 5

# Start Android emulator
echo ""
echo "Starting Android Emulator (Samsung Galaxy S10)..."
echo "This may take 2-3 minutes on first run..."
docker-compose --profile emulator up -d android-emulator

# Wait for emulator to boot
echo ""
echo "Waiting for emulator to boot..."
echo "You can watch the boot progress at: http://localhost:6080"
echo ""

sleep 10

# Check if emulator is ready
echo "Checking emulator status..."
for i in {1..30}; do
    if docker exec rental-android-emulator adb devices 2>/dev/null | grep -q "emulator"; then
        echo "✓ Emulator is ready!"
        break
    fi
    echo -n "."
    sleep 5
done

echo ""
echo "========================================="
echo "Services Started:"
echo "  - Web App:      http://localhost:3000"
echo "  - Backend API:  http://localhost:5000"
echo "  - Emulator VNC: http://localhost:6080"
echo ""
echo "Install APK:"
echo "  ./install-apk-emulator.sh"
echo "========================================="
