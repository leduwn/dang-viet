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

  // We run backup with DATABASE_PATH pointing to testDbPath
  const backupRes = await runSubprocess(path.resolve('scripts/backup.mjs'), [], {
    DATABASE_PATH: testDbPath,
  });
  assert.strictEqual(backupRes.code, 0, `Sao lưu phải thành công, stderr: ${backupRes.stderr}`);
  console.log(' -> PASSED: scripts/backup.mjs chạy thành công.');

  // Find the created backup directory
  const rootBackups = fs.readdirSync(path.resolve('backups'))
    .filter((d) => d.startsWith('backup-'))
    .sort()
    .reverse();
  assert(rootBackups.length > 0, 'Phải tìm thấy thư mục backup vừa tạo');
  const latestBackupDir = path.resolve('backups', rootBackups[0]);

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
    { DATABASE_PATH: testDbPath }
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

  // 4. Test protection: Server is running on port -> Rejects restore to active main DB
  console.log('[STEP 4] Kiểm thử từ chối restore đè database chính khi phát hiện server đang hoạt động...');
  const dummyPort = 3399; // Use dummy port to test port detection logic
  const dummyServer = net.createServer();
  await new Promise((resolve) => dummyServer.listen(dummyPort, '127.0.0.1', resolve));

  const rejectRes = await runSubprocess(
    path.resolve('scripts/restore.mjs'),
    [latestBackupDir], // No --target-dir, targets active main DB
    {
      DATABASE_PATH: testDbPath,
      PORT: String(dummyPort),
      HOST: '127.0.0.1',
    }
  );

  await new Promise((resolve) => dummyServer.close(resolve));

  assert.strictEqual(rejectRes.code, 1, 'Restore phải từ chối với exit code 1 khi server đang chạy');
  assert(
    rejectRes.stderr.includes('PHÁT HIỆN MÁY CHỦ DÁNG VIỆT ĐANG HOẠT ĐỘNG') ||
    rejectRes.stderr.includes('LỖI TỪ CHỐI'),
    'Phải in thông báo từ chối rõ ràng và hướng dẫn người dùng'
  );
  console.log(' -> PASSED: Restore đã chặn thành công việc ghi đè khi server đang chạy.\n');

  // 5. Test tampering: File altered -> SHA-256 mismatch rejection
  console.log('[STEP 5] Kiểm thử từ chối bản sao lưu bị sửa đổi (Mã băm SHA-256 không khớp)...');
  const tamperedDir = path.join(testBaseDir, 'tampered_backup');
  fs.cpSync(latestBackupDir, tamperedDir, { recursive: true });

  // Append 1 byte to dangviet.db to break hash
  const tamperedDbPath = path.join(tamperedDir, 'dangviet.db');
  fs.appendFileSync(tamperedDbPath, Buffer.from([0x00]));

  const tamperRes = await runSubprocess(
    path.resolve('scripts/restore.mjs'),
    [tamperedDir, '--target-dir', path.join(testBaseDir, 'tampered_dest')],
    { DATABASE_PATH: testDbPath }
  );

  assert.strictEqual(tamperRes.code, 1, 'Restore phải từ chối khi sha256 không khớp');
  assert(
    tamperRes.stderr.includes('MÃ BĂM SHA-256 KHÔNG KHỚP') || tamperRes.stderr.includes('LỖI TOÀN VẸN'),
    'Phải báo lỗi mã băm không khớp'
  );
  console.log(' -> PASSED: Bản sao lưu bị sửa đổi mã băm đã bị phát hiện và từ chối khôi phục.\n');

  // 6. Test stale WAL/SHM cleanup during restore
  console.log('[STEP 6] Kiểm thử dọn dẹp file -wal và -shm cũ trước khi restore...');
  const walTargetDir = path.join(testBaseDir, 'wal_test_dest');
  fs.mkdirSync(walTargetDir, { recursive: true });
  const staleWal = path.join(walTargetDir, 'dangviet.db-wal');
  const staleShm = path.join(walTargetDir, 'dangviet.db-shm');
  fs.writeFileSync(staleWal, 'stale wal content');
  fs.writeFileSync(staleShm, 'stale shm content');

  const walRestoreRes = await runSubprocess(
    path.resolve('scripts/restore.mjs'),
    [latestBackupDir, '--target-dir', walTargetDir],
    { DATABASE_PATH: testDbPath }
  );
  assert.strictEqual(walRestoreRes.code, 0, 'Restore vào thư mục có WAL cũ phải thành công');
  assert(!fs.existsSync(staleWal), 'Tệp -wal cũ phải được dọn dẹp');
  assert(!fs.existsSync(staleShm), 'Tệp -shm cũ phải được dọn dẹp');
  console.log(' -> PASSED: File -wal và -shm cũ đã được dọn sạch hoàn toàn trước khi restore.\n');

  console.log('===============================================================================');
  console.log('  CHÚC MỪNG: TẤT CẢ CÁC BÀI KIỂM THỬ BACKUP & RESTORE AN TOÀN ĐỀU ĐẠT CHUẨN!');
  console.log('===============================================================================');
} finally {
  try {
    fs.rmSync(testBaseDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
}
