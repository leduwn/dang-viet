import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  type Look,
  type LookbookItem,
  type CultureCard,
  type CommandPayload,
  type CommandResult,
  LookSchema,
} from '@dangviet/contracts';
import { executeCommand } from '@dangviet/domain';
import { getAppConfig } from './config.js';

let dbInstance: DatabaseSync | null = null;

export function runPendingMigrations(db: DatabaseSync, migrationsDir: string): void {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>;
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`[MIGRATION ERROR] Không tìm thấy thư mục migration tại: ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const version = path.basename(file, '.sql');
    if (!appliedVersions.has(version)) {
      console.log(`[MIGRATION] Bắt đầu áp dụng migration: ${file}...`);
      db.exec('BEGIN IMMEDIATE');
      try {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
          version,
          new Date().toISOString()
        );
        db.exec('COMMIT');
        console.log(`[MIGRATION] Áp dụng thành công: ${file}`);
      } catch (err: any) {
        try {
          db.exec('ROLLBACK');
        } catch (rollbackErr: any) {
          console.error(`[MIGRATION] Lỗi khi rollback migration ${file}:`, rollbackErr.message);
        }
        const failMessage = `[MIGRATION ERROR] Thất bại khi áp dụng migration "${file}": ${err.message}. Dừng khởi động hệ thống để bảo vệ dữ liệu.`;
        console.error(failMessage);
        throw new Error(failMessage);
      }
    }
  }
}

function syncCultureCardsFromDisk(db: DatabaseSync, contentDir: string): void {
  const cardsFile = path.join(contentDir, 'culture-cards.json');
  if (!fs.existsSync(cardsFile)) {
    console.warn(`[WARN] Không tìm thấy tệp culture-cards.json tại ${cardsFile}`);
    return;
  }

  try {
    const raw = fs.readFileSync(cardsFile, 'utf-8');
    const cards = JSON.parse(raw);
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
  } catch (err: any) {
    console.error('[DB] Lỗi đồng bộ thẻ văn hóa:', err.message);
  }
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  const config = getAppConfig();
  const resolvedPath = config.databasePath;
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  dbInstance = new DatabaseSync(resolvedPath);
  runPendingMigrations(dbInstance, config.migrationsDir);
  syncCultureCardsFromDisk(dbInstance, config.contentDir);
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
}

export interface LookRow {
  id: string;
  user_id: string;
  title: string;
  event_id: string;
  style_id: string;
  config_json: string;
  locks_json: string;
  explanation: string;
  revision: number;
  is_design: number;
  created_at: string;
  updated_at: string;
  undo_stack_json?: string;
}

export function rowToLook(row: LookRow): Look {
  return {
    id: row.id,
    title: row.title,
    eventId: row.event_id as any,
    styleId: row.style_id as any,
    config: JSON.parse(row.config_json),
    locks: JSON.parse(row.locks_json),
    explanation: row.explanation,
    revision: row.revision,
    isDesign: Boolean(row.is_design),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const dbRepo = {
  getLook(id: string): Look | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM looks WHERE id = ?').get(id) as LookRow | undefined;
    if (!row) return null;
    return rowToLook(row);
  },

  hasCommand(commandId: string): boolean {
    const db = getDb();
    const row = db.prepare('SELECT id FROM commands WHERE id = ?').get(commandId);
    return Boolean(row);
  },

  createLook(look: Look): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO looks (
        id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at, undo_stack_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      look.id,
      'default_user',
      look.title,
      look.eventId,
      look.styleId,
      JSON.stringify(look.config),
      JSON.stringify(look.locks),
      look.explanation,
      look.revision,
      look.isDesign ? 1 : 0,
      look.createdAt,
      look.updatedAt,
      JSON.stringify([])
    );

    // Save initial revision
    db.prepare(`
      INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      look.id,
      look.revision,
      JSON.stringify(look.config),
      JSON.stringify(look.locks),
      look.explanation,
      look.updatedAt
    );
  },

  /**
   * Execute command in a single atomic transaction:
   * 1. Check duplicate commandId -> reject 409 DUPLICATE_COMMAND_ID
   * 2. Read look state within transaction
   * 3. Check expectedRevision -> reject 409 REVISION_CONFLICT
   * 4. Execute domain logic
   * 5. Push previous state onto undo stack
   * 6. Write look, look_revision, command in the same transaction
   */
  executeCommandTransaction(
    lookId: string,
    command: CommandPayload
  ): { ok: true; result: CommandResult } | { ok: false; statusCode: number; error: string; code?: string; currentRevision?: number } {
    const db = getDb();
    db.exec('BEGIN IMMEDIATE');

    try {
      // 1. Duplicate check (Idempotency / Replay protection)
      const existingCmd = db.prepare('SELECT id, revision FROM commands WHERE id = ?').get(command.commandId) as any;
      if (existingCmd) {
        db.exec('ROLLBACK');
        return {
          ok: false,
          statusCode: 409,
          code: 'DUPLICATE_COMMAND_ID',
          error: `Lệnh đã được thực thi trước đó (Trùng lặp Command ID: ${command.commandId})`,
        };
      }

      // 2. Read current state fresh from DB inside transaction
      const row = db.prepare('SELECT * FROM looks WHERE id = ?').get(lookId) as LookRow | undefined;
      if (!row) {
        db.exec('ROLLBACK');
        return {
          ok: false,
          statusCode: 404,
          code: 'LOOK_NOT_FOUND',
          error: 'Không tìm thấy bộ phối',
        };
      }

      const currentLook = rowToLook(row);

      // 3. Concurrency check: expectedRevision must match current revision
      if (command.expectedRevision !== currentLook.revision) {
        db.exec('ROLLBACK');
        return {
          ok: false,
          statusCode: 409,
          code: 'REVISION_CONFLICT',
          currentRevision: currentLook.revision,
          error: `Xung đột phiên bản: Lệnh yêu cầu revision ${command.expectedRevision} nhưng phiên bản hiện tại trong cơ sở dữ liệu là ${currentLook.revision}. Hãy tải lại trạng thái mới nhất.`,
        };
      }

      // 4. Pure domain execution
      const execution = executeCommand(currentLook, command);
      if (!execution.ok) {
        db.exec('ROLLBACK');
        return {
          ok: false,
          statusCode: execution.statusCode,
          code: execution.code || 'DOMAIN_RULE_VIOLATION',
          error: execution.error,
        };
      }

      const updatedLook = execution.result.look;

      // 4b. Validate resulting Look state before writing to DB
      const lookValidation = LookSchema.safeParse(updatedLook);
      if (!lookValidation.success) {
        db.exec('ROLLBACK');
        return {
          ok: false,
          statusCode: 400,
          code: 'INVALID_RESULTING_LOOK',
          error: 'Cấu hình bộ phối kết quả không hợp lệ theo chuẩn schema',
        };
      }

      // 5. Update Undo Stack: Push previous state snapshot
      let undoStack: any[] = [];
      try {
        if (row.undo_stack_json) {
          undoStack = JSON.parse(row.undo_stack_json);
        }
      } catch {}

      undoStack.push({
        config: currentLook.config,
        locks: currentLook.locks,
        explanation: currentLook.explanation,
        title: currentLook.title,
        eventId: currentLook.eventId,
        styleId: currentLook.styleId,
      });

      // Keep max 50 undo steps
      if (undoStack.length > 50) {
        undoStack.shift();
      }

      // 6. Persist look update
      db.prepare(`
        UPDATE looks SET
          title = ?,
          event_id = ?,
          style_id = ?,
          config_json = ?,
          locks_json = ?,
          explanation = ?,
          revision = ?,
          is_design = ?,
          updated_at = ?,
          undo_stack_json = ?
        WHERE id = ?
      `).run(
        updatedLook.title,
        updatedLook.eventId,
        updatedLook.styleId,
        JSON.stringify(updatedLook.config),
        JSON.stringify(updatedLook.locks),
        updatedLook.explanation,
        updatedLook.revision,
        updatedLook.isDesign ? 1 : 0,
        updatedLook.updatedAt,
        JSON.stringify(undoStack),
        updatedLook.id
      );

      // 7. Persist revision history
      db.prepare(`
        INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        updatedLook.id,
        updatedLook.revision,
        JSON.stringify(updatedLook.config),
        JSON.stringify(updatedLook.locks),
        updatedLook.explanation,
        updatedLook.updatedAt
      );

      // 8. Persist command record
      db.prepare(`
        INSERT INTO commands (id, look_id, revision, action, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        command.commandId,
        updatedLook.id,
        updatedLook.revision,
        command.action,
        JSON.stringify(command.payload),
        command.timestamp
      );

      db.exec('COMMIT');

      return {
        ok: true,
        result: execution.result,
      };
    } catch (err: any) {
      try { db.exec('ROLLBACK'); } catch {}
      return {
        ok: false,
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        error: `Lỗi giao dịch máy chủ: ${err.message}`,
      };
    }
  },

  /**
   * Sequential Multi-level Undo:
   * Pops previous state from undo_stack_json.
   * Monotonically increments revision to prevent concurrency overwrites.
   */
  executeUndoTransaction(
    lookId: string,
    options: { expectedRevision?: number; commandId?: string } = {}
  ): { ok: true; result: { success: boolean; message: string; look: Look; remainingUndoSteps: number } } | { ok: false; statusCode: number; error: string; code?: string; currentRevision?: number } {
    const db = getDb();
    db.exec('BEGIN IMMEDIATE');

    try {
      if (options.commandId) {
        const existingCmd = db.prepare('SELECT id FROM commands WHERE id = ?').get(options.commandId);
        if (existingCmd) {
          db.exec('ROLLBACK');
          return {
            ok: false,
            statusCode: 409,
            code: 'DUPLICATE_COMMAND_ID',
            error: `Lệnh hoàn tác trùng lặp (Command ID: ${options.commandId})`,
          };
        }
      }

      const row = db.prepare('SELECT * FROM looks WHERE id = ?').get(lookId) as LookRow | undefined;
      if (!row) {
        db.exec('ROLLBACK');
        return { ok: false, statusCode: 404, code: 'LOOK_NOT_FOUND', error: 'Không tìm thấy bộ phối' };
      }

      const currentLook = rowToLook(row);

      if (options.expectedRevision !== undefined && options.expectedRevision !== currentLook.revision) {
        db.exec('ROLLBACK');
        return {
          ok: false,
          statusCode: 409,
          code: 'REVISION_CONFLICT',
          currentRevision: currentLook.revision,
          error: `Xung đột phiên bản khi hoàn tác: yêu cầu revision ${options.expectedRevision} nhưng phiên bản hiện tại là ${currentLook.revision}`,
        };
      }

      let undoStack: any[] = [];
      try {
        if (row.undo_stack_json) {
          undoStack = JSON.parse(row.undo_stack_json);
        }
      } catch {}

      if (undoStack.length === 0) {
        db.exec('ROLLBACK');
        return {
          ok: false,
          statusCode: 400,
          code: 'CANNOT_UNDO',
          error: 'Đã ở trạng thái ban đầu của phiên làm việc, không thể hoàn tác tiếp.',
        };
      }

      // Pop the most recent previous state
      const prevEntry = undoStack.pop();

      // Monotonically increase revision
      const newRevision = currentLook.revision + 1;
      const rolledBackLook: Look = {
        ...currentLook,
        title: prevEntry.title ?? currentLook.title,
        eventId: prevEntry.eventId ?? currentLook.eventId,
        styleId: prevEntry.styleId ?? currentLook.styleId,
        config: prevEntry.config,
        locks: prevEntry.locks,
        explanation: prevEntry.explanation,
        revision: newRevision,
        updatedAt: new Date().toISOString(),
      };

      // Validate look schema
      const validLook = LookSchema.safeParse(rolledBackLook);
      if (!validLook.success) {
        db.exec('ROLLBACK');
        return {
          ok: false,
          statusCode: 500,
          code: 'INVALID_ROLLBACK_STATE',
          error: 'Trạng thái hoàn tác không hợp lệ theo chuẩn schema',
        };
      }

      // Persist rolled back state with updated undo stack
      db.prepare(`
        UPDATE looks SET
          title = ?,
          event_id = ?,
          style_id = ?,
          config_json = ?,
          locks_json = ?,
          explanation = ?,
          revision = ?,
          is_design = ?,
          updated_at = ?,
          undo_stack_json = ?
        WHERE id = ?
      `).run(
        rolledBackLook.title,
        rolledBackLook.eventId,
        rolledBackLook.styleId,
        JSON.stringify(rolledBackLook.config),
        JSON.stringify(rolledBackLook.locks),
        rolledBackLook.explanation,
        rolledBackLook.revision,
        rolledBackLook.isDesign ? 1 : 0,
        rolledBackLook.updatedAt,
        JSON.stringify(undoStack),
        rolledBackLook.id
      );

      // Record revision
      db.prepare(`
        INSERT INTO look_revisions (look_id, revision, config_json, locks_json, explanation, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        rolledBackLook.id,
        rolledBackLook.revision,
        JSON.stringify(rolledBackLook.config),
        JSON.stringify(rolledBackLook.locks),
        rolledBackLook.explanation,
        rolledBackLook.updatedAt
      );

      // Record command if commandId provided
      if (options.commandId) {
        db.prepare(`
          INSERT INTO commands (id, look_id, revision, action, payload_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          options.commandId,
          rolledBackLook.id,
          rolledBackLook.revision,
          'UNDO',
          JSON.stringify({ revertedToRevision: currentLook.revision }),
          rolledBackLook.updatedAt
        );
      }

      db.exec('COMMIT');

      return {
        ok: true,
        result: {
          success: true,
          message: `Đã hoàn tác về trạng thái trước đó. Phiên bản mới: v${newRevision}`,
          look: rolledBackLook,
          remainingUndoSteps: undoStack.length,
        },
      };
    } catch (err: any) {
      try { db.exec('ROLLBACK'); } catch {}
      return { ok: false, statusCode: 500, code: 'INTERNAL_ERROR', error: `Lỗi hoàn tác: ${err.message}` };
    }
  },

  getRevision(lookId: string, revision: number): { config: any; locks: any; explanation: string } | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM look_revisions WHERE look_id = ? AND revision = ?').get(lookId, revision) as any;
    if (!row) return null;
    return {
      config: JSON.parse(row.config_json),
      locks: JSON.parse(row.locks_json),
      explanation: row.explanation,
    };
  },

  getAllRevisions(lookId: string): Array<{ revision: number; createdAt: string }> {
    const db = getDb();
    const rows = db.prepare('SELECT revision, created_at FROM look_revisions WHERE look_id = ? ORDER BY revision ASC').all(lookId) as any[];
    return rows.map((r) => ({ revision: r.revision, createdAt: r.created_at }));
  },

  // Lookbook
  getLookbook(): LookbookItem[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM lookbook ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      lookId: r.look_id,
      revision: r.revision,
      snapshotConfig: JSON.parse(r.snapshot_config_json),
      eventId: r.event_id,
      styleId: r.style_id,
      notes: r.notes,
      createdAt: r.created_at,
    }));
  },

  saveToLookbook(item: LookbookItem): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO lookbook (id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.title,
      item.lookId,
      item.revision,
      JSON.stringify(item.snapshotConfig),
      item.eventId,
      item.styleId,
      item.notes,
      item.createdAt
    );
  },

  deleteFromLookbook(id: string): boolean {
    const db = getDb();
    const info = db.prepare('DELETE FROM lookbook WHERE id = ?').run(id);
    return info.changes > 0;
  },

  // Culture Cards
  getCultureCards(status: string = 'published'): CultureCard[] {
    const db = getDb();
    let rows: any[];
    if (status === 'all') {
      rows = db.prepare('SELECT * FROM culture_cards ORDER BY created_at ASC').all() as any[];
    } else {
      rows = db.prepare('SELECT * FROM culture_cards WHERE status = ? ORDER BY created_at ASC').all(status) as any[];
    }
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      summary: r.summary,
      content: r.content,
      sourceName: r.source_name,
      sourceAuthor: r.source_author,
      sourceUrl: r.source_url,
      sourceEvidence: r.source_evidence,
      status: r.status,
      createdAt: r.created_at,
    }));
  },

  getCultureCardBySlug(slug: string): CultureCard | null {
    const db = getDb();
    const r = db.prepare('SELECT * FROM culture_cards WHERE slug = ?').get(slug) as any;
    if (!r) return null;
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      category: r.category,
      summary: r.summary,
      content: r.content,
      sourceName: r.source_name,
      sourceAuthor: r.source_author,
      sourceUrl: r.source_url,
      sourceEvidence: r.source_evidence,
      status: r.status,
      createdAt: r.created_at,
    };
  },

  syncCultureCards(cards: CultureCard[]): void {
    const db = getDb();
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
  },
};
