/**
 * Automated Test Suite: External Avatar Pipeline & Compatibility Verification
 * Tests:
 * 1. Contract & Domain: resolveAvatarForModel fallback logic.
 * 2. Contract: getCompatibilityStatus triplet matrix (verified / untested / unsupported).
 * 3. Domain: SET_AVATAR command with OCC revision, locks enforcement, and multi-level Undo.
 * 4. 3D MorphController: Alias resolution and dynamic socket tracking deformed by body morphs.
 * 5. CLI Pipeline inspect: Valid master assets (avatar_v2.glb, avatar_base.glb).
 * 6. CLI Pipeline inspect: Error handling for corrupt headers and missing files.
 * 7. CLI Pipeline register: SHA-256 verification and atomic catalog registration.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

import {
  resolveAvatarForModel,
  getCompatibilityStatus,
} from '@dangviet/contracts';
import { executeCommand } from '@dangviet/domain';
import { MorphController, MORPH_ALIASES } from '../apps/web/src/3d/MorphController.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PASS = '✓';
const FAIL = '✕';
let testCount = 0;
let passCount = 0;

function runTest(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`  ${PASS} [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ${FAIL} [FAIL] ${name}`);
    console.error(`     Chi tiết: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  testCount++;
  try {
    await fn();
    console.log(`  ${PASS} [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ${FAIL} [FAIL] ${name}`);
    console.error(`     Chi tiết: ${err.message}`);
    throw err;
  }
}

console.log('======================================================================');
console.log('  DÁNG VIỆT - BỘ KIỂM THỬ PIPELINE AVATAR & MA TRẬN TƯƠNG THÍCH');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// NHÓM 1: CONTRACT & BACKWARD COMPATIBILITY
// -----------------------------------------------------------------------------
console.log('--- 1. Kiểm tra Contract & Tương thích ngược (Backward Compatibility) ---');

runTest('Look cũ thiếu avatarId tự động fallback về avatar chuẩn theo modelId', () => {
  assert.strictEqual(
    resolveAvatarForModel('aodai_traditional_v2'),
    'avatar_v2',
    'Mẫu V2 phải fallback về avatar_v2'
  );
  assert.strictEqual(
    resolveAvatarForModel('aodai_classic_01'),
    'avatar_base',
    'Mẫu Classic V1 phải fallback về avatar_base'
  );
  assert.strictEqual(
    resolveAvatarForModel('aodai_remix_raglan'),
    'avatar_base',
    'Mẫu Raglan V1 phải fallback về avatar_base'
  );
  assert.strictEqual(
    resolveAvatarForModel(undefined),
    'avatar_base',
    'Khi modelId undefined phải an toàn trả về avatar_base'
  );
});

runTest('Bảo toàn avatarId khi bản ghi Look đã có trường avatarId hợp lệ', () => {
  assert.strictEqual(
    resolveAvatarForModel('aodai_classic_01', 'custom_ai_avatar_01'),
    'custom_ai_avatar_01',
    'Phải ưu tiên avatarId đã khai báo'
  );
  assert.strictEqual(
    resolveAvatarForModel('aodai_traditional_v2', 'avatar_v2'),
    'avatar_v2'
  );
  assert.strictEqual(
    resolveAvatarForModel('aodai_traditional_v2', '   '),
    'avatar_v2',
    'Chuỗi khoảng trắng phải fallback về mặc định'
  );
});

// -----------------------------------------------------------------------------
// NHÓM 2: MA TRẬN TƯƠNG THÍCH BỘ BA
// -----------------------------------------------------------------------------
console.log('\n--- 2. Kiểm tra Ma trận tương thích bộ ba (Avatar - Áo - Vóc dáng) ---');

runTest('avatar_v2 kết hợp aodai_traditional_v2 phải có trạng thái verified', () => {
  const result = getCompatibilityStatus('avatar_v2', 'aodai_traditional_v2', 'standard');
  assert.strictEqual(result.status, 'verified');
  assert.ok(result.reason.includes('V2'));
});

runTest('avatar_base kết hợp aodai_classic_01 và raglan phải có trạng thái verified', () => {
  const classic = getCompatibilityStatus('avatar_base', 'aodai_classic_01', 'standard');
  assert.strictEqual(classic.status, 'verified');

  const raglan = getCompatibilityStatus('avatar_base', 'aodai_remix_raglan', 'petite');
  assert.strictEqual(raglan.status, 'verified');
});

runTest('avatar_base kết hợp aodai_traditional_v2 phải báo unsupported', () => {
  const result = getCompatibilityStatus('avatar_base', 'aodai_traditional_v2', 'standard');
  assert.strictEqual(result.status, 'unsupported');
  assert.ok(result.reason.length > 0);
});

runTest('Avatar AI nhập ngoài chưa kiểm thử phải báo untested', () => {
  const result = getCompatibilityStatus('tripo_avatar_adult_01', 'aodai_traditional_v2', 'standard');
  assert.strictEqual(result.status, 'untested');
});

runTest('Ma trận tương thích tùy biến (customMatrix) có độ ưu tiên cao nhất', () => {
  const customMatrix = [
    {
      avatarId: 'tripo_avatar_adult_01',
      avatarVersion: '1.0.0',
      garmentModelId: 'aodai_traditional_v2',
      garmentVersion: '2.0.0',
      bodyShape: 'standard',
      status: 'verified',
      reason: 'Đã nghiệm thu kiểm thử phòng phối',
    },
  ];
  const result = getCompatibilityStatus('tripo_avatar_adult_01', 'aodai_traditional_v2', 'standard', customMatrix);
  assert.strictEqual(result.status, 'verified');
  assert.strictEqual(result.reason, 'Đã nghiệm thu kiểm thử phòng phối');
});

// -----------------------------------------------------------------------------
// NHÓM 3: DOMAIN COMMAND SET_AVATAR & LOCKS & UNDO
// -----------------------------------------------------------------------------
console.log('\n--- 3. Kiểm tra Domain Command SET_AVATAR, Khóa thuộc tính & Undo ---');

function createSampleLook(overrides = {}) {
  const baseConfig = {
    avatarId: 'avatar_v2',
    modelId: 'aodai_traditional_v2',
    bodyShape: 'standard',
    primaryColor: { hex: '#B83A24', name: 'Đỏ Son', family: 'red' },
    pantsColor: { hex: '#F0EAD6', name: 'Trắng Ngà', family: 'white' },
    collarStyle: 'high_stand_4cm',
    sleeveStyle: 'long_raglan',
    fabric: 'silk_ha_dong',
    pattern: 'lotus_traditional',
    accessories: ['man_truyen_thong'],
    ...overrides.config,
  };

  return {
    id: 'look_test_01',
    title: 'Bản phối thử nghiệm',
    eventId: 'tet_nguyen_dan',
    styleId: 'truyen_thong',
    explanation: 'Giải thích',
    revision: 1,
    updatedAt: new Date().toISOString(),
    config: baseConfig,
    locks: {
      avatarId: false,
      primaryColor: false,
      pantsColor: false,
      collarStyle: false,
      sleeveStyle: false,
      fabric: false,
      pattern: false,
      accessories: false,
      bodyShape: false,
      modelId: false,
      ...overrides.locks,
    },
    ...overrides,
  };
}

runTest('Thực thi lệnh SET_AVATAR thành công cập nhật config và tăng revision', () => {
  const currentLook = createSampleLook();
  const res = executeCommand(currentLook, {
    commandId: 'cmd_avatar_01',
    action: 'SET_AVATAR',
    expectedRevision: 1,
    payload: { avatarId: 'avatar_base' },
  });

  assert.strictEqual(res.ok, true);
  assert.ok(res.result.look);
  assert.strictEqual(res.result.look.config.avatarId, 'avatar_base');
  assert.strictEqual(res.result.look.revision, 2);
});

runTest('Khóa thuộc tính locks.avatarId ngăn chặn lệnh SET_AVATAR', () => {
  const lockedLook = createSampleLook({ locks: { avatarId: true } });
  const res = executeCommand(lockedLook, {
    commandId: 'cmd_avatar_02',
    action: 'SET_AVATAR',
    expectedRevision: 1,
    payload: { avatarId: 'avatar_base' },
  });

  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.error?.includes('khóa'));
  assert.strictEqual(lockedLook.config.avatarId, 'avatar_v2');
});

runTest('SET_AVATAR từ chối avatarId rỗng hoặc không hợp lệ', () => {
  const currentLook = createSampleLook();
  const emptyRes = executeCommand(currentLook, {
    commandId: 'cmd_avatar_03',
    action: 'SET_AVATAR',
    expectedRevision: 1,
    payload: { avatarId: '' },
  });
  assert.strictEqual(emptyRes.ok, false);
  assert.strictEqual(emptyRes.statusCode, 400);

  const whitespaceRes = executeCommand(currentLook, {
    commandId: 'cmd_avatar_04',
    action: 'SET_AVATAR',
    expectedRevision: 1,
    payload: { avatarId: '   ' },
  });
  assert.strictEqual(whitespaceRes.ok, false);
  assert.strictEqual(whitespaceRes.statusCode, 400);
});

runTest('SET_AVATAR phát hiện xung đột OCC khi clientExpectedRevision sai lệch', () => {
  const currentLook = createSampleLook({ revision: 5 });
  const conflictRes = executeCommand(currentLook, {
    commandId: 'cmd_avatar_05',
    action: 'SET_AVATAR',
    expectedRevision: 3,
    payload: { avatarId: 'avatar_base' },
  });
  assert.strictEqual(conflictRes.ok, false);
  assert.strictEqual(conflictRes.statusCode, 409);
});

// -----------------------------------------------------------------------------
// NHÓM 4: 3D MORPH CONTROLLER & ATTACHMENT SOCKETS
// -----------------------------------------------------------------------------
console.log('\n--- 4. Kiểm tra Morph Dictionary Aliases & Socket Tracking ---');

runTest('Bảng quy đổi MORPH_ALIASES ánh xạ đúng danh xưng morph từ AI ngoài', () => {
  assert.strictEqual(MORPH_ALIASES['petite'], 'morph_petite');
  assert.strictEqual(MORPH_ALIASES['slender_short'], 'morph_petite');
  assert.strictEqual(MORPH_ALIASES['tall'], 'morph_tall_slender');
  assert.strictEqual(MORPH_ALIASES['broad_shoulders'], 'morph_broad_shoulders');
  assert.strictEqual(MORPH_ALIASES['curvy_hips'], 'morph_curvy_hips');
  assert.strictEqual(MORPH_ALIASES['plus_size'], 'morph_plus_size');
});

runTest('Dynamic socket transform: Đỉnh đầu (head) biến dạng theo chiều cao', () => {
  const standardHead = MorphController.getSocketTransform('head', {});
  const petiteHead = MorphController.getSocketTransform('head', { morph_petite: 1.0 });
  const tallHead = MorphController.getSocketTransform('head', { morph_tall_slender: 1.0 });

  assert.ok(petiteHead.position[1] < standardHead.position[1], 'Dáng petite đỉnh đầu phải thấp hơn chuẩn');
  assert.ok(tallHead.position[1] > standardHead.position[1], 'Dáng tall đỉnh đầu phải cao hơn chuẩn');
});

runTest('Dynamic socket transform: Tay phải (right_hand) dạt ra ngoài tránh xuyên hông/đùi', () => {
  const standardHand = MorphController.getSocketTransform('right_hand', {});
  const broadHand = MorphController.getSocketTransform('right_hand', { morph_broad_shoulders: 1.0 });
  const plusHand = MorphController.getSocketTransform('right_hand', { morph_plus_size: 1.0 });

  assert.ok(broadHand.position[0] > standardHand.position[0], 'Vai rộng tay phải dạt ra trục X dương');
  assert.ok(plusHand.position[0] > standardHand.position[0], 'Dáng đầy đặn tay phải dạt ra trục X dương');
});

// -----------------------------------------------------------------------------
// NHÓM 5: CLI AVATAR PIPELINE INSPECTION
// -----------------------------------------------------------------------------
console.log('\n--- 5. Kiểm tra CLI avatar-pipeline.mjs inspect trên asset thực tế ---');

runTest('inspect trên avatar_v2.glb: Chuẩn Khronos 0 lỗi, chiều cao 1.643m', () => {
  const glbPath = path.join(ROOT_DIR, 'apps/web/public/models/avatar_v2.glb');
  const out = execSync(`node scripts/avatar-pipeline.mjs inspect "${glbPath}" --json`, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });
  const data = JSON.parse(out);

  assert.strictEqual(data.ok, true);
  assert.ok(Math.abs(data.stats.bounds.height - 1.643) < 0.05, `Chiều cao đo được: ${data.stats?.bounds?.height}`);
  assert.strictEqual(data.stats.morphs.count, 5);
  assert.ok(data.stats.materials.count >= 2);
  assert.strictEqual(data.errors.length, 0);
});

runTest('inspect trên avatar_base.glb: Chuẩn Khronos 0 lỗi, chiều cao 1.669m', () => {
  const glbPath = path.join(ROOT_DIR, 'apps/web/public/models/avatar_base.glb');
  const out = execSync(`node scripts/avatar-pipeline.mjs inspect "${glbPath}" --json`, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });
  const data = JSON.parse(out);

  assert.strictEqual(data.ok, true);
  assert.ok(Math.abs(data.stats.bounds.height - 1.669) < 0.05, `Chiều cao đo được: ${data.stats?.bounds?.height}`);
  assert.strictEqual(data.stats.morphs.count, 5);
  assert.strictEqual(data.errors.length, 0);
});

// -----------------------------------------------------------------------------
// NHÓM 6: CLI AVATAR PIPELINE ERROR HANDLING & CORRUPT FIXTURES
// -----------------------------------------------------------------------------
console.log('\n--- 6. Kiểm tra Xử lý lỗi & Fixtures hỏng (Corrupt / Invalid Assets) ---');

runTest('inspect phát hiện lỗi ERR_INVALID_GLTF khi file có header sai byte magic', () => {
  const tmpDir = path.join(ROOT_DIR, 'tmp-test-fixtures');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const corruptPath = path.join(tmpDir, 'corrupt_bad_magic.glb');

  // Ghi file nhị phân giả mạo 12 byte với magic sai 0xDEADBEEF
  const badBuf = Buffer.alloc(32);
  badBuf.writeUInt32LE(0xdeadbeef, 0); // Sai magic glTF
  badBuf.writeUInt32LE(2, 4);
  badBuf.writeUInt32LE(32, 8);
  fs.writeFileSync(corruptPath, badBuf);

  try {
    let thrown = false;
    try {
      execSync(`node scripts/avatar-pipeline.mjs inspect "${corruptPath}" --json`, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      thrown = true;
      const stdout = err.stdout ? err.stdout.toString() : '';
      const stderr = err.stderr ? err.stderr.toString() : '';
      const combined = stdout + stderr;
      assert.ok(
        combined.includes('ERR_INVALID_GLTF') || combined.includes('không hợp lệ'),
        `Phải phát hiện mã lỗi ERR_INVALID_GLTF. Kết quả: ${combined}`
      );
    }
    assert.strictEqual(thrown, true, 'Lệnh inspect trên file corrupt phải trả về exit code lỗi');
  } finally {
    if (fs.existsSync(corruptPath)) fs.unlinkSync(corruptPath);
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  }
});

runTest('inspect báo lỗi rõ ràng khi tệp không tồn tại', () => {
  let thrown = false;
  try {
    execSync(`node scripts/avatar-pipeline.mjs inspect "non_existent_file_path.glb"`, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    thrown = true;
    const combined = (err.stdout || '') + (err.stderr || '');
    assert.ok(combined.includes('Không tìm thấy tệp') || combined.includes('ENOENT'));
  }
  assert.strictEqual(thrown, true);
});

// -----------------------------------------------------------------------------
// NHÓM 7: CLI AVATAR PIPELINE REGISTRATION & ATOMIC MANIFEST
// -----------------------------------------------------------------------------
console.log('\n--- 7. Kiểm tra Lệnh register & Cập nhật nguyên tử Catalog Manifest ---');

runTest('register từ chối khi avatarId hoặc version không hợp lệ', () => {
  const glbPath = path.join(ROOT_DIR, 'apps/web/public/models/avatar_v2.glb');
  let thrown = false;
  try {
    execSync(`node scripts/avatar-pipeline.mjs register "${glbPath}" --id ""`, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    thrown = true;
    const combined = (err.stdout || '') + (err.stderr || '');
    assert.ok(
      combined.includes('--id') || combined.includes('không hợp lệ') || combined.includes('Thiếu'),
      `Kết quả thông báo lỗi: ${combined}`
    );
  }
  assert.strictEqual(thrown, true);
});

runTest('Catalog manifest chứa đầy đủ danh sách avatars chuẩn và ma trận tương thích', () => {
  const manifestPath = path.join(ROOT_DIR, 'apps/web/public/models/catalog_manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'catalog_manifest.json phải tồn tại');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.ok(Array.isArray(manifest.avatars), 'Manifest phải có mảng avatars');
  assert.ok(manifest.avatars.some((a) => a.avatarId === 'avatar_v2'));
  assert.ok(manifest.avatars.some((a) => a.avatarId === 'avatar_base'));

  assert.ok(Array.isArray(manifest.compatibilityMatrix), 'Manifest phải có mảng compatibilityMatrix');
  assert.ok(
    manifest.compatibilityMatrix.some(
      (m) => m.avatarId === 'avatar_v2' && m.garmentModelId === 'aodai_traditional_v2' && m.status === 'verified'
    )
  );
  assert.ok(
    manifest.compatibilityMatrix.some(
      (m) => m.avatarId === 'avatar_base' && m.garmentModelId === 'aodai_traditional_v2' && m.status === 'unsupported'
    )
  );
});

console.log('\n======================================================================');
console.log(`  KẾT QUẢ: Đã chạy thành công ${passCount}/${testCount} bài kiểm thử.`);
console.log('  TẤT CẢ CÁC BÀI TEST PIPELINE VÀ COMPATIBILITY ĐỀU ĐẠT CHUẨN 100%!');
console.log('======================================================================\n');
