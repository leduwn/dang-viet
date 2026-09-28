import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';

console.log('=== DÁNG VIỆT - PHỤC HỒI AN TOÀN HỆ THỐNG (SAFE RESTORE) ===\n');

// 1. Parse CLI arguments
const args = process.argv.slice(2);
let backupDirInput = null;
let explicitTargetDir = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--target-dir' && args[i + 1]) {
    explicitTargetDir = path.resolve(args[i + 1]);
    i++;
  } else if (!args[i].startsWith('--')) {
    backupDirInput = args[i];
  }
}

// 2. Resolve Active and Target Database Paths
const defaultDbPath = path.resolve(process.env.DATABASE_PATH || './data/dangviet.db');
const isCustomTarget = Boolean(explicitTargetDir);
const targetDirInput = isCustomTarget ? explicitTargetDir : path.dirname(defaultDbPath);
const targetDbName = path.basename(defaultDbPath);
const targetDbPath = path.join(targetDirInput, targetDbName);
const targetContentDir = isCustomTarget ? path.join(targetDirInput, 'content') : path.resolve('content');

console.log(`[CẤU HÌNH] Database chính hệ thống: ${defaultDbPath}`);
console.log(`[CẤU HÌNH] Thư mục đích khôi phục:   ${targetDirInput}`);
console.log(`[CẤU HÌNH] Tệp database đích:        ${targetDbPath}`);
console.log(`[CẤU HÌNH] Khôi phục trực tiếp DB chính: ${!isCustomTarget ? 'CÓ (Yêu cầu server dừng)' : 'KHÔNG (Restore vào thư mục kiểm nghiệm)'}\n`);

// 3. Check if server is running when targeting the active database
function checkServerRunning(port, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let connected = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      connected = true;
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

const serverPort = Number(process.env.PORT) || 3001;
const serverHost = process.env.HOST || '127.0.0.1';

if (!isCustomTarget) {
  const isRunning = await checkServerRunning(serverPort, serverHost);
  if (isRunning) {
    console.error('=============================================================================');
    console.error('[LỖI TỪ CHỐI] PHÁT HIỆN MÁY CHỦ DÁNG VIỆT ĐANG HOẠT ĐỘNG!');
    console.error(`Địa chỉ máy chủ đang lắng nghe: http://${serverHost}:${serverPort}`);
    console.error('Không được phép ghi đè tệp SQLite khi server đang chạy vì sẽ gây hỏng dữ liệu.');
    console.error('\nHƯỚNG DẪN XỬ LÝ:');
    console.error('1. Dừng server trước khi khôi phục:');
    console.error('   - Nhấn Ctrl+C tại cửa sổ terminal đang chạy server');
    console.error('   - Hoặc trên PowerShell: Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force');
    console.error('2. Hoặc khôi phục vào thư mục riêng biệt để kiểm tra / phục hồi dữ liệu:');
    console.error('   node scripts/restore.mjs [backup-folder] --target-dir ./test-restored-data');
    console.error('=============================================================================');
    process.exit(1);
  }
}

// 4. Locate Backup Directory
const backupsDir = path.resolve('backups');
let targetBackupDir = '';

if (backupDirInput) {
  targetBackupDir = path.resolve(backupDirInput);
} else {
  if (!fs.existsSync(backupsDir)) {
    console.error('[FAIL] Thư mục backups không tồn tại.');
    process.exit(1);
  }

  const dirs = fs.readdirSync(backupsDir)
    .filter((d) => fs.statSync(path.join(backupsDir, d)).isDirectory() && d.startsWith('backup-'))
    .sort()
    .reverse();

  if (dirs.length === 0) {
    console.error('[FAIL] Không tìm thấy bản sao lưu nào trong thư mục backups.');
    process.exit(1);
  }
  targetBackupDir = path.join(backupsDir, dirs[0]);
}

if (!fs.existsSync(targetBackupDir)) {
  console.error(`[FAIL] Bản sao lưu không tồn tại: ${targetBackupDir}`);
  process.exit(1);
}

console.log(`[RESTORE] Nguồn sao lưu: ${targetBackupDir}`);

// Helper to compute sha256 checksum
function computeFileSha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

// 5. Verify manifest.json
const manifestPath = path.join(targetBackupDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('[FAIL] Không tìm thấy manifest.json trong bản sao lưu. Bản backup không hợp lệ.');
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`[MANIFEST] Bản sao lưu tạo lúc: ${manifest.timestamp} | Ứng dụng: ${manifest.app || 'dang-viet'}`);
} catch (err) {
  console.error(`[FAIL] manifest.json bị lỗi cú pháp: ${err.message}`);
  process.exit(1);
}

