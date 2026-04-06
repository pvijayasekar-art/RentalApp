# Android Build Environment for RentalManager
# This container builds the Android APK from the React/Capacitor project

FROM openjdk:17-jdk-slim

# Install Node.js 18
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    git \
    python3 \
    python3-pip \
    wget \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=$ANDROID_HOME
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Create android sdk directory
RUN mkdir -p $ANDROID_HOME

# Download and install Android SDK command line tools
RUN cd $ANDROID_HOME && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip && \
    unzip -q commandlinetools-linux-11076708_latest.zip && \
    rm commandlinetools-linux-11076708_latest.zip && \
    mkdir -p cmdline-tools/latest && \
    mv cmdline-tools/bin cmdline-tools/latest/ && \
    mv cmdline-tools/lib cmdline-tools/latest/

# Accept licenses and install SDK components
RUN yes | sdkmanager --licenses

# Install Android SDK platforms and build tools
RUN sdkmanager "platforms;android-34" \
    "platforms;android-33" \
    "platforms;android-23" \
    "build-tools;34.0.0" \
    "build-tools;33.0.0" \
    "platform-tools" \
    "extras;android;m2repository" \
    "extras;google;m2repository"

# Install Capacitor CLI globally
RUN npm install -g @capacitor/cli

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY frontend/ ./

# Build the React app
RUN npm run build

# Sync Capacitor
RUN npx cap sync android

# Build debug APK
WORKDIR /app/android
RUN ./gradlew assembleDebug

# Copy APK to output directory
RUN mkdir -p /app/output && \
    cp /app/android/app/build/outputs/apk/debug/app-debug.apk /app/output/rentalmanager-debug.apk

# Default command keeps container running
CMD ["tail", "-f", "/dev/null"]
