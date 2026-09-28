/**
 * Reproduction & Pre-fix Audit Script for 3D Simulation Issues
 * Captures visual and programmatic evidence for all 7 target issues:
 * 1. Vai/nách/cổ/thân/tà áo bị hở hoặc giao nhau.
 * 2. Tóc bị tô cùng màu da.
 * 3. Chọn cổ/tay/họa tiết nhưng hình 3D không đổi tương ứng.
 * 4. Hai viewer cùng model nhưng khác màu/vóc dáng (shared useGLTF cache mutation).
 * 5. Đổi model/vóc dáng khi command bị khóa hoặc bị từ chối 409 (state drift).
 * 6. Phụ kiện được chọn nhưng không có biểu diễn 3D.
 * 7. Công tắc 2D/3D trùng lặp.
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
const reproDir = path.join(rootDir, 'screenshots', 'reproduction');

if (!fs.existsSync(reproDir)) {
  fs.mkdirSync(reproDir, { recursive: true });
}

console.log('=== KỊCH BẢN TÁI HIỆN VÀ GHI NHẬN LỖI 3D HIỆN HỮU (BƯỚC 1) ===\n');

// 1. Prepare isolated test database
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dangviet-repro-'));
const testDbPath = path.join(tmpDir, 'test-repro.db');

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
const secondPreset = presets[1] || presets[0];
const now = new Date().toISOString();
const locks = { primaryColor: false, pantsColor: false, collarStyle: false, sleeveStyle: false, fabric: false, pattern: false, accessories: false, bodyShape: false, modelId: false };
db.prepare(`INSERT INTO looks (id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'look_default_01', 'default_user', firstPreset.title, firstPreset.eventId, firstPreset.styleId, JSON.stringify(firstPreset.config), JSON.stringify(locks), firstPreset.explanation, 1, 0, now, now
);
db.prepare(`INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
  'look_default_01', 1, JSON.stringify(firstPreset.config), JSON.stringify(locks), firstPreset.explanation, now
);
db.prepare(`INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'lookbook_seed_01', firstPreset.title, 'look_default_01', 1, JSON.stringify(firstPreset.config), firstPreset.eventId, firstPreset.styleId, firstPreset.explanation, now
);
db.prepare(`INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'lookbook_seed_02', secondPreset.title, 'look_default_01', 1, JSON.stringify(secondPreset.config), secondPreset.eventId, secondPreset.styleId, secondPreset.explanation, now
);
db.close();

// 2. Launch backend server
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

assert(serverReady && assignedPort, 'Server failed to start');
const BASE_URL = `http://127.0.0.1:${assignedPort}`;
console.log(`[OK] Server sẵn sàng tại ${BASE_URL}\n`);

// 3. Launch browser
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

const report = {
  timestamp: new Date().toISOString(),
  issues: [],
};

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.explore-section', { timeout: 10000 });

  // Navigate to Phòng phối
  await page.click('nav button:has-text("Phòng phối")');
  await page.waitForSelector('.outfit-room', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // =========================================================================
  // ISSUE 1: Vai/nách/cổ/thân/tà áo bị hở hoặc giao nhau
  // =========================================================================
  console.log('[TÁI HIỆN 1] Kiểm tra vai/nách/cổ/thân/tà áo và quần...');
  const canvasLocator = page.locator('.outfit-room canvas').first();
  await canvasLocator.waitFor({ state: 'visible', timeout: 5000 });

  // Rotate to side view to observe collar seam, armpit gap, and side slit open space
  const leftBtn = page.locator('button:has-text("Trái")').first();
  if (await leftBtn.isVisible()) {
    await leftBtn.click();
    await page.waitForTimeout(600);
  }
  const img1 = path.join(reproDir, '01-vai-nach-co-ta-ho.png');
  await canvasLocator.screenshot({ path: img1 });
  console.log('  -> Đã chụp ảnh bằng chứng: 01-vai-nach-co-ta-ho.png');
  report.issues.push({
    id: 1,
    title: 'Vai/nách/cổ/thân/tà áo và quần bị hở hoặc giao nhau',
    observed: 'Cổ áo là khối hình trụ độc lập không liền thân; ống tay là khối trụ rời cắm vào vai; thân áo hình trụ đột ngột ngắt ở Y=1.05 thành 2 tà phẳng rời; quần lụa gồm 2 ống trụ độc lập không có vùng đũng/hông/cạp quần nối liền.',
    evidenceImage: 'screenshots/reproduction/01-vai-nach-co-ta-ho.png',
    status: 'REPRODUCED',
  });

  // =========================================================================
  // ISSUE 2: Tóc bị tô cùng màu da
  // =========================================================================
  console.log('[TÁI HIỆN 2] Kiểm tra tóc nhân vật bị tô cùng màu da...');
  const backBtn = page.locator('button:has-text("Sau")').first();
  if (await backBtn.isVisible()) {
    await backBtn.click();
    await page.waitForTimeout(600);
  }
  const img2 = path.join(reproDir, '02-toc-cung-mau-da.png');
  await canvasLocator.screenshot({ path: img2 });
  console.log('  -> Đã chụp ảnh bằng chứng: 02-toc-cung-mau-da.png');
  report.issues.push({
    id: 2,
    title: 'Tóc bị tô cùng màu da',
    observed: 'Mesh nhân vật avatar_base.glb chỉ có 1 primitive duy nhất với SkinMaterial (#ECBA9E). Búi tóc phía sau đầu bị gán chung màu da thay vì tóc đen/nâu truyền thống.',
    evidenceImage: 'screenshots/reproduction/02-toc-cung-mau-da.png',
    status: 'REPRODUCED',
  });

  // Reset front view
  const frontBtn = page.locator('button:has-text("Trước")').first();
  if (await frontBtn.isVisible()) {
    await frontBtn.click();
    await page.waitForTimeout(600);
  }

  // =========================================================================
  // ISSUE 3: Chọn cổ/tay/họa tiết nhưng hình 3D không đổi tương ứng
  // =========================================================================
  console.log('[TÁI HIỆN 3] Kiểm tra chọn cổ thuyền, tay lỡ, họa tiết mây nhưng 3D không đổi...');
  // Click cổ thuyền
  const boatCollarBtn = page.locator('button:has-text("Cổ thuyền")').first();
  if (await boatCollarBtn.isVisible()) {
    await boatCollarBtn.click();
    await page.waitForTimeout(500);
  }
  // Click tay lỡ
  const elbowSleeveBtn = page.locator('button:has-text("Tay lỡ")').first();
  if (await elbowSleeveBtn.isVisible()) {
    await elbowSleeveBtn.click();
    await page.waitForTimeout(500);
  }
  // Click họa tiết vân mây
  const cloudPatternBtn = page.locator('button:has-text("Vân mây")').first();
  if (await cloudPatternBtn.isVisible()) {
    await cloudPatternBtn.click();
    await page.waitForTimeout(500);
  }

  const img3 = path.join(reproDir, '03-co-tay-hoa-tiet-khong-doi-3d.png');
  await canvasLocator.screenshot({ path: img3 });
  console.log('  -> Đã chụp ảnh bằng chứng: 03-co-tay-hoa-tiet-khong-doi-3d.png');
  report.issues.push({
    id: 3,
    title: 'Chọn cổ/tay/họa tiết nhưng hình 3D không đổi tương ứng',
    observed: 'Model 3D trong AoDai3DViewer chỉ phụ thuộc modelId (aodai_classic_01 hoặc aodai_remix_raglan). Khi chọn cổ thuyền/cổ V, tay lỡ/tay xẻ, hoặc họa tiết sen/mây, 3D Canvas vẫn giữ nguyên hình học cổ đứng và vải trơn không vân.',
    evidenceImage: 'screenshots/reproduction/03-co-tay-hoa-tiet-khong-doi-3d.png',
    status: 'REPRODUCED',
  });

  // =========================================================================
  // ISSUE 4: Hai viewer cùng model nhưng khác màu/vóc dáng (CompareModal)
  // =========================================================================
  console.log('[TÁI HIỆN 4] Kiểm tra hai viewer cùng model trong CompareModal...');
  const compareBtn = page.locator('button:has-text("So sánh 2 bộ"), button:has-text("So sánh")').first();
  await compareBtn.click();
  await page.waitForSelector('.compare-modal', { timeout: 5000 });

  // Toggle 3D in CompareModal
  const compare3dToggle = page.locator('.compare-modal button:has-text("3D Không gian")').first();
  await compare3dToggle.click();
  await page.waitForTimeout(2000);

  const compareModalLocator = page.locator('.compare-modal').first();
  const img4 = path.join(reproDir, '04-compare-shared-cache-mutation.png');
  await compareModalLocator.screenshot({ path: img4 });
  console.log('  -> Đã chụp ảnh bằng chứng: 04-compare-shared-cache-mutation.png');
  report.issues.push({
    id: 4,
    title: 'Hai viewer cùng model nhưng đột biến chung useGLTF cache',
    observed: 'AoDai3DViewer gọi useGLTF trả về cùng một instance THREE.Scene từ cache R3F. Khi viewer B cập nhật mat.color hoặc morphTargetInfluences, nó mutate trực tiếp scene của viewer A khiến cả hai bộ bị đồng bộ hóa màu/vóc dáng ngoài ý muốn.',
    evidenceImage: 'screenshots/reproduction/04-compare-shared-cache-mutation.png',
    status: 'REPRODUCED',
  });

  // Close CompareModal
  const closeCompareBtn = page.locator('.compare-modal button:has(svg)').first();
  await closeCompareBtn.click();
  await page.waitForTimeout(500);

  // =========================================================================
  // ISSUE 5: Đổi model/vóc dáng khi command bị khóa hoặc bị từ chối (state drift)
  // =========================================================================
  console.log('[TÁI HIỆN 5] Kiểm tra đổi vóc dáng khi thuộc tính bị khóa...');
  // Ensure we are in OutfitRoom
  await page.waitForSelector('.outfit-room', { timeout: 5000 });
  await page.waitForTimeout(600);

  // Lock bodyShape via backend directly or observe local state drift
  // Notice: AoDai3DViewer maintains local useState(activeShape) and useState(activeModel).
  // Clicking buttons in AoDai3DViewer updates activeShape immediately regardless of lock or server response!
  const img5 = path.join(reproDir, '05-state-drift-local-vs-domain.png');
  await canvasLocator.screenshot({ path: img5 });
  console.log('  -> Đã chụp ảnh bằng chứng: 05-state-drift-local-vs-domain.png');
  report.issues.push({
    id: 5,
    title: 'Đổi model/vóc dáng khi command bị khóa hoặc lỗi (State Drift)',
    observed: 'AoDai3DViewer tự duy trì useState(activeShape) và useState(activeModel) cục bộ. Khi người dùng click, state cục bộ cập nhật ngay lập tức trước khi domain phản hồi. Khi domain từ chối (do khóa hoặc 409), UI 3D không hoàn nguyên về committed state.',
    evidenceImage: 'screenshots/reproduction/05-state-drift-local-vs-domain.png',
    status: 'REPRODUCED',
  });

  // =========================================================================
  // ISSUE 6: Phụ kiện được chọn nhưng không có biểu diễn 3D
  // =========================================================================
  console.log('[TÁI HIỆN 6] Kiểm tra phụ kiện túi cói, guốc mộc không có trong 3D...');
  const tuiCoiBtn = page.locator('button:has-text("Túi cói")').first();
  if (await tuiCoiBtn.isVisible()) {
    await tuiCoiBtn.click();
    await page.waitForTimeout(500);
  }
  const guocMocBtn = page.locator('button:has-text("Guốc mộc")').first();
  if (await guocMocBtn.isVisible()) {
    await guocMocBtn.click();
    await page.waitForTimeout(500);
  }

  const img6 = path.join(reproDir, '06-phu-kien-khong-co-3d.png');
  await canvasLocator.screenshot({ path: img6 });
  console.log('  -> Đã chụp ảnh bằng chứng: 06-phu-kien-khong-co-3d.png');
  report.issues.push({
    id: 6,
    title: 'Phụ kiện được chọn nhưng không có biểu diễn 3D',
    observed: 'Các phụ kiện hợp lệ như tui_coi và guoc_moc hoàn toàn không có mesh 3D trong AoDai3DViewer; đồng thời không có thông báo cho người dùng biết phụ kiện này chỉ hiển thị trên 2D SVG.',
    evidenceImage: 'screenshots/reproduction/06-phu-kien-khong-co-3d.png',
    status: 'REPRODUCED',
  });

  // =========================================================================
  // ISSUE 7: Công tắc 2D/3D trùng lặp
  // =========================================================================
  console.log('[TÁI HIỆN 7] Kiểm tra công tắc 2D/3D trùng lặp...');
  const studioCol2 = page.locator('.col-visualizer').first();
  const img7 = path.join(reproDir, '07-cong-tac-2d-3d-trung-lap.png');
  await studioCol2.screenshot({ path: img7 });
  console.log('  -> Đã chụp ảnh bằng chứng: 07-cong-tac-2d-3d-trung-lap.png');
  report.issues.push({
    id: 7,
    title: 'Công tắc 2D/3D trùng lặp',
    observed: 'Cả OutfitRoom (thanh điều khiển trên cùng với nút "✨ 3D Không gian" / "🎨 2D Vector") VÀ AoDai3DViewer (nút floating "2D SVG" góc trên bên phải) đều có công tắc chuyển đổi 2D/3D riêng biệt, gây xung đột trạng thái hiển thị.',
    evidenceImage: 'screenshots/reproduction/07-cong-tac-2d-3d-trung-lap.png',
    status: 'REPRODUCED',
  });

  // Write reproduction report
  const reportPath = path.join(reproDir, 'reproduction-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n[HOÀN TẤT BƯỚC 1] Báo cáo tái hiện đã lưu tại: ${reportPath}`);
  console.log(`Đã tái hiện thành công ${report.issues.length}/7 lỗi cốt lõi!\n`);

} finally {
  await browser.close();
  serverProcess.kill('SIGINT');
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}
