#!/bin/bash
#
# KeClaw macOS Notarization Script
#
# Usage: ./scripts/notarize-macos.sh [--clean]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CLEAN_BUILD=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean) CLEAN_BUILD=true; shift ;;
        *) shift ;;
    esac
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  KeClaw macOS Notarization${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Load .env file
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} Loading .env file..."
    set -a
    source .env
    set +a
fi

# Validate environment variables
MISSING=""
[ -z "$APPLE_ID" ] && MISSING="$MISSING APPLE_ID"
[ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] && MISSING="$MISSING APPLE_APP_SPECIFIC_PASSWORD"
[ -z "$APPLE_TEAM_ID" ] && MISSING="$MISSING APPLE_TEAM_ID"

if [ -n "$MISSING" ]; then
    echo -e "${RED}✗ Missing environment variables:$MISSING${NC}"
    echo ""
    echo "Create .env file with:"
    echo "  APPLE_ID=your@email.com"
    echo "  APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx"
    echo "  APPLE_TEAM_ID=XXXXXXXXXX"
    exit 1
fi

echo -e "${GREEN}✓${NC} Environment variables set"
echo -e "  APPLE_ID: $APPLE_ID"
echo -e "  APPLE_TEAM_ID: $APPLE_TEAM_ID"

# Check Developer ID certificate
CERT=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1)
if [ -z "$CERT" ]; then
    echo -e "${RED}✗ No Developer ID Application certificate found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Certificate: $(echo $CERT | sed 's/.*"\(.*\)".*/\1/')"

# Clean build
if [ "$CLEAN_BUILD" = true ]; then
    echo -e "${BLUE}➤${NC} Cleaning previous build..."
    rm -rf release/
fi

# Export and build
export APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Building and Notarizing (this takes 10-20 minutes)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

START=$(date +%s)
pnpm package:mac
END=$(date +%s)

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Verify x64
if [ -d "release/mac/KeClaw.app" ]; then
    RESULT=$(spctl -a -t execute -vvv release/mac/KeClaw.app 2>&1)
    if echo "$RESULT" | grep -q "Notarized Developer ID"; then
        echo -e "${GREEN}✓${NC} x64: Notarized"
        stapler validate release/mac/KeClaw.app &>/dev/null && echo -e "${GREEN}✓${NC} x64: Stapled"
    else
        echo -e "${RED}✗${NC} x64: Not notarized"
    fi
fi

# Verify arm64
if [ -d "release/mac-arm64/KeClaw.app" ]; then
    RESULT=$(spctl -a -t execute -vvv release/mac-arm64/KeClaw.app 2>&1)
    if echo "$RESULT" | grep -q "Notarized Developer ID"; then
        echo -e "${GREEN}✓${NC} arm64: Notarized"
        stapler validate release/mac-arm64/KeClaw.app &>/dev/null && echo -e "${GREEN}✓${NC} arm64: Stapled"
    else
        echo -e "${RED}✗${NC} arm64: Not notarized"
    fi
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Complete! Build time: $((END - START))s${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
ls -lh release/*.dmg 2>/dev/null
echo ""
