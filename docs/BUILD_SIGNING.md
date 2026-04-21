# KeAgent macOS Application Signing Guide

This guide explains how to sign and build your KeAgent macOS application using the provided certificates.

## Prerequisites

- macOS operating system
- Apple Developer account with a valid developer ID certificate
- Valid Apple ID and team ID
- The certificates `keagent.p12` and `keagent.certSigningRequest` (the latter is kept for historical purposes, only the `.p12` file is used for signing)

## Quick Start

There are two ways to build and sign your application:

### Method 1: Interactive Script (Recommended)

1. Make sure you have the `keagent.p12` file in your project root
2. Run the interactive build script:
   ```bash
   zx scripts/macos-sign-and-build.mjs
   ```
   Or using npm scripts:
   ```bash
   pnpm run package:mac:sign
   ```

This script will prompt you for the following information:
- Your Apple ID email
- Your Apple Developer Team ID
- The certificate password (if applicable)

### Method 2: Manual Process

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Prepare your build environment by bundling required components:
   ```bash
   pnpm run package
   ```

3. Set the required environment variables:
   ```bash
   export APPLE_ID=your_apple_id@example.com
   export APPLE_TEAM_ID=YOUR_TEAM_ID
   export CSC_LINK=./keagent.p12
   export CSC_KEY_PASSWORD=your_certificate_password_if_any
   ```

4. Build the signed macOS application:
   ```bash
   pnpm run package:mac
   ```

## Important Notes

- The built application will be located in the `release/` directory
- The build process includes code signing and notarization by default (as configured in `electron-builder.yml`)
- Notarization requires a valid Apple Developer account and proper internet connectivity
- If you need to skip notarization for testing, temporarily edit `electron-builder.yml` and set `notarize: false`

## Certificate Security

- Keep your `keagent.p12` file secure and do not commit it to public repositories
- The certificate contains private keys that allow code signing
- If compromised, revoke and regenerate the certificate in your Apple Developer portal

## Troubleshooting

- If you encounter code signing errors, ensure your certificate is properly imported to your keychain:
  ```bash
  security import ./keagent.p12 -k ~/Library/Keychains/login.keychain -T /usr/bin/codesign
  ```

- For notarization errors, verify your Apple ID and team ID are correct

- Check that your network allows communication with Apple's notary service