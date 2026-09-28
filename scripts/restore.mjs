import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

console.log('=== DÁNG VIỆT - PHỤC HỒI AN TOÀN HỆ THỐNG (SAFE RESTORE) ===');

// Parse CLI args: node scripts/restore.mjs [backup-path] [--target-dir <path>]
const args = process.argv.slice(2);
let backupDirInput = null;
let targetDirInput = path.resolve('data');
let targetContentDir = path.resolve('content');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--target-dir' && args[i + 1]) {
    targetDirInput = path.resolve(args[i + 1]);
    targetContentDir = path.join(targetDirInput, 'content');
    i++;
  } else if (!args[i].startsWith('--')) {
    backupDirInput = args[i];
  }
}

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
console.log(`[RESTORE] Thư mục đích: ${targetDirInput}`);

// 1. Check and verify manifest.json
const manifestPath = path.join(targetBackupDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('[FAIL] Không tìm thấy manifest.json trong bản sao lưu.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
console.log(`[MANIFEST] Phiên bản: ${manifest.version || 'unknown'} | Thời điểm: ${manifest.timestamp}`);

// 2. Verify database integrity before restoring
const backupDbPath = path.join(targetBackupDir, 'dangviet.db');
if (fs.existsSync(backupDbPath)) {
  console.log('[VERIFY] Kiểm tra tính toàn vẹn của tệp SQLite trong bản sao lưu...');
  try {
    const testDb = new DatabaseSync(backupDbPath);
    const integrityRow = testDb.prepare('PRAGMA integrity_check;').get();
    testDb.close();

    if (integrityRow?.integrity_check !== 'ok') {
      throw new Error(`PRAGMA integrity_check trả về: ${integrityRow?.integrity_check}`);
    }
    console.log('[OK] Tệp SQLite trong bản sao lưu hợp lệ (integrity_check: ok).');
  } catch (err) {
    console.error(`[FAIL] Tệp database trong bản sao lưu bị lỗi: ${err.message}`);
    process.exit(1);
  }
}

// 3. Check if target database is currently open/locked
const targetDbPath = path.join(targetDirInput, 'dangviet.db');
if (fs.existsSync(targetDbPath)) {
  try {
    // Attempt exclusive write access test
    const handle = fs.openSync(targetDbPath, 'r+');
    fs.closeSync(handle);
  } catch (err) {
    console.error(`[FAIL] Không thể ghi đè cơ sở dữ liệu đích tại ${targetDbPath}. Có thể server đang chạy hoặc tệp đang bị khóa.`);
    console.error(`Chi tiết lỗi: ${err.message}`);
    console.error('Vui lòng dừng server trước khi khôi phục hoặc dùng tham số --target-dir để khôi phục vào thư mục thử nghiệm.');
    process.exit(1);
  }
}

// 4. Perform restoration
if (!fs.existsSync(targetDirInput)) {
  fs.mkdirSync(targetDirInput, { recursive: true });
}

if (fs.existsSync(backupDbPath)) {
  fs.copyFileSync(backupDbPath, targetDbPath);
  console.log(`[OK] Đã phục hồi cơ sở dữ liệu -> ${targetDbPath}`);
}

const backupContentPath = path.join(targetBackupDir, 'content');
if (fs.existsSync(backupContentPath)) {
  if (!fs.existsSync(targetContentDir)) {
    fs.mkdirSync(targetContentDir, { recursive: true });
  }
  fs.cpSync(backupContentPath, targetContentDir, { recursive: true });
  console.log(`[OK] Đã phục hồi nội dung văn hóa -> ${targetContentDir}`);
}

console.log(`\n[THÀNH CÔNG] Đã phục hồi hoàn tất dữ liệu từ ${targetBackupDir} vào ${targetDirInput}`);
