import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

console.log('=== DÁNG VIỆT - SAO LƯU AN TOÀN SQLITE (SAFE BACKUP) ===');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.resolve('backups', `backup-${timestamp}`);
fs.mkdirSync(backupDir, { recursive: true });

const dbSrc = path.resolve(process.env.DATABASE_PATH || './data/dangviet.db');
const backupDbPath = path.join(backupDir, 'dangviet.db');

let dbStats = {
  looksCount: 0,
  lookbookCount: 0,
  revisionsCount: 0,
  cultureCardsCount: 0,
  schemaVersions: [],
};

// 1. Safe SQLite Backup using VACUUM INTO
if (fs.existsSync(dbSrc)) {
  console.log(`[BACKUP] Đang sao lưu SQLite từ: ${dbSrc}`);
  try {
    // Open source DB and execute VACUUM INTO for zero-downtime, crash-safe snapshot
    const sourceDb = new DatabaseSync(dbSrc);

    // Escape backslashes for Windows path in SQLite string literal
    const escapedBackupPath = backupDbPath.replace(/\\/g, '/');
    sourceDb.exec(`VACUUM INTO '${escapedBackupPath}';`);
    sourceDb.close();

    console.log(`[OK] VACUUM INTO hoàn thành -> ${backupDbPath}`);

    // Verify backup integrity with PRAGMA integrity_check
    const verifyDb = new DatabaseSync(backupDbPath);
    const integrityRow = verifyDb.prepare('PRAGMA integrity_check;').get();
    const integrityStatus = integrityRow?.integrity_check || 'unknown';

    if (integrityStatus !== 'ok') {
      verifyDb.close();
      throw new Error(`Kiểm tra toàn vẹn thất bại: ${integrityStatus}`);
    }
    console.log(`[OK] PRAGMA integrity_check: ${integrityStatus} (Cơ sở dữ liệu sao lưu hợp lệ)`);

    // Collect stats from verified backup
    try {
      const looks = verifyDb.prepare('SELECT count(*) as count FROM looks').get();
      dbStats.looksCount = looks?.count || 0;
      const lb = verifyDb.prepare('SELECT count(*) as count FROM lookbook').get();
      dbStats.lookbookCount = lb?.count || 0;
      const revs = verifyDb.prepare('SELECT count(*) as count FROM look_revisions').get();
      dbStats.revisionsCount = revs?.count || 0;
      const cc = verifyDb.prepare('SELECT count(*) as count FROM culture_cards').get();
      dbStats.cultureCardsCount = cc?.count || 0;
      const migs = verifyDb.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
      dbStats.schemaVersions = migs.map((m) => m.version);
    } catch (e) {
      console.warn(`[WARN] Không thể lấy đầy đủ thống kê bảng: ${e.message}`);
    }

    verifyDb.close();
  } catch (err) {
    console.error(`[ERROR] Không thể sao lưu an toàn cơ sở dữ liệu: ${err.message}`);
    process.exit(1);
  }
} else {
  console.log('[WARN] Không tìm thấy file SQLite chính tại data/dangviet.db, bỏ qua sao lưu DB.');
}

// 2. Backup Content directory
const contentSrc = path.resolve('content');
if (fs.existsSync(contentSrc)) {
  const contentDest = path.join(backupDir, 'content');
  fs.cpSync(contentSrc, contentDest, { recursive: true });
  console.log(`[OK] Đã sao lưu thư mục content -> ${contentDest}`);
}

// Helper to compute sha256 checksum
function computeFileSha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

// 3. Create Manifest
const manifestFiles = {};

if (fs.existsSync(backupDbPath)) {
  manifestFiles['dangviet.db'] = {
    size: fs.statSync(backupDbPath).size,
    sha256: computeFileSha256(backupDbPath),
  };
}

const manifest = {
  timestamp,
  app: 'dang-viet',
  version: '1.0.0',
  description: 'Dáng Việt system backup with SQLite VACUUM INTO and integrity verification',
  dbStats,
  files: manifestFiles,
  verifiedIntegrity: true,
};

fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`[OK] Đã tạo manifest.json ghi nhận cấu trúc và checksum`);

console.log(`\n[THÀNH CÔNG] Hoàn tất sao lưu hệ thống an toàn tại: ${backupDir}`);
