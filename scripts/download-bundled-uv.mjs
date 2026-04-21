#!/usr/bin/env zx

import 'zx/globals';

const ROOT_DIR = path.resolve(__dirname, '..');
const UV_VERSION = '0.10.0';
// Use mirror for Chinese users (can be overridden via UV_DOWNLOAD_MIRROR env var)
// Set UV_DOWNLOAD_MIRROR="" to disable mirror
const DEFAULT_MIRROR = 'https://gh-proxy.com/';
const MIRROR = process.env.UV_DOWNLOAD_MIRROR !== undefined
  ? process.env.UV_DOWNLOAD_MIRROR
  : DEFAULT_MIRROR;
const BASE_URL = MIRROR
  ? `${MIRROR}https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`
  : `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`;
const OUTPUT_BASE = path.join(ROOT_DIR, 'resources', 'bin');
const CACHE_DIR = path.join(ROOT_DIR, '.cache', 'binaries');

// Mapping Node platforms/archs to uv release naming
const TARGETS = {
  'darwin-arm64': {
    filename: 'uv-aarch64-apple-darwin.tar.gz',
    binName: 'uv',
  },
  'darwin-x64': {
    filename: 'uv-x86_64-apple-darwin.tar.gz',
    binName: 'uv',
  },
  'win32-arm64': {
    filename: 'uv-aarch64-pc-windows-msvc.zip',
    binName: 'uv.exe',
  },
  'win32-x64': {
    filename: 'uv-x86_64-pc-windows-msvc.zip',
    binName: 'uv.exe',
  },
  'linux-arm64': {
    filename: 'uv-aarch64-unknown-linux-gnu.tar.gz',
    binName: 'uv',
  },
  'linux-x64': {
    filename: 'uv-x86_64-unknown-linux-gnu.tar.gz',
    binName: 'uv',
  }
};

// Platform groups for building multi-arch packages
const PLATFORM_GROUPS = {
  'mac': ['darwin-x64', 'darwin-arm64'],
  'win': ['win32-x64', 'win32-arm64'],
  'linux': ['linux-x64', 'linux-arm64']
};

async function getBinaryVersion(binPath) {
  try {
    const result = await $`${binPath} --version`.quiet();
    const match = result.stdout.match(/uv\s+(\d+\.\d+\.\d+)/);
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
  const destBin = path.join(targetDir, target.binName);
  const cachePath = path.join(CACHE_DIR, 'uv', UV_VERSION, id, target.binName);
  const tempDir = path.join(ROOT_DIR, 'temp_uv_extract');
  const archivePath = path.join(ROOT_DIR, target.filename);
  const downloadUrl = `${BASE_URL}/${target.filename}`;

  // Check if binary already exists with correct version
  if (!force && await fs.pathExists(destBin)) {
    const existingVersion = await getBinaryVersion(destBin);
    if (existingVersion === UV_VERSION) {
      echo(chalk.green`✅ uv ${UV_VERSION} already installed for ${id}, skipping download`);
      return;
    } else if (existingVersion) {
      echo(chalk.yellow`⬆️ uv ${existingVersion} found, upgrading to ${UV_VERSION}...`);
    }
  }

  // Check cache first
  if (!force && await fs.pathExists(cachePath)) {
    echo(chalk.blue`\n📦 Installing uv for ${id} from cache...`);
    await fs.ensureDir(targetDir);
    await fs.copy(cachePath, destBin);
    if (os.platform() !== 'win32') {
      await fs.chmod(destBin, 0o755);
    }
    echo(chalk.green`✅ Success: ${destBin}`);
    return;
  }

  echo(chalk.blue`\n📦 Setting up uv for ${id}...`);

  // Cleanup & Prep
  await fs.remove(targetDir);
  await fs.remove(tempDir);
  await fs.ensureDir(targetDir);
  await fs.ensureDir(tempDir);

  try {
    // Download
    echo`⬇️ Downloading: ${downloadUrl}`;
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(archivePath, Buffer.from(buffer));

    // Extract
    echo`📂 Extracting...`;
    if (target.filename.endsWith('.zip')) {
      if (os.platform() === 'win32') {
        const { execFileSync } = await import('child_process');
        const psCommand = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${archivePath.replace(/'/g, "''")}', '${tempDir.replace(/'/g, "''")}')`;
        execFileSync('powershell.exe', ['-NoProfile', '-Command', psCommand], { stdio: 'inherit' });
      } else {
        await $`unzip -q -o ${archivePath} -d ${tempDir}`;
      }
    } else {
      await $`tar -xzf ${archivePath} -C ${tempDir}`;
    }

    // Move binary
    // uv archives usually contain a folder named after the target
    const folderName = target.filename.replace('.tar.gz', '').replace('.zip', '');
    const sourceBin = path.join(tempDir, folderName, target.binName);

    if (await fs.pathExists(sourceBin)) {
      await fs.move(sourceBin, destBin, { overwrite: true });
    } else {
      echo(chalk.yellow`🔍 Binary not found in expected subfolder, searching...`);
      const files = await glob(`**/${target.binName}`, { cwd: tempDir, absolute: true });
      if (files.length > 0) {
        await fs.move(files[0], destBin, { overwrite: true });
      } else {
        throw new Error(`Could not find ${target.binName} in extracted files.`);
      }
    }

    // Permission fix
    if (os.platform() !== 'win32') {
      await fs.chmod(destBin, 0o755);
    }

    // Save to cache
    await fs.ensureDir(path.dirname(cachePath));
    await fs.copy(destBin, cachePath);
    echo(chalk.gray`💾 Cached to: ${cachePath}`);

    echo(chalk.green`✅ Success: ${destBin}`);
  } finally {
    // Cleanup
    await fs.remove(archivePath);
    await fs.remove(tempDir);
  }
}

// Main logic
const downloadAll = argv.all;
const platform = argv.platform;
const force = argv.force;

if (downloadAll) {
  // Download for all platforms
  echo(chalk.cyan`🌐 Downloading uv binaries for ALL supported platforms...`);
  for (const id of Object.keys(TARGETS)) {
    await setupTarget(id, force);
  }
} else if (platform) {
  // Download for a specific platform (e.g., --platform=mac)
  const targets = PLATFORM_GROUPS[platform];
  if (!targets) {
    echo(chalk.red`❌ Unknown platform: ${platform}`);
    echo(`Available platforms: ${Object.keys(PLATFORM_GROUPS).join(', ')}`);
    process.exit(1);
  }

  echo(chalk.cyan`🎯 Downloading uv binaries for platform: ${platform}`);
  echo(`   Architectures: ${targets.join(', ')}`);
  for (const id of targets) {
    await setupTarget(id, force);
  }
} else {
  // Download for current system only (default for local dev)
  const currentId = `${os.platform()}-${os.arch()}`;
  echo(chalk.cyan`💻 Detected system: ${currentId}`);

  if (TARGETS[currentId]) {
    await setupTarget(currentId, force);
  } else {
    echo(chalk.red`❌ Current system ${currentId} is not in the supported download list.`);
    echo(`Supported targets: ${Object.keys(TARGETS).join(', ')}`);
    echo(`\nTip: Use --platform=<platform> to download for a specific platform`);
    echo(`     Use --all to download for all platforms`);
    echo(`     Use --force to force re-download`);
    process.exit(1);
  }
}

echo(chalk.green`\n🎉 Done!`);
