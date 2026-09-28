import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

console.log('=== DÁNG VIỆT - KIỂM THỬ LUỒNG NGHIỆP VỤ ĐẦY ĐỦ (FULL USER JOURNEY E2E API) ===\n');

const testDir = path.resolve('test-flow-scratch');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

const testDbPath = path.join(testDir, 'test-flow.db');

// 1. Launch test server on OS-allocated ephemeral port and fresh database
console.log(`[SERVER] Khởi động máy chủ backend tại cổng ngẫu nhiên do HĐH cấp (database độc lập)...`);
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
  const match = text.match(/http:\/\/127\.0\.0\.1:(\d+)/);
  if (match) {
    assignedPort = match[1];
  }
});
serverProcess.stderr.on('data', (chunk) => {
  const errText = chunk.toString();
  if (errText.trim()) console.error('[SERVER STDERR]', errText);
});

// Wait for the spawned server's own stdout to emit the bound port
let ready = false;
for (let i = 0; i < 25; i++) {
  if (assignedPort) {
    try {
      const res = await fetch(`http://127.0.0.1:${assignedPort}/api/health`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
  }
  await new Promise((r) => setTimeout(r, 400));
}

if (!ready || !assignedPort) {
  console.error('[FAIL] Không thể kết nối tới server do test khởi động sau 10 giây.');
  serverProcess.kill();
  process.exit(1);
}

const BASE_URL = `http://127.0.0.1:${assignedPort}/api`;
console.log(`[OK] Máy chủ backend đã sẵn sàng tại port ${assignedPort} (xác nhận đúng tiến trình con vừa khởi tạo).\n`);

async function api(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { headers, ...options });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

try {
  // Seed initial test look via API
  console.log('[SETUP] Khởi tạo bộ phối mặc định qua API...');
  const initLookRes = await api('/looks', {
    method: 'POST',
    body: JSON.stringify({
      id: 'look_default_01',
      title: 'Áo dài Nữ sinh Truyền thống',
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
      explanation: 'Bộ phối mặc định ban đầu',
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  });
  assert.strictEqual(initLookRes.status, 201, 'Khởi tạo look ban đầu thành công');
  console.log(' -> PASSED: Đã khởi tạo look_default_01 thành công.\n');
  // =========================================================================
  // JOURNEY STEP 1: KHỞI TẠO & KHÁM PHÁ (EXPLORE)
  // =========================================================================
  console.log('[BƯỚC 1] Khám phá: Tải siêu dữ liệu /meta và thẻ văn hóa /culture...');
  const metaRes = await api('/meta');
  assert.strictEqual(metaRes.status, 200);
  assert(metaRes.data.events.length > 0, 'Phải có danh sách sự kiện');
  assert(metaRes.data.styles.length > 0, 'Phải có danh sách phong cách');
  assert(metaRes.data.presets.length > 0, 'Phải có danh sách presets');

  const pubCultureRes = await api('/culture?status=published');
  assert.strictEqual(pubCultureRes.status, 200);
  assert.strictEqual(pubCultureRes.data.length, 2, 'Chính xác 2 thẻ văn hóa published');
  console.log(` -> PASSED: Đã tải ${metaRes.data.events.length} sự kiện, ${metaRes.data.presets.length} presets, 2 thẻ văn hóa published.\n`);

  // =========================================================================
  // JOURNEY STEP 2: CHỌN SỰ KIỆN -> PHÒNG PHỐI (SET_EVENT)
  // =========================================================================
  console.log('[BƯỚC 2] Chọn sự kiện từ Explore sang Phòng phối: Chuyển sang "Đi chơi Tết" (choi_tet)...');
  const getLookRes = await api('/looks/look_default_01');
  assert.strictEqual(getLookRes.status, 200);
  let currentLook = getLookRes.data;
  assert.strictEqual(currentLook.revision, 1);
  assert.strictEqual(currentLook.eventId, 'ky_yeu');

  // Dispatch SET_EVENT
  const setEventCmd = await api('/looks/look_default_01/command', {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: 'look_default_01',
      expectedRevision: currentLook.revision,
      action: 'SET_EVENT',
      payload: { eventId: 'choi_tet' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(setEventCmd.status, 200);
  currentLook = setEventCmd.data.look;
  assert.strictEqual(currentLook.eventId, 'choi_tet', 'Sự kiện phải chuyển sang choi_tet');
  assert.strictEqual(currentLook.revision, 2, 'Revision tăng lên 2');
  assert(currentLook.explanation.length > 0, 'Giải trình phối đồ được cập nhật theo sự kiện mới');
  console.log(` -> PASSED: Đã đổi sự kiện thành "${currentLook.eventId}", giải trình: "${currentLook.explanation.slice(0, 60)}..."\n`);

  // =========================================================================
  // JOURNEY STEP 3: TÙY BIẾN MÀU ÁO & KHÓA (CUSTOMIZE & LOCK)
  // =========================================================================
  console.log('[BƯỚC 3] Tùy biến màu áo sang Đỏ son hoàng gia và khóa màu áo lại...');
  const setShirtCmd = await api('/looks/look_default_01/command', {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: 'look_default_01',
      expectedRevision: currentLook.revision,
      action: 'SET_PRIMARY_COLOR',
      payload: { color: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' } },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(setShirtCmd.status, 200);
  currentLook = setShirtCmd.data.look;
  assert.strictEqual(currentLook.config.primaryColor.name, 'Đỏ son hoàng gia');
  assert.strictEqual(currentLook.revision, 3);

  // Lock primaryColor
  const lockCmd = await api('/looks/look_default_01/command', {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: 'look_default_01',
      expectedRevision: currentLook.revision,
      action: 'TOGGLE_LOCK',
      payload: { field: 'primaryColor' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(lockCmd.status, 200);
  currentLook = lockCmd.data.look;
  assert.strictEqual(currentLook.locks.primaryColor, true, 'Màu áo phải ở trạng thái đã khóa');
  assert.strictEqual(currentLook.revision, 4);
  console.log(' -> PASSED: Đã đổi màu áo sang Đỏ son hoàng gia và khóa thành công.\n');

  // =========================================================================
  // JOURNEY STEP 4: HỎI AI TƯ VẤN (ASK AI WITH CONTEXT)
  // =========================================================================
  console.log('[BƯỚC 4] Hỏi Trợ lý AI: Yêu cầu đổi màu quần sang Đen tuyền...');
  const aiChatRes = await api('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      lookId: 'look_default_01',
      message: 'Gợi ý đổi quần sang màu đen tuyền dạ hội giúp mình',
      history: [
        { role: 'user', content: 'Chào bạn, mình đang phối đồ đi chơi Tết' },
        { role: 'assistant', content: 'Chào bạn! Mình có thể giúp gì cho bạn?' },
      ],
    }),
  });
  assert.strictEqual(aiChatRes.status, 200);
  assert(aiChatRes.data.mode === 'mock' || aiChatRes.data.mode === 'live', 'Phải có nhãn mode');
  assert(aiChatRes.data.commands && aiChatRes.data.commands.length > 0, 'AI phải sinh lệnh có cấu trúc');
  const aiPlannedCmd = aiChatRes.data.commands[0];
  assert.strictEqual(aiPlannedCmd.action, 'SET_PANTS_COLOR');
  assert.strictEqual(aiPlannedCmd.payload.color.name, 'Đen tuyền dạ hội');
  console.log(` -> PASSED: AI phản hồi: "${aiChatRes.data.reply}", sinh lệnh ${aiPlannedCmd.action}.\n`);

  // =========================================================================
  // JOURNEY STEP 5: THI HÀNH LỆNH TỪ AI (EXECUTE AI COMMAND SEQUENTIALLY)
  // =========================================================================
  console.log('[BƯỚC 5] Thi hành lệnh đổi màu quần do AI đề xuất...');
  const execAiCmd = await api('/looks/look_default_01/command', {
    method: 'POST',
    body: JSON.stringify(aiPlannedCmd),
  });
  assert.strictEqual(execAiCmd.status, 200);
  currentLook = execAiCmd.data.look;
  assert.strictEqual(currentLook.config.pantsColor.name, 'Đen tuyền dạ hội');
  assert.strictEqual(currentLook.config.primaryColor.name, 'Đỏ son hoàng gia', 'Màu áo đã khóa vẫn được bảo toàn!');
  assert.strictEqual(currentLook.revision, 5);
  console.log(' -> PASSED: Đã thi hành lệnh AI, màu áo đã khóa được bảo toàn tuyệt đối.\n');

  // =========================================================================
  // JOURNEY STEP 6: SÁNG TẠO THIẾT KẾ MỚI TẠI DESIGN STUDIO (AI DESIGN)
  // =========================================================================
  console.log('[BƯỚC 6] Sáng tạo thiết kế tại Remix Studio với bối cảnh riêng (Ngày hội trường - Tươi trẻ)...');
  const aiDesignRes = await api('/ai/design', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Phối màu tương phản Gen Z sắc xanh ngọc và hồng sen cho ngày hội trường',
      eventId: 'ngay_hoi_truong',
      styleId: 'tuoi_tre',
      baseLookId: 'look_default_01',
    }),
  });
  assert.strictEqual(aiDesignRes.status, 200);
  assert(aiDesignRes.data.title, 'Thiết kế phải có tiêu đề');
  assert(aiDesignRes.data.config, 'Thiết kế phải có cấu hình trang phục');
  assert(aiDesignRes.data.explanation, 'Thiết kế phải có giải trình sáng tạo');
  const generatedDesign = aiDesignRes.data;
  console.log(` -> PASSED: AI tạo thiết kế "${generatedDesign.title}" thành công.\n`);

  // =========================================================================
  // JOURNEY STEP 7: LƯU THIẾT KẾ VÀO LOOKBOOK (PRESERVE EVENT & STYLE)
  // =========================================================================
  console.log('[BƯỚC 7] Lưu thiết kế vào Lookbook: Bảo tồn đúng eventId=ngay_hoi_truong & styleId=tuoi_tre...');
  const lookbookId = `lookbook_design_${Date.now()}`;
  const saveLbRes = await api('/lookbook', {
    method: 'POST',
    body: JSON.stringify({
      id: lookbookId,
      title: generatedDesign.title,
      lookId: 'look_default_01',
      revision: currentLook.revision,
      snapshotConfig: generatedDesign.config,
      eventId: 'ngay_hoi_truong', // Preserved design's own event!
      styleId: 'tuoi_tre',        // Preserved design's own style!
      notes: generatedDesign.explanation,
      createdAt: new Date().toISOString(),
    }),
  });
  assert.strictEqual(saveLbRes.status, 201);
  console.log(' -> PASSED: Đã lưu thiết kế vào Lookbook với định danh và bối cảnh riêng.\n');

  // Verify in lookbook list
  const listLbRes = await api('/lookbook');
  assert.strictEqual(listLbRes.status, 200);
  const foundSaved = listLbRes.data.find((x) => x.id === lookbookId);
  assert(foundSaved, 'Phải tìm thấy thiết kế trong danh sách Lookbook');
  assert.strictEqual(foundSaved.eventId, 'ngay_hoi_truong');
  assert.strictEqual(foundSaved.styleId, 'tuoi_tre');

  // =========================================================================
  // JOURNEY STEP 8: MỞ LẠI TỪ LOOKBOOK VÀO PHÒNG PHỐI (APPLY_DESIGN)
  // =========================================================================
  console.log('[BƯỚC 8] Mở thiết kế từ Lookbook vào Phòng phối qua APPLY_DESIGN...');
  const openFromLbRes = await api('/looks/look_default_01/command', {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: 'look_default_01',
      expectedRevision: currentLook.revision, // 5
      action: 'APPLY_DESIGN',
      payload: {
        config: foundSaved.snapshotConfig,
        title: foundSaved.title,
        explanation: foundSaved.notes,
        eventId: foundSaved.eventId,
        styleId: foundSaved.styleId,
      },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(openFromLbRes.status, 200);
  currentLook = openFromLbRes.data.look;

  // Verify all metadata restored exactly without styling rule overwrite
  assert.strictEqual(currentLook.eventId, 'ngay_hoi_truong', 'Bối cảnh sự kiện phục hồi chính xác');
  assert.strictEqual(currentLook.styleId, 'tuoi_tre', 'Định hướng phong cách phục hồi chính xác');
  assert.strictEqual(currentLook.title, foundSaved.title, 'Tiêu đề thiết kế phục hồi chính xác');
  assert.strictEqual(currentLook.explanation, foundSaved.notes, 'Giải trình sáng tạo phục hồi chính xác');
  assert.strictEqual(currentLook.revision, 6);
  console.log(` -> PASSED: Đã mở thiết kế "${currentLook.title}", eventId=${currentLook.eventId}, styleId=${currentLook.styleId}.\n`);

  // =========================================================================
  // JOURNEY STEP 9: CHỈNH SỬA TIẾP TỤC (EDIT AFTER OPENING FROM LOOKBOOK)
  // =========================================================================
  console.log('[BƯỚC 9] Chỉnh sửa tiếp tục sau khi mở Lookbook: Đổi kiểu cổ áo sang cổ thuyền (boat)...');
  const editAfterLbRes = await api('/looks/look_default_01/command', {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId: 'look_default_01',
      expectedRevision: currentLook.revision,
      action: 'SET_COLLAR',
      payload: { collarStyle: 'boat' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(editAfterLbRes.status, 200);
  currentLook = editAfterLbRes.data.look;
  assert.strictEqual(currentLook.config.collarStyle, 'boat');
  assert.strictEqual(currentLook.revision, 7);

  // Verify Lookbook snapshot in DB was NOT mutated by subsequent edits
  const recheckLbRes = await api('/lookbook');
  const untouchedLbItem = recheckLbRes.data.find((x) => x.id === lookbookId);
  assert.strictEqual(
    untouchedLbItem.snapshotConfig.collarStyle,
    foundSaved.snapshotConfig.collarStyle,
    'Lookbook snapshot bất biến, không bị ảnh hưởng khi phòng phối tiếp tục chỉnh sửa'
  );
  console.log(' -> PASSED: Chỉnh sửa tiếp tục thành công; bản snapshot Lookbook giữ nguyên 100% tính toàn vẹn.\n');

  console.log('===============================================================================');
  console.log('  CHÚC MỪNG: TOÀN BỘ LUỒNG NGHIỆP VỤ E2E TỪ KHỞI TẠO -> PHỐI ĐỒ -> AI -> ');
  console.log('  TẠO THIẾT KẾ -> LƯU LOOKBOOK -> MỞ LẠI -> CHỈNH SỬA ĐỀU ĐÃ ĐẠT CHUẨN XUẤT SẮC!');
  console.log('===============================================================================');
} catch (err) {
  console.error('\n[LỖI LUỒNG NGHIỆP VỤ]:', err);
  process.exitCode = 1;
} finally {
  serverProcess.kill();
  try {
    fs.rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
  console.log('\n[TEARDOWN] Đã dọn dẹp môi trường kiểm thử độc lập.');
}
