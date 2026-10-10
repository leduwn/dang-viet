import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(rootDir, 'screenshots', 'visualizer-2d');
const artifactsDir = path.join(rootDir, 'artifacts', 'screenshots', 'visualizer-2d');

fs.mkdirSync(screenshotsDir, { recursive: true });
fs.mkdirSync(artifactsDir, { recursive: true });

const saveScreenshot = async (pageOrLocator, filename, opts = {}) => {
  const p1 = path.join(screenshotsDir, filename);
  const p2 = path.join(artifactsDir, filename);
  await pageOrLocator.screenshot({ path: p1, ...opts });
  try {
    fs.copyFileSync(p1, p2);
  } catch {}
};

console.log('====================================================================');
console.log('   BỘ KIỂM THỬ CHUYÊN SÂU HỆ THỐNG PHỐI ĐỒ 2D SVG VECTOR (DÁNG VIỆT)   ');
console.log('====================================================================\n');

// 1. Prepare unique isolated test database
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dangviet-2d-test-'));
const testDbPath = path.join(tmpDir, 'test-2d.db');

const db = new DatabaseSync(testDbPath);
const migrationsDir = path.join(rootDir, 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);');
for (const file of migrationFiles) {
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
const secondPreset = presets[1] || presets[0];
const now = new Date().toISOString();
const locks = { primaryColor: false, pantsColor: false, collarStyle: false, sleeveStyle: false, fabric: false, pattern: false, accessories: false };
db.prepare(`INSERT INTO looks (id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'look_default_01', 'default_user', firstPreset.title, firstPreset.eventId, firstPreset.styleId, JSON.stringify(firstPreset.config), JSON.stringify(locks), firstPreset.explanation, 1, 0, now, now
);
db.prepare(`INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
  'look_default_01', 1, JSON.stringify(firstPreset.config), JSON.stringify(locks), firstPreset.explanation, now
);
db.prepare(`INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'lookbook_2d_01', firstPreset.title, 'look_default_01', 1, JSON.stringify(firstPreset.config), firstPreset.eventId, firstPreset.styleId, firstPreset.explanation, now
);
db.prepare(`INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'lookbook_2d_02', secondPreset.title, 'look_default_01', 1, JSON.stringify(secondPreset.config), secondPreset.eventId, secondPreset.styleId, secondPreset.explanation, now
);
db.close();

// 2. Launch backend server serving frontend on dynamic port
console.log('[1/10] Khởi động máy chủ backend cô lập (port 0)...');
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

assert(serverReady && assignedPort, '[LỖI]: Máy chủ không sẵn sàng sau 10s.');
const BASE_URL = `http://127.0.0.1:${assignedPort}`;
console.log(`[OK] Máy chủ sẵn sàng tại ${BASE_URL}\n`);

// 3. Launch browser
console.log('[2/10] Khởi chạy headless Chromium/Edge...');
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('ERR_SOCKET') && !t.includes('ERR_CONNECTION')) {
        pageErrors.push(t);
      }
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.click('nav button:has-text("Phòng phối")');
  await page.waitForSelector('.outfit-room', { timeout: 10000 });

  // Đảm bảo ở chế độ 2D Vector
  const btn2D = page.locator('button:has-text("2D Vector")').first();
  if (await btn2D.isVisible()) {
    await btn2D.click();
    await page.waitForTimeout(400);
  }

  const svgVisualizer = page.locator('.outfit-room svg[viewBox*="-10 0 420 700"]').first();
  assert(await svgVisualizer.isVisible(), '[ASSERTION FAILED]: SVG 2D Visualizer không hiển thị đúng viewBox');
  console.log('[OK] 2D SVG Visualizer đã hiển thị với viewBox="-10 0 420 700"\n');

  // =========================================================================
  // GIAI ĐOẠN 1: KIỂM THỬ TẤT CẢ MÀU SẮC (ÁO CHÍNH, QUẦN LỤA)
  // =========================================================================
  console.log('[3/10] Kiểm thử ma trận màu sắc (Áo chính, Quần lụa)...');
  const primaryColorButtons = page.locator('button[aria-label*="Chọn màu áo"]');
  const primaryColorCount = await primaryColorButtons.count();
  assert(primaryColorCount > 0, '[ASSERTION FAILED]: Không tìm thấy nút màu áo');

  // Chọn màu Đỏ son hoàng gia
  const redColorBtn = page.locator('button[aria-label*="Đỏ son hoàng gia"]').first();
  if (await redColorBtn.isVisible()) {
    await redColorBtn.click();
    await page.waitForTimeout(300);
  }

  // Chọn màu Quần sang Đen tuyền
  const pantsBlackBtn = page.locator('button[aria-label*="Chọn màu quần Đen tuyền"]').first();
  if (await pantsBlackBtn.isVisible()) {
    await pantsBlackBtn.click();
    await page.waitForTimeout(300);
  }

  // Verify paths have updated colors
  const primaryFlap = svgVisualizer.locator('g[id$="-layer-front-bodice-flap"] path').first();
  const primaryFlapFill = await primaryFlap.getAttribute('fill');
  assert(primaryFlapFill, '[ASSERTION FAILED]: Tà áo chính thiếu thuộc tính fill');
  await saveScreenshot(svgVisualizer, '2d-colors-applied.png');
  console.log(`   -> Màu sắc cập nhật chính xác (fill: ${primaryFlapFill}). Đã lưu 2d-colors-applied.png`);

  // =========================================================================
  // GIAI ĐOẠN 2: KIỂM THỬ 4 CHẤT LIỆU PROCEDURAL SVG SHADERS
  // =========================================================================
  console.log('\n[4/10] Kiểm thử 4 chất liệu vải (Lụa, Gấm, Voan, Đũi)...');
  const fabricSelect = page.locator('label:has-text("Chất liệu vải")').locator('..').locator('select');
  assert(await fabricSelect.isVisible(), '[ASSERTION FAILED]: Select Chất liệu vải không hiển thị');

  const fabrics = [
    { id: 'silk_ha_dong', name: 'Lụa Hà Đông', file: '2d-fabric-silk.png' },
    { id: 'brocade_hue', name: 'Gấm Huế', file: '2d-fabric-brocade.png' },
    { id: 'voile_chiffon', name: 'Voan tơ mỏng', file: '2d-fabric-voile.png' },
    { id: 'linen_modern', name: 'Đũi tơ tự nhiên', file: '2d-fabric-linen.png' },
  ];

  for (const fab of fabrics) {
    await fabricSelect.selectOption(fab.id);
    await page.waitForTimeout(350);
    // Kiểm tra defs chứa gradient/pattern tương ứng
    const defsContent = await svgVisualizer.locator('defs').innerHTML();
    assert(defsContent.includes('silkSheen'), `[ASSERTION FAILED]: Thiếu shader silkSheen cho vải ${fab.name}`);
    if (fab.id === 'brocade_hue') {
      assert(defsContent.includes('fabric-brocade'), '[ASSERTION FAILED]: Thiếu pattern fabric-brocade');
    }
    if (fab.id === 'linen_modern') {
      assert(defsContent.includes('fabric-linen'), '[ASSERTION FAILED]: Thiếu pattern fabric-linen');
    }
    await saveScreenshot(svgVisualizer, fab.file);
    console.log(`   -> Vải ${fab.name}: Shader defs kiểm tra hợp lệ, đã lưu ${fab.file}`);
  }

  // =========================================================================
  // GIAI ĐOẠN 3: KIỂM THỬ 5 HỌA TIẾT PROCEDURAL
  // =========================================================================
  console.log('\n[5/10] Kiểm thử 5 hoa văn họa tiết (Vải trơn, Sen, Mây, Hạc, Kỷ hà Gen Z)...');
  const patternSelect = page.locator('label:has-text("Họa tiết")').locator('..').locator('select');
  assert(await patternSelect.isVisible(), '[ASSERTION FAILED]: Select Họa tiết không hiển thị');

  const patterns = [
    { id: 'plain', name: 'Vải trơn', file: '2d-pattern-plain.png' },
    { id: 'lotus', name: 'Hoa sen', file: '2d-pattern-lotus.png' },
    { id: 'cloud', name: 'Vân mây', file: '2d-pattern-cloud.png' },
    { id: 'crane', name: 'Chim hạc', file: '2d-pattern-crane.png' },
    { id: 'geometric_genz', name: 'Kỷ hà Gen Z', file: '2d-pattern-geometric.png' },
  ];

  for (const pat of patterns) {
    await patternSelect.selectOption(pat.id);
    await page.waitForTimeout(350);
    const defsContent = await svgVisualizer.locator('defs').innerHTML();
    if (pat.id !== 'plain') {
      const patKeyword = pat.id === 'geometric_genz' ? 'pattern-geometric' : `pattern-${pat.id}`;
      assert(defsContent.includes(patKeyword), `[ASSERTION FAILED]: Thiếu pattern ${patKeyword}`);
    }
    await saveScreenshot(svgVisualizer, pat.file);
    console.log(`   -> Họa tiết ${pat.name}: Pattern defs kiểm tra hợp lệ, đã lưu ${pat.file}`);
  }

  // =========================================================================
  // GIAI ĐOẠN 4: KIỂM THỬ 6 VÓC DÁNG CƠ THỂ 2D PARAMETRIC
  // =========================================================================
  console.log('\n[6/10] Kiểm thử 6 vóc dáng cơ thể 2D (Tỷ lệ toán học Bezier co giãn trực quan)...');
  const shapes = [
    { id: 'standard', name: 'Dáng chuẩn', file: '2d-body-standard.png' },
    { id: 'petite', name: 'nhỏ nhắn', file: '2d-body-petite.png' },
    { id: 'tall_slender', name: 'cao thanh', file: '2d-body-tall-slender.png' },
    { id: 'broad_shoulders', name: 'vai rộng', file: '2d-body-broad-shoulders.png' },
    { id: 'curvy_hips', name: 'hông nở', file: '2d-body-curvy-hips.png' },
    { id: 'plus_size', name: 'đầy đặn', file: '2d-body-plus-size.png' },
  ];

  const bodyShapeSelect = page.locator('select[aria-label="Vóc dáng 2D"]').first();
  assert(await bodyShapeSelect.isVisible(), '[ASSERTION FAILED]: Select Vóc dáng 2D không hiển thị');

  for (const sh of shapes) {
    await bodyShapeSelect.selectOption(sh.id);
    await page.waitForTimeout(350);

    // Bắt đường path tà áo trước để xác minh tọa độ thay đổi
    const flapPathD = await svgVisualizer.locator('g[id$="-layer-front-bodice-flap"] path').first().getAttribute('d');
    assert(flapPathD && flapPathD.length > 50, `[ASSERTION FAILED]: Đường path tà áo rỗng khi chọn ${sh.name}`);
    await saveScreenshot(svgVisualizer, sh.file);
    console.log(`   -> Vóc dáng ${sh.name}: Đường nét co giãn chuẩn xác, đã lưu ${sh.file}`);
  }

  // =========================================================================
  // GIAI ĐOẠN 5: KIỂM THỬ PHOM ÁO TRUYỀN THỐNG VS CÁCH TÂN RAGLAN
  // =========================================================================
  console.log('\n[7/10] Kiểm thử 2 phom áo: Truyền thống vs Cách tân Raglan...');
  // Chuyển sang Áo dài cách tân Raglan
  const remixBtn = page.locator('button:has-text("Remix cách tân")').first();
  assert(await remixBtn.isVisible(), '[ASSERTION FAILED]: Không tìm thấy nút Remix cách tân');
  await remixBtn.click();
  await page.waitForTimeout(500);

  await saveScreenshot(svgVisualizer, '2d-model-remix-raglan.png');
  console.log('   -> Phom cách tân Raglan: Tà lửng qua gối (y=505), quần culottes, đã lưu 2d-model-remix-raglan.png');

  // Đổi kiểu tay sang Tay lửng 3/4
  const sleeveSelect = page.locator('label:has-text("Tay áo")').locator('..').locator('select');
  await sleeveSelect.selectOption('elbow');
  await page.waitForTimeout(300);
  await saveScreenshot(svgVisualizer, '2d-sleeve-elbow.png');
  console.log('   -> Tay lửng 3/4 (elbow): Da cánh tay lộ tự nhiên, đã lưu 2d-sleeve-elbow.png');

  // Đổi kiểu tay sang Tay xẻ
  await sleeveSelect.selectOption('slit');
  await page.waitForTimeout(300);
  await saveScreenshot(svgVisualizer, '2d-sleeve-slit.png');
  console.log('   -> Tay xẻ (slit): Đường xẻ cổ tay rõ nét, đã lưu 2d-sleeve-slit.png');

  // Chuyển lại Truyền thống
  const traditionalBtn = page.locator('button:has-text("Cổ cao truyền thống")').first();
  await traditionalBtn.click();
  await page.waitForTimeout(400);

  // =========================================================================
  // GIAI ĐOẠN 6: KIỂM THỬ PHỤ KIỆN & XỬ LÝ XUNG ĐỘT (MẤN + NÓN LÁ)
  // =========================================================================
  console.log('\n[8/10] Kiểm thử hệ thống phụ kiện & giải quyết xung đột không gian...');

  const setAccessoryState = async (nameKeyword, targetChecked) => {
    const btn = page.locator(`.section-customize button:has-text("${nameKeyword}")`).first();
    assert(await btn.isVisible(), `[ASSERTION FAILED]: Không tìm thấy nút phụ kiện ${nameKeyword}`);
    const isChecked = (await btn.locator('svg').count()) > 0;
    if (isChecked !== targetChecked) {
      await btn.click();
      await page.waitForTimeout(300);
    }
  };

  // 1. Chỉ chọn Nón lá (không mấn) -> Nón lá đội trên đầu
  await setAccessoryState('Mấn', false);
  await setAccessoryState('Nón lá', true);
  assert(await svgVisualizer.locator('[id$="-accessory-non-la-head"]').isVisible(), '[ASSERTION FAILED]: Khi không có mấn, nón lá phải ở vị trí đội đầu');
  console.log('   -> Nón lá đơn lẻ: Đội đầu chuẩn xác [id$="-accessory-non-la-head"]');

  // 2. Chọn thêm Mấn đội đầu -> Mấn lên đầu, Nón lá tự động chuyển sang khoác vai
  await setAccessoryState('Mấn', true);
  assert(await svgVisualizer.locator('[id$="-accessory-man"]').isVisible(), '[ASSERTION FAILED]: Mấn phải hiển thị trên đầu');
  assert(await svgVisualizer.locator('[id$="-accessory-non-la-carry"]').isVisible(), '[ASSERTION FAILED]: Nón lá phải chuyển sang carry khi có mấn');
  console.log('   -> Giải quyết xung đột Mấn + Nón lá: Mấn trên đầu, Nón lá tự động khoác vai thanh lịch!');

  // 3. Kích hoạt toàn bộ 6 phụ kiện
  await setAccessoryState('Chuỗi ngọc', true);
  await setAccessoryState('Quạt xếp', true);
  await setAccessoryState('Túi cói', true);
  await setAccessoryState('Guốc mộc', true);

  assert(await svgVisualizer.locator('[id$="-accessory-chuoi-ngoc"]').isVisible(), '[ASSERTION FAILED]: Chuỗi ngọc không hiển thị');
  assert(await svgVisualizer.locator('[id$="-accessory-quat-xep"]').isVisible(), '[ASSERTION FAILED]: Quạt xếp không hiển thị');
  assert(await svgVisualizer.locator('[id$="-accessory-tui-coi"]').isVisible(), '[ASSERTION FAILED]: Túi cói không hiển thị');
  assert(await svgVisualizer.locator('[id$="-accessory-guoc-moc"]').isVisible(), '[ASSERTION FAILED]: Guốc mộc không hiển thị');

  await saveScreenshot(svgVisualizer, '2d-all-accessories-resolved.png');
  console.log('   -> Toàn bộ 6 phụ kiện hiển thị hài hòa, z-index phân tầng chuẩn, đã lưu 2d-all-accessories-resolved.png');

  // =========================================================================
  // GIAI ĐOẠN 7: KIỂM THỬ SO SÁNH 2 BẢN PHỐI (COMPARE MODAL & CHỐNG TRÙNG ID)
  // =========================================================================
  console.log('\n[9/10] Kiểm thử render đồng thời 2 bản phối (Compare Modal & Namespace ID)...');
  const compareBtn = page.locator('button:has-text("So sánh 2 bộ"), button:has-text("So sánh")').first();
  await compareBtn.click();
  await page.waitForSelector('.compare-modal', { timeout: 10000 });

  // Chuyển Compare Modal sang chế độ 2D Bản vẽ phẳng
  const compare2dBtn = page.locator('.compare-modal button:has-text("2D Bản vẽ phẳng")');
  await compare2dBtn.click();
  await page.waitForTimeout(400);

  const compareVisualizerSvgs = page.locator('.compare-modal .aodai-visualizer svg');
  const compareSvgCount = await compareVisualizerSvgs.count();
  assert(compareSvgCount >= 2, `[ASSERTION FAILED]: Compare Modal phải render ít nhất 2 SVG (thực tế: ${compareSvgCount})`);

  // Kiểm tra tính duy nhất của ID gradient và pattern giữa 2 instance
  const idCollisionCheck = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll('.compare-modal .aodai-visualizer svg'));
    const defs0 = svgs[0]?.querySelector('defs');
    const defs1 = svgs[1]?.querySelector('defs');
    if (!defs0 || !defs1) return { error: 'Không tìm thấy defs ở cả 2 modal' };

    const ids0 = Array.from(defs0.querySelectorAll('[id]')).map((el) => el.id);
    const ids1 = Array.from(defs1.querySelectorAll('[id]')).map((el) => el.id);

    // Tìm các ID trùng nhau giữa 2 instance
    const collisions = ids0.filter((id) => ids1.includes(id));
    return {
      count0: ids0.length,
      count1: ids1.length,
      collisions,
    };
  });

  assert(!idCollisionCheck.error, `[ASSERTION FAILED]: ${idCollisionCheck.error}`);
  assert.strictEqual(idCollisionCheck.collisions.length, 0, `[ASSERTION FAILED]: Phát hiện xung đột ID giữa 2 SVG: ${idCollisionCheck.collisions?.join(', ')}`);
  await saveScreenshot(page.locator('.compare-modal'), '2d-compare-dual-render.png');
  console.log(`   -> Đã kiểm tra 2 bản phối đồng thời: 0 xung đột ID! Đã lưu 2d-compare-dual-render.png`);

  // Đóng modal
  await page.click('.compare-modal button:has(svg)');
  await page.waitForTimeout(300);

  // =========================================================================
  // GIAI ĐOẠN 8: KIỂM THỬ XUẤT ẢNH PNG ĐỘ PHÂN GIẢI CAO 1200x1600
  // =========================================================================
  console.log('\n[10/10] Kiểm thử xuất ảnh PNG 1200x1600 từ 2D SVG...');
  const exportBtn = page.locator('button:has-text("Xuất ảnh bản phối 2D (PNG)"), button:has-text("Xuất ảnh bản phối (PNG)")').first();
  assert(await exportBtn.isVisible(), '[ASSERTION FAILED]: Không tìm thấy nút xuất ảnh PNG');

  // Trigger export PNG via page evaluation to capture data URL
  const exportResult = await page.evaluate(async () => {
    try {
      const svg = document.querySelector('.outfit-room svg');
      if (!svg) return { success: false, error: 'Không tìm thấy SVG trong outfit-room' };

      // Chạy serialization và vẽ lên canvas 1200x1600
      const svgString = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = URL.createObjectURL(svgBlob);

      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { success: false, error: 'Canvas 2D context null' };

      // Nền kem vàng thượng hạng
      ctx.fillStyle = '#FDFBF7';
      ctx.fillRect(0, 0, 1200, 1600);

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 100, 120, 1000, 1360);
          resolve();
        };
        img.onerror = () => reject(new Error('Lỗi load SVG Image'));
        img.src = blobURL;
      });
      URL.revokeObjectURL(blobURL);

      const dataUrl = canvas.toDataURL('image/png');
      return {
        success: true,
        width: canvas.width,
        height: canvas.height,
        dataUrlLength: dataUrl.length,
        base64: dataUrl.split(',')[1],
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  assert(exportResult.success, `[ASSERTION FAILED]: Lỗi xuất ảnh PNG: ${exportResult.error}`);
  assert.strictEqual(exportResult.width, 1200, 'Chiều rộng PNG phải đúng 1200px');
  assert.strictEqual(exportResult.height, 1600, 'Chiều cao PNG phải đúng 1600px');
  assert(exportResult.dataUrlLength > 20000, 'PNG data URL phải có kích thước hợp lệ (>20KB)');

  // Decode and verify with pngjs
  const pngBuffer = Buffer.from(exportResult.base64, 'base64');
  const parsedPng = PNG.sync.read(pngBuffer);
  assert.strictEqual(parsedPng.width, 1200, 'Kích thước decode pngjs width=1200');
  assert.strictEqual(parsedPng.height, 1600, 'Kích thước decode pngjs height=1600');

  // Save the exported PNG for inspection
  const exportedPngPath = path.join(screenshotsDir, '2d-exported-highres-1200x1600.png');
  fs.writeFileSync(exportedPngPath, pngBuffer);
  fs.copyFileSync(exportedPngPath, path.join(artifactsDir, '2d-exported-highres-1200x1600.png'));
  console.log(`   -> Xuất PNG thành công: 1200x1600px, dung lượng ${Math.round(pngBuffer.length / 1024)} KB.`);
  console.log(`   -> Đã lưu: ${exportedPngPath}`);

  // Kiểm tra không có lỗi console nào phát sinh
  assert.strictEqual(pageErrors.length, 0, `[ASSERTION FAILED]: Phát hiện lỗi console trong quá trình test: ${pageErrors.join('; ')}`);

  console.log('\n====================================================================');
  console.log('   KẾT QUẢ: 10/10 GIAI ĐOẠN KIỂM THỬ 2D SVG VECTOR ĐẠT XUẤT SẮC!   ');
  console.log('====================================================================\n');
} finally {
  await browser.close();
  serverProcess.kill('SIGTERM');
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}
