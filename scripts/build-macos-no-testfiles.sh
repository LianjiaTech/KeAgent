#!/usr/bin/env zx

import { $, fs } from 'zx';

console.log('🚀 Starting KeClaw macOS build with cleanup of problematic files');

// Clean up problematic test/coverage files that cause signing issues
console.log('🧹 Removing problematic test files that cause code signing issues...');
try {
  await $`find . -name "lcov-report" -type d -exec rm -rf {} + 2>/dev/null || true`;
  await $`find . -name "*.coverage*" -type d -exec rm -rf {} + 2>/dev/null || true`;
  await $`find . -path "*/node_modules/*" -name "coverage" -type d -exec rm -rf {} + 2>/dev/null || true`;
  console.log('✅ Problematic test files removed');
} catch (e) {
  console.warn('⚠️ Failed to remove some problematic files:', e.message);
}

// Continue with normal build process
await $`pnpm run package:mac:local`;