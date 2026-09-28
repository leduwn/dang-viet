import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

console.log('=== KIỂM THỬ TỰ ĐỘNG SAO LƯU & KHÔI PHỤC TOÀN DIỆN (BACKUP & RESTORE TEST) ===\n');

const testBaseDir = path.resolve('test-backup-scratch');
if (fs.existsSync(testBaseDir)) {
  fs.rmSync(testBaseDir, { recursive: true, force: true });
}
fs.mkdirSync(testBaseDir, { recursive: true });

const testDataDir = path.join(testBaseDir, 'data');
const testBackupRoot = path.join(testBaseDir, 'backups');
const testRestoreDir = path.join(testBaseDir, 'restored');
fs.mkdirSync(testDataDir, { recursive: true });
fs.mkdirSync(testBackupRoot, { recursive: true });
fs.mkdirSync(testRestoreDir, { recursive: true });

const testDbPath = path.join(testDataDir, 'dangviet.db');

try {
  // 1. Prepare initial database with real records
  console.log('[STEP 1] Khởi tạo cơ sở dữ liệu thử nghiệm với dữ liệu phong phú...');
  const initDb = new DatabaseSync(testDbPath);
  const sql001 = fs.readFileSync(path.resolve('migrations/001_initial.sql'), 'utf-8');
  const sql002 = fs.readFileSync(path.resolve('migrations/002_undo_and_constraints.sql'), 'utf-8');
  initDb.exec(sql001);
  initDb.exec(sql002);

  // Insert 3 looks
  for (let i = 1; i <= 3; i++) {
    const lookId = `look_test_${i}`;
    initDb.prepare(`
      INSERT INTO looks (id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at, undo_stack_json)
      VALUES (?, 'user_test', ?, 'ky_yeu', 'truyen_thong', '{"fabric":"lua"}', '{}', 'Giai thich', ?, 0, '2026-09-28', '2026-09-28', '[]')
    `).run(lookId, `Bộ phối thử nghiệm ${i}`, i * 2);

    // Insert revisions
    for (let r = 1; r <= i * 2; r++) {
      initDb.prepare(`
        INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at)
        VALUES (?, ?, '{"fabric":"lua"}', '{}', 'rev note', '2026-09-28')
      `).run(lookId, r);
    }
  }

  // Insert 2 lookbook items
  initDb.prepare(`
    INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at)
    VALUES ('lb_1', 'Lookbook item 1', 'look_test_1', 2, '{"fabric":"lua"}', 'ky_yeu', 'truyen_thong', 'Ghi chu 1', '2026-09-28')
  `).run();
  initDb.prepare(`
    INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at)
    VALUES ('lb_2', 'Lookbook item 2', 'look_test_2', 4, '{"fabric":"lua"}', 'ky_yeu', 'truyen_thong', 'Ghi chu 2', '2026-09-28')
  `).run();

  initDb.close();
  console.log(' -> PASSED: Đã chuẩn bị database thử nghiệm có 3 looks, 12 revisions, 2 lookbook items.\n');

  // 2. Perform safe backup via subprocess
  console.log('[STEP 2] Thực hiện sao lưu an toàn bằng scripts/backup.mjs...');
  const runSubprocess = (scriptPath, args = [], envOverrides = {}) => {
    return new Promise((resolve) => {
      const proc = spawn(process.execPath, [scriptPath, ...args], {
        env: { ...process.env, ...envOverrides },
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
    });
  };

  // We run backup with DATABASE_PATH pointing to testDbPath and BACKUPS_ROOT_DIR to testBackupRoot
  const backupRes = await runSubprocess(path.resolve('scripts/backup.mjs'), [], {
    DATABASE_PATH: testDbPath,
    BACKUPS_ROOT_DIR: testBackupRoot,
  });
  assert.strictEqual(backupRes.code, 0, `Sao lưu phải thành công, stderr: ${backupRes.stderr}`);
  console.log(' -> PASSED: scripts/backup.mjs chạy thành công.');

  // Find the created backup directory inside testBackupRoot
  const rootBackups = fs.readdirSync(testBackupRoot)
    .filter((d) => d.startsWith('backup-'))
    .sort()
    .reverse();
  assert(rootBackups.length > 0, 'Phải tìm thấy thư mục backup vừa tạo');
  const latestBackupDir = path.resolve(testBackupRoot, rootBackups[0]);

  // Verify manifest.json
  const manifest = JSON.parse(fs.readFileSync(path.join(latestBackupDir, 'manifest.json'), 'utf-8'));
  assert(manifest.files && manifest.files['dangviet.db'], 'Manifest phải chứa dangviet.db');
  assert(manifest.files['dangviet.db'].sha256, 'Manifest phải chứa mã sha256');
  console.log(` -> PASSED: Manifest hợp lệ, SHA-256 = ${manifest.files['dangviet.db'].sha256}\n`);

  // 3. Restore to an isolated target directory using --target-dir
  console.log('[STEP 3] Khôi phục sang thư mục riêng biệt với --target-dir...');
  const restoreRes = await runSubprocess(
    path.resolve('scripts/restore.mjs'),
    [latestBackupDir, '--target-dir', testRestoreDir],
    { DATABASE_PATH: testDbPath, BACKUPS_ROOT_DIR: testBackupRoot }
  );
  assert.strictEqual(restoreRes.code, 0, `Restore phải thành công: ${restoreRes.stderr}`);

  // Query restored database and verify all data matches
  const restoredDbFile = path.join(testRestoreDir, 'dangviet.db');
  assert(fs.existsSync(restoredDbFile), 'Tệp database đã khôi phục phải tồn tại');
  const restoredDb = new DatabaseSync(restoredDbFile);

  const restoredLooks = restoredDb.prepare('SELECT count(*) as c FROM looks').get().c;
  const restoredRevs = restoredDb.prepare('SELECT count(*) as c FROM look_revisions').get().c;
  const restoredLb = restoredDb.prepare('SELECT count(*) as c FROM lookbook').get().c;

  assert.strictEqual(restoredLooks, 3, 'Số lượng looks phải khớp');
  assert.strictEqual(restoredRevs, 12, 'Số lượng revisions phải khớp');
  assert.strictEqual(restoredLb, 2, 'Số lượng lookbook phải khớp');

  const lbItem = restoredDb.prepare('SELECT * FROM lookbook WHERE id = ?').get('lb_1');
  assert.strictEqual(lbItem.title, 'Lookbook item 1');
  assert.strictEqual(lbItem.revision, 2);
  restoredDb.close();
  console.log(' -> PASSED: Khôi phục thành công 100% dữ liệu looks, lookbook, revisions sang thư mục riêng.\n');

  // 4. Test protection: Target matches active DB directory -> Reject
  console.log('[STEP 4] Kiểm thử từ chối khi thư mục đích trùng với thư mục database đang hoạt động...');
  const rejectActiveRes = await runSubprocess(
    path.resolve('scripts/restore.mjs'),
    [latestBackupDir, '--target-dir', testDataDir],
    { DATABASE_PATH: testDbPath, BACKUPS_ROOT_DIR: testBackupRoot }
  );

  assert.strictEqual(rejectActiveRes.code, 1, 'Restore phải từ chối khi đích trùng thư mục active DB');
  assert(
    rejectActiveRes.stderr.includes('THƯ MỤC ĐÍCH TRÙNG VỚI THƯ MỤC DATABASE ĐANG HOẠT ĐỘNG') ||
    rejectActiveRes.stderr.includes('[TỪ CHỐI]'),
    'Phải in cảnh báo từ chối rõ ràng'
  );
  console.log(' -> PASSED: Restore đã chặn thành công khi đích trùng thư mục active database.\n');

  // 5. Test protection: Target matches backup source directory -> Reject
  console.log('[STEP 5] Kiểm thử từ chối khi thư mục đích trùng với chính thư mục backup nguồn...');
  const rejectSourceRes = await runSubprocess(
    path.resolve('scripts/restore.mjs'),
    [latestBackupDir, '--target-dir', latestBackupDir],
    { DATABASE_PATH: testDbPath, BACKUPS_ROOT_DIR: testBackupRoot }
  );

  assert.strictEqual(rejectSourceRes.code, 1, 'Restore phải từ chối khi đích trùng nguồn backup');
  assert(
    rejectSourceRes.stderr.includes('THƯ MỤC ĐÍCH TRÙNG VỚI CHÍNH THƯ MỤC BẢN SAO LƯU NGUỒN'),
    'Phải in cảnh báo từ chối trùng nguồn'
  );
  console.log(' -> PASSED: Restore đã chặn thành công khi đích trùng chính nguồn sao lưu.\n');

  // 6. Test protection: Target directory exists and is not empty -> Reject
  console.log('[STEP 6] Kiểm thử từ chối khi thư mục đích đã tồn tại và không rỗng...');
  const nonEmptyDir = path.join(testBaseDir, 'non_empty_dest');
  fs.mkdirSync(nonEmptyDir, { recursive: true });
  fs.writeFileSync(path.join(nonEmptyDir, 'existing_file.txt'), 'hello world');

  const rejectNonEmptyRes = await runSubprocess(
    path.resolve('scripts/restore.mjs'),
    [latestBackupDir, '--target-dir', nonEmptyDir],
    { DATABASE_PATH: testDbPath, BACKUPS_ROOT_DIR: testBackupRoot }
  );

  assert.strictEqual(rejectNonEmptyRes.code, 1, 'Restore phải từ chối khi thư mục đích không rỗng');
  assert(
    rejectNonEmptyRes.stderr.includes('THƯ MỤC ĐÍCH ĐÃ CÓ SẴN DỮ LIỆU'),
    'Phải in cảnh báo từ chối thư mục có dữ liệu'
  );
  console.log(' -> PASSED: Restore đã chặn thành công khi thư mục đích không rỗng.\n');

  // 7. Test tampering: File altered -> SHA-256 mismatch rejection & staging cleanup
  console.log('[STEP 7] Kiểm thử từ chối bản sao lưu bị sửa đổi (Mã băm SHA-256 không khớp)...');
  const tamperedDir = path.join(testBaseDir, 'tampered_backup');
  fs.cpSync(latestBackupDir, tamperedDir, { recursive: true });

  // Append 1 byte to dangviet.db to break hash
  const tamperedDbPath = path.join(tamperedDir, 'dangviet.db');
  fs.appendFileSync(tamperedDbPath, Buffer.from([0x00]));

  const tamperDest = path.join(testBaseDir, 'tampered_dest');
  const tamperRes = await runSubprocess(
    path.resolve('scripts/restore.mjs'),
    [tamperedDir, '--target-dir', tamperDest],
    { DATABASE_PATH: testDbPath, BACKUPS_ROOT_DIR: testBackupRoot }
  );

  assert.strictEqual(tamperRes.code, 1, 'Restore phải từ chối khi sha256 không khớp');
  assert(
    tamperRes.stderr.includes('MÃ BĂM SHA-256 KHÔNG KHỚP') || tamperRes.stderr.includes('LỖI TOÀN VẸN'),
    'Phải báo lỗi mã băm không khớp'
  );
  // Verify tamperDest was NOT created and staging was cleaned up
  assert(!fs.existsSync(tamperDest), 'Thư mục đích cuối không được tạo khi lỗi toàn vẹn');
  console.log(' -> PASSED: Bản sao lưu bị sửa đổi mã băm đã bị phát hiện, từ chối và dọn dẹp staging an toàn.\n');

  // 8. Clean up created backup folder to leave no junk
  try {
    fs.rmSync(latestBackupDir, { recursive: true, force: true });
  } catch {}

  console.log('===============================================================================');
  console.log('  CHÚC MỪNG: TẤT CẢ CÁC BÀI KIỂM THỬ BACKUP & RESTORE AN TOÀN ĐỀU ĐẠT CHUẨN!');
  console.log('===============================================================================');
} finally {
  try {
    fs.rmSync(testBaseDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
}
