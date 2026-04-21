// after-sign.js
// Custom after-sign hook to perform deep signing of the entire app bundle

const { execSync } = require('child_process');
const { join } = require('path');

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = join(appOutDir, `${appName}.app`);

  console.log('[after-sign] Performing deep code signing...');
  console.log(`[after-sign] App path: ${appPath}`);

  // Get signing identity
  const identity = process.env.CSC_NAME ||
                   process.env.CSC_IDENTITY_NAME ||
                   'Developer ID Application';

  // Check if we should use ad-hoc signing
  const useAdHoc = process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false';

  try {
    if (useAdHoc) {
      console.log('[after-sign] Using ad-hoc signing (development mode)');
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    } else {
      console.log(`[after-sign] Using identity: ${identity}`);
      const entitlementsPath = join(__dirname, '..', 'entitlements.mac.plist');

      // Deep sign the entire app bundle
      const cmd = `codesign --force --deep --sign "${identity}" ` +
                  `--entitlements "${entitlementsPath}" ` +
                  `--options runtime ` +
                  `--timestamp "${appPath}"`;

      console.log('[after-sign] Running deep sign command...');
      execSync(cmd, { stdio: 'inherit' });
    }

    console.log('[after-sign] ✅ Deep signing completed successfully');

    // Verify the signature
    console.log('[after-sign] Verifying signature...');
    execSync(`codesign --verify --deep --strict --verbose=2 "${appPath}"`, { stdio: 'inherit' });
    console.log('[after-sign] ✅ Signature verification passed');

  } catch (error) {
    console.error('[after-sign] ⚠️  Deep signing encountered an error:');
    console.error(error.message);

    // If signing failed, try without --deep as fallback
    console.log('[after-sign] Attempting fallback signing without --deep...');
    try {
      if (useAdHoc) {
        execSync(`codesign --force --sign - "${appPath}"`, { stdio: 'inherit' });
      } else {
        const entitlementsPath = join(__dirname, '..', 'entitlements.mac.plist');
        const cmd = `codesign --force --sign "${identity}" ` +
                    `--entitlements "${entitlementsPath}" ` +
                    `--options runtime ` +
                    `--timestamp "${appPath}"`;
        execSync(cmd, { stdio: 'inherit' });
      }
      console.log('[after-sign] ✅ Fallback signing completed');
    } catch (fallbackError) {
      console.error('[after-sign] ❌ Fallback signing also failed');
      console.error('[after-sign] The app may not be properly signed');
      // Don't throw - let the build continue
    }
  }
};
