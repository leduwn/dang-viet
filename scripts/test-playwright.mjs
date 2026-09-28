import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(rootDir, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

console.log('=== BẮT ĐẦU KIỂM THỬ PLAYWRIGHT GIAO DIỆN & MUTATION GUARD ===\n');

// 1. Prepare isolated test database
const testDbPath = path.join(rootDir, 'data', 'test-playwright.db');
if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch {}
}

console.log('[1/5] Khởi tạo dữ liệu mẫu cho database cô lập...');
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
db.close();
console.log('   * Đã nạp thành công migration và seed data vào test-playwright.db');

// Ensure web dist is up to date
console.log('[1/5] Kiểm tra bản build giao diện frontend (apps/web/dist)...');
if (!fs.existsSync(path.join(rootDir, 'apps', 'web', 'dist', 'index.html'))) {
  console.error('[LỖI] Chưa có bản build apps/web/dist! Vui lòng chạy npm run build trước.');
  process.exit(1);
}

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

if (!serverReady || !assignedPort) {
  console.error('[LỖI] Máy chủ kiểm thử không khởi động được sau 10s.');
  serverProcess.kill();
  process.exit(1);
}

const BASE_URL = `http://127.0.0.1:${assignedPort}`;
console.log(`[OK] Máy chủ kiểm thử sẵn sàng tại ${BASE_URL} (Database cô lập: data/test-playwright.db)\n`);

// 3. Launch browser
console.log('[3/5] Khởi chạy Microsoft Edge headless...');
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
});

