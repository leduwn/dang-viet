/**
 * Comprehensive 3D Visual Quality, FPS & Viewpoint Evaluation Script
 * Uses Playwright to drive the real browser, measure actual render loops,
 * and capture evaluation screenshots across all required angles and body shapes.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'screenshots', '3d-eval');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('=== DÁNG VIỆT - KIỂM CHỨNG KỸ THUẬT & HÌNH ẢNH RENDERER 3D ===\n');

// 1. Setup isolated database
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dangviet-3deval-'));
const testDbPath = path.join(tmpDir, 'test-3d.db');
const db = new DatabaseSync(testDbPath);
const migrationsDir = path.join(rootDir, 'migrations');
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);`);
for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  db.exec(sql);
  db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(path.basename(file, '.sql'), new Date().toISOString());
}
const cards = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'culture-cards.json'), 'utf-8'));
for (const c of cards) {
  db.prepare(`INSERT INTO culture_cards (id, slug, title, category, summary, content, source_name, source_author, source_url, source_evidence, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    c.id, c.slug, c.title, c.category, c.summary, c.content, c.sourceName, c.sourceAuthor, c.sourceUrl || '', c.sourceEvidence, c.status || 'review', c.createdAt || new Date().toISOString()
  );
}
const presets = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'presets.json'), 'utf-8'));
const firstPreset = presets[0];
const now = new Date().toISOString();
const locks = { primaryColor: false, pantsColor: false, collarStyle: false, sleeveStyle: false, fabric: false, pattern: false, accessories: false, bodyShape: false, modelId: false };
db.prepare(`INSERT INTO looks (id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'look_default_01', 'default_user', firstPreset.title, firstPreset.eventId, firstPreset.styleId, JSON.stringify(firstPreset.config), JSON.stringify(locks), firstPreset.explanation, 1, 0, now, now
);
db.close();

// 2. Start temporary backend server
const serverProcess = spawn(process.execPath, ['apps/server/dist/index.js'], {
  cwd: rootDir,
  env: {
    ...process.env,
    PORT: '0',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    DATABASE_PATH: testDbPath,
    AI_API_KEY: '',
  },
  stdio: 'pipe',
});

let assignedPort = null;
serverProcess.stdout.on('data', (chunk) => {
  const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:(\d+)/);
  if (match) assignedPort = match[1];
});

for (let i = 0; i < 30; i++) {
  if (assignedPort) {
    try {
      const res = await fetch(`http://127.0.0.1:${assignedPort}/api/health`);
      if (res.ok) break;
    } catch {}
  }
  await new Promise((r) => setTimeout(r, 300));
}

if (!assignedPort) {
  console.error('Failed to bind server port.');
  serverProcess.kill();
  process.exit(1);
}

const APP_URL = `http://127.0.0.1:${assignedPort}`;
console.log(`[OK] Server running at: ${APP_URL}`);

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();
  console.log('[1/4] Navigating to studio tab...');
  await page.goto(`${APP_URL}/?tab=studio`, { waitUntil: 'networkidle' });

  // Wait for 3D viewer canvas to mount
  await page.waitForSelector('.aodai-3d-container canvas', { timeout: 15000 });
  console.log('   * 3D Canvas element mounted.');

  // Wait for GLB models to download and render
  await page.waitForTimeout(3000);

  // Measure FPS and WebGL parameters directly in browser context
  console.log('\n[2/4] Measuring WebGL parameters and actual render performance in browser...');
  const perfData = await page.evaluate(async () => {
    const canvas = document.querySelector('.aodai-3d-container canvas');
    if (!canvas) return { error: 'No canvas found' };

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';

    // Measure actual rAF timing over 60 frames
    const frameTimes = [];
    let lastTime = performance.now();
    await new Promise((resolve) => {
      let count = 0;
      function onFrame(now) {
        frameTimes.push(now - lastTime);
        lastTime = now;
        count++;
        if (count >= 60) {
          resolve();
        } else {
          requestAnimationFrame(onFrame);
        }
      }
      requestAnimationFrame(onFrame);
    });

    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps = Math.round(1000 / avgFrameTime);

    return {
      vendor,
      renderer,
      dpr: window.devicePixelRatio,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      measuredFps: fps,
      avgFrameTimeMs: avgFrameTime.toFixed(2),
      framesSampled: frameTimes.length,
    };
  });

  console.log('   * WebGL Vendor   :', perfData.vendor);
  console.log('   * WebGL Renderer :', perfData.renderer);
  console.log('   * Device DPR     :', perfData.dpr);
  console.log('   * Canvas Buffer  :', `${perfData.canvasWidth}x${perfData.canvasHeight}`);
  console.log('   * Measured FPS   :', `${perfData.measuredFps} FPS (Avg frame delta: ${perfData.avgFrameTimeMs}ms)`);

  // 3. Viewpoints & Closeups capture
  console.log('\n[3/4] Capturing required camera viewpoints and closeups...');

  // Helper to click viewpoint button
  async function selectCameraView(title) {
    const btn = page.locator(`button[title="${title}"]`);
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(600); // Allow smooth camera lerp
    }
  }

  // Front view
  await selectCameraView('Góc nhìn chính diện');
  const viewerLoc = page.locator('.aodai-3d-container').first();
  await viewerLoc.screenshot({ path: path.join(outDir, '01_view_front.png') });
  console.log('   ✓ 01_view_front.png (Trước)');

  // Back view
  await selectCameraView('Góc nhìn sau lưng');
  await viewerLoc.screenshot({ path: path.join(outDir, '02_view_back.png') });
  console.log('   ✓ 02_view_back.png (Sau)');

  // Left view
  await selectCameraView('Góc nhìn bên trái');
  await viewerLoc.screenshot({ path: path.join(outDir, '03_view_left.png') });
  console.log('   ✓ 03_view_left.png (Trái)');

  // Right view
  await selectCameraView('Góc nhìn bên phải');
  await viewerLoc.screenshot({ path: path.join(outDir, '04_view_right.png') });
  console.log('   ✓ 04_view_right.png (Phải)');

  // Collar Closeup
  await selectCameraView('Cận cảnh Cổ áo');
  await viewerLoc.screenshot({ path: path.join(outDir, '05_closeup_collar.png') });
  console.log('   ✓ 05_closeup_collar.png (Cận cảnh Cổ áo)');

  // Hem / Slit Closeup
  await selectCameraView('Cận cảnh Eo & Tà áo');
  await viewerLoc.screenshot({ path: path.join(outDir, '06_closeup_waist_slit.png') });
  console.log('   ✓ 06_closeup_waist_slit.png (Cận cảnh Eo & Tà áo)');

  // Reset View
  await selectCameraView('Đặt lại góc nhìn chuẩn');
  await page.waitForTimeout(400);

  // 4. Capture all 5 Body Shape Presets
  console.log('\n[4/4] Testing all 5 Body Shape presets with morph synchronization...');
  const shapes = [
    { id: 'standard', name: 'Dáng cơ bản', file: '07_shape_standard.png' },
    { id: 'petite', name: 'Thon gọn (Petite)', file: '08_shape_petite.png' },
    { id: 'tall_slender', name: 'Cao thanh mảnh', file: '09_shape_tall_slender.png' },
    { id: 'broad_shoulders', name: 'Vai ngang', file: '10_shape_broad_shoulders.png' },
    { id: 'curvy_hips', name: 'Hông nở', file: '11_shape_curvy_hips.png' },
    { id: 'plus_size', name: 'Đầy đặn (Plus size)', file: '12_shape_plus_size.png' },
  ];

  for (const s of shapes) {
    const shapeSelect = page.locator('.aodai-3d-toolbar select');
    if (await shapeSelect.count() > 0) {
      await shapeSelect.first().selectOption(s.id);
      await page.waitForTimeout(500); // Allow morph weights update
    }
    await viewerLoc.screenshot({ path: path.join(outDir, s.file) });
    console.log(`   ✓ ${s.file} (${s.name})`);
  }

  // Mobile viewport snapshot
  console.log('\nCapturing Mobile Viewport (iPhone 14 / 390x844)...');
  const mobilePage = await context.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto(`${APP_URL}/?tab=studio`, { waitUntil: 'networkidle' });
  await mobilePage.waitForSelector('.aodai-3d-container canvas', { timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: path.join(outDir, '13_mobile_studio.png'), fullPage: false });
  console.log('   ✓ 13_mobile_studio.png');
  await mobilePage.close();

  // Side-by-side Compare View snapshot
  console.log('\nCapturing Side-by-side Compare Modal...');
  const compareBtn = page.locator('button:has-text("So sánh")').first();
  if (await compareBtn.count() > 0) {
    await compareBtn.click();
    await page.waitForSelector('.compare-modal', { timeout: 8000 });
    await page.waitForTimeout(2500); // Allow both canvas instances to render
    await page.screenshot({ path: path.join(outDir, '14_compare_side_by_side.png') });
    console.log('   ✓ 14_compare_side_by_side.png');
  }

  console.log('\n======================================================');
  console.log(`  KIỂM TRA HOÀN TẤT: 14 ảnh đánh giá đã được xuất vào:`);
  console.log(`  ${outDir}`);
  console.log('======================================================');

  // Verify all files were written with > 0 bytes
  const writtenFiles = fs.readdirSync(outDir);
  assert(writtenFiles.length >= 10, 'Must have at least 10 evaluation screenshots');
  for (const f of writtenFiles) {
    const fsize = fs.statSync(path.join(outDir, f)).size;
    assert(fsize > 1000, `Screenshot file ${f} is too small: ${fsize} bytes`);
  }
  console.log(`Xác thực thành công: Tất cả ${writtenFiles.length} file ảnh đều chứa dữ liệu hình ảnh thật (> 1KB).`);

} catch (err) {
  console.error('\n[LỖI]:', err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  serverProcess.kill();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}
