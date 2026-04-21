#!/usr/bin/env node
/**
 * Bundle ClawTeams frameworks for distribution
 *
 * This script copies the agent frameworks to the resources directory
 * for packaging with the application.
 */

import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const frameworksDir = join(rootDir, 'frameworks');
const resourcesDir = join(rootDir, 'resources', 'frameworks');

console.log('🦞 Bundling ClawTeams frameworks...');

// Clean and create resources directory
if (existsSync(resourcesDir)) {
  rmSync(resourcesDir, { recursive: true });
}
mkdirSync(resourcesDir, { recursive: true });

// Copy frameworks manifest
const manifestPath = join(frameworksDir, 'frameworks.json');
if (existsSync(manifestPath)) {
  cpSync(manifestPath, join(resourcesDir, 'frameworks.json'));
  console.log('  ✓ Copied frameworks.json');
}

// Copy each agent framework
const agents = ['ceo', 'tech', 'writer', 'secretary', 'social', 'multimodal', 'test', 'security'];

for (const agent of agents) {
  const sourceDir = join(frameworksDir, agent);
  const targetDir = join(resourcesDir, agent);

  if (existsSync(sourceDir)) {
    cpSync(sourceDir, targetDir, { recursive: true });
    console.log(`  ✓ Copied ${agent} framework`);
  } else {
    console.log(`  ⚠ ${agent} framework not found, skipping`);
  }
}

// Copy shared skills
const sharedSkillsSource = join(frameworksDir, 'shared-skills');
const sharedSkillsTarget = join(resourcesDir, 'shared-skills');

if (existsSync(sharedSkillsSource)) {
  cpSync(sharedSkillsSource, sharedSkillsTarget, { recursive: true });
  console.log('  ✓ Copied shared-skills');
}

console.log('');
console.log('🎉 ClawTeams frameworks bundled successfully!');
