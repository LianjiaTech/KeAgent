/**
 * after-pack-resign.cjs
 *
 * Simplified approach: Remove pre-existing signatures and let electron-builder
 * handle signing the entire app bundle with --deep flag.
 *
 * This avoids certificate chain issues when trying to sign individual binaries.
 */

const { execSync } = require('child_process');
const { readdirSync } = require('fs');
const { join } = require('path');

// Find all binary files recursively
function findBinaries(dir, extensions = ['.node', '.dylib', '.so']) {
  const binaries = [];

  function walk(currentDir) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === '.bin' || entry.name === 'test' || entry.name === '__tests__') {
            continue;
          }
          walk(fullPath);
        } else if (entry.isFile()) {
          if (extensions.some(ext => entry.name.endsWith(ext))) {
            binaries.push(fullPath);
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  walk(dir);
  return binaries;
}

// Remove existing signature from a binary
function removeSignature(binaryPath) {
  try {
    // Check if file has a signature
    execSync(`codesign -v "${binaryPath}" 2>/dev/null`, { stdio: 'ignore' });
    // Has signature, remove it
    execSync(`codesign --remove-signature "${binaryPath}" 2>/dev/null || true`, { stdio: 'pipe' });
    return true;
  } catch {
    // No signature or error, that's fine
    return false;
  }
}

exports.default = async function afterPackResign(context) {
  const { appOutDir, electronPlatformName } = context;

  // Only run on macOS
  if (electronPlatformName !== 'darwin') {
    return;
  }

  console.log('[after-pack-resign] Preparing binaries for signing...');

  const appName = context.packager.appInfo.productFilename;
  const appPath = join(appOutDir, `${appName}.app`);
  const resourcesDir = join(appPath, 'Contents', 'Resources');

  // Find all native binaries
  const binaries = findBinaries(resourcesDir);
  console.log(`[after-pack-resign] Found ${binaries.length} native binaries`);

  if (binaries.length === 0) {
    return;
  }

  // Remove existing signatures only
  console.log('[after-pack-resign] Removing pre-existing signatures...');
  let removedCount = 0;

  for (const binary of binaries) {
    if (removeSignature(binary)) {
      removedCount++;
    }
  }

  console.log(`[after-pack-resign] Removed ${removedCount} pre-existing signatures`);
  console.log('[after-pack-resign] electron-builder will sign all binaries with --deep flag');
};