// 6. Verify database integrity and SHA-256 in backup folder
const backupDbPath = path.join(targetBackupDir, 'dangviet.db');
if (!fs.existsSync(backupDbPath)) {
  console.error(`[FAIL] Không tìm thấy tệp dangviet.db trong bản sao lưu: ${backupDbPath}`);
  process.exit(1);
}

console.log('[VERIFY 1/2] Kiểm tra mã băm SHA-256 của tệp sao lưu...');
const expectedHash = manifest.files?.['dangviet.db']?.sha256;
if (!expectedHash) {
  console.error('[FAIL] manifest.json không chứa thông tin mã băm sha256 cho dangviet.db!');
  process.exit(1);
}

const actualHash = computeFileSha256(backupDbPath);
if (actualHash !== expectedHash) {
  console.error('=============================================================================');
  console.error('[LỖI TOÀN VẸN] MÃ BĂM SHA-256 KHÔNG KHỚP! BẢN SAO LƯU ĐÃ BỊ SỬA ĐỔI HOẶC HỎNG!');
  console.error(`Mã băm kỳ vọng trong manifest: ${expectedHash}`);
  console.error(`Mã băm thực tế của tệp backup:  ${actualHash}`);
  console.error('Từ chối thực hiện khôi phục để bảo vệ tính toàn vẹn hệ thống.');
  console.error('=============================================================================');
  process.exit(1);
}
console.log(`[OK] Mã băm SHA-256 khớp chuẩn xác (${actualHash.slice(0, 16)}...)`);

console.log('[VERIFY 2/2] Kiểm tra tính toàn vẹn SQLite (PRAGMA integrity_check)...');
try {
  const testDb = new DatabaseSync(backupDbPath);
  const integrityRow = testDb.prepare('PRAGMA integrity_check;').get();
  testDb.close();

  if (integrityRow?.integrity_check !== 'ok') {
    throw new Error(`PRAGMA integrity_check trả về: ${integrityRow?.integrity_check}`);
  }
  console.log('[OK] Tệp SQLite trong bản sao lưu hợp lệ 100% (integrity_check: ok).');
} catch (err) {
  console.error(`[FAIL] Kiểm tra cấu trúc SQLite của file sao lưu thất bại: ${err.message}`);
  process.exit(1);
}

// 7. Staging Rollback Backup of Destination
if (!fs.existsSync(targetDirInput)) {
  fs.mkdirSync(targetDirInput, { recursive: true });
}

const stagingBackupDir = path.join(targetDirInput, `.staging_rollback_${Date.now()}`);
let hasStagedData = false;

