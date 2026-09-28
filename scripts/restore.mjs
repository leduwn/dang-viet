import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { getAppConfig } from './config.mjs';

console.log('=== DÁNG VIỆT - PHỤC HỒI AN TOÀN HỆ THỐNG (ISOLATED RESTORE) ===\n');

// 1. Parse CLI arguments
const args = process.argv.slice(2);
let backupDirInput = null;
let explicitTargetDir = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--force') {
    console.error('=============================================================================');
    console.error('[TỪ CHỐI] Tùy chọn --force không được hỗ trợ!');
    console.error('Để bảo vệ an toàn dữ liệu, hệ thống không cho phép bỏ qua các kiểm tra an toàn.');
    console.error('=============================================================================');
    process.exit(1);
  } else if (args[i] === '--target-dir' && args[i + 1]) {
    explicitTargetDir = path.resolve(args[i + 1]);
    i++;
  } else if (!args[i].startsWith('--')) {
    backupDirInput = args[i];
  }
}

const config = getAppConfig();
const activeDbPath = config.databasePath;
const activeDbDir = path.dirname(activeDbPath);

// Helper for canonical path comparison (resolving symlinks and junctions on Windows)
function getCanonicalPath(p) {
  const resolved = path.resolve(p);
  if (fs.existsSync(resolved)) {
    try {
      return fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
    } catch {
      return path.normalize(resolved).toLowerCase();
    }
  }
  return path.normalize(resolved).toLowerCase();
}

// 2. Locate Backup Directory
const backupsRootDir = path.join(config.projectRoot, 'backups');
let targetBackupDir = '';

if (backupDirInput) {
  targetBackupDir = path.resolve(backupDirInput);
} else {
  if (!fs.existsSync(backupsRootDir)) {
    console.error(`[FAIL] Thư mục backups không tồn tại tại: ${backupsRootDir}`);
    process.exit(1);
  }

  const dirs = fs
    .readdirSync(backupsRootDir)
    .filter((d) => fs.statSync(path.join(backupsRootDir, d)).isDirectory() && d.startsWith('backup-'))
    .sort()
    .reverse();

  if (dirs.length === 0) {
    console.error('[FAIL] Không tìm thấy bản sao lưu nào trong thư mục backups.');
    process.exit(1);
  }
  targetBackupDir = path.join(backupsRootDir, dirs[0]);
}

if (!fs.existsSync(targetBackupDir)) {
  console.error(`[FAIL] Bản sao lưu không tồn tại: ${targetBackupDir}`);
  process.exit(1);
}

console.log(`[RESTORE] Nguồn sao lưu: ${targetBackupDir}`);

// 3. Determine Target Directory (Default to a new dedicated folder)
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const targetDir = explicitTargetDir || path.join(config.projectRoot, 'restored', `restore-${timestamp}`);

console.log(`[RESTORE] Thư mục đích:  ${targetDir}`);

// 4. Strict Safety Checks
const canonicalTarget = getCanonicalPath(targetDir);
const canonicalActiveDbDir = getCanonicalPath(activeDbDir);
const canonicalActiveDbPath = getCanonicalPath(activeDbPath);
const canonicalBackupSource = getCanonicalPath(targetBackupDir);

// Check A: Target matches active DB directory
if (canonicalTarget === canonicalActiveDbDir) {
  console.error('=============================================================================');
  console.error('[TỪ CHỐI] THƯ MỤC ĐÍCH TRÙNG VỚI THƯ MỤC DATABASE ĐANG HOẠT ĐỘNG!');
  console.error(`Thư mục active: ${activeDbDir}`);
  console.error('Restore chỉ được phép khôi phục ra một thư mục riêng biệt mới hoàn toàn.');
  console.error('=============================================================================');
  process.exit(1);
}

// Check B: Target would overwrite active DB file
const targetDbFile = path.join(targetDir, 'dangviet.db');
if (getCanonicalPath(targetDbFile) === canonicalActiveDbPath) {
  console.error('=============================================================================');
  console.error('[TỪ CHỐI] ĐƯỜNG DẪN ĐÍCH GÂY GHI ĐÈ FILE DATABASE ĐANG DÙNG CỦA HỆ THỐNG!');
  console.error(`Tệp active: ${activeDbPath}`);
  console.error('Restore không được phép ghi đè database chính hoặc xóa tệp WAL/SHM.');
  console.error('=============================================================================');
  process.exit(1);
}

// Check C: Target matches backup source directory
if (canonicalTarget === canonicalBackupSource) {
  console.error('=============================================================================');
  console.error('[TỪ CHỐI] THƯ MỤC ĐÍCH TRÙNG VỚI CHÍNH THƯ MỤC BẢN SAO LƯU NGUỒN!');
  console.error(`Thư mục backup nguồn: ${targetBackupDir}`);
  console.error('=============================================================================');
  process.exit(1);
}

// Check D: Target directory must not already contain files
if (fs.existsSync(targetDir)) {
  const existingFiles = fs.readdirSync(targetDir);
  if (existingFiles.length > 0) {
    console.error('=============================================================================');
    console.error('[TỪ CHỐI] THƯ MỤC ĐÍCH ĐÃ CÓ SẴN DỮ LIỆU!');
    console.error(`Thư mục "${targetDir}" hiện chứa ${existingFiles.length} tệp/thư mục con.`);
    console.error('Để tránh ghi đè dữ liệu, hãy chọn một thư mục mới hoàn toàn trống.');
    console.error('=============================================================================');
    process.exit(1);
  }
}

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

