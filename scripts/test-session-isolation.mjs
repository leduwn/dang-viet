import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

console.log('=== DÁNG VIỆT - KIỂM THỬ PHÂN TÁCH PHIÊN, BẢO VỆ LOOKBOOK & CONCURRENCY OCC ===\n');

const testDir = path.resolve('test-session-scratch');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

const testDbPath = path.join(testDir, 'test-session.db');

// Launch server on ephemeral port with independent test database
console.log('[SERVER] Đang khởi động backend tại cổng ngẫu nhiên...');
const serverProcess = spawn(process.execPath, ['apps/server/dist/index.js'], {
  env: {
    ...process.env,
    PORT: '0',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    DATABASE_PATH: testDbPath,
  },
  stdio: 'pipe',
});

let assignedPort = null;
serverProcess.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  console.log('[SERVER STDOUT]', text.trim());
  const match = text.match(/http:\/\/127\.0\.0\.1:(\d+)/);
  if (match) assignedPort = match[1];
});
serverProcess.stderr.on('data', (chunk) => {
  const errText = chunk.toString();
  if (errText.trim()) console.error('[SERVER STDERR]', errText);
});

// Wait for server ready
let ready = false;
for (let i = 0; i < 30; i++) {
  if (assignedPort) {
    try {
      const res = await fetch(`http://127.0.0.1:${assignedPort}/api/health`);
      if (res.ok) {
        ready = true;
        break;
      }
      console.log('[HEALTH NOT OK]', res.status, await res.text());
    } catch (hErr) {
      console.log('[HEALTH ERR]', hErr.message);
    }
  }
  await new Promise((r) => setTimeout(r, 300));
}

if (!ready || !assignedPort) {
  console.error('[FAIL] Không thể kết nối tới server sau 9 giây.');
  serverProcess.kill();
  process.exit(1);
}

const BASE_URL = `http://127.0.0.1:${assignedPort}/api`;
console.log(`[OK] Server sẵn sàng tại: http://127.0.0.1:${assignedPort}\n`);

// Helper for session client simulating browser cookie jar
class BrowserSession {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
  }

  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = { ...(options.headers || {}) };
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    // Attach stored cookies
    if (this.cookies.size > 0) {
      const cookieHeader = Array.from(this.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      headers['Cookie'] = cookieHeader;
    }

    const res = await fetch(url, { ...options, headers });

    // Store Set-Cookie headers
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (setCookies.length === 0) {
      const raw = res.headers.get('set-cookie');
      if (raw) setCookies.push(raw);
    }

    for (const sc of setCookies) {
      const parts = sc.split(';')[0].split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        this.cookies.set(key, val);
      }
    }

    const data = await res.json().catch(() => null);
    return {
      status: res.status,
      ok: res.ok,
      data,
      headers: res.headers,
    };
  }
}

