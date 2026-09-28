import fs from 'node:fs';
import path from 'node:path';

console.log('--- DÁNG VIỆT - PHỤC HỒI HỆ THỐNG (RESTORE) ---');

const backupsDir = path.resolve('backups');
if (!fs.existsSync(backupsDir)) {
  console.error('[FAIL] Thư mục backups không tồn tại.');
  process.exit(1);
}

// Find target backup
const targetArg = process.argv[2];
let targetBackupDir = '';

if (targetArg) {
  targetBackupDir = path.resolve(targetArg);
} else {
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

console.log(`[RESTORE] Đang phục hồi từ: ${targetBackupDir}`);

// 1. Restore database
const backupDb = path.join(targetBackupDir, 'dangviet.db');
if (fs.existsSync(backupDb)) {
  const destDir = path.resolve('data');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(backupDb, path.join(destDir, 'dangviet.db'));
  console.log('[OK] Đã phục hồi tệp database data/dangviet.db');
}

// 2. Restore content
const backupContent = path.join(targetBackupDir, 'content');
if (fs.existsSync(backupContent)) {
  fs.cpSync(backupContent, path.resolve('content'), { recursive: true });
  console.log('[OK] Đã phục hồi thư mục content/');
}

console.log('\n[THÀNH CÔNG] Quá trình phục hồi hoàn tất!');
