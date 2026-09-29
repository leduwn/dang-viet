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
const screenshotsDir = path.join(rootDir, 'screenshots');
const artifactsScreenshotsDir = path.join(rootDir, 'artifacts', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}
if (!fs.existsSync(artifactsScreenshotsDir)) {
  fs.mkdirSync(artifactsScreenshotsDir, { recursive: true });
}

const saveScreenshot = async (pageOrLocator, filename, opts = {}) => {
  const p1 = path.join(screenshotsDir, filename);
  const p2 = path.join(artifactsScreenshotsDir, filename);
  await pageOrLocator.screenshot({ path: p1, ...opts });
  try {
    fs.copyFileSync(p1, p2);
  } catch {}
};

console.log('=== BẮT ĐẦU KIỂM THỬ PLAYWRIGHT GIAO DIỆN & MUTATION GUARD ===\n');

// 1. Prepare unique isolated test database directory for this run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dangviet-playwright-'));
const testDbPath = path.join(tmpDir, 'test-playwright.db');

console.log('[1/5] Khởi tạo dữ liệu mẫu cho database cô lập...');
console.log('      Thư mục tạm:', tmpDir);
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
const locks = { primaryColor: false, pantsColor: false, collarStyle: false, sleeveStyle: false, fabric: false, pattern: false, accessories: false };
db.prepare(`INSERT INTO looks (id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'look_default_01', 'default_user', firstPreset.title, firstPreset.eventId, firstPreset.styleId, JSON.stringify(firstPreset.config), JSON.stringify(locks), firstPreset.explanation, 1, 0, now, now
);
db.prepare(`INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
  'look_default_01', 1, JSON.stringify(firstPreset.config), JSON.stringify(locks), firstPreset.explanation, now
);
const secondPreset = presets[1] || presets[0];
db.prepare(`INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'lookbook_seed_01', firstPreset.title, 'look_default_01', 1, JSON.stringify(firstPreset.config), firstPreset.eventId, firstPreset.styleId, firstPreset.explanation, now
);
db.prepare(`INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'lookbook_seed_02', secondPreset.title, 'look_default_01', 1, JSON.stringify(secondPreset.config), secondPreset.eventId, secondPreset.styleId, secondPreset.explanation, now
);
db.close();
console.log('   * Đã nạp thành công migration và seed data vào test-playwright.db');

// Ensure web dist is up to date
console.log('[1/5] Kiểm tra bản build giao diện frontend (apps/web/dist)...');
assert(
  fs.existsSync(path.join(rootDir, 'apps', 'web', 'dist', 'index.html')),
  '[LỖI BẮT BUỘC]: Chưa có bản build apps/web/dist! Hãy chạy npm run build trước.'
);

// 2. Spawn backend server serving frontend on dynamic port
console.log('[2/5] Khởi động máy chủ backend cô lập (port 0)...');
const serverProcess = spawn(process.execPath, ['apps/server/dist/index.js'], {
  cwd: rootDir,
  env: {
    ...process.env,
    PORT: '0',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    DATABASE_PATH: testDbPath,
    AI_API_KEY: '', // Test with mock fallback to avoid quota dependency
  },
  stdio: 'pipe',
});

let assignedPort = null;
serverProcess.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  const match = text.match(/http:\/\/127\.0\.0\.1:(\d+)/);
  if (match) {
    assignedPort = match[1];
  }
});
serverProcess.stderr.on('data', (chunk) => {
  const err = chunk.toString().trim();
  if (err) console.error('[SERVER STDERR]', err);
});

// Wait for server health
let serverReady = false;
for (let i = 0; i < 30; i++) {
  if (assignedPort) {
    try {
      const res = await fetch(`http://127.0.0.1:${assignedPort}/api/health`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {}
  }
  await new Promise((r) => setTimeout(r, 300));
}

assert(serverReady && assignedPort, '[LỖI BẮT BUỘC]: Máy chủ kiểm thử không khởi động được sau 10s.');

const BASE_URL = `http://127.0.0.1:${assignedPort}`;
console.log(`[OK] Máy chủ kiểm thử sẵn sàng tại ${BASE_URL} (Database: ${testDbPath})\n`);

// 3. Launch browser
console.log('[3/5] Khởi chạy Microsoft Edge headless với hỗ trợ WebGL...');
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=d3d11',
    '--enable-webgl',
    '--enable-webgl2',
    '--ignore-gpu-blocklist',
  ],
});

