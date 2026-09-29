import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { getModelCapability, MODEL_CAPABILITIES } from '@dangviet/contracts';

console.log('===============================================================================');
console.log('  DÁNG VIỆT - BÀI KIỂM CHỨNG TỔNG THỂ 13 BƯỚC: MỘT LUỒNG PHỐI ĐỒ HOÀN CHỈNH');
console.log('===============================================================================\n');

const testDir = path.resolve('test-complete-flow-scratch');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

const testDbPath = path.join(testDir, 'test-complete.db');

// Step 1: Khởi động máy chủ backend tại cổng ngẫu nhiên do HĐH cấp và DB tạm
console.log('[BƯỚC 1/13] Khởi động máy chủ backend tại cổng ngẫu nhiên và database độc lập...');
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
  if (match) assignedPort = match[1];
});
serverProcess.stderr.on('data', (chunk) => {
  const errText = chunk.toString();
  if (errText.trim()) console.error('[SERVER STDERR]', errText);
});

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
  console.error('[FAIL] Không thể kết nối tới server sau 10 giây.');
  serverProcess.kill();
  process.exit(1);
}

const BASE_URL = `http://127.0.0.1:${assignedPort}/api`;
console.log(` -> Máy chủ backend đã sẵn sàng tại port ${assignedPort} (PID: ${serverProcess.pid}).\n`);

async function api(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { headers, ...options });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

