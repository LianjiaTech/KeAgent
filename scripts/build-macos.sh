#!/bin/bash

# macOS Application Build and Sign Script for KeClaw
# Usage: ./scripts/build-macos.sh

set -e  # Exit immediately if a command exits with a non-zero status

echo "🚀 KeClaw macOS Application Build and Sign Script"
echo "=================================================="

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: This script must be run on macOS."
    exit 1
fi

if ! command_exists pnpm; then
    echo "❌ Error: pnpm is not installed. Please install pnpm first."
    exit 1
fi

if ! command_exists security; then
    echo "❌ Error: security command not found. Are you on macOS?"
    exit 1
fi

# Check for required certificate files
if [ ! -f "./keclaw.p12" ]; then
    echo "❌ Error: keclaw.p12 certificate file not found in project root."
    exit 1
fi

# Get user inputs
read -p "Enter your Apple ID email: " apple_id
read -p "Enter your Apple Developer Team ID (e.g. ABCD123456): " apple_team_id
read -s -p "Enter the certificate password (press Enter if none): " cert_password
echo  # New line after hidden password input

echo
echo "📋 Configuration Summary:"
echo "Apple ID: $apple_id"
echo "Team ID: $apple_team_id"
echo "Certificate file: keclaw.p12"
echo "Has password: $(if [ -n "$cert_password" ]; then echo "Yes"; else echo "No"; fi)"
echo

while true; do
    read -p "Continue with the build process? (y/n): " yn
    case $yn in
        [Yy]* ) break;;
        [Nn]* ) echo "Build cancelled."; exit 0;;
        * ) echo "Please answer y or n.";;
    esac
done

# Import certificate into keychain if not already imported
echo
echo "🔐 Importing certificate to keychain..."
if [ -n "$cert_password" ]; then
    security import ./keclaw.p12 -k ~/Library/Keychains/login.keychain -P "$cert_password" -T /usr/bin/codesign
else
    security import ./keclaw.p12 -k ~/Library/Keychains/login.keychain -T /usr/bin/codesign
fi

echo
echo "📦 Installing dependencies and preparing build assets..."
pnpm install

echo
echo "🏗️  Building application components..."
pnpm run package

echo
echo "📱 Building, signing and notarizing macOS application..."

# Set environment variables for electron-builder
export APPLE_ID="$apple_id"
export APPLE_TEAM_ID="$apple_team_id"
export CSC_LINK="./keclaw.p12"
export CSC_KEY_PASSWORD="$cert_password"

pnpm run package:mac

echo
echo "✅ Success! The macOS application has been built and signed."
echo "🎉 Signed and notarized files are available in the release/ directory"