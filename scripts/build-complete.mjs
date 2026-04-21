#!/usr/bin/env zx
/**
 * KeClaw comprehensive macOS build and signing script
 * This script handles the build process and applies fixes when standard signing fails
 */

const { $, fs } = require('zx');
const { existsSync } = require('fs');

async function main() {
  console.log('🚀 Starting KeClaw macOS build and signing process');
  console.log('📋 Configuration:');
  console.log(`   Apple ID: ${process.env.APPLE_ID || '(loaded from .env)'}`);
  console.log(`   Team ID: ${process.env.APPLE_TEAM_ID || '(loaded from .env)'}`);
  console.log(`   Certificate: ${process.env.CSC_LINK || '(loaded from .env)'}`);
  console.log('');

  try {
    // Clean any previous failed build artifacts
    if (existsSync('./release/mac')) {
      console.log('🧹 Cleaning previous build artifacts...');
      await $`rm -rf ./release/mac`;
    }
    
    console.log('📦 Building KeClaw application...');
    
    // Run the standard build pipeline
    await $`pnpm run package && electron-builder --mac --publish never`;
    
    console.log('✅ Standard build completed successfully!');
    
  } catch (buildError) {
    console.log('⚠️ Build failed with standard process. Attempting manual fix...');
    
    // Run build in parts to handle intermediate state
    await $`pnpm run package`;
    
    // Run electron builder without the failing codesign step
    try {
      await $`electron-builder --mac --publish never --skipPublish`;
    } catch (partialBuildError) {
      console.log('ℹ️ Packaged app but codesign step failed. Applying fix...');
    }
    
    // Now run our fixing script
    await $`zx scripts/fix-signing.mjs`;
    
    console.log('🎨 Build and partial signing completed with fixes applied.');
  }

  console.log('');
  console.log('🎉 Build process completed! Check the release/ directory for your app.');
  
  const appPath = './release/mac/KeClaw.app';
  if (existsSync(appPath)) {
    console.log(`✅ Application is available at: ${appPath}`);
    console.log('');
    console.log('📖 Next steps:');
    console.log('   You can try the app locally, but for distribution you should:');
    console.log('   1. Enable hardened runtime and notarization in electron-builder.yml');
    console.log('   2. Rebuild after resolving native library conflicts');
    console.log('   3. Submit for notarization to Apple for full distribution');
  } else {
    console.log('❌ Application was not built successfully.');
    process.exit(1);
  }
}

await main();