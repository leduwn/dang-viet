import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { getAppConfig, validateRequiredPaths } from './config.mjs';

console.log('=== DÁNG VIỆT - SAO LƯU AN TOÀN SQLITE (SAFE BACKUP) ===');

const config = getAppConfig();
try {
  validateRequiredPaths(config);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupsRootDir = process.env.BACKUPS_ROOT_DIR
  ? path.resolve(process.env.BACKUPS_ROOT_DIR)
  : path.join(config.projectRoot, 'backups');
const backupDir = path.join(backupsRootDir, `backup-${timestamp}`);
fs.mkdirSync(backupDir, { recursive: true });

const dbSrc = config.databasePath;
const backupDbPath = path.join(backupDir, 'dangviet.db');

if (!fs.existsSync(dbSrc)) {
  console.error(`[FAIL] Không tìm thấy tệp cơ sở dữ liệu chính tại: ${dbSrc}`);
  console.error('Không thể tạo bản sao lưu khi chưa có cơ sở dữ liệu. Dừng thực hiện.');
  try {
    fs.rmSync(backupDir, { recursive: true, force: true });
  } catch {}
  process.exit(1);
}

let dbStats = {
  looksCount: 0,
  lookbookCount: 0,
  revisionsCount: 0,
  cultureCardsCount: 0,
  schemaVersions: [],
};

// 1. Safe SQLite Backup using VACUUM INTO
console.log(`[BACKUP] Đang sao lưu SQLite từ: ${dbSrc}`);
try {
  const sourceDb = new DatabaseSync(dbSrc);

  // Normalize path and escape single quotes for SQLite string literal
  const escapedBackupPath = backupDbPath.replace(/\\/g, '/').replace(/'/g, "''");
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
  try {
    fs.rmSync(backupDir, { recursive: true, force: true });
  } catch {}
  process.exit(1);
}

// 2. Backup Content directory
const contentSrc = config.contentDir;
const contentDest = path.join(backupDir, 'content');
fs.cpSync(contentSrc, contentDest, { recursive: true });
console.log(`[OK] Đã sao lưu thư mục content -> ${contentDest}`);

// Helper to compute sha256 checksum
function computeFileSha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

// 3. Create Manifest with checksums for database and all content files
const manifestFiles = {
  'dangviet.db': {
    size: fs.statSync(backupDbPath).size,
    sha256: computeFileSha256(backupDbPath),
  },
};

const contentFiles = fs.readdirSync(contentDest).filter((f) => fs.statSync(path.join(contentDest, f)).isFile());
for (const f of contentFiles) {
  const fPath = path.join(contentDest, f);
  manifestFiles[`content/${f}`] = {
    size: fs.statSync(fPath).size,
    sha256: computeFileSha256(fPath),
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
console.log(`[OK] Đã tạo manifest.json ghi nhận cấu trúc và checksum (bao gồm ${contentFiles.length} file content)`);

console.log(`\n[THÀNH CÔNG] Hoàn tất sao lưu hệ thống an toàn tại: ${backupDir}`);
