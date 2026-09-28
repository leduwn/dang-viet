import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { parseModelChatOutput } from '../apps/server/dist/ai/parser.js';

console.log('=== DÁNG VIỆT - BÀI KIỂM THỬ TỔNG HỢP KIỂM CHỨNG HỆ THỐNG (HARDENED SUITE) ===\n');

const testDir = path.resolve('test-harden-scratch');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

const testDbPath = path.join(testDir, 'dangviet.db');
const TEST_PORT = '3147';
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

// 1. Prepare isolated test environment
console.log('[SETUP] Chuẩn bị môi trường kiểm thử độc lập cho test-harden...');
// Server will automatically create DB, run schema migrations, and sync culture cards from content/

// Helper to make API requests
async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    headers,
    ...options,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

// Start temporary test server
console.log(`[SETUP] Khởi động máy chủ backend tại port ${TEST_PORT} (database độc lập)...`);
const serverProcess = spawn(process.execPath, ['apps/server/dist/index.js'], {
  env: {
    ...process.env,
    PORT: TEST_PORT,
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    DATABASE_PATH: testDbPath,
  },
  stdio: 'pipe',
});

// Wait for server ready
let ready = false;
for (let i = 0; i < 25; i++) {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (res.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 400));
}

if (!ready) {
  console.error('[FAIL] Không thể kết nối tới server sau 10 giây.');
  serverProcess.kill();
  process.exit(1);
}
console.log(`[OK] Máy chủ backend đã sẵn sàng tại port ${TEST_PORT}.\n`);

