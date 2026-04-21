#!/bin/bash
# verify-signatures.sh
# Verifies code signatures for all binaries in a macOS app bundle

set -e

if [ $# -eq 0 ]; then
  echo "Usage: $0 <path-to-app-bundle>"
  echo "Example: $0 release/mac-arm64/KeAgent.app"
  exit 1
fi

APP_PATH="$1"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: App bundle not found at: $APP_PATH"
  exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "Verifying signatures for: $APP_PATH"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Find all binary files
echo "🔍 Finding native binaries..."
BINARIES=$(find "$APP_PATH/Contents/Resources" -type f \( -name "*.node" -o -name "*.dylib" -o -name "*.so" \) 2>/dev/null || true)

if [ -z "$BINARIES" ]; then
  echo "⚠️  No native binaries found"
else
  BINARY_COUNT=$(echo "$BINARIES" | wc -l | tr -d ' ')
  echo "Found $BINARY_COUNT native binaries"
  echo ""
fi

# Verify each binary
VERIFIED=0
FAILED=0
UNSIGNED=0

echo "🔐 Verifying signatures..."
echo ""

while IFS= read -r BINARY; do
  if [ -n "$BINARY" ]; then
    BINARY_NAME=$(basename "$BINARY")

    # Check if file has a signature
    if codesign -v "$BINARY" 2>/dev/null; then
      # Verify signature thoroughly
      if codesign -vvv --deep --strict "$BINARY" 2>&1 | grep -q "valid on disk"; then
        echo "✅ $BINARY_NAME"
        ((VERIFIED++))
      else
        echo "❌ $BINARY_NAME (invalid signature)"
        ((FAILED++))
      fi
    else
      echo "⚠️  $BINARY_NAME (unsigned)"
      ((UNSIGNED++))
    fi
  fi
done <<< "$BINARIES"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Summary:"
echo "  ✅ Verified: $VERIFIED"
echo "  ❌ Failed:   $FAILED"
echo "  ⚠️  Unsigned: $UNSIGNED"
echo "═══════════════════════════════════════════════════════════"

# Verify the main app bundle
echo ""
echo "🔐 Verifying main app bundle..."
if codesign -vvv --deep --strict "$APP_PATH" 2>&1; then
  echo "✅ Main app bundle signature is valid"
  EXIT_CODE=0
else
  echo "❌ Main app bundle signature is invalid"
  EXIT_CODE=1
fi

# Show the app's signature info
echo ""
echo "📋 App signature info:"
codesign -dvvv "$APP_PATH" 2>&1 | grep -E "(Identifier|Authority|TeamIdentifier|Sealed Resources|Format=)"

exit $EXIT_CODE
