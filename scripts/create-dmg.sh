#!/bin/bash

# Get the app version from package.json
APP_VERSION=$(node -p "require('./package.json').version")
APP_NAME="KeClaw"
DMG_NAME="KeClaw-$APP_VERSION-mac-x64"
SOURCE_APP="release/mac/KeClaw.app"
OUTPUT_DMG="release/$DMG_NAME.dmg"

echo "Creating DMG for $APP_NAME v$APP_VERSION"

# Configuration values
WINDOW_X=100
WINDOW_Y=100
WINDOW_WIDTH=600
WINDOW_HEIGHT=400
ICON_SIZE=100
TEXT_SIZE=12

# Apps icon coordinates  (destination location)
APP_ICON_X=160
APP_ICON_Y=220

# Applications folder link coordinates 
APPS_LINK_X=440
APPS_LINK_Y=220

# Create temporary directory and DMG
TEMP_DMG_DIR="/tmp/${APP_NAME}_dmg_temp.$$"
rm -rf "$TEMP_DMG_DIR"
mkdir -p "$TEMP_DMG_DIR"

# Copy the app to temporary directory
cp -R "$SOURCE_APP" "$TEMP_DMG_DIR/"

# Create background if it doesn't exist
BG_IMAGE="resources/dmg-background.png"
if [ ! -f "$BG_IMAGE" ]; then
    mkdir -p "resources"
    # If background doesn't exist, use default
    echo "Background image not found: $BG_IMAGE"
    BG_ARG=""
else
    BG_ARG="-background $BG_IMAGE"
fi

echo "Creating initial DMG image..."
hdiutil create -srcfolder "$TEMP_DMG_DIR" \
             -volname "$APP_NAME $APP_VERSION" \
             -fs HFS+ \
             -fsargs "-c c=64,a=16,e=16" \
             -format UDRW \
             "$TEMP_DMG_DIR.tmp.dmg"

# Mount the temporary DMG
echo "Mounting and configuring DMG layout..."
DEVICE=$(hdiutil attach -readwrite -noverify -noautoopen "$TEMP_DMG_DIR.tmp.dmg" | \
         egrep '^/dev/' | sed 1q | awk '{print $1}')

sleep 2

# Create symbolic link to Applications folder
ln -s /Applications "/Volumes/$APP_NAME $APP_VERSION/.background"
mv "/Volumes/$APP_NAME $APP_VERSION/.background" "/Volumes/$APP_NAME $APP_VERSION/Applications"

# Change to mounted volume dir to apply settings without errors
pushd "/Volumes/$APP_NAME $APP_VERSION"

# Apply folder settings with AppleScript
osascript << EOF
tell application "Finder"
 tell disk "$APP_NAME $APP_VERSION"
     open
     set current view of container window to icon view
     set toolbar visible of container window to false
     set statusbar visible of container window to false
     set the bounds of container window to {400, 100, 1000, 500} 
     set viewOptions to the icon view options of container window
     set arrangement of viewOptions to not arranged
     set icon size of viewOptions to ${ICON_SIZE}
     set text size of viewOptions to ${TEXT_SIZE}
     set position of item "$APP_NAME.app" of container to {${APP_ICON_X}, ${APP_ICON_Y}}
     set position of item "Applications" of container to {${APPS_LINK_X}, ${APPS_LINK_Y}}
     update without registering applications
     delay 3    # Wait for updates to finish
     close
 end tell
end tell
EOF

popd

# Unmount
hdiutil detach "$DEVICE" -quiet

# Convert to compressed DMG
echo "Converting to final compressed DMG..."
hdiutil convert "$TEMP_DMG_DIR.tmp.dmg" \
               -format UDZO \
               -imagekey zlib-level=9 \
               -o "$OUTPUT_DMG"

# Cleanup
rm -rf "$TEMP_DMG_DIR.tmp.dmg"
rm -rf "$TEMP_DMG_DIR"

echo "Created final DMG: $OUTPUT_DMG"
ls -lah "$OUTPUT_DMG"