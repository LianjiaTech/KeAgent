#!/usr/bin/env zx

import { $, fs } from 'zx';

// Declare question globally, as it's provided by zx
const question = global.question;

// macOS Application Build and Sign Script for KeAgent
console.log('🚀 KeAgent macOS Application Build and Sign Script');

async function main() {
  // Use existing environment variables from .env.local if they exist
  const appleId = process.env.APPLE_ID || await question('Enter your Apple ID email: ');
  const appleTeamId = process.env.APPLE_TEAM_ID || await question('Enter your Apple Developer Team ID (e.g. ABCD123456): ');
  
  let certificatePassword = process.env.CSC_KEY_PASSWORD || '';
  if (!process.env.CSC_KEY_PASSWORD) {
    const hasPassword = await question('Does the p12 certificate have a password? (y/n): ', { choices: ['y', 'n'] });
    if (hasPassword.toLowerCase() === 'y') {
      certificatePassword = await question('Enter the certificate password: ', { mask: '*' });
    }
  }

  console.log('\n📋 Configuration:');
  console.log(`Apple ID: ${appleId}`);
  console.log(`Team ID: ${appleTeamId}`);
  console.log(`Certificate file: keagent.p12`);
  console.log(`Has password: ${!!process.env.CSC_KEY_PASSWORD || !!certificatePassword}`);

  // Verify the certificate files exist
  if (!fs.existsSync('./keagent.p12')) {
    console.error('\n❌ Error: keagent.p12 certificate file not found');
    console.error('Make sure the keagent.p12 file exists in the project root.');
    process.exit(1);
  }

  console.log('\n🔄 Proceeding with building and signing the application...');

  try {
    // Import certificate into keychain
    console.log('\n🔐 Importing certificate to keychain...');
    if (certificatePassword) {
      await $`security import ./keagent.p12 -k ~/Library/Keychains/login.keychain -P ${certificatePassword} -T /usr/bin/codesign`;
    } else {
      await $`security import ./keagent.p12 -k ~/Library/Keychains/login.keychain -T /usr/bin/codesign`;
    }

    // Set environment variables for electron-builder
    process.env.CSC_LINK = './keagent.p12';
    process.env.CSC_KEY_PASSWORD = certificatePassword;
    process.env.APPLE_ID = appleId;
    process.env.APPLE_TEAM_ID = appleTeamId;

    // Since we've already loaded these from .env in shell environment, no need to run install again if exists
    if (!fs.existsSync('node_modules')) {
      console.log('\n📦 Installing dependencies...');
      await $`pnpm install`;
    }

    // Bundle required components
    console.log('\n📦 Bundling required components...');
    await $`pnpx zx scripts/bundle-openclaw.mjs`;
    await $`pnpx zx scripts/bundle-openclaw-plugins.mjs`;
    await $`pnpx zx scripts/bundle-preinstalled-skills.mjs`;
    await $`pnpx zx scripts/bundle-frameworks.mjs`;
    
    console.log('\n📱 Building, signing and notarizing macOS application...');
    await $`pnpm run package:mac:local`;

    console.log('\n✅ Successfully built and signed macOS application!');
    console.log('🎉 The signed and notarized .dmg file is located in the release/ directory');
    
  } catch (error) {
    console.error('\n❌ Error during build process:');
    console.error(error.message);
    process.exit(1);
  }
}

await main();