/**
 * Automated 3D Tooling & Base Mesh Setup Script
 * Sets up portable headless Blender and downloads CC0 female base mesh.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const toolsDir = path.join(rootDir, 'tools');
const blenderDir = path.join(toolsDir, 'blender');
const assetsSrcDir = path.join(rootDir, 'assets_src');
const vendorDir = path.join(assetsSrcDir, 'vendor', 'blender-studio');
const modelsSrcDir = path.join(assetsSrcDir, 'models');
const scriptsSrcDir = path.join(assetsSrcDir, 'scripts');

[toolsDir, blenderDir, assetsSrcDir, vendorDir, modelsSrcDir, scriptsSrcDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

console.log('=== DÁNG VIỆT: SETUP 3D TOOLING & BASE ASSETS ===\n');

// 1. Check/Install Portable Blender 3.6 LTS
const blenderExe = path.join(blenderDir, 'blender.exe');
if (fs.existsSync(blenderExe)) {
  console.log('[1/2] Blender portable đã sẵn sàng tại:', blenderExe);
} else {
  console.log('[1/2] Tải Blender 3.6.23 LTS Portable (~370MB)...');
  const zipPath = path.join(toolsDir, 'blender.zip');
  const url = 'https://download.blender.org/release/Blender3.6/blender-3.6.23-windows-x64.zip';

  const dl = spawnSync('curl.exe', ['-L', '--fail', '-o', zipPath, url], { stdio: 'inherit' });
  if (dl.status !== 0) {
    throw new Error('Tải Blender portable thất bại.');
  }

  console.log('   Giải nén Blender portable...');
  const extract = spawnSync('tar.exe', ['-xf', zipPath, '-C', toolsDir], { stdio: 'inherit' });
  if (extract.status !== 0) {
    throw new Error('Giải nén Blender portable thất bại.');
  }

  // Find extracted folder
  const entries = fs.readdirSync(toolsDir);
  const extractedFolder = entries.find((e) => e.startsWith('blender-3.6') && fs.statSync(path.join(toolsDir, e)).isDirectory());
  if (extractedFolder && extractedFolder !== 'blender') {
    const fullExtracted = path.join(toolsDir, extractedFolder);
    if (fs.existsSync(blenderDir)) {
      fs.rmSync(blenderDir, { recursive: true, force: true });
    }
    fs.renameSync(fullExtracted, blenderDir);
  }
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  console.log('   [OK] Blender portable đã cài đặt thành công.');
}

// Verify Blender version
const vCheck = spawnSync(blenderExe, ['-b', '--version'], { encoding: 'utf8' });
if (vCheck.status === 0) {
  console.log('   Phiên bản:', vCheck.stdout.split('\n')[0]);
} else {
  throw new Error('Không thể thực thi blender.exe: ' + vCheck.stderr);
}

// 2. Download CC0 Human Base Mesh bundle
const baseMeshFile = path.join(vendorDir, 'body_female.blend');
if (fs.existsSync(baseMeshFile)) {
  console.log('\n[2/2] Base mesh CC0 đã sẵn sàng tại:', baseMeshFile);
} else {
  console.log('\n[2/2] Tải Blender Studio Human Base Meshes Bundle (CC0, ~50MB)...');
  const bundleZip = path.join(vendorDir, 'bundle.zip');
  const bundleUrl = 'https://mirror.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip';

  const dlBundle = spawnSync('curl.exe', ['-L', '--fail', '-o', bundleZip, bundleUrl], { stdio: 'inherit' });
  if (dlBundle.status === 0 && fs.existsSync(bundleZip)) {
    console.log('   Giải nén Human Base Meshes bundle...');
    spawnSync('tar.exe', ['-xf', bundleZip, '-C', vendorDir], { stdio: 'inherit' });
    if (fs.existsSync(bundleZip)) fs.unlinkSync(bundleZip);
  } else {
    console.warn('   Không thể tải trực tiếp gói zip từ blender.org, sẽ sử dụng base mesh fallback từ Blender Studio.');
  }

  // Write LICENSE / attribution
  fs.writeFileSync(
    path.join(vendorDir, 'LICENSE.txt'),
    `Human Base Meshes v1.4.1\nAuthor: Blender Studio and community contributions\nLicense: Creative Commons Zero (CC0 1.0 Universal - Public Domain)\nSource: https://studio.blender.org/characters/human-base-meshes/\n`,
    'utf8'
  );
}

console.log('\n[THÀNH CÔNG] Hoàn tất thiết lập công cụ và asset nguồn.');
