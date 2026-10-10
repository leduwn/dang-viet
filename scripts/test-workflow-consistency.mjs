/**
 * Regression Test Suite: Workflow Consistency & Guardrails
 * Tests 7 critical user interaction scenarios:
 * 1. Áp dụng preset thuộc sự kiện khác (Atomic sync eventId, styleId, config)
 * 2. Áp dụng preset khi có thuộc tính bị khóa (Strict lock preservation)
 * 3. API thất bại giữa thao tác (State preservation on failure)
 * 4. Hai thao tác gửi liên tiếp (Concurrency & OCC 409 REVISION_CONFLICT)
 * 5. Đề xuất Remix hết hạn (Stale proposal on revision/event/style change)
 * 6. Mở thiết kế Lookbook không tồn tại (404 isolation)
 * 7. Người dùng liên tục đổi sự kiện, phong cách, màu sắc (Sequential consistency)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  executeCommand,
  validateDesignProposal,
  computeProposalDiff,
} from '../packages/domain/dist/index.js';

console.log('=== DÁNG VIỆT - KIỂM THỬ HỒI QUY 7 KỊCH BẢN WORKFLOW CONSISTENCY ===\n');

// ============================================================================
// PART 1: DOMAIN-LEVEL TESTS (1, 2, 5)
// ============================================================================

console.log('--- PHẦN 1: KIỂM THỬ MIỀN NGHIỆP VỤ (DOMAIN LOGIC) ---');

// Kịch bản 1: Áp dụng preset thuộc sự kiện khác
console.log('\n[KỊCH BẢN 1] Áp dụng preset thuộc sự kiện khác...');
{
  const initialLook = {
    id: 'look_kb1',
    title: 'Áo dài Kỷ yếu Ban đầu',
    revision: 1,
    eventId: 'ky_yeu',
    styleId: 'thanh_lich',
    config: {
      garmentType: 'aodai',
      primaryColor: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
      pantsColor: { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black' },
      collarStyle: 'traditional_high',
      sleeveStyle: 'traditional_long',
      fabric: 'silk_ha_dong',
      pattern: 'plain',
      accessories: ['non_la'],
      bodyShape: 'standard',
      modelId: 'aodai_traditional_v2',
      avatarId: 'avatar_v2',
    },
    locks: {
      primaryColor: false,
      pantsColor: false,
      collarStyle: false,
      sleeveStyle: false,
      fabric: false,
      pattern: false,
      accessories: false,
      bodyShape: false,
      modelId: false,
      avatarId: false,
    },
    explanation: 'Bản phối kỷ yếu ban đầu',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const presetTets = {
    id: 'preset_tet_01',
    title: 'Sắc Xuân Chơi Tết',
    eventId: 'choi_tet',
    styleId: 'tuoi_tre',
    explanation: 'Thiết kế du xuân rạng rỡ phong cách trẻ trung',
    config: {
      garmentType: 'aodai',
      primaryColor: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' },
      pantsColor: { hex: '#DAA520', name: 'Vàng đồng vương giả', family: 'yellow' },
      collarStyle: 'round',
      sleeveStyle: 'elbow',
      fabric: 'brocade_hue',
      pattern: 'lotus',
      accessories: ['non_la', 'quat_xep'],
      bodyShape: 'standard',
      modelId: 'aodai_traditional_v2',
      avatarId: 'avatar_v2',
    },
  };

  const command = {
    commandId: randomUUID(),
    lookId: initialLook.id,
    expectedRevision: 1,
    action: 'APPLY_PRESET',
    payload: {
      presetId: presetTets.id,
      config: presetTets.config,
      title: presetTets.title,
      explanation: presetTets.explanation,
      eventId: presetTets.eventId,
      styleId: presetTets.styleId,
    },
    timestamp: new Date().toISOString(),
  };

  const outcome = executeCommand(initialLook, command);
  assert.equal(outcome.ok, true, 'Lệnh APPLY_PRESET phải thực thi thành công');
  const nextLook = outcome.result.look;

  assert.equal(nextLook.eventId, 'choi_tet', 'eventId phải đồng bộ sang choi_tet');
  assert.equal(nextLook.styleId, 'tuoi_tre', 'styleId phải đồng bộ sang tuoi_tre');
  assert.equal(nextLook.title, 'Sắc Xuân Chơi Tết', 'title phải đồng bộ theo preset');
  assert.equal(nextLook.config.primaryColor.hex, '#B83A24', 'primaryColor phải cập nhật theo preset');
  assert.equal(nextLook.config.pantsColor.hex, '#DAA520', 'pantsColor phải cập nhật theo preset');
  assert.equal(nextLook.config.collarStyle, 'round', 'collarStyle phải cập nhật theo preset');
  assert.equal(nextLook.revision, 2, 'revision phải tăng lên 2');
  console.log('✓ Kịch bản 1 ĐẠT: eventId, styleId, config, title, explanation đồng bộ nguyên tử, xóa sạch event/style cũ.');
}

// Kịch bản 2: Áp dụng preset khi có thuộc tính bị khóa
console.log('\n[KỊCH BẢN 2] Áp dụng preset khi có thuộc tính bị khóa...');
{
  const lockedLook = {
    id: 'look_kb2',
    title: 'Bản phối có khóa thuộc tính',
    revision: 2,
    eventId: 'ky_yeu',
    styleId: 'thanh_lich',
    config: {
      garmentType: 'aodai',
      primaryColor: { hex: '#008080', name: 'Xanh cổ vịt', family: 'blue' },
      pantsColor: { hex: '#FFFFFF', name: 'Trắng', family: 'white' },
      collarStyle: 'traditional_high',
      sleeveStyle: 'traditional_long',
      fabric: 'linen_modern',
      pattern: 'plain',
      accessories: ['chuoi_ngoc'],
      bodyShape: 'standard',
      modelId: 'aodai_traditional_v2',
      avatarId: 'avatar_v2',
    },
    locks: {
      primaryColor: true, // KHÓA MÀU ÁO!
      pantsColor: false,
      collarStyle: true,  // KHÓA CỔ ÁO!
      sleeveStyle: false,
      fabric: true,       // KHÓA CHẤT LIỆU!
      pattern: false,
      accessories: true,  // KHÓA PHỤ KIỆN!
      bodyShape: true,
      modelId: false,
      avatarId: false,
    },
    explanation: 'Bản phối có nhiều khóa',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const incomingPreset = {
    config: {
      garmentType: 'aodai',
      primaryColor: { hex: '#B83A24', name: 'Đỏ son', family: 'red' }, // Khác màu áo
      pantsColor: { hex: '#1E1B18', name: 'Đen tuyền', family: 'black' }, // Cho phép đổi
      collarStyle: 'v_neck', // Khác cổ áo
      sleeveStyle: 'raglan', // Cho phép đổi
      fabric: 'silk_ha_dong', // Khác chất liệu
      pattern: 'geometric_genz', // Cho phép đổi
      accessories: ['non_la', 'quat_xep'], // Khác phụ kiện
      bodyShape: 'standard',
      modelId: 'aodai_traditional_v2',
      avatarId: 'avatar_v2',
    },
    title: 'Preset thử nghiệm khóa',
    explanation: 'Thử nghiệm bảo toàn khóa',
    eventId: 'ngay_hoi_truong',
    styleId: 'toi_gian',
  };

  const command = {
    commandId: randomUUID(),
    lookId: lockedLook.id,
    expectedRevision: 2,
    action: 'APPLY_PRESET',
    payload: incomingPreset,
    timestamp: new Date().toISOString(),
  };

  const outcome = executeCommand(lockedLook, command);
  assert.equal(outcome.ok, true, 'Lệnh APPLY_PRESET thành công');
  const resultLook = outcome.result.look;

  // Thuộc tính đã khóa PHẢI được bảo tồn nguyên vẹn
  assert.equal(resultLook.config.primaryColor.hex, '#008080', 'Màu áo bị khóa không được đổi');
  assert.equal(resultLook.config.collarStyle, 'traditional_high', 'Cổ áo bị khóa không được đổi');
  assert.equal(resultLook.config.fabric, 'linen_modern', 'Chất liệu bị khóa không được đổi');
  assert.deepEqual(resultLook.config.accessories, ['chuoi_ngoc'], 'Phụ kiện bị khóa không được đổi');

  // Thuộc tính không khóa ĐƯỢC PHÉP đổi theo preset
  assert.equal(resultLook.config.pantsColor.hex, '#1E1B18', 'Màu quần không khóa được đổi theo preset');
  assert.equal(resultLook.config.sleeveStyle, 'raglan', 'Tay áo không khóa được đổi theo preset');
  assert.equal(resultLook.config.pattern, 'geometric_genz', 'Họa tiết không khóa được đổi theo preset');
  assert.equal(resultLook.eventId, 'ngay_hoi_truong', 'eventId được cập nhật');
  assert.equal(resultLook.styleId, 'toi_gian', 'styleId được cập nhật');
  console.log('✓ Kịch bản 2 ĐẠT: 100% thuộc tính bị khóa được bảo lưu; thuộc tính không khóa cập nhật chính xác.');
}

// Kịch bản 5: Đề xuất Remix hết hạn (Stale Proposal)
console.log('\n[KỊCH BẢN 5] Đề xuất Remix hết hạn (Stale Guardrails)...');
{
  const baseLook = {
    id: 'look_kb5',
    title: 'Look chuẩn để sinh proposal',
    revision: 5,
    eventId: 'ky_yeu',
    styleId: 'thanh_lich',
    config: {
      garmentType: 'aodai',
      primaryColor: { hex: '#FFFFFF', name: 'Trắng', family: 'white' },
      pantsColor: { hex: '#1E1B18', name: 'Đen', family: 'black' },
      collarStyle: 'traditional_high',
      sleeveStyle: 'traditional_long',
      fabric: 'silk_ha_dong',
      pattern: 'plain',
      accessories: [],
      bodyShape: 'standard',
      modelId: 'aodai_traditional_v2',
      avatarId: 'avatar_v2',
    },
    locks: {
      primaryColor: false,
      pantsColor: false,
      collarStyle: false,
      sleeveStyle: false,
      fabric: false,
      pattern: false,
      accessories: false,
      bodyShape: false,
      modelId: false,
      avatarId: false,
    },
    explanation: 'Look khởi tạo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validProposal = {
    schemaVersion: '2.0.0',
    proposalId: randomUUID(),
    targetLookId: baseLook.id,
    baseRevision: 5,
    baseEventId: 'ky_yeu',
    baseStyleId: 'thanh_lich',
    catalogVersion: '2.0.0',
    title: 'Đề xuất Gen Z',
    proposedConfig: {
      ...baseLook.config,
      primaryColor: { hex: '#B83A24', name: 'Đỏ son', family: 'red' },
    },
    diff: computeProposalDiff(baseLook.config, {
      ...baseLook.config,
      primaryColor: { hex: '#B83A24', name: 'Đỏ son', family: 'red' },
    }),
    explanation: 'Thiết kế đề xuất',
    unsupportedRequests: [],
    warnings: [],
    citations: [],
    mode: 'live',
    model: 'gemini-2.5-flash',
    createdAt: new Date().toISOString(),
  };

  // 5.1 Kiểm tra khi Look ở đúng revision và context: HỢP LỆ
  const validCheck = validateDesignProposal(validProposal, baseLook, []);
  assert.equal(validCheck.valid, true, 'Proposal khớp hoàn toàn phải valid: true');
  assert.equal(validCheck.stale, false, 'stale phải false');

  // 5.2 Kiểm tra khi Look đã tăng revision (v5 -> v6): STALE
  const modifiedLookRev = { ...baseLook, revision: 6 };
  const staleRevCheck = validateDesignProposal(validProposal, modifiedLookRev, []);
  assert.equal(staleRevCheck.valid, false, 'Proposal lệch revision phải valid: false');
  assert.equal(staleRevCheck.stale, true, 'Proposal lệch revision phải stale: true');
  assert.ok(staleRevCheck.errors[0].includes('lỗi thời (Stale)'));

  // 5.3 Kiểm tra khi Look đổi sự kiện (ky_yeu -> choi_tet): STALE
  const modifiedLookEvent = { ...baseLook, eventId: 'choi_tet' };
  const staleEventCheck = validateDesignProposal(validProposal, modifiedLookEvent, []);
  assert.equal(staleEventCheck.valid, false, 'Proposal lệch sự kiện phải valid: false');
  assert.equal(staleEventCheck.stale, true, 'Proposal lệch sự kiện phải stale: true');

  // 5.4 Kiểm tra khi Look đổi phong cách (thanh_lich -> toi_gian): STALE
  const modifiedLookStyle = { ...baseLook, styleId: 'toi_gian' };
  const staleStyleCheck = validateDesignProposal(validProposal, modifiedLookStyle, []);
  assert.equal(staleStyleCheck.valid, false, 'Proposal lệch phong cách phải valid: false');
  assert.equal(staleStyleCheck.stale, true, 'Proposal lệch phong cách phải stale: true');

  console.log('✓ Kịch bản 5 ĐẠT: Proposal tự động gắn baseRevision/baseEventId/baseStyleId và bị chặn stale chính xác.');
}

// ============================================================================
// PART 2: HTTP INTEGRATION TESTS (3, 4, 6, 7)
// ============================================================================

console.log('\n--- PHẦN 2: KIỂM THỬ TÍCH HỢP HTTP SERVER (END-TO-END) ---');

const testDir = path.resolve('test-workflow-scratch');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

const testDbPath = path.join(testDir, 'test-workflow.db');

console.log('[SERVER] Khởi động máy chủ Fastify tại cổng ngẫu nhiên...');
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
  const match = text.match(/:(\d+)/);
  if (match && !assignedPort) assignedPort = match[1];
});
serverProcess.stderr.on('data', (chunk) => {
  const errText = chunk.toString();
  if (errText.trim()) console.error('[SERVER STDERR]', errText.trim());
});

// Chờ server sẵn sàng
let serverReady = false;
for (let i = 0; i < 40; i++) {
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
  console.error('[FAIL] Không thể khởi động server.');
  serverProcess.kill();
  process.exit(1);
}

const BASE_URL = `http://127.0.0.1:${assignedPort}/api`;
console.log(`[OK] Server sẵn sàng tại ${BASE_URL}\n`);

class TestSessionClient {
  constructor() {
    this.cookies = new Map();
  }

  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = { ...(options.headers || {}) };
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    if (this.cookies.size > 0) {
      const cookieHeader = Array.from(this.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      headers['Cookie'] = cookieHeader;
    }

    const res = await fetch(url, { ...options, headers });

    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (setCookies.length === 0) {
      const raw = res.headers.get('set-cookie');
      if (raw) setCookies.push(raw);
    }
    for (const cookieStr of setCookies) {
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) {
        this.cookies.set(parts[0].trim(), parts.slice(1).join('=').trim());
      }
    }
    return res;
  }
}

try {
  const client = new TestSessionClient();

  // Khởi tạo phiên
  const sessRes = await client.request('/session');
  assert.equal(sessRes.status, 200);
  const sessData = await sessRes.json();
  let currentLook = sessData.look;
  assert.ok(currentLook);
  console.log(`[SESSION] Đã tạo phiên người dùng, Look ID: ${currentLook.id}, Revision: v${currentLook.revision}`);

  // Kịch bản 3: API thất bại giữa thao tác
  console.log('\n[KỊCH BẢN 3] API thất bại giữa thao tác (bảo toàn trạng thái)...');
  {
    const initialRev = currentLook.revision;
    const initialConfig = JSON.parse(JSON.stringify(currentLook.config));

    // Gửi lệnh sai: kiểu cổ áo không tồn tại
    const badCmd = {
      commandId: randomUUID(),
      lookId: currentLook.id,
      expectedRevision: initialRev,
      action: 'SET_COLLAR',
      payload: { collarStyle: 'invalid_collar_style_xyz' },
      timestamp: new Date().toISOString(),
    };

    const failRes = await client.request(`/looks/${currentLook.id}/command`, {
      method: 'POST',
      body: badCmd,
    });
    assert.equal(failRes.status, 400, 'Lệnh sai phải trả về HTTP 400');
    const failBody = await failRes.json();
    assert.ok(failBody.error, 'Phải có thông báo lỗi rõ ràng');

    // Kiểm tra lại Look trên server: trạng thái và revision KHÔNG bị thay đổi
    const checkRes = await client.request(`/looks/${currentLook.id}`);
    assert.equal(checkRes.status, 200);
    const freshLook = await checkRes.json();
    assert.equal(freshLook.revision, initialRev, 'Revision không đổi khi lệnh thất bại');
    assert.deepEqual(freshLook.config, initialConfig, 'Cấu hình không bị méo mó/thay đổi dở dang');
    console.log('✓ Kịch bản 3 ĐẠT: Thao tác thất bại trả về HTTP 400, trạng thái bản phối được bảo toàn 100%.');
  }

  // Kịch bản 4: Hai thao tác gửi liên tiếp (Concurrency / Race Condition)
  console.log('\n[KỊCH BẢN 4] Hai thao tác gửi liên tiếp (Concurrency OCC 409)...');
  {
    const baseRev = currentLook.revision;

    const cmd1 = {
      commandId: randomUUID(),
      lookId: currentLook.id,
      expectedRevision: baseRev,
      action: 'SET_PRIMARY_COLOR',
      payload: { color: { hex: '#112233', name: 'Màu 1', family: 'blue' } },
      timestamp: new Date().toISOString(),
    };

    const cmd2 = {
      commandId: randomUUID(),
      lookId: currentLook.id,
      expectedRevision: baseRev, // Cùng expectedRevision!
      action: 'SET_PRIMARY_COLOR',
      payload: { color: { hex: '#445566', name: 'Màu 2', family: 'blue' } },
      timestamp: new Date().toISOString(),
    };

    // Bắn 2 request đồng thời
    const [res1, res2] = await Promise.all([
      client.request(`/looks/${currentLook.id}/command`, { method: 'POST', body: cmd1 }),
      client.request(`/looks/${currentLook.id}/command`, { method: 'POST', body: cmd2 }),
    ]);

    const statuses = [res1.status, res2.status];
    assert.ok(statuses.includes(200), 'Ít nhất một lệnh phải thành công (HTTP 200)');
    assert.ok(statuses.includes(409), 'Lệnh còn lại phải bị từ chối do xung đột phiên bản (HTTP 409)');

    const conflictRes = res1.status === 409 ? res1 : res2;
    const conflictBody = await conflictRes.json();
    assert.equal(conflictBody.code, 'REVISION_CONFLICT', 'Lỗi xung đột phải trả về mã REVISION_CONFLICT');

    // Đồng bộ lại trạng thái mới nhất
    const refreshRes = await client.request(`/looks/${currentLook.id}`);
    currentLook = await refreshRes.json();
    assert.equal(currentLook.revision, baseRev + 1, 'Revision tăng chính xác 1 đơn vị');
    console.log('✓ Kịch bản 4 ĐẠT: Gửi 2 lệnh cùng revision bị chặn đúng bằng 409 REVISION_CONFLICT, không bị race condition.');
  }

  // Kịch bản 6: Mở thiết kế Lookbook không tồn tại
  console.log('\n[KỊCH BẢN 6] Mở thiết kế Lookbook không tồn tại (404 isolation)...');
  {
    const nonExistentId = 'lookbook_fake_9999999';
    const notFoundRes = await client.request(`/lookbook/${nonExistentId}`);
    assert.equal(notFoundRes.status, 404, 'Mục Lookbook không tồn tại phải trả về HTTP 404');
    const notFoundBody = await notFoundRes.json();
    assert.equal(notFoundBody.code, 'LOOKBOOK_ITEM_NOT_FOUND', 'Mã lỗi phải là LOOKBOOK_ITEM_NOT_FOUND');

    // Kiểm tra bản phối hiện tại không bị ảnh hưởng
    const verifyLookRes = await client.request(`/looks/${currentLook.id}`);
    const lookAfter = await verifyLookRes.json();
    assert.equal(lookAfter.id, currentLook.id, 'Look hiện tại không bị thay đổi');
    assert.equal(lookAfter.revision, currentLook.revision, 'Revision Look không bị thay đổi');
    console.log('✓ Kịch bản 6 ĐẠT: Thao tác mở Lookbook giả định trả về HTTP 404, không làm mất bản phối đang chỉnh sửa.');
  }

  // Kịch bản 7: Người dùng liên tục đổi sự kiện, phong cách, màu sắc (Sequential Consistency)
  console.log('\n[KỊCH BẢN 7] Người dùng liên tục đổi sự kiện, phong cách, màu sắc...');
  {
    let rev = currentLook.revision;

    // Chuỗi 7 thao tác thay đổi liên tiếp
    const operations = [
      { action: 'SET_EVENT', payload: { eventId: 'choi_tet' } },
      { action: 'SET_STYLE', payload: { styleId: 'tuoi_tre' } },
      { action: 'SET_PRIMARY_COLOR', payload: { color: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' } } },
      { action: 'TOGGLE_LOCK', payload: { field: 'primaryColor' } }, // KHÓA MÀU ÁO
      { action: 'SET_PANTS_COLOR', payload: { color: { hex: '#DAA520', name: 'Vàng đồng', family: 'yellow' } } },
      { action: 'TOGGLE_ACCESSORY', payload: { accessoryId: 'chuoi_ngoc' } },
      { action: 'SET_FABRIC', payload: { fabric: 'brocade_hue' } },
    ];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const cmd = {
        commandId: randomUUID(),
        lookId: currentLook.id,
        expectedRevision: rev,
        action: op.action,
        payload: op.payload,
        timestamp: new Date().toISOString(),
      };

      const res = await client.request(`/looks/${currentLook.id}/command`, {
        method: 'POST',
        body: cmd,
      });

      assert.equal(res.status, 200, `Thao tác ${i + 1} (${op.action}) phải thành công HTTP 200`);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.newRevision, rev + 1);
      rev = body.newRevision;
      currentLook = body.look;
    }

    assert.equal(currentLook.eventId, 'choi_tet');
    assert.equal(currentLook.styleId, 'tuoi_tre');
    assert.equal(currentLook.config.primaryColor.hex, '#B83A24');
    assert.equal(currentLook.locks.primaryColor, true, 'Màu áo phải đang ở trạng thái khóa');
    assert.equal(currentLook.config.pantsColor.hex, '#DAA520');
    assert.ok(currentLook.config.accessories.includes('chuoi_ngoc'));
    assert.equal(currentLook.config.fabric, 'brocade_hue');

    // Thử đổi màu áo khi đã khóa: PHẢI BỊ CHẶN HTTP 400
    const changeLockedColorCmd = {
      commandId: randomUUID(),
      lookId: currentLook.id,
      expectedRevision: rev,
      action: 'SET_PRIMARY_COLOR',
      payload: { color: { hex: '#FFFFFF', name: 'Trắng', family: 'white' } },
      timestamp: new Date().toISOString(),
    };
    const blockLockedRes = await client.request(`/looks/${currentLook.id}/command`, {
      method: 'POST',
      body: changeLockedColorCmd,
    });
    assert.equal(blockLockedRes.status, 400, 'Đổi màu áo khi đã khóa phải bị chặn 400');
    const blockBody = await blockLockedRes.json();
    assert.ok(blockBody.error.includes('bị khóa'));

    console.log(`✓ Kịch bản 7 ĐẠT: Chuỗi thao tác liên tục từ v${rev - 7} lên v${rev} hoàn toàn nhất quán, quy tắc khóa bảo vệ tuyệt đối.`);
  }

  console.log('\n=======================================================');
  console.log('🎉 TẤT CẢ 7 KỊCH BẢN WORKFLOW CONSISTENCY ĐÃ ĐẠT 100%!');
  console.log('=======================================================\n');

} finally {
  serverProcess.kill();
  await new Promise((r) => setTimeout(r, 500));
  if (fs.existsSync(testDir)) {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  }
}
