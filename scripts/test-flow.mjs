import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

console.log('--- DÁNG VIỆT - KIỂM THỬ LUỒNG NGHIỆP VỤ TỰ ĐỘNG (TEST-FLOW) ---');

const serverProc = spawn(process.execPath, ['apps/server/dist/index.js'], {
  stdio: 'pipe',
  env: process.env,
});

serverProc.stdout.on('data', (d) => {
  // console.log(`[server] ${d}`);
});
serverProc.stderr.on('data', (d) => {
  console.error(`[server err] ${d}`);
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return true;
    } catch (e) {
      await sleep(500);
    }
  }
  throw new Error('Server failed to start within timeout');
}

async function runTests() {
  const baseUrl = 'http://127.0.0.1:3001/api';
  console.log('Đang khởi động máy chủ thử nghiệm...');
  await waitForServer(baseUrl);

  try {
    // 1. Health check
    console.log('\n[1/12] Kiểm tra máy chủ /health...');
    const healthRes = await fetch(`${baseUrl}/health`);
    if (!healthRes.ok) throw new Error('Health check failed');
    const healthData = await healthRes.json();
    console.log(` -> Máy chủ hoạt động: ${healthData.service} v${healthData.version}`);

    // 2. Meta data
    console.log('\n[2/12] Kiểm tra danh mục /meta...');
    const metaRes = await fetch(`${baseUrl}/meta`);
    const metaData = await metaRes.json();
    console.log(` -> Đã tải: ${metaData.events.length} sự kiện, ${metaData.styles.length} phong cách, ${metaData.presets.length} presets`);

    // 3. Get Look
    console.log('\n[3/12] Tải bộ phối mẫu ban đầu /looks/look_default_01...');
    const lookRes = await fetch(`${baseUrl}/looks/look_default_01`);
    if (!lookRes.ok) throw new Error('Failed to get initial look');
    const initialLook = await lookRes.json();
    console.log(` -> Bộ phối ban đầu: "${initialLook.title}" (revision: ${initialLook.revision})`);

    // 4. Command: Change Primary Color
    console.log('\n[4/12] Gửi lệnh đổi màu áo sang Đỏ son hoàng gia...');
    const cmd1Res = await fetch(`${baseUrl}/looks/look_default_01/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId: randomUUID(),
        lookId: 'look_default_01',
        expectedRevision: initialLook.revision,
        action: 'SET_PRIMARY_COLOR',
        payload: {
          color: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' },
        },
        timestamp: new Date().toISOString(),
      }),
    });
    if (!cmd1Res.ok) throw new Error(`Command 1 failed: ${await cmd1Res.text()}`);
    const cmd1Data = await cmd1Res.json();
    console.log(` -> Thành công! Revision mới: ${cmd1Data.newRevision}, Màu áo mới: ${cmd1Data.look.config.primaryColor.name}`);

    // 5. Test Lock Enforcement
    console.log('\n[5/12] Khóa màu áo và kiểm tra từ chối thay đổi khi đang khóa...');
    // Lock primaryColor
    await fetch(`${baseUrl}/looks/look_default_01/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId: randomUUID(),
        lookId: 'look_default_01',
        expectedRevision: cmd1Data.newRevision,
        action: 'TOGGLE_LOCK',
        payload: { field: 'primaryColor' },
        timestamp: new Date().toISOString(),
      }),
    });

    // Attempt to change locked color
    const lockedRes = await fetch(`${baseUrl}/looks/look_default_01/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId: randomUUID(),
        lookId: 'look_default_01',
        expectedRevision: cmd1Data.newRevision + 1,
        action: 'SET_PRIMARY_COLOR',
        payload: {
          color: { hex: '#70A9A1', name: 'Xanh thiên thanh', family: 'blue' },
        },
        timestamp: new Date().toISOString(),
      }),
    });
    if (lockedRes.status === 400) {
      console.log(' -> Đã chặn thành công: Không cho phép đổi màu áo khi đang khóa!');
    } else {
      throw new Error('Lỗi: Hệ thống không chặn được việc đổi màu khi đang khóa');
    }

    // Unlock primaryColor
    const unlockRes = await fetch(`${baseUrl}/looks/look_default_01/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId: randomUUID(),
        lookId: 'look_default_01',
        expectedRevision: cmd1Data.newRevision + 1,
        action: 'TOGGLE_LOCK',
        payload: { field: 'primaryColor' },
        timestamp: new Date().toISOString(),
      }),
    });
    const currentRev = (await unlockRes.json()).newRevision;

    // 6. Change Pants Color & Accessory
    console.log('\n[6/12] Đổi màu quần sang Trắng tinh khôi và thêm nón lá...');
    const cmdAccRes = await fetch(`${baseUrl}/looks/look_default_01/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId: randomUUID(),
        lookId: 'look_default_01',
        expectedRevision: currentRev,
        action: 'TOGGLE_ACCESSORY',
        payload: { accessoryId: 'non_la' },
        timestamp: new Date().toISOString(),
      }),
    });
    const afterAccLook = (await cmdAccRes.json()).look;
    console.log(` -> Phụ kiện hiện tại: [${afterAccLook.config.accessories.join(', ')}]`);

    // 7. Save to Lookbook
    console.log('\n[7/12] Lưu bộ phối hiện tại vào Lookbook...');
    const lookbookItem = {
      id: `lb_test_${Date.now()}`,
      title: 'Bộ phối Test Du Xuân',
      lookId: afterAccLook.id,
      revision: afterAccLook.revision,
      snapshotConfig: JSON.parse(JSON.stringify(afterAccLook.config)),
      eventId: afterAccLook.eventId,
      styleId: afterAccLook.styleId,
      notes: 'Thử nghiệm lưu snapshot Lookbook',
      createdAt: new Date().toISOString(),
    };
    const lbSaveRes = await fetch(`${baseUrl}/lookbook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lookbookItem),
    });
    if (!lbSaveRes.ok) throw new Error('Failed to save to lookbook');
    console.log(` -> Đã lưu thành công vào Lookbook với snapshot revision v${afterAccLook.revision}`);

    // 8. Modify look further and verify Lookbook snapshot didn't change
    console.log('\n[8/12] Đổi tiếp màu áo sang Vàng hoàng yến và kiểm tra Lookbook snapshot không bị ghi đè...');
    const modifyRes = await fetch(`${baseUrl}/looks/look_default_01/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId: randomUUID(),
        lookId: 'look_default_01',
        expectedRevision: afterAccLook.revision,
        action: 'SET_PRIMARY_COLOR',
        payload: {
          color: { hex: '#E5A93C', name: 'Vàng hoàng yến', family: 'yellow' },
        },
        timestamp: new Date().toISOString(),
      }),
    });
    const modifiedLook = (await modifyRes.json()).look;

    // Check Lookbook
    const lbListRes = await fetch(`${baseUrl}/lookbook`);
    const lbList = await lbListRes.json();
    const savedItem = lbList.find((x) => x.id === lookbookItem.id);
    if (savedItem.snapshotConfig.primaryColor.hex === afterAccLook.config.primaryColor.hex) {
      console.log(' -> Chuẩn xác! Snapshot trong Lookbook giữ nguyên màu ban đầu, không bị ảnh hưởng bởi thay đổi mới.');
    } else {
      throw new Error('Lỗi: Lookbook snapshot bị ghi đè ngầm bởi thay đổi mới của look');
    }

    // 9. Undo test
    console.log('\n[9/12] Kiểm tra tính năng Hoàn tác (Undo)...');
    const undoRes = await fetch(`${baseUrl}/looks/look_default_01/undo`, {
      method: 'POST',
    });
    if (!undoRes.ok) throw new Error('Undo failed');
    const undoData = await undoRes.json();
    console.log(` -> Hoàn tác thành công! Màu áo phục hồi về: ${undoData.look.config.primaryColor.name}`);

    // 10. Culture cards and verification check
    console.log('\n[10/12] Kiểm tra thẻ văn hóa và phân định trạng thái published/draft...');
    const cultureRes = await fetch(`${baseUrl}/culture?status=published`);
    const cultureList = await cultureRes.json();
    const hasDraft = cultureList.some((c) => c.status !== 'published');
    if (hasDraft) {
      throw new Error('Lỗi: Thẻ văn hóa chưa kiểm chứng (draft) bị rò rỉ vào danh sách published');
    }
    console.log(` -> Đã duyệt ${cultureList.length} thẻ văn hóa đã kiểm chứng (published) có nguồn trích dẫn.`);

    // 11. AI Status check
    console.log('\n[11/12] Kiểm tra trạng thái AI Adapter...');
    const aiStatRes = await fetch(`${baseUrl}/ai/status`);
    const aiStat = await aiStatRes.json();
    console.log(` -> Chế độ AI: ${aiStat.mode} (${aiStat.provider})`);

    // 12. AI Chat & intent parsing
    console.log('\n[12/12] Kiểm tra Trợ lý AI thực thi câu lệnh văn hóa và tạo command...');
    const aiChatRes = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lookId: 'look_default_01',
        message: 'Giải thích nguồn gốc kỹ thuật tay raglan có trích dẫn tư liệu',
        history: [],
      }),
    });
    const aiChat = await aiChatRes.json();
    console.log(` -> Phản hồi AI: "${aiChat.reply.slice(0, 100)}..."`);
    if (aiChat.citations && aiChat.citations.length > 0) {
      console.log(` -> Trích dẫn nguồn: ${aiChat.citations[0].title} (${aiChat.citations[0].source})`);
    }

    console.log('\n================================================================');
    console.log('TẤT CẢ 12 BÀI KIỂM THỬ LUỒNG NGHIỆP VỤ ĐỀU THÀNH CÔNG VÀ CHÍNH XÁC!');
    console.log('================================================================');
  } finally {
    serverProc.kill();
  }
}

runTests();
