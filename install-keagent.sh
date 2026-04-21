#!/bin/bash

# KeAgent macOS Installation Script
# Created: March 2026, KeAgent Team

# Script version for tracking
SCRIPT_VERSION="1.0"

echo " "
echo "╔══════════════════════════════════════╗"
echo "║            KeAgent Installer          ║"
echo "║         Version $SCRIPT_VERSION for macOS        ║"
echo "╚══════════════════════════════════════╝"
echo " "

# Verify this is running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: This installer only works on macOS."
    read -n1 -r -p "Press any key to exit..." key
    exit 1
fi

# Verify script is run with proper privileges
echo "🔒 Verifying system security..."

# Check if user has admin rights for installation to /Applications
ADMIN_ACCESS=false
if [[ $EUID -eq 0 ]] || sudo -n true 2>/dev/null; then
    ADMIN_ACCESS=true
else
    echo "🔑 Administrative access required for installation in Applications."
    echo "  Please provide your admin credentials when prompted:"
    if sudo -v; then
        ADMIN_ACCESS=true
    else
        echo "❌ Unable to obtain administrative privileges."
        echo "   Please run script with 'sudo $0' or login with admin account."
        read -n1 -r -p "Press any key to exit..." key
        exit 1
    fi
fi

echo "✅ Admin rights acquired. Checking available package..."

# Check if application already exists and handle replacement
INSTALL_PATH="/Applications/KeAgent.app"
APP_ALREADY_EXISTS=false
if [ -d "$INSTALL_PATH" ]; then
    echo "⚠️  KeAgent is already installed at $INSTALL_PATH"
    read -p "Do you want to proceed with replacement? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing existing installation..."
        if [ "$ADMIN_ACCESS" = true ]; then
            sudo rm -rf "$INSTALL_PATH"
        else
            rm -rf "$INSTALL_PATH"
        fi
        echo "✅ Previous installation removed."
    else
        echo "Installation canceled by user."
        read -n1 -r -p "Press any key to exit..." key
        exit 0
    fi
fi

# Locate the app bundle in the source location
echo "🔍 Locating application bundle..."

# Look for the source KeAgent app in a few common locations:
# 1. Current directory as sibling to the script
# 2. One directory up, in a release/ or dist/ folder
# 3. Ask the user for manual location

SOURCE_APP_FOUND=false
SOURCE_APP_PATH=""

# 1. Check in the same directory as this script
if [ -d "./KeAgent.app" ]; then
    SOURCE_APP_PATH="./KeAgent.app"
    SOURCE_APP_FOUND=true
elif [ -d "../KeAgent.app" ]; then
    SOURCE_APP_PATH="../KeAgent.app"
    SOURCE_APP_FOUND=true
else
    # Look for KeAgent in common distribution subdirectories
    for dir in release dist .; do
        if [ -d "$dir/KeAgent.app" ]; then
            SOURCE_APP_PATH="$dir/KeAgent.app"
            SOURCE_APP_FOUND=true
            break
        fi
    done
    
    # Also check for DMG-mounted volume containing KeAgent
    if [ ! "$SOURCE_APP_FOUND" = true ]; then
        for mount_point in /Volumes/*KeAgent* /Volumes/*KeAgent*; do
            if [ -d "$mount_point/KeAgent.app" ]; then
                SOURCE_APP_PATH="$mount_point/KeAgent.app"
                SOURCE_APP_FOUND=true
                break
            fi
        done
    fi
fi

# If still not found, ask the user
if [ ! "$SOURCE_APP_FOUND" = true ]; then
    echo "❌ Could not find KeAgent.app to install!"
    echo " "
    echo "If you opened this installer from the KeAgent DMG:"
    echo "  • Make sure the DMG is still mounted (double click on it)"
    echo "  • Run this script from the mounted DMG volume"
    echo " "
    echo "If you copied this script elsewhere:"
    echo "  • Move it back to the same location as KeAgent.app and run again"
    read -n1 -r -p "Press any key to exit and view installation guide..." key
    echo " "
    open https://keagent.ai/install-help  # This would be linked to a help page in real implementation
    exit 1
fi

echo "✅ Found: $SOURCE_APP_PATH"

# Begin copying the application
echo "🚀 Installing KeAgent to Applications folder..."

if [ "$ADMIN_ACCESS" = true ]; then
    if sudo cp -R "$SOURCE_APP_PATH" /Applications/; then
        echo "✅ KeAgent successfully installed!"
    else
        echo "❌ Failed to copy application to /Applications/"
        read -n1 -r -p "Press any key to exit..." key
        exit 1
    fi
else
    if cp -R "$SOURCE_APP_PATH" /Applications/; then
        echo "✅ KeAgent successfully installed!"
    else
        echo "❌ Failed to copy application to /Applications/"
        read -n1 -r -p "Press any key to exit..." key
        exit 1
    fi
fi

# Remove any quarantine attributes that would cause Gatekeeper warnings
echo "🔧 Removing quarantine attributes..."
xattr -rd com.apple.quarantine "$INSTALL_PATH" 2>/dev/null || true
sudo xattr -rd com.apple.quarantine "$INSTALL_PATH" 2>/dev/null || true

# Update Launch Services to recognize the app
echo "🔄 Registering application with Launch Services..."
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$INSTALL_PATH" 2>/dev/null || true

# Try to open the installed application
echo "🎯 Launching KeAgent!"
open "$INSTALL_PATH"

sleep 2

echo " "
echo "🎉 Installation Complete!"
echo "KeAgent is now installed and has been launched."
echo " "
echo "Troubleshooting tip: If you encounter any issues:"
echo "  • Check System Preferences > Security & Privacy if app fails to open"
echo "  • The app is located in: $INSTALL_PATH"
echo " "

read -n1 -r -p "Press any key to exit..." key