try {
  // =========================================================================
  // TEST 1: Phiên ẩn danh an toàn & Khởi tạo bản phối riêng biệt
  // =========================================================================
  console.log('--- TEST 1: Phiên ẩn danh an toàn & Khởi tạo bản phối riêng biệt ---');
  const clientA = new BrowserSession('Client A');
  const clientB = new BrowserSession('Client B');

  const resA1 = await clientA.request('/session');
  assert.strictEqual(resA1.status, 200, 'Client A phải lấy được thông tin session (200 OK)');
  assert(clientA.cookies.has('dv_session'), 'Client A phải nhận được cookie dv_session');
  const sessionCookieA = clientA.cookies.get('dv_session');
  assert(sessionCookieA.includes('.'), 'Cookie dv_session phải có chữ ký HMAC');
  const lookA = resA1.data.look;
  assert(lookA && lookA.id, 'Client A phải có bản phối hợp lệ');
  assert.notStrictEqual(lookA.id, 'look_default_01', 'Bản phối của Client A không được trùng với template look_default_01');
  console.log(`[PASS] Client A đã khởi tạo session: ${resA1.data.sessionId}, lookId: ${lookA.id}`);

  const resB1 = await clientB.request('/session');
  assert.strictEqual(resB1.status, 200, 'Client B phải lấy được thông tin session (200 OK)');
  assert(clientB.cookies.has('dv_session'), 'Client B phải nhận được cookie dv_session');
  const lookB = resB1.data.look;
  assert.notStrictEqual(resA1.data.sessionId, resB1.data.sessionId, 'SessionId của Client A và B phải khác nhau');
  assert.notStrictEqual(lookA.id, lookB.id, 'LookId của Client A và B phải tách biệt hoàn toàn');
  console.log(`[PASS] Client B đã khởi tạo session: ${resB1.data.sessionId}, lookId: ${lookB.id}`);
  console.log(' -> PASSED: Hai phiên trình duyệt có session và bản phối độc lập.\n');

  // =========================================================================
  // TEST 2: Khôi phục phiên khi tải lại trang (Persistence on Reload)
  // =========================================================================
  console.log('--- TEST 2: Khôi phục phiên khi tải lại trang (Persistence on Reload) ---');
  // Client A chỉnh sửa trang phục trước khi reload
  const cmdA1 = {
    commandId: randomUUID(),
    lookId: lookA.id,
    expectedRevision: lookA.revision,
    action: 'SET_PRIMARY_COLOR',
    payload: { color: { hex: '#D4AF37', name: 'Hoàng Cúc', family: 'yellow' } },
    timestamp: new Date().toISOString(),
  };
  const mutateA = await clientA.request(`/looks/${lookA.id}/command`, { method: 'POST', body: cmdA1 });
  if (mutateA.status !== 200) {
    console.error('[MUTATE A ERROR]', mutateA.status, mutateA.data);
  }
  assert.strictEqual(mutateA.status, 200, 'Client A thực hiện lệnh đổi màu thành công');
  assert.strictEqual(mutateA.data.look.revision, 2, 'Revision của Client A phải tăng lên 2');

  // Client A "reload" trang bằng cách gọi lại GET /session với cùng cookie
  const reloadA = await clientA.request('/session');
  assert.strictEqual(reloadA.status, 200, 'Reload Client A phải trả về 200 OK');
  assert.strictEqual(reloadA.data.sessionId, resA1.data.sessionId, 'Session ID phải được bảo lưu');
  assert.strictEqual(reloadA.data.currentLookId, lookA.id, 'Current Look ID phải được bảo lưu');
  assert.strictEqual(reloadA.data.look.revision, 2, 'Revision v2 đã sửa đổi phải được khôi phục nguyên vẹn');
  assert.strictEqual(reloadA.data.look.config.primaryColor.hex, '#D4AF37', 'Màu đã chọn phải được giữ nguyên');
  console.log(' -> PASSED: Tải lại trang khôi phục chính xác trạng thái phiên và bản phối.\n');

  // =========================================================================
  // TEST 3: Ngăn chặn truy cập chéo và bảo vệ chống dò ID (Non-leaking 404)
  // =========================================================================
  console.log('--- TEST 3: Ngăn chặn truy cập chéo & Bảo vệ chống dò ID (Non-leaking 404) ---');
  // Client B cố đọc bản phối của Client A
  const crossRead = await clientB.request(`/looks/${lookA.id}`);
  assert.strictEqual(crossRead.status, 404, 'Client B đọc bản phối của Client A phải trả về 404 Not Found (không làm lộ tài nguyên)');
  assert.strictEqual(crossRead.data.code, 'LOOK_NOT_FOUND', 'Mã lỗi phải là LOOK_NOT_FOUND');
  console.log('[PASS] Client B bị từ chối 404 khi GET /looks/:id của Client A');

  // Client B cố gửi command sửa bản phối của Client A
  const crossCmd = {
    commandId: randomUUID(),
    lookId: lookA.id,
    expectedRevision: 2,
    action: 'SET_PRIMARY_COLOR',
    payload: { color: { hex: '#000000', name: 'Đen', family: 'black' } },
    timestamp: new Date().toISOString(),
  };
  const crossMutate = await clientB.request(`/looks/${lookA.id}/command`, { method: 'POST', body: crossCmd });
  assert.strictEqual(crossMutate.status, 404, 'Client B sửa bản phối của Client A phải bị từ chối 404');
  console.log('[PASS] Client B bị từ chối 404 khi POST /looks/:id/command của Client A');

  // Client B cố gọi undo trên bản phối của Client A
  const crossUndo = await clientB.request(`/looks/${lookA.id}/undo`, {
    method: 'POST',
    body: { expectedRevision: 2, commandId: randomUUID() },
  });
  assert.strictEqual(crossUndo.status, 404, 'Client B hoàn tác bản phối của Client A phải bị từ chối 404');
  console.log('[PASS] Client B bị từ chối 404 khi POST /looks/:id/undo của Client A');

  // Client B cố gọi AI chat với bản phối của Client A
  const crossAi = await clientB.request('/ai/chat', {
    method: 'POST',
    body: { lookId: lookA.id, message: 'Chào bạn', history: [] },
  });
  assert.strictEqual(crossAi.status, 404, 'Client B trò chuyện AI trên bản phối của Client A phải bị từ chối 404');
  console.log('[PASS] Client B bị từ chối 404 khi tương tác AI với bản phối của Client A');

  // Xác minh bản phối của Client A vẫn nguyên vẹn
  const checkA = await clientA.request(`/looks/${lookA.id}`);
  assert.strictEqual(checkA.data.revision, 2);
  assert.strictEqual(checkA.data.config.primaryColor.hex, '#D4AF37', 'Bản phối của Client A không bị xâm phạm');
  console.log(' -> PASSED: Toàn bộ thao tác truy cập trái phép bị chặn với 404 non-leaking.\n');

  // =========================================================================
  // TEST 4: Phân tách Lookbook & Bảo vệ sở hữu (Lookbook CRUD Protection)
  // =========================================================================
  console.log('--- TEST 4: Phân tách Lookbook & Bảo vệ sở hữu (Lookbook CRUD Protection) ---');
  // Client A lưu 1 thiết kế vào Lookbook
  const itemA = {
    id: `lb_${randomUUID()}`,
    title: 'Áo dài Lễ Tết của A',
    lookId: lookA.id,
    revision: 2,
    snapshotConfig: checkA.data.config,
    eventId: 'choi_tet',
    styleId: 'thanh_lich',
    notes: 'Thiết kế riêng của phiên A',
    createdAt: new Date().toISOString(),
  };
  const saveA = await clientA.request('/lookbook', { method: 'POST', body: itemA });
  assert.strictEqual(saveA.status, 201, 'Client A lưu Lookbook thành công (201 Created)');

  // Client A xem danh sách Lookbook -> thấy 1 mục
  const listA = await clientA.request('/lookbook');
  assert.strictEqual(listA.status, 200);
  assert.strictEqual(listA.data.length, 1);
  assert.strictEqual(listA.data[0].id, itemA.id);

  // Client B xem danh sách Lookbook -> danh sách của B phải rỗng (không thấy item của A)
  const listB = await clientB.request('/lookbook');
  assert.strictEqual(listB.status, 200);
  assert.strictEqual(listB.data.length, 0, 'Client B không được nhìn thấy bất kỳ mục nào của Client A');
  console.log('[PASS] Client B có danh sách Lookbook riêng biệt rỗng');

  // Client B cố GET trực tiếp item của Client A theo ID
  const readLbB = await clientB.request(`/lookbook/${itemA.id}`);
  assert.strictEqual(readLbB.status, 404, 'Client B đọc Lookbook của Client A phải bị 404 Not Found');

  // Client B cố DELETE item của Client A
  const deleteLbB = await clientB.request(`/lookbook/${itemA.id}`, { method: 'DELETE' });
  assert.strictEqual(deleteLbB.status, 404, 'Client B xóa Lookbook của Client A phải bị 404 Not Found');

  // Kiểm tra lại danh sách của Client A vẫn còn nguyên mục
  const verifyListA = await clientA.request('/lookbook');
  assert.strictEqual(verifyListA.data.length, 1, 'Mục Lookbook của Client A vẫn còn nguyên');
  console.log(' -> PASSED: Lookbook phân tách hoàn toàn, cấm đọc/xóa chéo phiên.\n');

  // =========================================================================
  // TEST 5: Idempotency và Xử lý xung đột đồng thời (Optimistic Concurrency)
  // =========================================================================
  console.log('--- TEST 5: Idempotency & Optimistic Concurrency Control (OCC) ---');
  // 5a. Lệnh trùng lặp commandId phải bị 409 DUPLICATE_COMMAND_ID
  const duplicateCommandId = randomUUID();
  const cmdDup1 = {
    commandId: duplicateCommandId,
    lookId: lookA.id,
    expectedRevision: 2,
    action: 'SET_EVENT',
    payload: { eventId: 'choi_tet' },
    timestamp: new Date().toISOString(),
  };
  const exec1 = await clientA.request(`/looks/${lookA.id}/command`, { method: 'POST', body: cmdDup1 });
  assert.strictEqual(exec1.status, 200, 'Lệnh ban đầu thực thi thành công');
  assert.strictEqual(exec1.data.look.revision, 3);

  const exec2 = await clientA.request(`/looks/${lookA.id}/command`, { method: 'POST', body: cmdDup1 });
  assert.strictEqual(exec2.status, 409, 'Lệnh gửi lại cùng commandId phải bị từ chối 409 Conflict');
  assert.strictEqual(exec2.data.code, 'DUPLICATE_COMMAND_ID');
  console.log('[PASS] Ghi nhận thành công lỗi 409 DUPLICATE_COMMAND_ID');

  // 5b. Xung đột phiên bản (Stale Revision)
  const cmdStale = {
    commandId: randomUUID(),
    lookId: lookA.id,
    expectedRevision: 1, // Máy chủ đang ở revision 3
    action: 'SET_PANTS_COLOR',
    payload: { color: { hex: '#FFFFFF', name: 'Trắng', family: 'white' } },
    timestamp: new Date().toISOString(),
  };
  const execStale = await clientA.request(`/looks/${lookA.id}/command`, { method: 'POST', body: cmdStale });
  assert.strictEqual(execStale.status, 409, 'Lệnh gửi stale revision phải bị 409 Conflict');
  assert.strictEqual(execStale.data.code, 'REVISION_CONFLICT');
  assert.strictEqual(execStale.data.currentRevision, 3, 'Trả về revision hiện tại trên máy chủ');
  console.log('[PASS] Ghi nhận thành công lỗi 409 REVISION_CONFLICT');

  // 5c. Hai cập nhật đồng thời cùng expectedRevision: không được ghi đè âm thầm
  console.log('[CONCURRENCY] Chạy 2 request đồng thời từ Client A với cùng expectedRevision = 3...');
  const concurrentCmd1 = {
    commandId: randomUUID(),
    lookId: lookA.id,
    expectedRevision: 3,
    action: 'SET_PANTS_COLOR',
    payload: { color: { hex: '#111111', name: 'Đen tuyền', family: 'black' } },
    timestamp: new Date().toISOString(),
  };
  const concurrentCmd2 = {
    commandId: randomUUID(),
    lookId: lookA.id,
    expectedRevision: 3,
    action: 'SET_PANTS_COLOR',
    payload: { color: { hex: '#222222', name: 'Xám đậm', family: 'black' } },
    timestamp: new Date().toISOString(),
  };

  const [resConcurrent1, resConcurrent2] = await Promise.all([
    clientA.request(`/looks/${lookA.id}/command`, { method: 'POST', body: concurrentCmd1 }),
    clientA.request(`/looks/${lookA.id}/command`, { method: 'POST', body: concurrentCmd2 }),
  ]);

  const statuses = [resConcurrent1.status, resConcurrent2.status].sort();
  assert.deepStrictEqual(statuses, [200, 409], 'Chính xác 1 request thành công (200) và 1 request xung đột (409)');
  const conflictRes = resConcurrent1.status === 409 ? resConcurrent1 : resConcurrent2;
  assert.strictEqual(conflictRes.data.code, 'REVISION_CONFLICT');
  console.log(' -> PASSED: Hai cập nhật đồng thời được kiểm soát nguyên tử, bảo vệ OCC không mất dữ liệu.\n');

  // =========================================================================
  // TEST 6: Bảo vệ CSRF cho các yêu cầu biến đổi (Mutating requests)
  // =========================================================================
  console.log('--- TEST 6: Bảo vệ CSRF cho các yêu cầu biến đổi (Mutating requests) ---');
  // Mutating request với Sec-Fetch-Site: cross-site
  const csrfAttack = await clientA.request(`/looks/${lookA.id}/command`, {
    method: 'POST',
    headers: {
      'Sec-Fetch-Site': 'cross-site',
    },
    body: {
      commandId: randomUUID(),
      lookId: lookA.id,
      expectedRevision: 4,
      action: 'RESET_OUTFIT',
      payload: {},
      timestamp: new Date().toISOString(),
    },
  });
  assert.strictEqual(csrfAttack.status, 403, 'Yêu cầu cross-site mutating phải bị từ chối 403 Forbidden');
  assert.strictEqual(csrfAttack.data.code, 'CSRF_REJECTED');
  console.log(' -> PASSED: CSRF cross-site attack bị chặn thành công với 403 CSRF_REJECTED.\n');

  // =========================================================================
  // TEST 7: Template look_default_01 được bảo vệ không thể sửa trực tiếp
  // =========================================================================
  console.log('--- TEST 7: Template look_default_01 được bảo vệ không thể sửa trực tiếp ---');
  const mutateTemplate = await clientA.request('/looks/look_default_01/command', {
    method: 'POST',
    body: {
      commandId: randomUUID(),
      lookId: 'look_default_01',
      expectedRevision: 1,
      action: 'SET_PRIMARY_COLOR',
      payload: { color: { hex: '#000000', name: 'Đen', family: 'black' } },
      timestamp: new Date().toISOString(),
    },
  });
  assert.strictEqual(mutateTemplate.status, 404, 'Không thể mutate trực tiếp template look_default_01');
  console.log(' -> PASSED: Template look_default_01 được bảo toàn nguyên vẹn.\n');

  console.log('===============================================================================');
  console.log('  CHÚC MỪNG: TẤT CẢ 7 BÀI KIỂM THỬ SESSION ISOLATION & SECURITY ĐÃ ĐẠT 100%!');
  console.log('===============================================================================');
} finally {
  serverProcess.kill();
  try {
    fs.rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
}
