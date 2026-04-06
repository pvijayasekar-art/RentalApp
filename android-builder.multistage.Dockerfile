# Multi-stage build for RentalManager APK
# Stage 1: Build environment
FROM eclipse-temurin:17-jdk as builder

# Install Node.js and dependencies
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    wget \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set Android SDK environment
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Download and setup Android SDK
RUN mkdir -p $ANDROID_HOME && cd $ANDROID_HOME && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip && \
    unzip -q commandlinetools-linux-11076708_latest.zip && \
    rm commandlinetools-linux-11076708_latest.zip && \
    mkdir -p cmdline-tools/latest && \
    mv cmdline-tools/bin cmdline-tools/lib cmdline-tools/latest/ 2>/dev/null || true

# Accept licenses and install SDK
RUN yes | sdkmanager --licenses && \
    sdkmanager "platforms;android-28" "build-tools;28.0.3" "platform-tools"

# Install Capacitor
RUN npm install -g @capacitor/cli

# Stage 2: Build the app
FROM builder as app-builder

WORKDIR /app/frontend

# Copy and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source code (excluding android folder - will be regenerated)
COPY frontend/src ./src
COPY frontend/index.html ./
COPY frontend/vite.config.js ./
COPY frontend/capacitor.config.json ./

# Use mobile entry point for Android
RUN cp src/main.mobile.jsx src/main.jsx

# Build web app
RUN npm run build && ls -la dist/

# Add Android platform fresh
RUN rm -rf android
RUN npx cap add android

# Copy web assets using capacitor copy (proper method)
RUN npx cap copy android

# Sync native plugins
RUN npx cap sync android

# CRITICAL: Verify assets are actually in the right place before build
RUN echo "=== Verifying assets before build ===" && \
    ls -la android/app/src/main/assets/public/ && \
    echo "=== Checking if assets folder exists ===" && \
    ls -la android/app/src/main/assets/public/assets/ 2>/dev/null || echo "ASSETS FOLDER MISSING!" && \
    echo "=== Checking dist folder ===" && \
    ls -la dist/assets/ 2>/dev/null || echo "DIST ASSETS MISSING!"

# Configure for ASUS_I003DD device model
RUN sed -i 's/targetSdkVersion.*/targetSdkVersion 28/' android/app/build.gradle && \
    sed -i 's/minSdkVersion.*/minSdkVersion 28/' android/app/build.gradle

# Build APK
WORKDIR /app/frontend/android
RUN ./gradlew assembleDebug

# Stage 3: Output container
FROM alpine:latest as output

WORKDIR /output

# Copy built APK from builder stage
COPY --from=app-builder /app/frontend/android/app/build/outputs/apk/debug/app-debug.apk ./rentalmanager.apk

# Create a simple HTTP server to serve the APK
RUN apk add --no-cache python3 py3-pip

EXPOSE 8080

# Serve the APK file
CMD ["python3", "-m", "http.server", "8080"]
