import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// 1. Create a dedicated temporary directory for database isolation
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dangviet-verify-9router-'));
const isolatedDbPath = path.join(tmpDir, 'test-live-9router.db');
process.env.DATABASE_PATH = isolatedDbPath;

console.log('=== BẮT ĐẦU KIỂM CHỨNG DỊCH VỤ 9ROUTER ===\n');

let dbModule = null;
let allLivePassed = false;
const scenarioResults = {
  A: { live: false, fallbackWorking: false, error: null },
  B: { live: false, fallbackWorking: false, error: null },
  C: { live: false, fallbackWorking: false, error: null },
};

try {
  // 2. Use existing config loader, do not parse .env manually
  const { getAppConfig } = await import('../apps/server/dist/config.js');
  const config = getAppConfig();

  console.log('Thư mục tạm cô lập:', tmpDir);
  console.log('Database cô lập:', config.databasePath);
  console.log('Gateway Base URL:', config.aiBaseUrl);
  console.log('Model được cấu hình:', config.aiModel);
  console.log('API Key đã cấu hình:', Boolean(config.aiApiKey && config.aiApiKey.trim().length > 5));
  console.log('Timeout request (ms):', config.aiTimeoutMs);

  // 3. Import server & db modules
  const { NineRouterAdapter } = await import('../apps/server/dist/ai/nine-router-adapter.js');
  dbModule = await import('../apps/server/dist/db.js');
  const { dbRepo, getDb, closeDb } = dbModule;

  // Initialize DB instance
  getDb();

  // Seed initial look if empty
  let initialLook = dbRepo.getLook('look_default_01');
  if (!initialLook) {
    const presets = JSON.parse(fs.readFileSync(path.join(rootDir, 'content', 'presets.json'), 'utf8'));
    const firstPreset = presets[0];
    const now = new Date().toISOString();
    const defaultLocks = {
      primaryColor: false,
      pantsColor: false,
      collarStyle: false,
      sleeveStyle: false,
      fabric: false,
      pattern: false,
      accessories: false,
    };
    getDb().prepare(`
      INSERT INTO looks (
        id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'look_default_01',
      'default_user',
      firstPreset.title,
      firstPreset.eventId,
      firstPreset.styleId,
      JSON.stringify(firstPreset.config),
      JSON.stringify(defaultLocks),
      firstPreset.explanation,
      1,
      0,
      now,
      now
    );
    getDb().prepare(`
      INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'look_default_01',
      1,
      JSON.stringify(firstPreset.config),
      JSON.stringify(defaultLocks),
      firstPreset.explanation,
      now
    );
    initialLook = dbRepo.getLook('look_default_01');
  }

  const adapter = new NineRouterAdapter();

  // 4. Inspect configured model via direct request with timeout
  console.log('\n--- 1. KIỂM TRA TRỰC TIẾP GATEWAY & MODEL CẤU HÌNH ---');
  let gatewayModelsStatus = 'unknown';
  try {
    const modelsRes = await fetch(`${config.aiBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.aiApiKey}` },
      signal: AbortSignal.timeout(config.aiTimeoutMs || 10000),
    });
    gatewayModelsStatus = `HTTP ${modelsRes.status} ${modelsRes.statusText}`;
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      const list = Array.isArray(modelsData) ? modelsData : (modelsData.data || []);
      const modelIds = list.map((m) => m.id || m.name || m);
      console.log(`- Kết nối /models: ${gatewayModelsStatus} (tìm thấy ${modelIds.length} model)`);
      console.log(`- Model cấu hình "${config.aiModel}" có trong danh sách: ${modelIds.includes(config.aiModel)}`);
    } else {
      console.log(`- Kết nối /models: ${gatewayModelsStatus}`);
    }
  } catch (err) {
    gatewayModelsStatus = `Lỗi mạng: ${err.message}`;
    console.log(`- Kết nối /models thất bại: ${gatewayModelsStatus}`);
  }

  // Diagnostic direct completion check strictly for the configured model with timeout
  let directModelStatus = 'unknown';
  let directEvidence = null;
  try {
    const directRes = await fetch(`${config.aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.aiApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel,
        messages: [{ role: 'user', content: 'Xin chào' }],
        max_tokens: 20,
      }),
      signal: AbortSignal.timeout(config.aiTimeoutMs || 10000),
    });
    directModelStatus = `HTTP ${directRes.status} ${directRes.statusText}`;
    const directText = await directRes.text();
    directEvidence = directText.slice(0, 300);
    console.log(`- Gọi trực tiếp model "${config.aiModel}": ${directModelStatus}`);
    console.log(`  Bằng chứng phản hồi: ${directEvidence}`);
  } catch (err) {
    directModelStatus = `Lỗi: ${err.message}`;
    directEvidence = err.message;
    console.log(`- Gọi trực tiếp model "${config.aiModel}" thất bại: ${directModelStatus}`);
  }

  const adapterStatus = await adapter.getStatus();
  console.log(`- Trạng thái adapter: mode=${adapterStatus.mode}, provider=${adapterStatus.provider}, model=${adapterStatus.model}`);

  // ----------------------------------------------------
  // SCENARIO A: Đổi màu quần
  // ----------------------------------------------------
  console.log('\n--- 2. KỊCH BẢN A: ĐỔI MÀU QUẦN ---');
  let currentLook = initialLook;
  console.log(`Trạng thái ban đầu: Quần ${currentLook.config.pantsColor.name} (${currentLook.config.pantsColor.hex}), rev: v${currentLook.revision}`);

  const promptA = 'Hãy giúp tôi đổi quần sang màu đen tuyền để tạo vẻ đẹp thanh lịch cổ điển.';
  const resA = await adapter.chat(currentLook, promptA, []);
  console.log(`- Phản hồi: mode=${resA.mode}, model=${resA.model}`);
  console.log(`- Reply: ${resA.reply}`);

  if (resA.mode === 'live') {
    if (!resA.commands || resA.commands.length === 0) {
      scenarioResults.A.error = 'Gọi live nhưng không trả về danh sách lệnh commands';
    } else {
      // Execute command intact from adapter without modifying expectedRevision or commandId
      for (const cmd of resA.commands) {
        const execResult = dbRepo.executeCommandTransaction(currentLook.id, cmd);
        if (!execResult.ok) {
          throw new Error(`Thực thi lệnh từ adapter thất bại: ${execResult.error}`);
        }
        currentLook = execResult.result.look;
      }
      if (currentLook.config.pantsColor.family === 'black' || currentLook.config.pantsColor.hex === '#1E1B18' || currentLook.config.pantsColor.name.toLowerCase().includes('đen')) {
        scenarioResults.A.live = true;
        console.log(`-> Kịch bản A LIVE ĐẠT: Quần đã đổi sang ${currentLook.config.pantsColor.name} (${currentLook.config.pantsColor.hex}), rev: v${currentLook.revision}`);
      } else {
        scenarioResults.A.error = `Màu quần kết quả (${currentLook.config.pantsColor.hex}) không đúng mong muốn`;
      }
    }
  } else {
    scenarioResults.A.error = directEvidence || 'Adapter trả về mode=mock';
    // Verify fallback execution
    if (resA.commands && resA.commands.length > 0) {
      for (const cmd of resA.commands) {
        const execResult = dbRepo.executeCommandTransaction(currentLook.id, cmd);
        if (execResult.ok) {
          currentLook = execResult.result.look;
          scenarioResults.A.fallbackWorking = true;
        }
      }
    }
    console.log(`-> Kịch bản A: KHÔNG PHẢI LIVE (mode=${resA.mode}). Fallback hoạt động: ${scenarioResults.A.fallbackWorking}`);
  }

  // ----------------------------------------------------
  // SCENARIO B: Đổi nhiều thuộc tính nhưng bảo toàn màu áo đang khóa
  // ----------------------------------------------------
  console.log('\n--- 3. KỊCH BẢN B: ĐỔI THUỘC TÍNH BẢO TOÀN MÀU ÁO ĐANG KHÓA ---');
  // Lock primaryColor first
  const lockCmd = {
    commandId: crypto.randomUUID(),
    lookId: currentLook.id,
    expectedRevision: currentLook.revision,
    action: 'TOGGLE_LOCK',
    payload: { field: 'primaryColor' },
    timestamp: new Date().toISOString(),
  };
  const lockExec = dbRepo.executeCommandTransaction(currentLook.id, lockCmd);
  if (!lockExec.ok) throw new Error(`Khóa màu áo thất bại: ${lockExec.error}`);
  currentLook = lockExec.result.look;
  const lockedColorHex = currentLook.config.primaryColor.hex;
  console.log(`Đã khóa màu áo (${currentLook.config.primaryColor.name} - ${lockedColorHex}), rev: v${currentLook.revision}`);

  const promptB = 'Tôi muốn đổi màu áo sang màu vàng hoàng yến và đổi kiểu tay áo sang tay raglan hiện đại.';
  const resB = await adapter.chat(currentLook, promptB, []);
  console.log(`- Phản hồi: mode=${resB.mode}, model=${resB.model}`);
  console.log(`- Reply: ${resB.reply}`);

  if (resB.mode === 'live') {
    let touchedLockedColor = false;
    if (resB.commands && resB.commands.length > 0) {
      for (const cmd of resB.commands) {
        if (cmd.action === 'SET_PRIMARY_COLOR') {
          touchedLockedColor = true;
          // Attempting to execute should fail with 400
          const testExec = dbRepo.executeCommandTransaction(currentLook.id, cmd);
          if (testExec.ok) {
            throw new Error('Lỗi bảo mật: Lệnh đổi màu áo bị khóa lại được thực thi thành công');
          }
        } else {
          // Execute non-locked command intact from adapter
          const execRes = dbRepo.executeCommandTransaction(currentLook.id, cmd);
          if (execRes.ok) currentLook = execRes.result.look;
        }
      }
    }
    // Assertion: Primary color must be intact
    if (currentLook.config.primaryColor.hex === lockedColorHex && currentLook.locks.primaryColor === true) {
      scenarioResults.B.live = true;
      console.log(`-> Kịch bản B LIVE ĐẠT: Màu áo được bảo toàn nguyên vẹn (${currentLook.config.primaryColor.name})`);
    } else {
      scenarioResults.B.error = 'Màu áo bị thay đổi dù đã khóa';
    }
  } else {
    scenarioResults.B.error = directEvidence || 'Adapter trả về mode=mock';
    if (currentLook.config.primaryColor.hex === lockedColorHex) {
      scenarioResults.B.fallbackWorking = true;
    }
    console.log(`-> Kịch bản B: KHÔNG PHẢI LIVE (mode=${resB.mode}). Fallback hoạt động: ${scenarioResults.B.fallbackWorking}`);
  }

  // ----------------------------------------------------
  // SCENARIO C: Tạo thiết kế, lưu và mở lại
  // ----------------------------------------------------
  console.log('\n--- 4. KỊCH BẢN C: TẠO THIẾT KẾ, LƯU VÀ MỞ LẠI ---');
  const designReq = {
    prompt: 'Áo dài lụa Hà Đông màu sen hồng cho lễ tốt nghiệp, kiểu cổ thuyền, tay lỡ, phối túi cói đan mộc.',
    eventId: 'ky_yeu',
    styleId: 'tuoi_tre',
    baseLookId: currentLook.id,
  };
  const designRes = await adapter.generateStructuredDesign(designReq, currentLook);
  console.log(`- Phản hồi: mode=${designRes.mode}, model=${designRes.model}`);
  console.log(`- Tiêu đề: ${designRes.title}`);
  console.log(`- Config sinh ra: áo=${designRes.config?.primaryColor?.name}, cổ=${designRes.config?.collarStyle}, tay=${designRes.config?.sleeveStyle}`);

  // Save to lookbook
  const lookbookId = `lookbook_test_${Date.now()}`;
  const lookbookItem = {
    id: lookbookId,
    title: designRes.title,
    lookId: currentLook.id,
    revision: currentLook.revision,
    snapshotConfig: designRes.config,
    eventId: designReq.eventId,
    styleId: designReq.styleId,
    notes: designRes.explanation,
    createdAt: new Date().toISOString(),
  };
  dbRepo.saveToLookbook(lookbookItem);

  // Retrieve from Lookbook and reopen
  const lookbookList = dbRepo.getLookbook();
  const savedItem = lookbookList.find((item) => item.id === lookbookId);
  if (!savedItem) {
    throw new Error(`Không tìm thấy item ${lookbookId} trong Lookbook sau khi lưu`);
  }

  // Assertions on Lookbook item
  if (savedItem.eventId !== designReq.eventId || savedItem.styleId !== designReq.styleId) {
    throw new Error(`Lookbook item không lưu đúng eventId (${savedItem.eventId}) hoặc styleId (${savedItem.styleId})`);
  }

  // Reopen in Studio by applying design back: pass eventId & styleId
  const applyDesignCmd = {
    commandId: crypto.randomUUID(),
    lookId: currentLook.id,
    expectedRevision: currentLook.revision,
    action: 'APPLY_DESIGN',
    payload: {
      config: savedItem.snapshotConfig,
      title: savedItem.title,
      explanation: savedItem.notes,
      eventId: savedItem.eventId,
      styleId: savedItem.styleId,
    },
    timestamp: new Date().toISOString(),
  };
  const applyResult = dbRepo.executeCommandTransaction(currentLook.id, applyDesignCmd);
  if (!applyResult.ok) {
    throw new Error(`Áp dụng lại thiết kế vào bộ phối thất bại: ${applyResult.error}`);
  }
  currentLook = applyResult.result.look;

  // Assertions on applied Look
  if (currentLook.eventId !== savedItem.eventId || currentLook.styleId !== savedItem.styleId) {
    throw new Error(`Áp dụng thiết kế không cập nhật đúng eventId (${currentLook.eventId}) hoặc styleId (${currentLook.styleId})`);
  }
  // Check snapshot config fields (for non-locked primaryColor)
  if (currentLook.config.collarStyle !== savedItem.snapshotConfig.collarStyle ||
      currentLook.config.sleeveStyle !== savedItem.snapshotConfig.sleeveStyle) {
    throw new Error('Config bộ phối sau khi mở lại không khớp snapshotConfig');
  }

  if (designRes.mode === 'live') {
    scenarioResults.C.live = true;
    console.log(`-> Kịch bản C LIVE ĐẠT: Đã tạo, lưu và mở lại thiết kế chuẩn xác (rev: v${currentLook.revision})`);
  } else {
    scenarioResults.C.error = directEvidence || 'Adapter trả về mode=mock';
    scenarioResults.C.fallbackWorking = true;
    console.log(`-> Kịch bản C: KHÔNG PHẢI LIVE (mode=${designRes.mode}). Fallback hoạt động: true`);
  }

  allLivePassed = scenarioResults.A.live && scenarioResults.B.live && scenarioResults.C.live;
} catch (fatalErr) {
  console.error('\n[LỖI NGHIÊM TRỌNG]:', fatalErr.message);
  process.exitCode = 1;
} finally {
  // 5. Always close database and clean up temporary directory in finally
  if (dbModule && dbModule.closeDb) {
    try {
      dbModule.closeDb();
      console.log('\n[DỌN DẸP] Đã đóng kết nối cơ sở dữ liệu SQLite.');
    } catch (e) {
      console.error('[DỌN DẸP] Lỗi khi đóng database:', e.message);
    }
  }

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('[DỌN DẸP] Đã xóa thư mục tạm cô lập:', tmpDir);
  } catch (e) {
    console.error('[DỌN DẸP] Lỗi khi xóa thư mục tạm:', e.message);
  }
}

// 6. Transparent reporting and exit code
console.log('\n===============================================================');
if (allLivePassed) {
  console.log('  KẾT QUẢ TỔNG THỂ: LIVE PASS (TẤT CẢ 3 KỊCH BẢN ĐỀU ĐẠT CHUẨN LIVE)');
  console.log('===============================================================');
  process.exit(0);
} else {
  console.log('  KẾT QUẢ TỔNG THỂ: LIVE FAILED (KHÔNG ĐẠT ĐIỀU KIỆN LIVE PASS)');
  console.log('===============================================================');
  console.log('Chi tiết từng kịch bản:');
  console.log(`- Kịch bản A (Đổi màu quần): Live=${scenarioResults.A.live}, Fallback=${scenarioResults.A.fallbackWorking}, Lý do: ${scenarioResults.A.error || 'N/A'}`);
  console.log(`- Kịch bản B (Khóa màu áo):  Live=${scenarioResults.B.live}, Fallback=${scenarioResults.B.fallbackWorking}, Lý do: ${scenarioResults.B.error || 'N/A'}`);
  console.log(`- Kịch bản C (Thiết kế & Lưu): Live=${scenarioResults.C.live}, Fallback=${scenarioResults.C.fallbackWorking}, Lý do: ${scenarioResults.C.error || 'N/A'}`);
  console.log('\nĐánh giá chế độ phòng vệ Fallback-Mock:');
  const allFallbackWorking = scenarioResults.A.fallbackWorking && scenarioResults.B.fallbackWorking && scenarioResults.C.fallbackWorking;
  if (allFallbackWorking) {
    console.log('-> CƠ CHẾ DỰ PHÒNG HOẠT ĐỘNG HOÀN HẢO: Khi Gateway/Model không khả dụng, hệ thống tự động chuyển sang mô phỏng an toàn và bảo toàn dữ liệu.');
  } else {
    console.log('-> CẢNH BÁO: Một số kịch bản fallback không hoàn tất.');
  }
  process.exit(1);
}