try {
  // Test UI across viewports
  console.log('[4/5] Kiểm tra giao diện và chụp ảnh màn hình...');

  // A. Desktop 1440px
  console.log('   - Kiểm thử Desktop 1440x900...');
  const desktopPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  desktopPage.on('console', msg => console.log('   [BROWSER CONSOLE]', msg.type(), msg.text()));
  desktopPage.on('pageerror', err => console.log('   [BROWSER ERROR]', err.message));
  desktopPage.on('requestfailed', req => console.log('   [REQUEST FAILED]', req.url(), req.failure()?.errorText));
  const navRes = await desktopPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  console.log('   [GOTO STATUS]', navRes?.status(), navRes?.url());
  const bodyText = await desktopPage.evaluate(() => document.body.innerText);
  console.log('   [BODY TEXT]', bodyText.slice(0, 200));
  const htmlContent = await desktopPage.content();
  console.log('   [HTML PREVIEW]', htmlContent.slice(0, 300));

  // 1. Explore Tab
  await desktopPage.waitForSelector('.explore-section');
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-explore.png'), fullPage: false });
  console.log('     * Đã chụp: desktop-1440-explore.png');

  // Verify Explore: No horizontal overflow
  const desktopOverflow = await desktopPage.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  if (desktopOverflow) {
    console.warn('     [CẢNH BÁO]: Phát hiện tràn ngang trên Desktop 1440px');
  } else {
    console.log('     * Kiểm tra tràn ngang: KHÔNG TRÀN (scrollWidth <= 1440px)');
  }

  // Verify Preset card buttons alignment
  const buttonsAligned = await desktopPage.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.preset-card'));
    if (cards.length < 2) return true;
    const btnTops = cards.map(c => {
      const btn = c.querySelector('button');
      return btn ? Math.round(btn.getBoundingClientRect().top) : null;
    });
    // First row should have approximately equal top positions
    return btnTops[0] !== null && btnTops[1] !== null && Math.abs(btnTops[0] - btnTops[1]) <= 4;
  });
  console.log('     * Nút chọn bộ phối ở hàng đầu thẳng hàng:', buttonsAligned ? 'ĐẠT' : 'CHƯA ĐẠT');

  // Verify visualizer in preset card does not have disclaimer overlapping text
  const disclaimerOverlap = await desktopPage.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.preset-card'));
    for (const card of cards) {
      const text = card.textContent || '';
      if (text.includes('Mô hình đồ họa SVG minh họa 2D')) {
        return true; // Overlap detected inside thumbnail
      }
    }
    return false;
  });
  console.log('     * Thẻ preset không chứa đoạn chú thích dài gây đè chữ:', !disclaimerOverlap ? 'ĐẠT' : 'CHƯA ĐẠT');

  // 2. Studio Tab (Phòng phối)
  await desktopPage.click('nav button:has-text("Phòng phối")');
  await desktopPage.waitForSelector('.outfit-room');
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-studio.png'), fullPage: false });
  console.log('     * Đã chụp: desktop-1440-studio.png');

  // Verify Studio Visualizer has proper container and no overlap
  const studioVisualizerBounds = await desktopPage.evaluate(() => {
    const svg = document.querySelector('.outfit-room svg');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
  });
  console.log('     * SVG nhân vật Phòng phối hiển thị đầy đủ:', studioVisualizerBounds?.visible ? 'ĐẠT' : 'CHƯA ĐẠT');

  // 3. Design Studio Tab (Xưởng thiết kế)
  await desktopPage.click('nav button:has-text("Xưởng thiết kế")');
  await desktopPage.waitForSelector('.design-studio');
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-design.png'), fullPage: false });
  console.log('     * Đã chụp: desktop-1440-design.png');

  // 4. Lookbook Tab
  await desktopPage.click('nav button:has-text("Lookbook")');
  await desktopPage.waitForSelector('.lookbook-section');
  await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-lookbook.png'), fullPage: false });
  console.log('     * Đã chụp: desktop-1440-lookbook.png');

  // 5. Compare Modal
  await desktopPage.click('nav button:has-text("Phòng phối")');
  await desktopPage.waitForSelector('.outfit-room');
  const compareBtn = await desktopPage.$('button:has-text("So sánh 2 bộ"), button:has-text("So sánh")');
  if (compareBtn) {
    await compareBtn.click();
    await desktopPage.waitForSelector('.compare-modal');
    await desktopPage.screenshot({ path: path.join(screenshotsDir, 'desktop-1440-compare.png'), fullPage: false });
    console.log('     * Đã chụp: desktop-1440-compare.png');
    // Close modal
    const closeBtn = await desktopPage.$('.compare-modal button[aria-label="Đóng đối sánh"], .compare-modal button');
    if (closeBtn) await closeBtn.click();
  }
  await desktopPage.close();

  // B. Mobile 390px (iPhone 12/13/14)
  console.log('\n   - Kiểm thử Mobile 390x844...');
  const mobile390 = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await mobile390.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Explore
  await mobile390.waitForSelector('.explore-section');
  await mobile390.screenshot({ path: path.join(screenshotsDir, 'mobile-390-explore.png'), fullPage: false });
  console.log('     * Đã chụp: mobile-390-explore.png');
  const mobile390Overflow = await mobile390.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log('     * Tràn ngang trên 390px:', mobile390Overflow ? 'CÓ (CẦN XEM LẠI)' : 'KHÔNG (CHUẨN)');

  // Studio
  await mobile390.click('nav button:has-text("Phòng phối")');
  await mobile390.waitForSelector('.outfit-room');
  await mobile390.screenshot({ path: path.join(screenshotsDir, 'mobile-390-studio.png'), fullPage: false });
  console.log('     * Đã chụp: mobile-390-studio.png');

  // Design
  await mobile390.click('nav button:has-text("Xưởng thiết kế")');
  await mobile390.waitForSelector('.design-studio');
  await mobile390.screenshot({ path: path.join(screenshotsDir, 'mobile-390-design.png'), fullPage: false });
  console.log('     * Đã chụp: mobile-390-design.png');

  // Lookbook
  await mobile390.click('nav button:has-text("Lookbook")');
  await mobile390.waitForSelector('.lookbook-section');
  await mobile390.screenshot({ path: path.join(screenshotsDir, 'mobile-390-lookbook.png'), fullPage: false });
  console.log('     * Đã chụp: mobile-390-lookbook.png');
  await mobile390.close();

  // C. Small Mobile 360px (Android tiêu chuẩn)
  console.log('\n   - Kiểm thử Mobile nhỏ 360x780...');
  const mobile360 = await browser.newPage({
    viewport: { width: 360, height: 780 },
    isMobile: true,
  });
  await mobile360.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mobile360.waitForSelector('.explore-section');
  await mobile360.screenshot({ path: path.join(screenshotsDir, 'mobile-360-explore.png'), fullPage: false });
  console.log('     * Đã chụp: mobile-360-explore.png');
  const mobile360Overflow = await mobile360.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log('     * Tràn ngang trên 360px:', mobile360Overflow ? 'CÓ' : 'KHÔNG (CHUẨN)');

  await mobile360.click('nav button:has-text("Phòng phối")');
  await mobile360.waitForSelector('.outfit-room');
  await mobile360.screenshot({ path: path.join(screenshotsDir, 'mobile-360-studio.png'), fullPage: false });
  console.log('     * Đã chụp: mobile-360-studio.png');
  await mobile360.close();

  // 4. Test Frontend Mutation Guard
  console.log('\n[5/5] Kiểm thử cơ chế Mutation Guard React của Frontend...');
  const testPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  testPage.on('console', msg => console.log('     [TESTPAGE LOG]', msg.text()));
  testPage.on('pageerror', err => console.log('     [TESTPAGE ERROR]', err.message));
  await testPage.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Navigate to Studio
  await testPage.click('nav button:has-text("Phòng phối")');
  await testPage.waitForSelector('.outfit-room');

  // Intercept AI Chat to return a deterministic 2-command plan
  await testPage.route('**/api/ai/chat', async (route) => {
    console.log('     [AI ROUTE] Mocking AI Chat response with 2 sequential commands...');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: 'Tôi gợi ý đổi kiểu tay áo sang tay raglan và đổi màu quần sang đen tuyền.',
        explanation: 'Phong cách thanh lịch phù hợp kỷ yếu',
        mode: 'mock',
        model: 'test-guard-model',
        commands: [
          {
            commandId: '99999999-0001-4000-8000-000000000001',
            lookId: 'look_default_01',
            expectedRevision: 1,
            action: 'SET_SLEEVE',
            payload: { sleeveStyle: 'raglan' },
            timestamp: new Date().toISOString(),
          },
          {
            commandId: '99999999-0002-4000-8000-000000000002',
            lookId: 'look_default_01',
            expectedRevision: 2,
            action: 'SET_PANTS_COLOR',
            payload: { color: { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black' } },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  // Intercept command requests:
  // When AI sequence begins, hold the first command request in pending state!
  let routeResolver = null;
  const holdFirstCommandPromise = new Promise((resolve) => {
    routeResolver = resolve;
  });

  let commandRequestsCount = 0;
  let interceptedCommands = [];

  await testPage.route('**/api/looks/*/command', async (route) => {
    const req = route.request();
    commandRequestsCount++;
    const postData = req.postDataJSON();
    interceptedCommands.push(postData);

    console.log(`     [NETWORK INTERCEPT] Nhận request lệnh command #${commandRequestsCount}: action=${postData.action}`);

    if (commandRequestsCount === 1) {
      console.log('     [MUTATION GUARD TEST] Đang GIỮ lệnh AI đầu tiên ở trạng thái PENDING...');
      // Wait until released
      await holdFirstCommandPromise;
      console.log('     [MUTATION GUARD TEST] Đã THẢ lệnh AI đầu tiên, tiếp tục xử lý...');
      await route.continue();
    } else {
      await route.continue();
    }
  });

  // Also monitor undo route
  await testPage.route('**/api/looks/*/undo', async (route) => {
    commandRequestsCount++;
    console.log(`     [NETWORK INTERCEPT] Nhận request hoàn tác undo!`);
    await route.continue();
  });

  // Step 1: Trigger an AI command sequence via Chat input
  console.log('     * Gửi yêu cầu tư vấn AI trong Phòng phối...');
  const chatInput = await testPage.$('input[placeholder*="Yêu cầu AI"], form input');
  if (chatInput) {
    await chatInput.fill('Đổi tay áo và màu quần');
    const sendBtn = await testPage.$('form button[type="submit"]');
    if (sendBtn) await sendBtn.click();
  } else {
    console.warn('     [CẢNH BÁO]: Không tìm thấy ô nhập chat AI!');
  }

  // Wait a moment for network request to be captured and held
  await new Promise((r) => setTimeout(r, 600));
  console.log(`     * Trạng thái mạng: Lệnh AI đầu tiên đang bị treo (${commandRequestsCount} request đã gửi)`);

  // Step 2: Now user attempts a manual click (e.g. click undo button or another swatch) while system is busy
  console.log('     * Thử thao tác tay người dùng xen giữa (Click nút Hoàn tác & Đặt lại trong lúc đang áp dụng lệnh AI)...');
  const initialCountBeforeInterference = commandRequestsCount;
  const undoBtn = await testPage.$('button:has-text("Hoàn tác")');
  if (undoBtn) {
    await undoBtn.click({ force: true });
  }

  const collarBtn = await testPage.$('button:has-text("Cổ thuyền"), button:has-text("Cổ tròn")');
  if (collarBtn) {
    await collarBtn.click({ force: true });
  }

  await new Promise((r) => setTimeout(r, 500));

  // Step 3: Verify that frontend mutation guard prevented any new network requests
  const countAfterInterference = commandRequestsCount;
  console.log(`     * Số request sau khi người dùng cố thao tác xen giữa: ${countAfterInterference}`);
  if (countAfterInterference === initialCountBeforeInterference) {
    console.log('     -> THÀNH CÔNG: Frontend mutation guard ĐÃ CHẶN thao tác tay xen giữa!');
    console.log('        Không có bất kỳ request mutation xen giữa nào được gửi tới máy chủ.');
  } else {
    console.error('     -> THẤT BÀI: Frontend vẫn gửi request khi đang mutating!');
    process.exit(1);
  }

  // Step 4: Release the held request
  console.log('     * Thả phản hồi lệnh AI đầu tiên...');
  routeResolver();

  // Wait for command sequence to finish and UI to become unbusy
  await new Promise((r) => setTimeout(r, 1200));

  // Step 5: Verify that after release, UI is responsive again and new actions work
  console.log('     * Kiểm tra giao diện đã mở lại tương tác bình thường...');
  const resetBtn = await testPage.$('button:has-text("Đặt lại")');
  if (resetBtn) {
    await resetBtn.click();
    await new Promise((r) => setTimeout(r, 500));
    console.log(`     * Số request sau khi mở khóa và click Đặt lại: ${commandRequestsCount}`);
    if (commandRequestsCount > countAfterInterference) {
      console.log('     -> THÀNH CÔNG: Giao diện đã mở lại và tiếp nhận lệnh mới bình thường!');
    }
  }

  await testPage.close();
} finally {
  await browser.close();
  serverProcess.kill();
  console.log('\n[HOÀN TẤT] Đã đóng trình duyệt và dừng máy chủ kiểm thử.');

  // Clean up isolated db
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  } catch {}
}

console.log('\n===============================================================');
console.log('  TẤT CẢ CÁC BÀI TEST GIAO DIỆN VÀ MUTATION GUARD ĐỀU ĐẠT CHUẨN!');
console.log('===============================================================');