// 6. Verify backup database file & SHA-256
const backupDbPath = path.join(targetBackupDir, 'dangviet.db');
if (!fs.existsSync(backupDbPath)) {
  console.error(`[FAIL] Không tìm thấy tệp dangviet.db trong bản sao lưu: ${backupDbPath}`);
  process.exit(1);
}

console.log('[VERIFY 1/3] Kiểm tra mã băm SHA-256 của tệp sao lưu SQLite...');
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
  console.error('=============================================================================');
  process.exit(1);
}
console.log(`[OK] Mã băm SHA-256 của cơ sở dữ liệu khớp chuẩn xác (${actualHash.slice(0, 16)}...)`);

console.log('[VERIFY 2/3] Kiểm tra cấu trúc SQLite của file backup (PRAGMA integrity_check)...');
try {
  const testDb = new DatabaseSync(backupDbPath, { readOnly: true });
  const integrityRow = testDb.prepare('PRAGMA integrity_check;').get();
  testDb.close();

  if (integrityRow?.integrity_check !== 'ok') {
    throw new Error(`PRAGMA integrity_check trả về: ${integrityRow?.integrity_check}`);
  }
  console.log('[OK] Tệp SQLite trong bản sao lưu hợp lệ (integrity_check: ok).');
} catch (err) {
  console.error(`[FAIL] Kiểm tra cấu trúc SQLite của file sao lưu thất bại: ${err.message}`);
  process.exit(1);
}

// 7. Verify Content files listed in manifest
console.log('[VERIFY 3/3] Kiểm tra các tệp content trong bản sao lưu...');
let verifiedContentCount = 0;
if (manifest.files) {
  for (const [relPath, meta] of Object.entries(manifest.files)) {
    if (relPath.startsWith('content/')) {
      const fullPath = path.join(targetBackupDir, relPath);
      if (!fs.existsSync(fullPath)) {
        console.error(`[FAIL] Thiếu tệp content được liệt kê trong manifest: ${relPath}`);
        process.exit(1);
      }
      if (meta?.sha256) {
        const hash = computeFileSha256(fullPath);
        if (hash !== meta.sha256) {
          console.error(`[FAIL] Tệp content ${relPath} bị sai mã băm SHA-256!`);
          process.exit(1);
        }
      }
      verifiedContentCount++;
    }
  }
}
console.log(`[OK] Đã xác minh tính hợp lệ của ${verifiedContentCount} tệp content`);

// 8. Staging Restore Process
const stagingParentDir = path.dirname(targetDir);
if (!fs.existsSync(stagingParentDir)) {
  fs.mkdirSync(stagingParentDir, { recursive: true });
}

const stagingId = `staging_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const stagingDir = path.join(stagingParentDir, `.${stagingId}`);
fs.mkdirSync(stagingDir, { recursive: true });
console.log(`[STAGING] Khởi tạo thư mục kiểm thử staging: ${stagingDir}`);

try {
  // A. Copy database to staging
  const stagingDbPath = path.join(stagingDir, 'dangviet.db');
  fs.copyFileSync(backupDbPath, stagingDbPath);

  // B. Copy content directory to staging
  const backupContentDir = path.join(targetBackupDir, 'content');
  if (fs.existsSync(backupContentDir)) {
    const stagingContentDir = path.join(stagingDir, 'content');
    fs.cpSync(backupContentDir, stagingContentDir, { recursive: true });
  }

  // C. Verify staging database integrity
  const stagingDb = new DatabaseSync(stagingDbPath, { readOnly: true });
  const check = stagingDb.prepare('PRAGMA integrity_check;').get();
  if (check?.integrity_check !== 'ok') {
    stagingDb.close();
    throw new Error(`Kiểm tra integrity trên staging thất bại: ${check?.integrity_check}`);
  }

  let stagingLooks = 0;
  let stagingCards = 0;
  try {
    stagingLooks = stagingDb.prepare('SELECT count(*) as count FROM looks').get()?.count || 0;
    stagingCards = stagingDb.prepare('SELECT count(*) as count FROM culture_cards').get()?.count || 0;
  } catch {}
  stagingDb.close();

  // D. Copy manifest to staging for record
  fs.copyFileSync(manifestPath, path.join(stagingDir, 'manifest.json'));

  // E. Promote staging to final target directory
  if (fs.existsSync(targetDir)) {
    // If empty dir was pre-created, move items inside
    for (const item of fs.readdirSync(stagingDir)) {
      fs.renameSync(path.join(stagingDir, item), path.join(targetDir, item));
    }
    fs.rmdirSync(stagingDir);
  } else {
    fs.renameSync(stagingDir, targetDir);
  }

  console.log('\n=============================================================================');
  console.log('  PHỤC HỒI DỮ LIỆU RA THƯ MỤC MỚI THÀNH CÔNG!');
  console.log(`  - Thư mục phục hồi: ${targetDir}`);
  console.log(`  - Database:         ${path.join(targetDir, 'dangviet.db')}`);
  console.log(`  - Content:          ${path.join(targetDir, 'content')}`);
  console.log(`  - Số bộ phối (looks): ${stagingLooks}`);
  console.log(`  - Thẻ văn hóa:        ${stagingCards}`);
  console.log('=============================================================================');
} catch (err) {
  console.error('\n[LỖI TRONG QUÁ TRÌNH PHỤC HỒI STAGING]:', err.message);
  // Clean up ONLY staging directory created by this specific run
  if (fs.existsSync(stagingDir)) {
    console.log(`[CLEANUP] Đang dọn dẹp thư mục staging của lượt chạy này: ${stagingDir}`);
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    } catch {}
  }
  process.exit(1);
}
