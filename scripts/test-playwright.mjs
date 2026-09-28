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

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

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
console.log('[3/5] Khởi chạy Microsoft Edge headless...');
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
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
  const studioSvg = desktopPage.locator('.outfit-room svg[aria-label*="Mô hình vector"]').first();
  assert(await studioSvg.isVisible(), 'SVG nhân vật trong Phòng phối phải hiển thị');
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

  // Exact locator for Tay áo select
  const sleeveSelect = testPage.locator('label:has-text("Tay áo")').locator('..').locator('select');
  assert.strictEqual(await sleeveSelect.count(), 1, '[ASSERTION THẤT BÀI]: Không tìm thấy thẻ select Tay áo bằng locator chuẩn');

  console.log('     * Đã xác định đầy đủ các locator tương tác: Chat, Hoàn tác, Đặt lại, Select Cổ áo, Select Tay áo');

  // 2. Intercept AI Chat to return deterministic 2 sequential commands
  await testPage.route('**/api/ai/chat', async (route) => {
    console.log('     [AI ROUTE INTERCEPT] Mô phỏng phản hồi AI Chat gồm 2 lệnh tuần tự...');
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
  assert.strictEqual(commandRequests[0].action, 'SET_SLEEVE', '[ASSERTION THẤT BÀI]: Command đầu tiên phải là SET_SLEEVE');
  console.log('     * Assertion trạng thái pending: ĐÚNG 1 command AI đang pending (SET_SLEEVE)');

  // 5. Test (A) Disabled UI controls: Check disabled properties
  const isUndoDisabled = await undoBtn.isDisabled();
  assert(isUndoDisabled, '[ASSERTION THẤT BÀI]: Nút Hoàn tác phải ở trạng thái disabled khi hệ thống đang bận');

  const isResetDisabled = await resetBtn.isDisabled();
  assert(isResetDisabled, '[ASSERTION THẤT BÀI]: Nút Đặt lại phải ở trạng thái disabled khi hệ thống đang bận');

  const isCollarDisabled = await collarSelect.isDisabled();
  assert(isCollarDisabled, '[ASSERTION THẤT BÀI]: Select Cổ áo phải ở trạng thái disabled khi hệ thống đang bận');

  const isSleeveDisabled = await sleeveSelect.isDisabled();
  assert(isSleeveDisabled, '[ASSERTION THẤT BÀI]: Select Tay áo phải ở trạng thái disabled khi hệ thống đang bận');

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

  // Wait for sleeveSelect value to become 'raglan'
  await testPage.waitForFunction(
    () => {
      const select = Array.from(document.querySelectorAll('select')).find((s) =>
        s.previousElementSibling?.textContent?.includes('Tay áo')
      ) || document.querySelectorAll('select')[1];
      return select && select.value === 'raglan';
    },
    { timeout: 8000 }
  );

  assert.strictEqual(commandRequests.length, 2, '[ASSERTION THẤT BÀI]: Cả 2 command AI phải được gửi lên server');
  assert.strictEqual(commandRequests[1].action, 'SET_PANTS_COLOR', '[ASSERTION THẤT BÀI]: Command thứ hai phải là SET_PANTS_COLOR');

  const currentSleeveValue = await sleeveSelect.inputValue();
  assert.strictEqual(currentSleeveValue, 'raglan', '[ASSERTION THẤT BÀI]: UI phải hiển thị giá trị tay áo mới là "raglan"');
  console.log('     * Assertion thực thi 2 lệnh AI: ĐẠT (sleeve=raglan, pants=black)');

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
