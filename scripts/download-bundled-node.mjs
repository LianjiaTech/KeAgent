#!/usr/bin/env zx

import 'zx/globals';

const ROOT_DIR = path.resolve(__dirname, '..');
const NODE_VERSION = '22.16.0';
const BASE_URL = `https://nodejs.org/dist/v${NODE_VERSION}`;
const OUTPUT_BASE = path.join(ROOT_DIR, 'resources', 'bin');
const CACHE_DIR = path.join(ROOT_DIR, '.cache', 'binaries');

const TARGETS = {
  'win32-x64': {
    filename: `node-v${NODE_VERSION}-win-x64.zip`,
    sourceDir: `node-v${NODE_VERSION}-win-x64`,
  },
  'win32-arm64': {
    filename: `node-v${NODE_VERSION}-win-arm64.zip`,
    sourceDir: `node-v${NODE_VERSION}-win-arm64`,
  },
};

const PLATFORM_GROUPS = {
  win: ['win32-x64', 'win32-arm64'],
};

async function getBinaryVersion(binPath) {
  try {
    const result = await $`${binPath} --version`.quiet();
    const match = result.stdout.match(/v(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function setupTarget(id, force = false) {
  const target = TARGETS[id];
  if (!target) {
    echo(chalk.yellow`⚠️ Target ${id} is not supported by this script.`);
    return;
  }

  const targetDir = path.join(OUTPUT_BASE, id);
  const outputNode = path.join(targetDir, 'node.exe');
  const cachePath = path.join(CACHE_DIR, 'node', NODE_VERSION, id, 'node.exe');
  const tempDir = path.join(ROOT_DIR, 'temp_node_extract');
  const archivePath = path.join(ROOT_DIR, target.filename);
  const downloadUrl = `${BASE_URL}/${target.filename}`;

  // Check if binary already exists with correct version
  if (!force && await fs.pathExists(outputNode)) {
    const existingVersion = await getBinaryVersion(outputNode);
    if (existingVersion === NODE_VERSION) {
      echo(chalk.green`✅ Node.js ${NODE_VERSION} already installed for ${id}, skipping download`);
      return;
    } else if (existingVersion) {
      echo(chalk.yellow`⬆️ Node.js ${existingVersion} found, upgrading to ${NODE_VERSION}...`);
    }
  }

  // Check cache first
  if (!force && await fs.pathExists(cachePath)) {
    echo(chalk.blue`\n📦 Installing Node.js for ${id} from cache...`);
    await fs.ensureDir(targetDir);
    await fs.copy(cachePath, outputNode);
    echo(chalk.green`✅ Success: ${outputNode}`);
    return;
  }

  echo(chalk.blue`\n📦 Setting up Node.js for ${id}...`);

  // Only remove the target binary, not the entire directory,
  // to avoid deleting uv.exe or other binaries placed by other download scripts.
  if (await fs.pathExists(outputNode)) {
    await fs.remove(outputNode);
  }
  await fs.remove(tempDir);
  await fs.ensureDir(targetDir);
  await fs.ensureDir(tempDir);

  try {
    echo`⬇️ Downloading: ${downloadUrl}`;
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(archivePath, Buffer.from(buffer));

    echo`📂 Extracting...`;
    if (os.platform() === 'win32') {
      const { execFileSync } = await import('child_process');
      const psCommand = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${archivePath.replace(/'/g, "''")}', '${tempDir.replace(/'/g, "''")}')`;
      execFileSync('powershell.exe', ['-NoProfile', '-Command', psCommand], { stdio: 'inherit' });
    } else {
      await $`unzip -q -o ${archivePath} -d ${tempDir}`;
    }

    const expectedNode = path.join(tempDir, target.sourceDir, 'node.exe');
    if (await fs.pathExists(expectedNode)) {
      await fs.move(expectedNode, outputNode, { overwrite: true });
    } else {
      echo(chalk.yellow`🔍 node.exe not found in expected directory, searching...`);
      const files = await glob('**/node.exe', { cwd: tempDir, absolute: true });
      if (files.length > 0) {
        await fs.move(files[0], outputNode, { overwrite: true });
      } else {
        throw new Error('Could not find node.exe in extracted files.');
      }
    }

    // Save to cache
    await fs.ensureDir(path.dirname(cachePath));
    await fs.copy(outputNode, cachePath);
    echo(chalk.gray`💾 Cached to: ${cachePath}`);

    echo(chalk.green`✅ Success: ${outputNode}`);
  } finally {
    await fs.remove(archivePath);
    await fs.remove(tempDir);
  }
}

const downloadAll = argv.all;
const platform = argv.platform;
const force = argv.force;

if (downloadAll) {
  echo(chalk.cyan`🌐 Downloading Node.js binaries for all Windows targets...`);
  for (const id of Object.keys(TARGETS)) {
    await setupTarget(id, force);
  }
} else if (platform) {
  const targets = PLATFORM_GROUPS[platform];
  if (!targets) {
    echo(chalk.red`❌ Unknown platform: ${platform}`);
    echo(`Available platforms: ${Object.keys(PLATFORM_GROUPS).join(', ')}`);
    process.exit(1);
  }
  echo(chalk.cyan`🎯 Downloading Node.js binaries for platform: ${platform}`);
  for (const id of targets) {
    await setupTarget(id, force);
  }
} else {
  const currentId = `${os.platform()}-${os.arch()}`;
  if (TARGETS[currentId]) {
    echo(chalk.cyan`💻 Detected Windows system: ${currentId}`);
    await setupTarget(currentId, force);
  } else {
    echo(chalk.cyan`🎯 Defaulting to Windows multi-arch Node.js download`);
    for (const id of PLATFORM_GROUPS.win) {
      await setupTarget(id, force);
    }
  }
}

echo(chalk.green`\n🎉 Done!`);
