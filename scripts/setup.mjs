import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { getAppConfig, validateRequiredPaths } from './config.mjs';

console.log('--- DÁNG VIỆT - THIẾT LẬP CƠ SỞ DỮ LIỆU & DỮ LIỆU SEED (SETUP) ---');

const config = getAppConfig();
try {
  validateRequiredPaths(config);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// 0. Ensure shared packages (contracts, domain) are built
const contractsDist = path.join(config.projectRoot, 'packages', 'contracts', 'dist', 'index.js');
const domainDist = path.join(config.projectRoot, 'packages', 'domain', 'dist', 'index.js');
if (!fs.existsSync(contractsDist) || !fs.existsSync(domainDist)) {
  console.log('[SETUP] Đang biên dịch các gói dùng chung (@dangviet/contracts, @dangviet/domain)...');
  try {
    execSync('npm run build:packages', { cwd: config.projectRoot, stdio: 'inherit' });
    console.log('[OK] Đã biên dịch xong packages.');
  } catch (err) {
    console.error('[FAIL] Không thể biên dịch packages:', err.message);
    process.exit(1);
  }
}

const dataDir = path.dirname(config.databasePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`[OK] Đã tạo thư mục lưu trữ: ${dataDir}`);
}

const dbPath = config.databasePath;
const db = new DatabaseSync(dbPath);
console.log(`[OK] Kết nối SQLite: ${dbPath}`);

// 1. Run migrations
const migrationsDir = config.migrationsDir;
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

// Create schema_migrations table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

const appliedVersions = new Set(
  db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version)
);

for (const file of files) {
  const version = path.basename(file, '.sql');
  if (!appliedVersions.has(version)) {
    console.log(`[MIGRATION] Áp dụng ${file}...`);
    db.exec('BEGIN IMMEDIATE');
    try {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        version,
        new Date().toISOString()
      );
      db.exec('COMMIT');
      console.log(`[OK] Đã áp dụng migration: ${version}`);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {}
      console.error(`[FAIL] Lỗi khi áp dụng migration ${file}: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log(`[SKIP] Migration ${version} đã được áp dụng trước đó`);
  }
}

// 2. Seed culture cards
const cultureCardsFile = path.join(config.contentDir, 'culture-cards.json');
if (fs.existsSync(cultureCardsFile)) {
  const cards = JSON.parse(fs.readFileSync(cultureCardsFile, 'utf-8'));
  const upsertStmt = db.prepare(`
    INSERT INTO culture_cards (
      id, slug, title, category, summary, content, source_name, source_author, source_url, source_evidence, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      summary = excluded.summary,
      content = excluded.content,
      source_name = excluded.source_name,
      source_author = excluded.source_author,
      source_url = excluded.source_url,
      source_evidence = excluded.source_evidence,
      status = excluded.status;
  `);

  for (const c of cards) {
    upsertStmt.run(
      c.id,
      c.slug,
      c.title,
      c.category,
      c.summary,
      c.content,
      c.sourceName,
      c.sourceAuthor,
      c.sourceUrl || '',
      c.sourceEvidence,
      c.status || 'review',
      c.createdAt || new Date().toISOString()
    );
  }
  console.log(`[OK] Đã nạp ${cards.length} thẻ kiến thức văn hóa vào cơ sở dữ liệu`);
}

// 3. Seed default initial look if looks table empty
const looksCount = db.prepare('SELECT COUNT(*) as cnt FROM looks').get().cnt;
if (looksCount === 0) {
  console.log('[SEED] Khởi tạo bộ phối mẫu đầu tiên...');
  const presets = JSON.parse(fs.readFileSync(path.resolve('content/presets.json'), 'utf-8'));
  const firstPreset = presets[0];

  const defaultLookId = 'look_default_01';
  const now = new Date().toISOString();
  const locks = {
    primaryColor: false,
    pantsColor: false,
    collarStyle: false,
    sleeveStyle: false,
    fabric: false,
    pattern: false,
    accessories: false,
  };

  db.prepare(`
    INSERT INTO looks (
      id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    defaultLookId,
    'default_user',
    firstPreset.title,
    firstPreset.eventId,
    firstPreset.styleId,
    JSON.stringify(firstPreset.config),
    JSON.stringify(locks),
    firstPreset.explanation,
    1,
    0,
    now,
    now
  );

  db.prepare(`
    INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    defaultLookId,
    1,
    JSON.stringify(firstPreset.config),
    JSON.stringify(locks),
    firstPreset.explanation,
    now
  );

  console.log(`[OK] Đã tạo bộ phối mẫu ban đầu ID: ${defaultLookId}`);
}

console.log('\n[KẾT QUẢ] Quá trình thiết lập hoàn tất thành công!');
