import fs from 'node:fs';
import path from 'node:path';

console.log('--- DÁNG VIỆT - SAO LƯU HỆ THỐNG (BACKUP) ---');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.resolve('backups', `backup-${timestamp}`);
fs.mkdirSync(backupDir, { recursive: true });

// 1. Backup SQLite database
const dbSrc = path.resolve('data/dangviet.db');
if (fs.existsSync(dbSrc)) {
  fs.copyFileSync(dbSrc, path.join(backupDir, 'dangviet.db'));
  console.log(`[OK] Đã sao lưu database -> ${path.join(backupDir, 'dangviet.db')}`);
} else {
  console.log('[WARN] Chưa có tệp database để sao lưu');
}

// 2. Backup content directory
const contentSrc = path.resolve('content');
const contentDest = path.join(backupDir, 'content');
fs.cpSync(contentSrc, contentDest, { recursive: true });
console.log(`[OK] Đã sao lưu content -> ${contentDest}`);

// Write manifest
const manifest = {
  timestamp,
  version: '1.0.0',
  description: 'Dáng Việt system backup',
};
fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\n[THÀNH CÔNG] Bản sao lưu đã lưu tại: ${backupDir}`);
