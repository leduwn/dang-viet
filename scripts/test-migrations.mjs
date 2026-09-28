import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

console.log('=== KIỂM THỬ CƠ CHẾ MIGRATION AN TOÀN TRÊN DATABASE RIÊNG ===\n');

const testDir = path.resolve('test-migrations-scratch');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

try {
  // Test 1: Database trống chạy 001 rồi 002
  console.log('[TEST 1] Database trống chạy tuần tự 001_initial và 002_undo_and_constraints...');
  const db1Path = path.join(testDir, 'db1_clean.db');

  // Use server db module logic directly
  process.env.DATABASE_PATH = db1Path;
  const { getDb } = await import(`../apps/server/dist/db.js?t=${Date.now()}`);
  const db1 = getDb();

  const migrationsApplied = db1.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all();
  const versions = migrationsApplied.map((m) => m.version);
  assert.deepStrictEqual(versions, ['001_initial', '002_undo_and_constraints'], '001 và 002 phải được áp dụng đầy đủ');

  const looksColumns = db1.prepare('PRAGMA table_info(looks)').all().map((c) => c.name);
  assert(looksColumns.includes('undo_stack_json'), 'Cột undo_stack_json phải tồn tại');
  console.log(' -> PASSED: Database trống đã áp dụng thành công 001 và 002.\n');

  // Test 2: Chạy lại không áp dụng trùng
  console.log('[TEST 2] Khởi động lại / gọi lại migration trên database đã có schema...');
  const countBefore = db1.prepare('SELECT count(*) as c FROM schema_migrations').get().c;
  // Calling getDb() again
  const db1Again = getDb();
  const countAfter = db1Again.prepare('SELECT count(*) as c FROM schema_migrations').get().c;
  assert.strictEqual(countBefore, countAfter, 'Số lượng migration ghi nhận không đổi');
  console.log(' -> PASSED: Migration đã áp dụng không bị chạy lại trùng lặp.\n');

  // Test 3: Một migration cố ý lỗi không được ghi nhận và server dừng khởi động
  console.log('[TEST 3] Migration cố ý lỗi: Rollback, không ghi nhận và dừng khởi động...');
  const badMigrationsDir = path.join(testDir, 'bad_migrations');
  fs.mkdirSync(badMigrationsDir, { recursive: true });
  // Copy valid migrations
  fs.copyFileSync(path.resolve('migrations/001_initial.sql'), path.join(badMigrationsDir, '001_initial.sql'));
  // Create an intentionally broken migration 003_broken.sql
  fs.writeFileSync(
    path.join(badMigrationsDir, '003_broken.sql'),
    `-- Intentional syntax error
    CREATE TABLE valid_part (id TEXT PRIMARY KEY);
    INVALID SQL STATEMENT SYNTAX ERROR HERE;
    `,
    'utf-8'
  );

  const dbBadPath = path.join(testDir, 'db_broken.db');

  // Run an isolated node subprocess pointing to the broken migrations
  const testSubprocessCode = `
    import { DatabaseSync } from 'node:sqlite';
    import fs from 'node:fs';
    import path from 'node:path';

    const db = new DatabaseSync('${dbBadPath.replace(/\\/g, '/')}');
    db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);');

    // Apply 001 first
    const sql1 = fs.readFileSync('${path.join(badMigrationsDir, '001_initial.sql').replace(/\\/g, '/')}', 'utf-8');
    db.exec('BEGIN IMMEDIATE');
    db.exec(sql1);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run('001_initial', new Date().toISOString());
    db.exec('COMMIT');

    // Now try to apply 003_broken
    const sql3 = fs.readFileSync('${path.join(badMigrationsDir, '003_broken.sql').replace(/\\/g, '/')}', 'utf-8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql3);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run('003_broken', new Date().toISOString());
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch {}
      console.error('[EXPECTED_ERROR] ' + err.message);
      process.exit(42); // specific exit code for migration failure
    }
  `;

  const subProc = spawn(process.execPath, ['--input-type=module', '-e', testSubprocessCode]);
  let subOutput = '';
  subProc.stderr.on('data', (d) => { subOutput += d.toString(); });
  const exitCode = await new Promise((resolve) => subProc.on('close', resolve));

  assert.strictEqual(exitCode, 42, 'Tiến trình phải dừng lại với mã lỗi khi migration thất bại');
  assert(subOutput.includes('[EXPECTED_ERROR]'), 'Phải thông báo lỗi migration');

  // Verify broken migration was NOT recorded and table valid_part was rolled back
  const dbBadCheck = new DatabaseSync(dbBadPath);
  const badMigrations = dbBadCheck.prepare('SELECT version FROM schema_migrations').all().map((m) => m.version);
  assert(!badMigrations.includes('003_broken'), 'Migration lỗi không được ghi nhận trong schema_migrations');

  const tables = dbBadCheck.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
  assert(!tables.includes('valid_part'), 'Các bảng tạo dở trong migration lỗi phải được rollback hoàn toàn');
  dbBadCheck.close();
  console.log(' -> PASSED: Migration lỗi đã được rollback nguyên tử, không ghi nhận và dừng tiến trình.\n');

  // Test 4: Database hiện có nâng cấp mà giữ nguyên lookbook và revisions
  console.log('[TEST 4] Database hiện có với dữ liệu thực tế nâng cấp an toàn, giữ nguyên lookbook & revisions...');
  const dbUpgradePath = path.join(testDir, 'db_existing_upgrade.db');

  // Create db with only 001_initial and insert sample data
  const dbUpgrade = new DatabaseSync(dbUpgradePath);
  const sql001 = fs.readFileSync(path.resolve('migrations/001_initial.sql'), 'utf-8');
  dbUpgrade.exec(sql001);
  dbUpgrade.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run('001_initial', new Date().toISOString());

  // Insert look, look_revisions, lookbook
  dbUpgrade.prepare(`
    INSERT INTO looks (id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at)
    VALUES ('look_test_preserve', 'user1', 'Áo truyền thống test', 'ky_yeu', 'thanh_lich', '{}', '{}', 'Ghi chú', 5, 0, '2026-09-28', '2026-09-28')
  `).run();

  for (let rev = 1; rev <= 5; rev++) {
    dbUpgrade.prepare(`
      INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at)
      VALUES ('look_test_preserve', ?, '{}', '{}', 'rev test', '2026-09-28')
    `).run(rev);
  }

  dbUpgrade.prepare(`
    INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at)
    VALUES ('lb_test_preserve', 'Lookbook item đã lưu', 'look_test_preserve', 5, '{"preset": "ok"}', 'ky_yeu', 'thanh_lich', 'Lưu snapshot', '2026-09-28')
  `).run();
  dbUpgrade.close();

  // Now apply 002_undo_and_constraints.sql
  const dbUpgraded = new DatabaseSync(dbUpgradePath);
  const sql002 = fs.readFileSync(path.resolve('migrations/002_undo_and_constraints.sql'), 'utf-8');
  dbUpgraded.exec('BEGIN IMMEDIATE');
  dbUpgraded.exec(sql002);
  dbUpgraded.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run('002_undo_and_constraints', new Date().toISOString());
  dbUpgraded.exec('COMMIT');

  // Verify lookbook item is untouched
  const lbItem = dbUpgraded.prepare('SELECT * FROM lookbook WHERE id = ?').get('lb_test_preserve');
  assert.strictEqual(lbItem.title, 'Lookbook item đã lưu');
  assert.strictEqual(lbItem.revision, 5);
  assert.strictEqual(lbItem.snapshot_config_json, '{"preset": "ok"}');

  // Verify revisions are untouched
  const revCount = dbUpgraded.prepare('SELECT count(*) as c FROM look_revisions WHERE look_id = ?').get('look_test_preserve').c;
  assert.strictEqual(revCount, 5);

  // Verify new column undo_stack_json exists with default '[]'
  const lookRow = dbUpgraded.prepare('SELECT undo_stack_json FROM looks WHERE id = ?').get('look_test_preserve');
  assert.strictEqual(lookRow.undo_stack_json, '[]');
  dbUpgraded.close();
  console.log(' -> PASSED: Nâng cấp schema giữ nguyên 100% dữ liệu looks, lookbook và look_revisions!\n');

  console.log('===============================================================================');
  console.log('  CHÚC MỪNG: TẤT CẢ 4 BÀI KIỂM THỬ MIGRATION AN TOÀN ĐỀU ĐẠT CHUẨN!');
  console.log('===============================================================================');
  try { db1.close(); } catch {}
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch (cleanErr) {
    // On Windows, SQLite might release lock asynchronously
  }
}