try {
  if (fs.existsSync(targetDbPath)) {
    fs.mkdirSync(stagingBackupDir, { recursive: true });
    fs.copyFileSync(targetDbPath, path.join(stagingBackupDir, targetDbName));
    hasStagedData = true;

    // Also stage WAL / SHM if present
    if (fs.existsSync(`${targetDbPath}-wal`)) {
      fs.copyFileSync(`${targetDbPath}-wal`, path.join(stagingBackupDir, `${targetDbName}-wal`));
    }
    if (fs.existsSync(`${targetDbPath}-shm`)) {
      fs.copyFileSync(`${targetDbPath}-shm`, path.join(stagingBackupDir, `${targetDbName}-shm`));
    }
    console.log(`[STAGING] Đã tạo bản sao dự phòng rollback tại: ${stagingBackupDir}`);
  }

  // 8. Clean up stale -wal and -shm files before copying new database
  const targetWalPath = `${targetDbPath}-wal`;
  const targetShmPath = `${targetDbPath}-shm`;
  if (fs.existsSync(targetWalPath)) {
    fs.rmSync(targetWalPath, { force: true });
    console.log(`[CLEANUP] Đã xóa tệp WAL cũ: ${targetWalPath}`);
  }
  if (fs.existsSync(targetShmPath)) {
    fs.rmSync(targetShmPath, { force: true });
    console.log(`[CLEANUP] Đã xóa tệp SHM cũ: ${targetShmPath}`);
  }

  // 9. Copy database file
  fs.copyFileSync(backupDbPath, targetDbPath);
  console.log(`[RESTORE] Đã khôi phục cơ sở dữ liệu -> ${targetDbPath}`);

  // 10. Copy culture content directory if present
  const backupContentPath = path.join(targetBackupDir, 'content');
  if (fs.existsSync(backupContentPath)) {
    if (!fs.existsSync(targetContentDir)) {
      fs.mkdirSync(targetContentDir, { recursive: true });
    }
    fs.cpSync(backupContentPath, targetContentDir, { recursive: true });
    console.log(`[RESTORE] Đã khôi phục nội dung văn hóa -> ${targetContentDir}`);
  }

  // 11. Verify restored database
  const restoredDb = new DatabaseSync(targetDbPath);
  const postIntegrity = restoredDb.prepare('PRAGMA integrity_check;').get();
  if (postIntegrity?.integrity_check !== 'ok') {
    restoredDb.close();
    throw new Error(`Kiểm tra sau khôi phục thất bại: ${postIntegrity?.integrity_check}`);
  }

  // Collect restored counts
  let looksCount = 0;
  let lookbookCount = 0;
  let revsCount = 0;
  try {
    looksCount = restoredDb.prepare('SELECT count(*) as count FROM looks').get()?.count || 0;
    lookbookCount = restoredDb.prepare('SELECT count(*) as count FROM lookbook').get()?.count || 0;
    revsCount = restoredDb.prepare('SELECT count(*) as count FROM look_revisions').get()?.count || 0;
  } catch {}
  restoredDb.close();

  // 12. Success -> Remove staging backup
  if (hasStagedData && fs.existsSync(stagingBackupDir)) {
    fs.rmSync(stagingBackupDir, { recursive: true, force: true });
  }

  console.log('\n=============================================================================');
  console.log('  KHÔI PHỤC DỮ LIỆU THÀNH CÔNG VÀ AN TOÀN TUYỆT ĐỐI!');
  console.log(`  - Looks: ${looksCount}`);
  console.log(`  - Lookbook: ${lookbookCount}`);
  console.log(`  - Revisions: ${revsCount}`);
  console.log('=============================================================================');
} catch (restoreError) {
  console.error('\n[LỖI TRONG QUÁ TRÌNH KHÔI PHỤC]', restoreError.message);
  if (hasStagedData && fs.existsSync(stagingBackupDir)) {
    console.warn('[ROLLBACK] Đang hoàn tác lại trạng thái cơ sở dữ liệu ban đầu từ staging backup...');
    try {
      const stagedDbFile = path.join(stagingBackupDir, targetDbName);
      if (fs.existsSync(stagedDbFile)) {
        fs.copyFileSync(stagedDbFile, targetDbPath);
      }
      const stagedWal = path.join(stagingBackupDir, `${targetDbName}-wal`);
      if (fs.existsSync(stagedWal)) {
        fs.copyFileSync(stagedWal, `${targetDbPath}-wal`);
      }
      const stagedShm = path.join(stagingBackupDir, `${targetDbName}-shm`);
      if (fs.existsSync(stagedShm)) {
        fs.copyFileSync(stagedShm, `${targetDbPath}-shm`);
      }
      fs.rmSync(stagingBackupDir, { recursive: true, force: true });
      console.log('[ROLLBACK] Hoàn tác thành công! Cơ sở dữ liệu đích được bảo toàn.');
    } catch (rbErr) {
      console.error('[ROLLBACK THẤT BẠI] Vui lòng kiểm tra thủ công tại:', stagingBackupDir);
    }
  }
  process.exit(1);
}