try {
  // =========================================================================
  // TEST SUITE 1: SEQUENTIAL MULTI-LEVEL UNDO WITH MONOTONIC REVISIONS
  // =========================================================================
  console.log('--- TEST 1: HOÀN TÁC NHIỀU LẦN TUẦN TỰ (MULTI-LEVEL UNDO) ---');

  // Create a dedicated fresh test look
  const testLookId = `test_undo_look_${Date.now()}`;
  const initLookRes = await api('/looks', {
    method: 'POST',
    body: JSON.stringify({
      id: testLookId,
      title: 'Bộ kiểm thử Undo',
      eventId: 'ky_yeu',
      styleId: 'thanh_lich',
      config: {
        garmentType: 'aodai',
        primaryColor: { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' },
        pantsColor: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
        collarStyle: 'traditional_high',
        sleeveStyle: 'traditional_long',
        fabric: 'silk_ha_dong',
        pattern: 'plain',
        accessories: [],
      },
      locks: {
        primaryColor: false,
        pantsColor: false,
        collarStyle: false,
        sleeveStyle: false,
        fabric: false,
        pattern: false,
        accessories: false,
      },
      explanation: 'Khởi tạo cho bài kiểm thử hoàn tác',
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  });
  assert.strictEqual(initLookRes.status, 201, 'Tạo bộ test look ban đầu thành công');

  let currentLook = initLookRes.data;
  const initialRevision = currentLook.revision; // 1
  const initialPrimary = currentLook.config.primaryColor.name;
  const initialPants = currentLook.config.pantsColor.name;
  const initialCollar = currentLook.config.collarStyle;

  // Edit 1: Đổi màu áo sang Đỏ son hoàng gia
  console.log(' [1.1] Chỉnh sửa 1: Đổi màu áo sang Đỏ son hoàng gia');
  const cmd1 = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: currentLook.revision,
      action: 'SET_PRIMARY_COLOR',
      payload: { color: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' } },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(cmd1.status, 200);
  assert.strictEqual(cmd1.data.look.revision, 2);
  assert.strictEqual(cmd1.data.look.config.primaryColor.name, 'Đỏ son hoàng gia');
  currentLook = cmd1.data.look;

  // Edit 2: Đổi màu quần sang Đen tuyền dạ hội
  console.log(' [1.2] Chỉnh sửa 2: Đổi màu quần sang Đen tuyền dạ hội');
  const cmd2 = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: currentLook.revision,
      action: 'SET_PANTS_COLOR',
      payload: { color: { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black' } },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(cmd2.status, 200);
  assert.strictEqual(cmd2.data.look.revision, 3);
  assert.strictEqual(cmd2.data.look.config.pantsColor.name, 'Đen tuyền dạ hội');
  currentLook = cmd2.data.look;

  // Edit 3: Đổi kiểu cổ áo sang cổ thuyền (boat)
  console.log(' [1.3] Chỉnh sửa 3: Đổi kiểu cổ áo sang cổ thuyền (boat)');
  const cmd3 = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: currentLook.revision,
      action: 'SET_COLLAR',
      payload: { collarStyle: 'boat' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(cmd3.status, 200);
  assert.strictEqual(cmd3.data.look.revision, 4);
  assert.strictEqual(cmd3.data.look.config.collarStyle, 'boat');
  currentLook = cmd3.data.look;

  // 3 LẦN HOÀN TÁC LIÊN TIẾP
  // Undo 1: Phục hồi cổ áo về traditional_high. Revision tăng đơn điệu lên 5!
  console.log(' [1.4] Hoàn tác 1: Revert cổ áo -> kiểm tra revision tăng đơn điệu (v5)');
  const undo1 = await api(`/looks/${testLookId}/undo`, { method: 'POST' });
  assert.strictEqual(undo1.status, 200);
  assert.strictEqual(undo1.data.look.revision, 5, 'Revision phải tăng đơn điệu lên 5 để tránh xung đột');
  assert.strictEqual(undo1.data.look.config.collarStyle, 'traditional_high', 'Cổ áo đã được khôi phục về traditional_high');
  assert.strictEqual(undo1.data.look.config.pantsColor.name, 'Đen tuyền dạ hội', 'Màu quần vẫn giữ ở bước 2');
  currentLook = undo1.data.look;

  // Undo 2: Phục hồi màu quần về Trắng tinh khôi. Revision tăng lên 6!
  console.log(' [1.5] Hoàn tác 2: Revert màu quần -> kiểm tra revision tăng đơn điệu (v6)');
  const undo2 = await api(`/looks/${testLookId}/undo`, { method: 'POST' });
  assert.strictEqual(undo2.status, 200);
  assert.strictEqual(undo2.data.look.revision, 6);
  assert.strictEqual(undo2.data.look.config.pantsColor.name, 'Trắng tinh khôi', 'Màu quần khôi phục về Trắng tinh khôi');
  assert.strictEqual(undo2.data.look.config.primaryColor.name, 'Đỏ son hoàng gia', 'Màu áo vẫn giữ ở bước 1');
  currentLook = undo2.data.look;

  // Undo 3: Phục hồi màu áo về Trắng sứ ngà (trạng thái gốc ban đầu). Revision tăng lên 7!
  console.log(' [1.6] Hoàn tác 3: Revert màu áo -> trở về trạng thái gốc ban đầu (v7)');
  const undo3 = await api(`/looks/${testLookId}/undo`, { method: 'POST' });
  assert.strictEqual(undo3.status, 200);
  assert.strictEqual(undo3.data.look.revision, 7);
  assert.strictEqual(undo3.data.look.config.primaryColor.name, initialPrimary, 'Màu áo đã phục hồi về trạng thái ban đầu');
  assert.strictEqual(undo3.data.look.config.pantsColor.name, initialPants);
  assert.strictEqual(undo3.data.look.config.collarStyle, initialCollar);
  currentLook = undo3.data.look;

  // Tải lại trực tiếp từ SQLite để xác minh tính bền vững
  console.log(' [1.7] Tải lại từ SQLite kiểm tra trạng thái lưu trữ chính xác');
  const reloadRes = await api(`/looks/${testLookId}`);
  assert.strictEqual(reloadRes.status, 200);
  assert.strictEqual(reloadRes.data.revision, 7);
  assert.strictEqual(reloadRes.data.config.primaryColor.name, initialPrimary);

  // Thử Undo thêm lần nữa khi đã ở trạng thái ban đầu -> phải từ chối an toàn
  console.log(' [1.8] Kiểm tra từ chối hoàn tác khi ngăn xếp undo rỗng');
  const undoEmpty = await api(`/looks/${testLookId}/undo`, { method: 'POST' });
  assert.strictEqual(undoEmpty.status, 400);
  assert.strictEqual(undoEmpty.data.code, 'CANNOT_UNDO');

  // Chỉnh sửa mới sau chuỗi hoàn tác: Đổi tay áo sang lửng (slit)
  console.log(' [1.9] Thực hiện chỉnh sửa mới sau khi hoàn tác -> rẽ nhánh lịch sử an toàn');
  const cmdBranch = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: currentLook.revision, // 7
      action: 'SET_SLEEVE',
      payload: { sleeveStyle: 'slit' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(cmdBranch.status, 200);
  assert.strictEqual(cmdBranch.data.look.revision, 8);
  assert.strictEqual(cmdBranch.data.look.config.sleeveStyle, 'slit');
  console.log(' -> PASSED: Multi-level sequential undo hoạt động hoàn hảo và tăng đơn điệu.\n');

  // =========================================================================
  // TEST SUITE 2: COMMAND BUS HARDENING, ATOMIC OCC & LOCK CONSTRAINTS
  // =========================================================================
  console.log('--- TEST 2: CỦNG CỐ COMMAND BUS, KHÓA & XUNG ĐỘT GIAO DỊCH ---');

  // 2.1 Không cho phép vượt khóa bằng force: true
  console.log(' [2.1] Khóa màu áo và kiểm tra không thể vượt khóa dù truyền force: true');
  // Khóa màu áo
  const lockCmd = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: 8,
      action: 'TOGGLE_LOCK',
      payload: { field: 'primaryColor' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(lockCmd.status, 200);
  assert.strictEqual(lockCmd.data.look.locks.primaryColor, true);

  // Thử đổi màu áo khi đang khóa kèm force: true
  const forceCmd = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: 9,
      action: 'SET_PRIMARY_COLOR',
      payload: {
        color: { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' },
        force: true, // Bypass attempt
      },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(forceCmd.status, 400, 'Phải từ chối 400 khi màu áo đang bị khóa');
  console.log(' -> Từ chối vượt khóa thành công:', forceCmd.data.error);

  // 2.2 Áp dụng thiết kế (APPLY_DESIGN) phải bảo vệ thuộc tính đã khóa
  console.log(' [2.2] Áp dụng thiết kế mới: Kiểm tra phần đã khóa (áo) không bị đổi');
  const applyDesignCmd = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: 9,
      action: 'APPLY_DESIGN',
      payload: {
        config: {
          garmentType: 'aodai',
          primaryColor: { hex: '#5D3A68', name: 'Tím huế trầm', family: 'purple' },
          pantsColor: { hex: '#E5A93C', name: 'Vàng hoàng yến', family: 'yellow' },
          collarStyle: 'boat',
          sleeveStyle: 'slit',
          fabric: 'brocade_hue',
          pattern: 'cloud',
          accessories: ['quat_xep'],
        },
        title: 'Thiết kế thử nghiệm bảo vệ khóa',
      },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(applyDesignCmd.status, 200);
  assert.strictEqual(applyDesignCmd.data.look.config.pantsColor.name, 'Vàng hoàng yến', 'Màu quần chưa khóa được đổi');
  assert.strictEqual(applyDesignCmd.data.look.config.primaryColor.name, initialPrimary, 'Màu áo đã khóa được bảo toàn tuyệt đối!');

  // 2.3 Phụ kiện không tồn tại trong danh mục bị từ chối
  console.log(' [2.3] Thử thêm phụ kiện không tồn tại trong danh mục catalog');
  const invalidAccCmd = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: 10,
      action: 'TOGGLE_ACCESSORY',
      payload: { accessoryId: 'dong_ho_apple_watch_fake' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(invalidAccCmd.status, 400);
  console.log(' -> Đã chặn thành công phụ kiện không hợp lệ:', invalidAccCmd.data.error);

  // 2.4 Chống thực hiện trùng lặp Command ID (Idempotency)
  console.log(' [2.4] Kiểm tra chống thực hiện trùng: Gửi cùng 1 Command ID hai lần');
  const duplicateId = randomUUID();
  const firstSend = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: duplicateId,
      lookId: testLookId,
      expectedRevision: 10,
      action: 'SET_PANTS_COLOR',
      payload: { color: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' } },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(firstSend.status, 200, 'Lệnh gửi lần 1 thành công');

  const secondSend = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: duplicateId,
      lookId: testLookId,
      expectedRevision: 11,
      action: 'SET_PANTS_COLOR',
      payload: { color: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' } },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(secondSend.status, 409, 'Lệnh gửi lần 2 với cùng commandId phải trả về lỗi 409');
  assert.strictEqual(secondSend.data.code, 'DUPLICATE_COMMAND_ID');
  console.log(' -> Đã chặn duplicate command ID thành công:', secondSend.data.error);

  // 2.5 Kiểm tra xung đột phiên bản (OCC Concurrency Conflict)
  console.log(' [2.5] Hai command gửi đồng thời cùng expectedRevision');
  const sharedExpectedRev = 11;
  const [resA, resB] = await Promise.all([
    api(`/looks/${testLookId}/command`, {
      method: 'POST',
      body: JSON.stringify({
        commandId: randomUUID(),
        lookId: testLookId,
        expectedRevision: sharedExpectedRev,
        action: 'SET_PANTS_COLOR',
        payload: { color: { hex: '#1E1B18', name: 'Đen tuyền', family: 'black' } },
        timestamp: new Date().toISOString(),
      }),
    }),
    api(`/looks/${testLookId}/command`, {
      method: 'POST',
      body: JSON.stringify({
        commandId: randomUUID(),
        lookId: testLookId,
        expectedRevision: sharedExpectedRev,
        action: 'SET_PANTS_COLOR',
        payload: { color: { hex: '#E5A93C', name: 'Vàng yến', family: 'yellow' } },
        timestamp: new Date().toISOString(),
      }),
    }),
  ]);

  // One must succeed (200) and the other must fail with 409 REVISION_CONFLICT
  const statuses = [resA.status, resB.status].sort();
  assert.deepStrictEqual(statuses, [200, 409], 'Một lệnh thành công, một lệnh nhận xung đột 409');
  const conflictRes = resA.status === 409 ? resA : resB;
  assert.strictEqual(conflictRes.data.code, 'REVISION_CONFLICT');
  console.log(' -> Xung đột phiên bản kiểm soát chính xác qua SQLite BEGIN IMMEDIATE transaction!\n');

  // =========================================================================
  // TEST SUITE 3: AI MODEL PARSER, SIMULATION VS REAL MODE & REVISION RACE
  // =========================================================================
  console.log('--- TEST 3: BỘ PHÂN TÍCH AI PARSER, RÀO CHẮN LỆNH & KIỂM THỬ FIXTURE ---');

  // 3.1 Test Parser with simulated real model JSON response fixture
  console.log(' [3.1] Kiểm thử Parser với fixture phản hồi JSON của mô hình 9router');
  const simulatedModelOutput = JSON.stringify({
    reply: 'Gợi ý chuyển sang áo xanh ngọc bích phối cùng mấn truyền thống cho lễ hội.',
    explanation: 'Sắc xanh ngọc tượng trưng cho thanh xuân tươi mới.',
    actions: [
      {
        action: 'SET_PRIMARY_COLOR',
        payload: { color: { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' } },
      },
      {
        action: 'TOGGLE_ACCESSORY',
        payload: { accessoryId: 'man_truyen_thong' },
      },
      {
        action: 'TOGGLE_ACCESSORY',
        payload: { accessoryId: 'invalid_fake_accessory' }, // Should be ignored!
      },
    ],
  });

  // Current look with primaryColor UNLOCKED for parser test
  const lookForParser = {
    ...currentLook,
    revision: 12,
    locks: { ...currentLook.locks, primaryColor: false },
  };

  const parsed = parseModelChatOutput(simulatedModelOutput, lookForParser);
  assert.strictEqual(parsed.reply, 'Gợi ý chuyển sang áo xanh ngọc bích phối cùng mấn truyền thống cho lễ hội.');
  assert.strictEqual(parsed.commands.length, 2, 'Lệnh phụ kiện không hợp lệ đã bị parser lọc bỏ!');
  assert.strictEqual(parsed.commands[0].action, 'SET_PRIMARY_COLOR');
  assert.strictEqual(parsed.commands[0].expectedRevision, 12);
  assert.strictEqual(parsed.commands[1].action, 'TOGGLE_ACCESSORY');
  assert.strictEqual(parsed.commands[1].expectedRevision, 13);
  console.log(' -> Parser lọc lệnh rác và sinh expectedRevision tuần tự thành công.');

  // 3.2 Parser tôn trọng khóa (Locked attributes protection in Parser)
  console.log(' [3.2] Kiểm thử Parser khi thuộc tính bị khóa: Không tạo lệnh thay đổi');
  const lookWithLock = {
    ...currentLook,
    revision: 12,
    locks: { ...currentLook.locks, primaryColor: true }, // Locked!
  };
  const parsedLocked = parseModelChatOutput(simulatedModelOutput, lookWithLock);
  assert.strictEqual(parsedLocked.commands.length, 1, 'Lệnh đổi áo đã bị loại bỏ vì áo đang bị khóa');
  assert.strictEqual(parsedLocked.commands[0].action, 'TOGGLE_ACCESSORY');
  console.log(' -> Parser bảo vệ thuộc tính đã khóa thành công.');

  // 3.3 Tình huống người dùng đổi màu trong lúc chờ AI: Lệnh cũ của AI bị từ chối
  console.log(' [3.3] Tình huống người dùng đổi màu trong lúc chờ AI: Lệnh cũ không được ghi đè');
  const freshLookState = (await api(`/looks/${testLookId}`)).data;
  const staleAiRevision = freshLookState.revision;

  // Người dùng thao tác trước: Đổi kiểu tay áo (revision tăng lên)
  const userFastAction = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: staleAiRevision,
      action: 'SET_SLEEVE',
      payload: { sleeveStyle: 'slit' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(userFastAction.status, 200);

  // Phản hồi AI đến muộn (mang expectedRevision cũ)
  const delayedAiCommand = await api(`/looks/${testLookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: testLookId,
      expectedRevision: staleAiRevision, // Stale!
      action: 'SET_PRIMARY_COLOR',
      payload: { color: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' } },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(delayedAiCommand.status, 409);
  assert.strictEqual(delayedAiCommand.data.code, 'REVISION_CONFLICT');
  console.log(' -> Lệnh AI đến muộn bị từ chối an toàn, không ghi đè thao tác người dùng!\n');

  // =========================================================================
  // TEST SUITE 4: CULTURAL KNOWLEDGE AUDIT & STATUS GUARDRAILS
  // =========================================================================
  console.log('--- TEST 4: KIỂM CHỨNG DỮ LIỆU VĂN HÓA & PHÂN ĐỊNH TRẠNG THÁI REVIEW ---');

  // Kiểm tra 2 thẻ published sau khi kiểm chứng nguồn độc lập (Bảo tàng LSVN, TTXVN)
  const pubCards = await api('/culture?status=published');
  assert.strictEqual(pubCards.data.length, 2, 'Sau kiểm chứng, có đúng 2 thẻ đạt tiêu chuẩn published');

  const reviewCards = await api('/culture?status=review');
  assert.strictEqual(reviewCards.data.length, 7, 'Chính xác 7 thẻ ở trạng thái review chờ thẩm định nguồn');

  const draftCards = await api('/culture?status=draft');
  assert.strictEqual(draftCards.data.length, 1, '1 thẻ ở trạng thái draft');

  // AI Q&A không được trích dẫn thẻ review như kiến thức đã xác nhận
  console.log(' [4.1] Kiểm tra AI không tự nhận thẻ review là kiến thức đã kiểm chứng');
  const aiChatRes = await api('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      lookId: testLookId,
      message: 'Hãy giải thích chi tiết nguồn gốc và trích dẫn tư liệu về kỹ thuật tay raglan',
      history: [],
    }),
  });
  assert.strictEqual(aiChatRes.status, 200);
  assert.strictEqual(aiChatRes.data.mode, 'mock');
  assert(
    aiChatRes.data.reply.includes('thẩm định') || aiChatRes.data.reply.includes('chưa có đủ dẫn chứng'),
    'AI phải thông báo tư liệu đang ở trạng thái thẩm định hoặc chưa đủ dẫn chứng'
  );
  assert.deepStrictEqual(aiChatRes.data.citations || [], [], 'Không được gắn trích dẫn đã kiểm chứng khi thẻ ở trạng thái review');
  console.log(' -> AI tuân thủ nguyên tắc liêm chính học thuật: Không trích dẫn giả mạo.\n');

  console.log('===============================================================================');
  console.log('  CHÚC MỪNG: TẤT CẢ CÁC BÀI KIỂM THỬ HỆ THỐNG DÁNG VIỆT ĐỀU ĐÃ ĐẠT CHUẨN!');
  console.log('===============================================================================');
} catch (error) {
  console.error('\n[LỖI KIỂM THỬ]:', error);
  process.exitCode = 1;
} finally {
  serverProcess.kill();
  try {
    fs.rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
  console.log('\n[TEARDOWN] Đã dọn dẹp môi trường kiểm thử và dừng máy chủ an toàn.');
}