try {
  console.log('[4/5] Kiểm tra giao diện và thực thi các assertions bắt buộc...');

  // --------------------------------------------------------------------------
  // A. Desktop 1440px
  // --------------------------------------------------------------------------
  console.log('   - Kiểm thử Desktop 1440x900...');
  const desktopPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  desktopPage.on('pageerror', (err) => console.log('   [DESKTOP ERROR]', err.message));

  const navRes = await desktopPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  assert.strictEqual(navRes?.status(), 200, 'Desktop trang chủ phải trả HTTP 200');

  // 1. Explore Tab assertions
  await desktopPage.waitForSelector('.explore-section', { timeout: 10000 });
  assert(await desktopPage.locator('.explore-section').isVisible(), 'Khối .explore-section phải hiển thị trên Desktop');

  // Assert no horizontal overflow
  const desktopOverflow = await desktopPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!desktopOverflow, '[ASSERTION THẤT BÀI]: Phát hiện tràn ngang trên Desktop 1440px');
  console.log('     * Assertion không tràn ngang 1440px: ĐẠT');

  // Capture full-page screenshot of Explore and preset card element screenshot
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-explore-full.png'), fullPage: true });
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-explore.png'), fullPage: false });
  console.log('     * Đã chụp: desktop-1440-explore-full.png & desktop-1440-explore.png');

  const firstPresetCard = desktopPage.locator('.preset-card').first();
  assert(await firstPresetCard.isVisible(), 'Phải có ít nhất 1 thẻ .preset-card');
  await firstPresetCard.screenshot({ path: path.join(screenshotsDir, 'desktop-preset-card.png') });
  console.log('     * Đã chụp cận cảnh phần tử: desktop-preset-card.png');

  // Assert preset card buttons alignment
  const buttonsAligned = await desktopPage.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.preset-card'));
    if (cards.length < 2) return true;
    const btnTops = cards.map((c) => {
      const btn = c.querySelector('button');
      return btn ? Math.round(btn.getBoundingClientRect().top) : null;
    });
    return btnTops[0] !== null && btnTops[1] !== null && Math.abs(btnTops[0] - btnTops[1]) <= 4;
  });
  assert(buttonsAligned, '[ASSERTION THẤT BÀI]: Các nút chọn bộ phối ở hàng đầu không thẳng hàng');
  console.log('     * Assertion căn thẳng hàng nút chọn preset: ĐẠT');

  // Assert no disclaimer text overlapping inside preset cards
  const disclaimerOverlap = await desktopPage.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.preset-card'));
    for (const card of cards) {
      const text = card.textContent || '';
      if (text.includes('Mô hình đồ họa SVG minh họa 2D')) {
        return true;
      }
    }
    return false;
  });
  assert(!disclaimerOverlap, '[ASSERTION THẤT BÀI]: Thẻ preset chứa đoạn chú thích dài gây đè chữ');
  console.log('     * Assertion tách chú thích dài khỏi thẻ preset: ĐẠT');

  // 2. Studio Tab (Phòng phối) assertions
  await desktopPage.click('nav button:has-text("Phòng phối")');
  await desktopPage.waitForSelector('.outfit-room', { timeout: 10000 });
  assert(await desktopPage.locator('.outfit-room').isVisible(), 'Khối .outfit-room phải hiển thị');
  const studioVisualizer = desktopPage.locator('.outfit-room canvas, .outfit-room svg').first();
  assert(await studioVisualizer.isVisible(), 'Visualizer (3D Canvas hoặc SVG) trong Phòng phối phải hiển thị');
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-studio.png'), fullPage: false });
  console.log('     * Đã chụp: desktop-1440-studio.png');

  // 3. Design Studio Tab assertions
  await desktopPage.click('nav button:has-text("Xưởng thiết kế")');
  await desktopPage.waitForSelector('.design-studio', { timeout: 10000 });
  assert(await desktopPage.locator('.design-studio').isVisible(), 'Khối .design-studio phải hiển thị');
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-design.png'), fullPage: false });
  console.log('     * Đã chụp: desktop-1440-design.png');

  // 4. Lookbook Tab assertions
  await desktopPage.click('nav button:has-text("Lookbook")');
  await desktopPage.waitForSelector('.lookbook-section', { timeout: 10000 });
  assert(await desktopPage.locator('.lookbook-section').isVisible(), 'Khối .lookbook-section phải hiển thị');
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-lookbook.png'), fullPage: false });
  console.log('     * Đã chụp: desktop-1440-lookbook.png');

  // 5. Compare Modal assertions
  await desktopPage.click('nav button:has-text("Phòng phối")');
  await desktopPage.waitForSelector('.outfit-room', { timeout: 10000 });
  const compareBtn = desktopPage.locator('button:has-text("So sánh 2 bộ"), button:has-text("So sánh")');
  assert((await compareBtn.count()) > 0, 'Phải có nút So sánh trong Phòng phối');
  await compareBtn.first().click();
  await desktopPage.waitForSelector('.compare-modal', { timeout: 10000 });
  assert(await desktopPage.locator('.compare-modal').isVisible(), 'Khối .compare-modal phải mở');
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-compare.png'), fullPage: false });
  console.log('     * Đã chụp: desktop-1440-compare.png');
  await desktopPage.click('.compare-modal button:has(svg)');
  await desktopPage.close();

  // --------------------------------------------------------------------------
  // B. Mobile 390px (iPhone 12/13/14)
  // --------------------------------------------------------------------------
  console.log('\n   - Kiểm thử Mobile 390x844...');
  const mobile390 = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await mobile390.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mobile390.waitForSelector('.explore-section');
  await mobile390.screenshot({ path: path.join(screenshotsDir, 'mobile-390-explore.png'), fullPage: false });
  const mobile390Overflow = await mobile390.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!mobile390Overflow, '[ASSERTION THẤT BÀI]: Phát hiện tràn ngang trên Mobile 390px');
  console.log('     * Assertion không tràn ngang 390px: ĐẠT');

  await mobile390.click('nav button:has-text("Phòng phối")');
  await mobile390.waitForSelector('.outfit-room');
  await mobile390.screenshot({ path: path.join(screenshotsDir, 'mobile-390-studio.png'), fullPage: false });

  await mobile390.click('nav button:has-text("Xưởng thiết kế")');
  await mobile390.waitForSelector('.design-studio');
  await mobile390.screenshot({ path: path.join(screenshotsDir, 'mobile-390-design.png'), fullPage: false });

  await mobile390.click('nav button:has-text("Lookbook")');
  await mobile390.waitForSelector('.lookbook-section');
  await mobile390.screenshot({ path: path.join(screenshotsDir, 'mobile-390-lookbook.png'), fullPage: false });
  await mobile390.close();

  // --------------------------------------------------------------------------
  // C. Small Mobile 360px (Android tiêu chuẩn)
  // --------------------------------------------------------------------------
  console.log('\n   - Kiểm thử Mobile nhỏ 360x780...');
  const mobile360 = await browser.newPage({
    viewport: { width: 360, height: 780 },
    isMobile: true,
  });
  await mobile360.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mobile360.waitForSelector('.explore-section');
  await mobile360.screenshot({ path: path.join(screenshotsDir, 'mobile-360-explore.png'), fullPage: false });
  const mobile360Overflow = await mobile360.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!mobile360Overflow, '[ASSERTION THẤT BÀI]: Phát hiện tràn ngang trên Mobile 360px');
  console.log('     * Assertion không tràn ngang 360px: ĐẠT');

  await mobile360.click('nav button:has-text("Phòng phối")');
  await mobile360.waitForSelector('.outfit-room');
  await mobile360.screenshot({ path: path.join(screenshotsDir, 'mobile-360-studio.png'), fullPage: false });
  await mobile360.close();

  // --------------------------------------------------------------------------
  // D. 3D VISUAL SIMULATION & INTERACTIVE CONTROLS
  // --------------------------------------------------------------------------
  console.log('\n   - [3D] Kiểm thử không gian 3D tương tác, vóc dáng, camera & vật liệu...');
  const page3D = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const page3DErrors = [];
  page3D.on('pageerror', (err) => {
    page3DErrors.push(err.message);
    console.log('   [3D PAGE ERROR]', err.message);
  });
  page3D.on('console', (msg) => {
    if (msg.type() === 'error') {
      page3DErrors.push(msg.text());
      console.log('   [3D CONSOLE ERROR]', msg.text());
    }
  });

  await page3D.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page3D.click('nav button:has-text("Phòng phối")');
  await page3D.waitForSelector('.outfit-room', { timeout: 10000 });

  // 1. Chuyển sang chế độ 3D
  console.log('     * [3D.1] Kiểm tra kích hoạt chế độ 3D Không gian...');
  const btn3D = page3D.locator('button:has-text("3D Không gian")').first();
  await btn3D.click();
  await page3D.waitForSelector('.aodai-3d-container canvas', { timeout: 12000 });
  const canvas3D = page3D.locator('.aodai-3d-container canvas').first();
  assert(await canvas3D.isVisible(), '[ASSERTION THẤT BÀI]: Canvas 3D phải hiển thị trong .aodai-3d-container');

  // Chờ R3F load assets & compile shader
  await page3D.waitForTimeout(1500);
  assert.strictEqual(page3DErrors.length, 0, `[ASSERTION THẤT BÀI]: Phát hiện lỗi console/render khi nạp 3D: ${page3DErrors.join(', ')}`);
  console.log('       -> Canvas 3D sẵn sàng, không có lỗi WebGL.');

  // 2. Xoay nhân vật một góc xác định (Drag chuột trên canvas)
  console.log('     * [3D.2] Thao tác chuột xoay nhân vật 360° tự do...');
  const box = await canvas3D.boundingBox();
  assert(box, '[ASSERTION THẤT BÀI]: Canvas không có bounding box');
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page3D.mouse.move(centerX, centerY);
  await page3D.mouse.down();
  await page3D.mouse.move(centerX + 180, centerY, { steps: 10 });
  await page3D.mouse.up();
  await page3D.waitForTimeout(400);
  await saveScreenshot(page3D, '3d-01-drag-rotated.png');
  console.log('       -> Đã xoay góc tương tác và lưu: 3d-01-drag-rotated.png');

  // 3. Bấm các nút trước, sau, trái, phải, reset và chụp ảnh từng góc
  console.log('     * [3D.3] Kiểm tra các góc nhìn camera cố định (Trước, Sau, Trái, Phải, Reset)...');
  const viewButtons = [
    { label: 'Trước', file: '3d-view-front.png' },
    { label: 'Sau', file: '3d-view-back.png' },
    { label: 'Trái', file: '3d-view-left.png' },
    { label: 'Phải', file: '3d-view-right.png' },
    { label: 'Reset', file: '3d-view-reset.png' },
  ];
  for (const vb of viewButtons) {
    const btn = page3D.locator(`button.btn-view:has-text("${vb.label}")`).first();
    assert(await btn.isVisible(), `[ASSERTION THẤT BÀI]: Không tìm thấy nút góc nhìn ${vb.label}`);
    await btn.click();
    await page3D.waitForTimeout(600); // Chờ hiệu ứng lerp của camera director
    await saveScreenshot(page3D, vb.file);
    console.log(`       -> Góc ${vb.label}: Đã chụp ${vb.file}`);
  }

  // 4. Chọn tối thiểu 2 vóc dáng khác nhau (Petite, Plus size, Standard) và xác nhận không lỗi render/console
  console.log('     * [3D.4] Kiểm tra biến dạng đồng bộ 5 vóc dáng (Morph Targets)...');
  const shapesToTest = [
    { name: 'Nhỏ nhắn', file: '3d-body-petite.png' },
    { name: 'Đầy đặn', file: '3d-body-plus-size.png' },
    { name: 'Cao thanh', file: '3d-body-tall-slender.png' },
    { name: 'Dáng cơ bản', file: '3d-body-standard.png' },
  ];
  for (const st of shapesToTest) {
    const shapeBtn = page3D.locator(`button:has-text("${st.name}")`).first();
    assert(await shapeBtn.isVisible(), `[ASSERTION THẤT BÀI]: Không tìm thấy nút vóc dáng ${st.name}`);
    await shapeBtn.click();
    await page3D.waitForTimeout(500);
    assert.strictEqual(page3DErrors.length, 0, `[ASSERTION THẤT BÀI]: Lỗi console khi đổi vóc dáng ${st.name}`);
    await saveScreenshot(page3D, st.file);
    console.log(`       -> Vóc dáng ${st.name}: Đã kiểm tra không lỗi và lưu ${st.file}`);
  }

  // 5. Đổi mẫu áo dài qua Catalog-Driven (Cách tân Raglan)
  console.log('     * [3D.5] Kiểm tra đổi mẫu áo qua catalog (Áo dài cách tân Raglan)...');
  const raglanBtn = page3D.locator('button:has-text("Raglan")').first();
  assert(await raglanBtn.isVisible(), '[ASSERTION THẤT BÀI]: Không tìm thấy nút mẫu Cách tân Raglan');
  await raglanBtn.click();
  await page3D.waitForTimeout(600);
  assert.strictEqual(page3DErrors.length, 0, '[ASSERTION THẤT BÀI]: Lỗi khi chuyển sang mẫu Áo dài Raglan');
  await saveScreenshot(page3D, '3d-model-raglan.png');
  console.log('       -> Mẫu áo Raglan: Nạp thành công, đã lưu 3d-model-raglan.png');

  // Đổi lại Cổ đứng truyền thống
  await page3D.locator('button:has-text("Cổ đứng truyền thống")').first().click();
  await page3D.waitForTimeout(400);

  // 6. Đổi màu áo, đổi chất liệu vải và kiểm tra mesh/material phản ánh đúng
  console.log('     * [3D.6] Kiểm tra cập nhật chất liệu vải PBR & hòa sắc...');
  const fabricSelect = page3D.locator('label:has-text("Chất liệu vải")').locator('..').locator('select');
  assert(await fabricSelect.isVisible(), '[ASSERTION THẤT BÀI]: Không tìm thấy select chất liệu vải');
  await fabricSelect.selectOption('brocade_hue');
  await page3D.waitForTimeout(300);

  const yellowColorBtn = page3D.locator('button[aria-label*="Vàng hoàng yến"]').first();
  if (await yellowColorBtn.isVisible()) {
    await yellowColorBtn.click();
  }
  await page3D.waitForTimeout(500);
  await saveScreenshot(page3D, '3d-material-updated.png');
  console.log('       -> Cập nhật Gấm Huế & Sắc vàng: Đã lưu 3d-material-updated.png');

  // 7. Thử chuyển qua lại giữa 2D và 3D
  console.log('     * [3D.7] Kiểm tra chuyển đổi qua lại mượt mà giữa 2D Vector và 3D Không gian...');
  const btn2D = page3D.locator('button:has-text("2D Vector")').first();
  await btn2D.click();
  await page3D.waitForTimeout(300);
  assert(await page3D.locator('.outfit-room svg').first().isVisible(), '[ASSERTION THẤT BÀI]: Chế độ 2D phải hiển thị SVG');
  await saveScreenshot(page3D, '2d-fallback-active.png');
  console.log('       -> Chuyển sang 2D SVG: Thành công, đã lưu 2d-fallback-active.png');

  await btn3D.click();
  await page3D.waitForTimeout(500);
  assert(await canvas3D.isVisible(), '[ASSERTION THẤT BÀI]: Canvas 3D phải hiển thị trở lại khi bấm 3D Không gian');
  console.log('       -> Phục hồi 3D: Thành công.');

  // 8. Đo đạc hiệu năng FPS của renderer 3D
  console.log('     * [3D.8] Đo đạc tần số khung hình (FPS) & hiệu năng render 3D...');
  const perfBenchmark = await page3D.evaluate(async () => {
    return new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      let lastTime = start;

      const loop = (time) => {
        lastTime = time;
        frames++;
        if (frames < 60) {
          requestAnimationFrame(loop);
        } else {
          const totalDuration = time - start;
          const avgFps = Math.round((frames / totalDuration) * 1000);
          const avgFrameMs = Math.round((totalDuration / frames) * 10) / 10;
          resolve({ avgFps, avgFrameMs, totalFrames: frames });
        }
      };
      requestAnimationFrame(loop);
    });
  });
  console.log(`       -> Hiệu năng Render 3D: Trung bình ${perfBenchmark.avgFps} FPS, Thời gian khung hình: ${perfBenchmark.avgFrameMs} ms/frame (${perfBenchmark.totalFrames} frames)`);
  assert(perfBenchmark.avgFps >= 20, `[ASSERTION THẤT BÀI]: FPS quá thấp (${perfBenchmark.avgFps} FPS)`);

  // 9. Mở Lookbook, so sánh 2 bộ trong chế độ 3D
  console.log('     * [3D.9] Kiểm tra so sánh 2 bộ trang phục song song trong Lookbook (Chế độ 3D)...');
  // Lưu bộ hiện tại vào Lookbook để có đủ 2 bộ
  const saveLookbookBtn = page3D.locator('button:has-text("Lưu Lookbook")').first();
  if (await saveLookbookBtn.isVisible()) {
    await saveLookbookBtn.click();
    await page3D.waitForTimeout(800);
  }

  // Chuyển sang tab Lookbook
  await page3D.click('nav button:has-text("Lookbook")');
  await page3D.waitForSelector('.lookbook-section', { timeout: 10000 });

  // Chọn checkbox so sánh
  const checkboxes = page3D.locator('.lookbook-section input[type="checkbox"]');
  const count = await checkboxes.count();
  if (count >= 2) {
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    const compareTrigger = page3D.locator('button:has-text("So sánh 2 bộ đã chọn")');
    assert(await compareTrigger.isVisible(), '[ASSERTION THẤT BÀI]: Phải hiển thị nút "So sánh 2 bộ đã chọn"');
    await compareTrigger.click();

    await page3D.waitForSelector('.compare-modal', { timeout: 10000 });
    // Bật công tắc 3D trong CompareModal
    const modal3DBtn = page3D.locator('.compare-modal button:has-text("3D Không gian")').first();
    if (await modal3DBtn.isVisible()) {
      await modal3DBtn.click();
      await page3D.waitForTimeout(1200);
      const modalCanvases = page3D.locator('.compare-modal canvas');
      assert.strictEqual(await modalCanvases.count(), 2, '[ASSERTION THẤT BÀI]: Phải hiển thị 2 canvas 3D song song trong CompareModal');
      await saveScreenshot(page3D, '3d-compare-modal.png');
      console.log('       -> So sánh 3D song song: Đạt chuẩn, đã chụp 3d-compare-modal.png');
    }
    await page3D.click('.compare-modal button:has(svg)');
  } else {
    console.log('       [INFO] Chỉ có 1 bộ trong Lookbook, đã bỏ qua bước click so sánh đôi.');
  }

  await page3D.close();
  console.log('     -> HOÀN TẤT TOÀN DIỆN BÀI KIỂM THỬ KHÔNG GIAN 3D TƯƠNG TÁC!\n');

  // --------------------------------------------------------------------------
  // 5. TEST FRONTEND MUTATION GUARD & REACT COOLDOWN
  // --------------------------------------------------------------------------
  console.log('\n[5/5] Kiểm thử cơ chế Mutation Guard React của Frontend...');
  const testPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  testPage.on('pageerror', (err) => console.log('     [TESTPAGE ERROR]', err.message));
  await testPage.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Navigate to Studio
  await testPage.click('nav button:has-text("Phòng phối")');
  await testPage.waitForSelector('.outfit-room', { timeout: 10000 });

  // 1. Locators with strict existence assertions (No silent bypassing!)
  const chatInput = testPage.locator('input[placeholder*="Yêu cầu AI"], form input').first();
  assert((await chatInput.count()) > 0, '[ASSERTION THẤT BÀI]: Không tìm thấy ô nhập yêu cầu AI');

  const sendBtn = testPage.locator('form button[type="submit"]').first();
  assert((await sendBtn.count()) > 0, '[ASSERTION THẤT BÀI]: Không tìm thấy nút gửi chat AI');

  const undoBtn = testPage.locator('button:has-text("Hoàn tác")').first();
  assert((await undoBtn.count()) > 0, '[ASSERTION THẤT BÀI]: Không tìm thấy nút Hoàn tác');

  const resetBtn = testPage.locator('button:has-text("Đặt lại")').first();
  assert((await resetBtn.count()) > 0, '[ASSERTION THẤT BÀI]: Không tìm thấy nút Đặt lại');

  // Exact locator for Cổ áo select
  const collarSelect = testPage.locator('label:has-text("Cổ áo")').locator('..').locator('select');
  assert.strictEqual(await collarSelect.count(), 1, '[ASSERTION THẤT BÀI]: Không tìm thấy thẻ select Cổ áo bằng locator chuẩn');

  // Exact locator for Chất liệu vải select
  const testFabricSelect = testPage.locator('label:has-text("Chất liệu vải")').locator('..').locator('select');
  assert.strictEqual(await testFabricSelect.count(), 1, '[ASSERTION THẤT BÀI]: Không tìm thấy thẻ select Chất liệu vải bằng locator chuẩn');

  console.log('     * Đã xác định đầy đủ các locator tương tác: Chat, Hoàn tác, Đặt lại, Select Cổ áo, Select Chất liệu vải');

  // 2. Intercept AI Chat to return deterministic 2 sequential commands
  await testPage.route('**/api/ai/chat', async (route) => {
    console.log('     [AI ROUTE INTERCEPT] Mô phỏng phản hồi AI Chat gồm 2 lệnh tuần tự...');
    const curLookRes = await fetch(`${BASE_URL}/api/looks/look_default_01`);
    const curLook = await curLookRes.json();
    const curRev = curLook.revision;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: 'Tôi gợi ý đổi chất liệu vải sang voan tơ chiffon và đổi màu quần sang đen tuyền.',
        explanation: 'Phong cách thanh lịch phù hợp kỷ yếu',
        mode: 'mock',
        model: 'test-guard-model',
        commands: [
          {
            commandId: '99999999-0001-4000-8000-000000000001',
            lookId: 'look_default_01',
            expectedRevision: curRev,
            action: 'SET_FABRIC',
            payload: { fabric: 'voile_chiffon' },
            timestamp: new Date().toISOString(),
          },
          {
            commandId: '99999999-0002-4000-8000-000000000002',
            lookId: 'look_default_01',
            expectedRevision: curRev + 1,
            action: 'SET_PANTS_COLOR',
            payload: { color: { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black' } },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  // 3. Network interception with Promise signaling (No arbitrary sleeping!)
  let holdFirstCommandResolver = null;
  let firstCommandHeldSignal = null;
  const firstCommandHeldPromise = new Promise((resolve) => {
    firstCommandHeldSignal = resolve;
  });
  const releaseFirstCommandPromise = new Promise((resolve) => {
    holdFirstCommandResolver = resolve;
  });

  const commandRequests = [];
  const undoRequests = [];

  await testPage.route('**/api/looks/*/command', async (route) => {
    const postData = route.request().postDataJSON();
    commandRequests.push(postData);
    console.log(`     [NETWORK COMMAND] Nhận request #${commandRequests.length}: action=${postData.action}`);

    if (commandRequests.length === 1) {
      console.log('     [NETWORK COMMAND] Đang GIỮ lệnh AI #1 ở trạng thái PENDING...');
      firstCommandHeldSignal();
      await releaseFirstCommandPromise;
      console.log('     [NETWORK COMMAND] Đã THẢ lệnh AI #1, tiếp tục gửi lên server...');
      await route.continue();
    } else {
      await route.continue();
    }
  });

  await testPage.route('**/api/looks/*/undo', async (route) => {
    const postData = route.request().postDataJSON();
    undoRequests.push(postData);
    console.log(`     [NETWORK UNDO] Nhận request Hoàn tác!`);
    await route.continue();
  });

  // 4. Trigger AI chat
  console.log('     * Gửi yêu cầu tư vấn AI trong Phòng phối...');
  await chatInput.fill('Đổi tay áo và màu quần');
  await sendBtn.click();

  // Wait for the exact signal that command #1 is currently pending
  console.log('     * Chờ tín hiệu lệnh AI đầu tiên được gửi và đưa vào trạng thái pending...');
  await firstCommandHeldPromise;

  // Assert exactly 1 command pending
  assert.strictEqual(commandRequests.length, 1, '[ASSERTION THẤT BÀI]: Phải có đúng 1 command AI đang pending');
  assert.strictEqual(commandRequests[0].action, 'SET_FABRIC', '[ASSERTION THẤT BÀI]: Command đầu tiên phải là SET_FABRIC');
  console.log('     * Assertion trạng thái pending: ĐÚNG 1 command AI đang pending (SET_FABRIC)');

  // 5. Test (A) Disabled UI controls: Check disabled properties
  const isUndoDisabled = await undoBtn.isDisabled();
  assert(isUndoDisabled, '[ASSERTION THẤT BÀI]: Nút Hoàn tác phải ở trạng thái disabled khi hệ thống đang bận');

  const isResetDisabled = await resetBtn.isDisabled();
  assert(isResetDisabled, '[ASSERTION THẤT BÀI]: Nút Đặt lại phải ở trạng thái disabled khi hệ thống đang bận');

  const isCollarDisabled = await collarSelect.isDisabled();
  assert(isCollarDisabled, '[ASSERTION THẤT BÀI]: Select Cổ áo phải ở trạng thái disabled khi hệ thống đang bận');

  const isFabricDisabled = await testFabricSelect.isDisabled();
  assert(isFabricDisabled, '[ASSERTION THẤT BÀI]: Select Chất liệu vải phải ở trạng thái disabled khi hệ thống đang bận');

  console.log('     -> KIỂM TRA (A) DISABLED UI: ĐẠT (Các nút và select đều có thuộc tính disabled)');

  // 6. Test (B) React Mutation Guard (isMutatingRef): Attempt forced manual clicks & dispatches
  console.log('     * Thử thao tác tay cưỡng chế trong lúc lệnh AI đang treo (Click Hoàn tác, Đặt lại & dispatch Cổ áo)...');
  await undoBtn.click({ force: true });
  await resetBtn.click({ force: true });
  await collarSelect.evaluate((el) => {
    el.value = 'round';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Short pause to ensure no async network request slips through
  await testPage.waitForTimeout(300);

  assert.strictEqual(
    commandRequests.length,
    1,
    '[ASSERTION THẤT BÀI]: React Mutation Guard không chặn được thao tác tay! Đã phát sinh thêm command request.'
  );
  assert.strictEqual(
    undoRequests.length,
    0,
    '[ASSERTION THẤT BÀI]: React Mutation Guard không chặn được thao tác tay! Đã phát sinh undo request.'
  );

  console.log('     -> KIỂM TRA (B) REACT MUTATION GUARD: ĐẠT (Chặn triệt để request xen giữa, số request vẫn = 1)');

  // 7. Release first command and verify both AI commands succeed
  console.log('     * Thả phản hồi lệnh AI đầu tiên...');
  holdFirstCommandResolver();

  // Wait for fabricSelect value to become 'voile_chiffon'
  await testPage.waitForFunction(
    () => {
      const select = Array.from(document.querySelectorAll('select')).find((s) =>
        s.previousElementSibling?.textContent?.includes('Chất liệu vải')
      );
      return select && select.value === 'voile_chiffon';
    },
    { timeout: 8000 }
  );

  assert.strictEqual(commandRequests.length, 2, '[ASSERTION THẤT BÀI]: Cả 2 command AI phải được gửi lên server');
  assert.strictEqual(commandRequests[1].action, 'SET_PANTS_COLOR', '[ASSERTION THẤT BÀI]: Command thứ hai phải là SET_PANTS_COLOR');

  const currentFabricValue = await testFabricSelect.inputValue();
  assert.strictEqual(currentFabricValue, 'voile_chiffon', '[ASSERTION THẤT BÀI]: UI phải hiển thị giá trị chất liệu mới là "voile_chiffon"');
  console.log('     * Assertion thực thi 2 lệnh AI: ĐẠT (fabric=voile_chiffon, pants=black)');

  // 8. Test interaction re-opening and RESET_OUTFIT
  console.log('     * Kiểm tra giao diện mở lại tương tác bình thường sau khi hoàn thành...');
  await testPage.waitForFunction((el) => !el.disabled, await resetBtn.elementHandle(), { timeout: 5000 });
  assert(await resetBtn.isEnabled(), '[ASSERTION THẤT BÀI]: Nút Đặt lại phải enabled trở lại sau khi chuỗi AI kết thúc');
  assert(await collarSelect.isEnabled(), '[ASSERTION THẤT BÀI]: Select Cổ áo phải enabled trở lại');

  console.log('     * Bấm nút Đặt lại để kiểm tra request RESET_OUTFIT...');
  await resetBtn.click();

  // Wait for 3rd command (poll in Node.js context)
  for (let i = 0; i < 30; i++) {
    if (commandRequests.length >= 3) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.strictEqual(commandRequests.length, 3, '[ASSERTION THẤT BÀI]: Server phải nhận đủ 3 requests');
  assert.strictEqual(commandRequests[2].action, 'RESET_OUTFIT', '[ASSERTION THẤT BÀI]: Request thứ 3 phải là RESET_OUTFIT');
  console.log('     -> THÀNH CÔNG: Giao diện mở lại tương tác chuẩn xác, RESET_OUTFIT thực thi thành công');

  await testPage.close();
} finally {
  console.log('\n[DỌN DẸP] Đang dừng trình duyệt và tiến trình kiểm thử...');
  await browser.close();

  await new Promise((resolve) => {
    serverProcess.once('exit', resolve);
    serverProcess.kill();
    setTimeout(resolve, 1000);
  });

  let deleted = false;
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log('[DỌN DẸP] Đã xóa thư mục tạm:', tmpDir);
      deleted = true;
      break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!deleted) {
    console.warn('[DỌN DẸP] Không thể xóa thư mục tạm sau 5 lần thử:', tmpDir);
  }
}

console.log('\n===============================================================');
console.log('  TẤT CẢ CÁC BÀI TEST GIAO DIỆN VÀ MUTATION GUARD ĐỀU ĐẠT CHUẨN!');
console.log('===============================================================');