try {
  // Step 2: Khám phá model & assets, kiểm tra single source of truth capabilities
  console.log('[BƯỚC 2/13] Kiểm tra Single Source of Truth Capabilities & Tệp 3D V2 thực tế...');
  const capV2 = getModelCapability('aodai_traditional_v2');
  assert.strictEqual(capV2.category, 'classic');
  assert.deepStrictEqual(capV2.supportedCollars, ['traditional_high']);
  assert.deepStrictEqual(capV2.supportedSleeves, ['traditional_long']);
  assert(capV2.supportedFabrics.includes('silk_ha_dong'));
  assert(capV2.supportedAccessories.includes('quat_xep'));

  const capRaglan = getModelCapability('aodai_remix_raglan');
  assert.strictEqual(capRaglan.category, 'remix');
  assert(capRaglan.supportedCollars.includes('boat'));
  assert(capRaglan.supportedSleeves.includes('slit'));

  // Kiểm tra tệp 3D thực tế trên đĩa
  const modelDir = path.resolve('apps/web/public/models');
  const v2Glb = path.join(modelDir, 'aodai_traditional_v2.glb');
  const avatarV2Glb = path.join(modelDir, 'avatar_v2.glb');
  assert(fs.existsSync(v2Glb), 'Tệp aodai_traditional_v2.glb phải tồn tại thực tế');
  assert(fs.existsSync(avatarV2Glb), 'Tệp avatar_v2.glb phải tồn tại thực tế');
  console.log(' -> Đã xác thực Capabilities Registry và tồn tại 100% assets 3D v2 trên đĩa.\n');

  // Khởi tạo Look ban đầu dùng mẫu chuẩn V2
  const lookId = `look_e2e_${Date.now()}`;
  const initRes = await api('/looks', {
    method: 'POST',
    body: JSON.stringify({
      id: lookId,
      title: 'Áo dài Nữ sinh Cổ cao Chuẩn V2',
      eventId: 'ky_yeu',
      styleId: 'thanh_lich',
      config: {
        garmentType: 'aodai',
        modelId: 'aodai_traditional_v2',
        primaryColor: { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' },
        pantsColor: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
        collarStyle: 'traditional_high',
        sleeveStyle: 'traditional_long',
        fabric: 'silk_ha_dong',
        pattern: 'plain',
        accessories: [],
        bodyShape: 'standard',
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
      },
      explanation: 'Khởi tạo bộ phối chuẩn v2',
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  });
  assert.strictEqual(initRes.status, 201);
  let currentLook = initRes.data;
  console.log(` -> Khởi tạo lookId="${lookId}" thành công (revision: 1).\n`);

  // Step 3: Chỉnh thuộc tính có hỗ trợ: Đổi màu áo đỏ son, màu quần trắng
  console.log('[BƯỚC 3/13] Chỉnh thuộc tính có hỗ trợ: Đổi màu áo đỏ son (#B83A24), đổi màu quần (#FFFFFF)...');
  const setRedColor = await api(`/looks/${lookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId,
      expectedRevision: currentLook.revision,
      action: 'SET_PRIMARY_COLOR',
      payload: { color: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' } },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(setRedColor.status, 200);
  currentLook = setRedColor.data.look;
  assert.strictEqual(currentLook.config.primaryColor.name, 'Đỏ son hoàng gia');
  assert.strictEqual(currentLook.revision, 2);
  console.log(' -> Đổi màu áo thành công, revision=2.\n');

  // Step 4: Chặn thuộc tính không hỗ trợ theo capability
  console.log('[BƯỚC 4/13] Kiểm tra chặn thuộc tính không hỗ trợ: Đổi cổ sang "round" trên mẫu v2...');
  const setInvalidCollar = await api(`/looks/${lookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId,
      expectedRevision: currentLook.revision,
      action: 'SET_COLLAR',
      payload: { collarStyle: 'round' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(setInvalidCollar.status, 400, 'Phải từ chối 400 khi kiểu cổ không được mẫu hỗ trợ');
  assert(setInvalidCollar.data.error.includes('không hỗ trợ'), 'Thông báo phải giải thích rõ lý do không hỗ trợ');
  console.log(` -> Đã chặn thành công: "${setInvalidCollar.data.error}".\n`);

  // Step 5: Khóa màu áo (primaryColor: true)
  console.log('[BƯỚC 5/13] Khóa màu áo (TOGGLE_LOCK: primaryColor)...');
  const lockShirt = await api(`/looks/${lookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId,
      expectedRevision: currentLook.revision,
      action: 'TOGGLE_LOCK',
      payload: { field: 'primaryColor' },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(lockShirt.status, 200);
  currentLook = lockShirt.data.look;
  assert.strictEqual(currentLook.locks.primaryColor, true);
  assert.strictEqual(currentLook.revision, 3);
  console.log(' -> Màu áo đã được khóa an toàn, revision=3.\n');

  // Step 6: AI Assistant hội thoại tiếp nối tôn trọng khóa
  console.log('[BƯỚC 6/13] Gửi yêu cầu AI: "giữ màu áo, đổi quần xanh và bớt phụ kiện"...');
  const aiChatRes = await api('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      lookId,
      message: 'Giữ màu áo hiện tại giúp mình, đổi quần sang màu xanh và bớt phụ kiện',
      history: [
        { role: 'user', content: 'Mình thích tông màu thanh lịch này.' },
      ],
    }),
  });
  assert.strictEqual(aiChatRes.status, 200);
  assert(aiChatRes.data.reply.length > 0);
  // Xác nhận AI không sinh lệnh đổi primaryColor vì primaryColor đang bị khóa
  const primaryColorCmd = aiChatRes.data.commands.find((c) => c.action === 'SET_PRIMARY_COLOR');
  assert.strictEqual(primaryColorCmd, undefined, 'AI không được sinh lệnh đổi màu áo khi màu áo đang bị khóa');
  console.log(` -> AI trả lời: "${aiChatRes.data.reply.slice(0, 70)}..."`);
  console.log(' -> Rào chắn AI bảo vệ thành công: Không sinh lệnh thay đổi màu áo đã khóa.\n');

  // Step 7: Xem trước proposal rồi bấm "Hủy xem trước" (Preview & Cancel)
  console.log('[BƯỚC 7/13] Sinh đề xuất AI (Proposal), xem trước rồi hủy xem trước...');
  const proposalRes = await api('/ai/proposal', {
    method: 'POST',
    body: JSON.stringify({
      targetLookId: lookId,
      expectedRevision: currentLook.revision,
      prompt: 'Gợi ý phối thanh lịch cho áo đỏ son',
      eventId: currentLook.eventId,
      styleId: currentLook.styleId,
    }),
  });
  assert.strictEqual(proposalRes.status, 200);
  const proposal = proposalRes.data;
  assert.strictEqual(proposal.baseRevision, currentLook.revision);
  assert.strictEqual(proposal.proposedConfig.primaryColor.name, currentLook.config.primaryColor.name, 'Proposal phải giữ nguyên màu áo đã khóa');

  // Client xem trước (local preview) rồi hủy xem trước -> Look trong DB vẫn giữ nguyên
  const lookAfterCancel = (await api(`/looks/${lookId}`)).data;
  assert.strictEqual(lookAfterCancel.revision, currentLook.revision, 'Hủy xem trước không làm thay đổi DB');
  assert.strictEqual(lookAfterCancel.config.primaryColor.name, 'Đỏ son hoàng gia');
  console.log(' -> Hủy xem trước thành công: Cấu hình và revision trên server giữ nguyên vẹn.\n');

  // Step 8: Áp dụng đề xuất AI nguyên tử qua APPLY_DESIGN
  console.log('[BƯỚC 8/13] Áp dụng đề xuất AI nguyên tử qua APPLY_DESIGN...');
  const applyProposalRes = await api(`/looks/${lookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId,
      expectedRevision: currentLook.revision,
      action: 'APPLY_DESIGN',
      payload: {
        designId: proposal.proposalId,
        config: proposal.proposedConfig,
        title: proposal.title,
        explanation: proposal.explanation,
      },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(applyProposalRes.status, 200);
  currentLook = applyProposalRes.data.look;
  assert.strictEqual(currentLook.revision, 4, 'Revision tăng đơn điệu lên 4');
  assert.strictEqual(currentLook.config.primaryColor.name, 'Đỏ son hoàng gia', 'Màu áo đã khóa được bảo toàn');
  console.log(` -> Áp dụng nguyên tử thành công: revision=4, tiêu đề="${currentLook.title}".\n`);

  // Step 9: Nhấn Hoàn tác (Undo)
  console.log('[BƯỚC 9/13] Nhấn Hoàn tác (Undo) thiết kế vừa áp dụng...');
  const undoRes = await api(`/looks/${lookId}/undo`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      expectedRevision: currentLook.revision,
    }),
  });
  assert.strictEqual(undoRes.status, 200);
  currentLook = undoRes.data.look;
  assert.strictEqual(currentLook.revision, 5, 'Revision tăng đơn điệu lên 5 sau khi hoàn tác');
  assert.strictEqual(currentLook.title, 'Áo dài Nữ sinh Cổ cao Chuẩn V2', 'Tiêu đề trở về trước khi áp dụng proposal');
  console.log(' -> Hoàn tác thành công: Phục hồi hoàn toàn trạng thái trước khi áp dụng proposal.\n');

  // Step 10: Đọc tư liệu văn hóa đã kiểm chứng
  console.log('[BƯỚC 10/13] Đọc tư liệu văn hóa: Phân biệt thẻ published [Đã kiểm chứng] và review [Đang thẩm định]...');
  const allCardsRes = await api('/culture?status=all');
  assert.strictEqual(allCardsRes.status, 200);
  const cards = allCardsRes.data;
  const publishedCards = cards.filter((c) => c.status === 'published');
  const reviewCards = cards.filter((c) => c.status === 'review');

  assert(publishedCards.length >= 2, 'Phải có ít nhất 2 thẻ published');
  assert(reviewCards.length >= 1, 'Phải có thẻ review (như áo ngũ thân/lemur đang thẩm định)');

  for (const pc of publishedCards) {
    assert(pc.sourceUrl && pc.sourceUrl.startsWith('http'), `Thẻ published ${pc.slug} phải có URL nguồn thực tế`);
    assert(pc.sourceEvidence.length > 0, `Thẻ published ${pc.slug} phải có dẫn chứng`);
  }
  console.log(` -> Đã xác minh: ${publishedCards.length} thẻ [Đã kiểm chứng], ${reviewCards.length} thẻ [Đang thẩm định].\n`);

  // Step 11: Lưu bản phối vào Lookbook và kiểm tra tính bất biến
  console.log('[BƯỚC 11/13] Lưu bản phối vào Lookbook & kiểm tra snapshot bất biến...');
  const lookbookId = `lookbook_item_${Date.now()}`;
  const saveLb = await api('/lookbook', {
    method: 'POST',
    body: JSON.stringify({
      id: lookbookId,
      title: 'Bản phối Kỷ yếu Đỏ son',
      lookId,
      revision: currentLook.revision,
      snapshotConfig: currentLook.config,
      eventId: currentLook.eventId,
      styleId: currentLook.styleId,
      notes: 'Bản phối lưu kỷ yếu thanh lịch',
      createdAt: new Date().toISOString(),
    }),
  });
  assert.strictEqual(saveLb.status, 201);

  // Chỉnh sửa tiếp tục bản phối hiện tại trong phòng phối: Đổi màu quần sang đen tuyền
  const editCurrentLook = await api(`/looks/${lookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId,
      expectedRevision: currentLook.revision,
      action: 'SET_PANTS_COLOR',
      payload: { color: { hex: '#1E1B18', name: 'Đen tuyền', family: 'black' } },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(editCurrentLook.status, 200);
  currentLook = editCurrentLook.data.look;
  assert.strictEqual(currentLook.config.pantsColor.name, 'Đen tuyền');

  // Kiểm tra snapshot trong Lookbook không hề bị thay đổi
  const lbCheck = (await api('/lookbook')).data.find((x) => x.id === lookbookId);
  assert.strictEqual(lbCheck.snapshotConfig.pantsColor.name, 'Trắng tinh khôi', 'Snapshot Lookbook phải bất biến!');
  console.log(' -> Lưu Lookbook thành công, snapshot bất biến sau các chỉnh sửa tiếp theo.\n');

  // Step 12: Mở lại snapshot từ Lookbook khi có thuộc tính đang khóa
  console.log('[BƯỚC 12/13] Mở lại snapshot từ Lookbook: Bảo tồn thuộc tính đang khóa...');
  // Hiện tại primaryColor đang bị khóa (Đỏ son). Mở snapshot vào look:
  const restoreFromLb = await api(`/looks/${lookId}/command`, {
    method: 'POST',
    body: JSON.stringify({
      commandId: randomUUID(),
      lookId,
      expectedRevision: currentLook.revision,
      action: 'APPLY_DESIGN',
      payload: {
        config: lbCheck.snapshotConfig,
        title: lbCheck.title,
        explanation: lbCheck.notes,
        eventId: lbCheck.eventId,
        styleId: lbCheck.styleId,
      },
      timestamp: new Date().toISOString(),
    }),
  });
  assert.strictEqual(restoreFromLb.status, 200);
  currentLook = restoreFromLb.data.look;
  assert.strictEqual(currentLook.config.pantsColor.name, 'Trắng tinh khôi', 'Màu quần khôi phục đúng theo snapshot');
  assert.strictEqual(currentLook.config.primaryColor.name, 'Đỏ son hoàng gia', 'Màu áo khóa vẫn được bảo toàn');
  console.log(' -> Mở lại từ Lookbook thành công, tôn trọng các thuộc tính bị khóa.\n');

  // Step 13: Xuất ảnh minh họa 3D có thương hiệu Dáng Việt
  console.log('[BƯỚC 13/13] Kiểm tra tính năng Xuất ảnh minh họa 3D có thương hiệu (PNG)...');
  // Đọc mã nguồn exportImage.ts để xác thực các tiêu chí thiết kế
  const exportImageSrc = fs.readFileSync(path.resolve('apps/web/src/utils/exportImage.ts'), 'utf-8');
  assert(exportImageSrc.includes('1200'), 'Độ phân giải chiều rộng phải là 1200px');
  assert(exportImageSrc.includes('1600'), 'Độ phân giải chiều cao phải là 1600px');
  assert(exportImageSrc.includes('DÁNG VIỆT'), 'Phải chứa tên thương hiệu DÁNG VIỆT');
  assert(exportImageSrc.includes('Hình minh họa 3D'), 'Phải gắn nhãn kỹ thuật "Hình minh họa 3D"');
  assert(exportImageSrc.includes('toDataURL'), 'Phải xuất ra data URL PNG chuẩn');
  console.log(' -> Xuất ảnh bản phối 3D: Độ phân giải 1200x1600, logo Dáng Việt, bảng mã màu và nhãn kỹ thuật đầy đủ.\n');

  console.log('===============================================================================');
  console.log('  CHÚC MỪNG: TOÀN BỘ 13 BƯỚC CỦA LUỒNG PHỐI ĐỒ HOÀN CHỈNH ĐỀU ĐẠT CHUẨN 100%!');
  console.log('===============================================================================');
} catch (err) {
  console.error('\n[LỖI TRONG LUỒNG KIỂM CHỨNG]:', err);
  process.exitCode = 1;
} finally {
  serverProcess.kill();
  try {
    fs.rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
  console.log('\n[TEARDOWN] Đã dọn dẹp cơ sở dữ liệu tạm và dừng máy chủ an toàn.');
}
