import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  type Look,
  type LookbookItem,
  type CultureCard,
  type CommandPayload,
  type CommandResult,
  type GarmentConfig,
  type AIImageJob,
  type AIImageJobStatus,
  LookSchema,
  GarmentConfigSchema,
  LockStateSchema,
  resolveAvatarForModel,
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
  session_id?: string | null;
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

export interface SessionRow {
  id: string;
  current_look_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface FaceReferenceRow {
  id: string;
  session_id: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  expires_at: string;
}

export interface AIImageJobRow {
  id: string;
  session_id: string;
  look_id: string | null;
  prompt: string;
  style_preset: string;
  status: string;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  model_used: string | null;
  duration_ms: number | null;
  parsed_details: string | null;
  error_message: string | null;
  parent_image_id?: string | null;
  reference_id?: string | null;
  iteration?: number | null;
  refinement_prompt?: string | null;
  background_setting?: string | null;
  pose_style?: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToAIImageJob(row: AIImageJobRow): AIImageJob {
  let parsedDetails = undefined;
  if (row.parsed_details) {
    try {
      parsedDetails = JSON.parse(row.parsed_details);
    } catch {}
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    lookId: row.look_id || undefined,
    prompt: row.prompt,
    stylePreset: row.style_preset as any,
    status: row.status as any,
    imageUrl: row.status === 'completed' ? `/api/ai/images/${row.id}/file` : undefined,
    downloadUrl: row.status === 'completed' ? `/api/ai/images/${row.id}/file?download=1` : undefined,
    modelUsed: row.model_used || undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    fileSize: row.file_size ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    parsedDetails,
    errorMessage: row.error_message || undefined,
    parentImageId: row.parent_image_id || undefined,
    referenceId: row.reference_id || undefined,
    iteration: row.iteration ?? 1,
    refinementPrompt: row.refinement_prompt || undefined,
    backgroundSetting: row.background_setting || undefined,
    poseStyle: row.pose_style || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToLook(row: LookRow): Look {
  const rawConfig = JSON.parse(row.config_json);
  if (!rawConfig.avatarId) {
    rawConfig.avatarId = resolveAvatarForModel(rawConfig.modelId);
  }
  const parsedConfig = GarmentConfigSchema.parse(rawConfig);
  const parsedLocks = LockStateSchema.parse(JSON.parse(row.locks_json));
  return {
    id: row.id,
    sessionId: row.session_id || undefined,
    title: row.title,
    eventId: row.event_id as any,
    styleId: row.style_id as any,
    config: parsedConfig,
    locks: parsedLocks,
    explanation: row.explanation,
    revision: row.revision,
    isDesign: Boolean(row.is_design),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeInitialGarmentConfig(raw: any): GarmentConfig {
  const collarMap: Record<string, string> = {
    co_tru_truyenthong: 'traditional_high',
    co_tron: 'round',
    co_thuyen: 'boat',
    co_v: 'v_neck',
  };
  const sleeveMap: Record<string, string> = {
    tay_dai: 'traditional_long',
    tay_raglan: 'raglan',
    tay_lung: 'elbow',
    tay_xe: 'slit',
  };
  const fabricMap: Record<string, string> = {
    lua_to_tam: 'silk_ha_dong',
    gam_hoa: 'brocade_hue',
    to_voan: 'voile_chiffon',
    dui_to: 'linen_modern',
  };
  const patternMap: Record<string, string> = {
    tron: 'plain',
    hoa_sen: 'lotus',
    van_may: 'cloud',
    hac_phi: 'crane',
    ky_ha: 'geometric_genz',
  };
  const bodyShapeMap: Record<string, string> = {
    can_doi: 'standard',
    nho_nhan: 'petite',
    cao_thanh: 'tall_slender',
    day_da: 'curvy_hips',
  };
  const modelIdMap: Record<string, string> = {
    standard_female_aodai: 'aodai_traditional_v2',
  };

  const candidate = {
    garmentType: 'aodai' as const,
    primaryColor: raw?.primaryColor?.family
      ? raw.primaryColor
      : { hex: raw?.primaryColor?.hex || '#D97706', name: raw?.primaryColor?.name || 'Vàng Hoàng Cúc', family: 'yellow' as const },
    pantsColor: raw?.pantsColor?.family
      ? raw.pantsColor
      : { hex: raw?.pantsColor?.hex || '#FFFFFF', name: raw?.pantsColor?.name || 'Trắng Tinh Khôi', family: 'white' as const },
    collarStyle: collarMap[raw?.collarStyle] || raw?.collarStyle || 'traditional_high',
    sleeveStyle: sleeveMap[raw?.sleeveStyle] || raw?.sleeveStyle || 'traditional_long',
    fabric: fabricMap[raw?.fabric] || raw?.fabric || 'silk_ha_dong',
    pattern: patternMap[raw?.pattern] || raw?.pattern || 'lotus',
    accessories: Array.isArray(raw?.accessories) ? raw.accessories : ['non_la'],
    bodyShape: bodyShapeMap[raw?.bodyShape] || raw?.bodyShape || 'standard',
    modelId: modelIdMap[raw?.modelId] || raw?.modelId || 'aodai_traditional_v2',
    avatarId: raw?.avatarId === 'avatar_ha_noi_01' ? 'avatar_v2' : (raw?.avatarId || 'avatar_v2'),
  };

  const parsed = GarmentConfigSchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    garmentType: 'aodai',
    primaryColor: { hex: '#D97706', name: 'Vàng Hoàng Cúc', family: 'yellow' },
    pantsColor: { hex: '#FFFFFF', name: 'Trắng Tinh Khôi', family: 'white' },
    collarStyle: 'traditional_high',
    sleeveStyle: 'traditional_long',
    fabric: 'silk_ha_dong',
    pattern: 'lotus',
    accessories: ['non_la'],
    bodyShape: 'standard',
    modelId: 'aodai_traditional_v2',
    avatarId: 'avatar_v2',
  };
}

export function createInitialLookForSession(sessionId: string): Look {
  const db = getDb();
  const now = new Date().toISOString();
  const newLookId = `look_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  let baseConfig: any = null;
  let baseLocks: any = null;
  let baseTitle = 'Bộ Áo Dài Truyền Thống';
  let baseEventId = 'ky_yeu';
  let baseStyleId = 'thanh_lich';
  let baseExplanation = 'Phối đồ áo dài truyền thống';

  const templateRow = db.prepare('SELECT * FROM looks WHERE id = ?').get('look_default_01') as LookRow | undefined;
  if (templateRow) {
    try {
      baseConfig = JSON.parse(templateRow.config_json);
      baseLocks = JSON.parse(templateRow.locks_json);
      baseTitle = templateRow.title;
      baseEventId = templateRow.event_id;
      baseStyleId = templateRow.style_id;
      baseExplanation = templateRow.explanation;
    } catch {}
  }

  const validConfig = normalizeInitialGarmentConfig(baseConfig);

  if (!baseLocks) {
    baseLocks = {
      primaryColor: false,
      pantsColor: false,
      collarStyle: false,
      sleeveStyle: false,
      fabric: false,
      pattern: false,
      accessories: false,
      bodyShape: false,
      modelId: false,
      avatarId: false,
    };
  }

  const initialLook: Look = {
    id: newLookId,
    sessionId,
    title: baseTitle,
    eventId: baseEventId as any,
    styleId: baseStyleId as any,
    config: validConfig,
    locks: LockStateSchema.parse(baseLocks),
    explanation: baseExplanation,
    revision: 1,
    isDesign: false,
    createdAt: now,
    updatedAt: now,
  };

  dbRepo.createLook(initialLook, sessionId);
  return initialLook;
}

export const dbRepo = {
  // Session repository
  getSession(sessionId: string): SessionRow | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | undefined;
    return row || null;
  },

  createSession(sessionId: string, currentLookId?: string | null, expiresAt?: string | null): SessionRow {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO sessions (id, current_look_id, created_at, updated_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        current_look_id = coalesce(excluded.current_look_id, sessions.current_look_id),
        updated_at = excluded.updated_at
    `).run(sessionId, currentLookId ?? null, now, now, expiresAt ?? null);
    return {
      id: sessionId,
      current_look_id: currentLookId ?? null,
      created_at: now,
      updated_at: now,
      expires_at: expiresAt ?? null,
    };
  },

  updateSessionCurrentLook(sessionId: string, currentLookId: string): void {
    const db = getDb();
    db.prepare('UPDATE sessions SET current_look_id = ?, updated_at = ? WHERE id = ?').run(
      currentLookId,
      new Date().toISOString(),
      sessionId
    );
  },

  touchSession(sessionId: string): void {
    const db = getDb();
    db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), sessionId);
  },

  getOrCreateSession(sessionId?: string): { sessionId: string; currentLookId: string; look: Look } {
    const db = getDb();
    if (sessionId) {
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as SessionRow | undefined;
      if (session) {
        const now = new Date().toISOString();
        db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, session.id);

        if (session.current_look_id) {
          const existingLook = dbRepo.getLook(session.current_look_id, session.id);
          if (existingLook) {
            return {
              sessionId: session.id,
              currentLookId: existingLook.id,
              look: existingLook,
            };
          }
        }

        const newLook = createInitialLookForSession(session.id);
        dbRepo.updateSessionCurrentLook(session.id, newLook.id);
        return {
          sessionId: session.id,
          currentLookId: newLook.id,
          look: newLook,
        };
      }
    }

    const targetSessionId = sessionId || `sess_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const initialLook = createInitialLookForSession(targetSessionId);
    dbRepo.createSession(targetSessionId, initialLook.id);
    return {
      sessionId: targetSessionId,
      currentLookId: initialLook.id,
      look: initialLook,
    };
  },
  getLook(id: string, sessionId?: string): Look | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM looks WHERE id = ?').get(id) as LookRow | undefined;
    if (!row) return null;
    if (sessionId && row.session_id !== sessionId) {
      return null;
    }
    return rowToLook(row);
  },

  hasCommand(commandId: string): boolean {
    const db = getDb();
    const row = db.prepare('SELECT id FROM commands WHERE id = ?').get(commandId);
    return Boolean(row);
  },

  createLook(look: Look, sessionId?: string): void {
    const db = getDb();
    const targetSessionId = sessionId || look.sessionId || 'legacy_migration_archive';
    db.prepare(`
      INSERT INTO looks (
        id, session_id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at, undo_stack_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      look.id,
      targetSessionId,
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
    command: CommandPayload,
    sessionId?: string
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

      // 2b. Session ownership check
      if (sessionId && row.session_id !== sessionId) {
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
    options: { expectedRevision: number; commandId: string },
    sessionId?: string
  ): { ok: true; result: { success: boolean; message: string; look: Look; remainingUndoSteps: number } } | { ok: false; statusCode: number; error: string; code?: string; currentRevision?: number } {
    if (!options || typeof options.expectedRevision !== 'number' || options.expectedRevision < 0 || !options.commandId) {
      return {
        ok: false,
        statusCode: 400,
        code: 'INVALID_UNDO_REQUEST',
        error: 'Thiếu expectedRevision hoặc commandId khi hoàn tác',
      };
    }

    const db = getDb();
    db.exec('BEGIN IMMEDIATE');

    try {
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

      const row = db.prepare('SELECT * FROM looks WHERE id = ?').get(lookId) as LookRow | undefined;
      if (!row) {
        db.exec('ROLLBACK');
        return { ok: false, statusCode: 404, code: 'LOOK_NOT_FOUND', error: 'Không tìm thấy bộ phối' };
      }

      // Session ownership check
      if (sessionId && row.session_id !== sessionId) {
        db.exec('ROLLBACK');
        return { ok: false, statusCode: 404, code: 'LOOK_NOT_FOUND', error: 'Không tìm thấy bộ phối' };
      }

      const currentLook = rowToLook(row);

      if (options.expectedRevision !== currentLook.revision) {
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

  getRevision(lookId: string, revision: number, sessionId?: string): { config: any; locks: any; explanation: string } | null {
    const db = getDb();
    if (sessionId) {
      const look = db.prepare('SELECT session_id FROM looks WHERE id = ?').get(lookId) as { session_id?: string } | undefined;
      if (!look || look.session_id !== sessionId) return null;
    }
    const row = db.prepare('SELECT * FROM look_revisions WHERE look_id = ? AND revision = ?').get(lookId, revision) as any;
    if (!row) return null;
    return {
      config: JSON.parse(row.config_json),
      locks: JSON.parse(row.locks_json),
      explanation: row.explanation,
    };
  },

  getAllRevisions(lookId: string, sessionId?: string): Array<{ revision: number; createdAt: string }> {
    const db = getDb();
    if (sessionId) {
      const look = db.prepare('SELECT session_id FROM looks WHERE id = ?').get(lookId) as { session_id?: string } | undefined;
      if (!look || look.session_id !== sessionId) return [];
    }
    const rows = db.prepare('SELECT revision, created_at FROM look_revisions WHERE look_id = ? ORDER BY revision ASC').all(lookId) as any[];
    return rows.map((r) => ({ revision: r.revision, createdAt: r.created_at }));
  },

  // Lookbook
  getLookbook(sessionId?: string): LookbookItem[] {
    const db = getDb();
    if (!sessionId) {
      return [];
    }
    const rows = db.prepare('SELECT * FROM lookbook WHERE session_id = ? ORDER BY created_at DESC').all(sessionId) as any[];
    return rows.map((r) => {
      const rawConfig = JSON.parse(r.snapshot_config_json);
      if (!rawConfig.avatarId) {
        rawConfig.avatarId = resolveAvatarForModel(rawConfig.modelId);
      }
      let designMetadata = undefined;
      if (r.design_metadata_json) {
        try {
          designMetadata = JSON.parse(r.design_metadata_json);
        } catch {}
      }
      const resourceType = designMetadata?.resourceType || (designMetadata?.aiImageUrl ? (designMetadata?.referenceId ? 'ai_face_ref_image' : 'ai_prompt_image') : 'svg_2d');
      return {
        id: r.id,
        sessionId: r.session_id,
        title: r.title,
        lookId: r.look_id,
        revision: r.revision,
        snapshotConfig: GarmentConfigSchema.parse(rawConfig),
        eventId: r.event_id,
        styleId: r.style_id,
        notes: r.notes,
        resourceType,
        designMetadata,
        createdAt: r.created_at,
      };
    });
  },

  getLookbookItem(id: string, sessionId?: string): LookbookItem | null {
    const db = getDb();
    const r = db.prepare('SELECT * FROM lookbook WHERE id = ?').get(id) as any;
    if (!r) return null;
    if (sessionId && r.session_id !== sessionId) return null;
    const rawConfig = JSON.parse(r.snapshot_config_json);
    if (!rawConfig.avatarId) {
      rawConfig.avatarId = resolveAvatarForModel(rawConfig.modelId);
    }
    let designMetadata = undefined;
    if (r.design_metadata_json) {
      try {
        designMetadata = JSON.parse(r.design_metadata_json);
      } catch {}
    }
    const resourceType = designMetadata?.resourceType || (designMetadata?.aiImageUrl ? (designMetadata?.referenceId ? 'ai_face_ref_image' : 'ai_prompt_image') : 'svg_2d');
    return {
      id: r.id,
      sessionId: r.session_id,
      title: r.title,
      lookId: r.look_id,
      revision: r.revision,
      snapshotConfig: GarmentConfigSchema.parse(rawConfig),
      eventId: r.event_id,
      styleId: r.style_id,
      notes: r.notes,
      resourceType,
      designMetadata,
      createdAt: r.created_at,
    };
  },

  saveToLookbook(item: LookbookItem, sessionId?: string): { ok: true } | { ok: false; statusCode: number; error: string } {
    const db = getDb();
    const effectiveSessionId = sessionId || item.sessionId;
    if (!effectiveSessionId) {
      return { ok: false, statusCode: 401, error: 'Thiếu phiên người dùng khi lưu Lookbook' };
    }

    // Verify ownership of the referenced look
    const lookRow = db.prepare('SELECT session_id FROM looks WHERE id = ?').get(item.lookId) as { session_id?: string } | undefined;
    if (!lookRow || lookRow.session_id !== effectiveSessionId) {
      return { ok: false, statusCode: 404, error: 'Không tìm thấy bộ phối nguồn hoặc bạn không có quyền sở hữu' };
    }

    const metaToSave = item.designMetadata ? { ...item.designMetadata } : (item.resourceType ? { resourceType: item.resourceType } : null);
    if (metaToSave && item.resourceType && !metaToSave.resourceType) {
      metaToSave.resourceType = item.resourceType;
    }

    db.prepare(`
      INSERT INTO lookbook (id, session_id, title, look_id, revision, snapshot_config_json, event_id, style_id, notes, design_metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      effectiveSessionId,
      item.title,
      item.lookId,
      item.revision,
      JSON.stringify(item.snapshotConfig),
      item.eventId,
      item.styleId,
      item.notes,
      metaToSave ? JSON.stringify(metaToSave) : null,
      item.createdAt
    );
    return { ok: true };
  },

  deleteFromLookbook(id: string, sessionId?: string): boolean {
    const db = getDb();
    if (!sessionId) {
      return false;
    }
    const info = db.prepare('DELETE FROM lookbook WHERE id = ? AND session_id = ?').run(id, sessionId);
    return info.changes > 0;
  },

  // Face References (Temporary Face Upload Storage)
  createFaceReference(ref: {
    id: string;
    sessionId: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    createdAt?: string;
    expiresAt: string;
  }): void {
    const db = getDb();
    const now = ref.createdAt || new Date().toISOString();
    db.prepare(`
      INSERT INTO face_references (id, session_id, storage_path, mime_type, file_size, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(ref.id, ref.sessionId, ref.storagePath, ref.mimeType, ref.fileSize, now, ref.expiresAt);
  },

  getFaceReference(id: string, sessionId?: string): FaceReferenceRow | null {
    const db = getDb();
    const row = (sessionId
      ? db.prepare('SELECT * FROM face_references WHERE id = ? AND session_id = ?').get(id, sessionId)
      : db.prepare('SELECT * FROM face_references WHERE id = ?').get(id)) as FaceReferenceRow | undefined;
    return row || null;
  },

  deleteFaceReference(id: string, sessionId?: string): boolean {
    const db = getDb();
    const stmt = sessionId
      ? db.prepare('DELETE FROM face_references WHERE id = ? AND session_id = ?')
      : db.prepare('DELETE FROM face_references WHERE id = ?');
    const info = sessionId ? stmt.run(id, sessionId) : stmt.run(id);
    return info.changes > 0;
  },

  getExpiredFaceReferences(): FaceReferenceRow[] {
    const db = getDb();
    const now = new Date().toISOString();
    return db.prepare('SELECT * FROM face_references WHERE expires_at <= ?').all(now) as unknown as FaceReferenceRow[];
  },

  deleteExpiredFaceReferences(): number {
    const db = getDb();
    const now = new Date().toISOString();
    const info = db.prepare('DELETE FROM face_references WHERE expires_at <= ?').run(now);
    return Number(info.changes);
  },

  saveFaceReference(ref: {
    id: string;
    sessionId: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    createdAt?: string;
    expiresAt: string;
  }): void {
    this.createFaceReference(ref);
  },

  // AI Image Jobs
  createAIImageJob(job: AIImageJob): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO ai_image_jobs (
        id, session_id, look_id, prompt, style_preset, status,
        storage_path, mime_type, file_size, width, height,
        model_used, duration_ms, parsed_details, error_message,
        parent_image_id, reference_id, iteration, refinement_prompt,
        background_setting, pose_style,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.sessionId,
      job.lookId || null,
      job.prompt,
      job.stylePreset,
      job.status,
      null,
      null,
      job.fileSize ?? null,
      job.width ?? null,
      job.height ?? null,
      job.modelUsed ?? null,
      job.durationMs ?? null,
      job.parsedDetails ? JSON.stringify(job.parsedDetails) : null,
      job.errorMessage ?? null,
      job.parentImageId || null,
      job.referenceId || null,
      job.iteration ?? 1,
      job.refinementPrompt || null,
      job.backgroundSetting || null,
      job.poseStyle || null,
      job.createdAt,
      job.updatedAt
    );
  },

  getAIImageJob(id: string, sessionId?: string): AIImageJob | null {
    const db = getDb();
    const row = (sessionId
      ? db.prepare('SELECT * FROM ai_image_jobs WHERE id = ? AND session_id = ?').get(id, sessionId)
      : db.prepare('SELECT * FROM ai_image_jobs WHERE id = ?').get(id)) as AIImageJobRow | undefined;
    return row ? rowToAIImageJob(row) : null;
  },

  getAIImageJobLineage(jobId: string, sessionId?: string): AIImageJob[] {
    const db = getDb();
    const lineage: AIImageJob[] = [];
    let currentId: string | undefined = jobId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const row = (sessionId
        ? db.prepare('SELECT * FROM ai_image_jobs WHERE id = ? AND session_id = ?').get(currentId, sessionId)
        : db.prepare('SELECT * FROM ai_image_jobs WHERE id = ?').get(currentId)) as AIImageJobRow | undefined;
      if (!row) break;
      lineage.unshift(rowToAIImageJob(row));
      currentId = row.parent_image_id || undefined;
    }
    return lineage;
  },

  getAIImageJobStoragePath(id: string, sessionId?: string): { storagePath: string | null; mimeType: string | null; status: string } | null {
    const db = getDb();
    const row = (sessionId
      ? db.prepare('SELECT storage_path, mime_type, status FROM ai_image_jobs WHERE id = ? AND session_id = ?').get(id, sessionId)
      : db.prepare('SELECT storage_path, mime_type, status FROM ai_image_jobs WHERE id = ?').get(id)) as any;
    if (!row) return null;
    return {
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      status: row.status,
    };
  },

  updateAIImageJob(
    id: string,
    updates: {
      status?: AIImageJobStatus;
      storagePath?: string;
      mimeType?: string;
      fileSize?: number;
      width?: number;
      height?: number;
      modelUsed?: string;
      durationMs?: number;
      parsedDetails?: any;
      errorMessage?: string;
      parentImageId?: string | null;
      referenceId?: string | null;
      iteration?: number;
      refinementPrompt?: string | null;
      backgroundSetting?: string | null;
      poseStyle?: string | null;
    }
  ): void {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM ai_image_jobs WHERE id = ?').get(id) as AIImageJobRow | undefined;
    if (!existing) return;

    db.prepare(`
      UPDATE ai_image_jobs SET
        status = ?,
        storage_path = ?,
        mime_type = ?,
        file_size = ?,
        width = ?,
        height = ?,
        model_used = ?,
        duration_ms = ?,
        parsed_details = ?,
        error_message = ?,
        parent_image_id = ?,
        reference_id = ?,
        iteration = ?,
        refinement_prompt = ?,
        background_setting = ?,
        pose_style = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.status ?? existing.status,
      (updates.storagePath !== undefined ? updates.storagePath : existing.storage_path) ?? null,
      (updates.mimeType !== undefined ? updates.mimeType : existing.mime_type) ?? null,
      (updates.fileSize !== undefined ? updates.fileSize : existing.file_size) ?? null,
      (updates.width !== undefined ? updates.width : existing.width) ?? null,
      (updates.height !== undefined ? updates.height : existing.height) ?? null,
      (updates.modelUsed !== undefined ? updates.modelUsed : existing.model_used) ?? null,
      (updates.durationMs !== undefined ? updates.durationMs : existing.duration_ms) ?? null,
      updates.parsedDetails !== undefined
        ? JSON.stringify(updates.parsedDetails)
        : (existing.parsed_details ?? null),
      (updates.errorMessage !== undefined ? updates.errorMessage : existing.error_message) ?? null,
      (updates.parentImageId !== undefined ? updates.parentImageId : existing.parent_image_id) ?? null,
      (updates.referenceId !== undefined ? updates.referenceId : existing.reference_id) ?? null,
      updates.iteration !== undefined ? updates.iteration : (existing.iteration ?? 1),
      (updates.refinementPrompt !== undefined ? updates.refinementPrompt : existing.refinement_prompt) ?? null,
      (updates.backgroundSetting !== undefined ? updates.backgroundSetting : existing.background_setting) ?? null,
      (updates.poseStyle !== undefined ? updates.poseStyle : existing.pose_style) ?? null,
      now,
      id
    );
  },

  getAIImageJobsBySession(sessionId: string, limit = 20): AIImageJob[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM ai_image_jobs WHERE session_id = ? ORDER BY created_at DESC LIMIT ?').all(sessionId, limit) as unknown as AIImageJobRow[];
    return rows.map(rowToAIImageJob);
  },

  deleteAIImageJob(id: string, sessionId?: string): boolean {
    const db = getDb();
    const stmt = sessionId
      ? db.prepare('DELETE FROM ai_image_jobs WHERE id = ? AND session_id = ?')
      : db.prepare('DELETE FROM ai_image_jobs WHERE id = ?');
    const info = sessionId ? stmt.run(id, sessionId) : stmt.run(id);
    return info.changes > 0;
  },

  countActiveJobsForSession(sessionId: string): number {
    const db = getDb();
    const row = db.prepare(`
      SELECT COUNT(*) as count FROM ai_image_jobs
      WHERE session_id = ? AND status IN ('pending', 'processing')
    `).get(sessionId) as { count: number };
    return row?.count || 0;
  },

  findRecentDuplicateJob(sessionId: string, prompt: string, stylePreset: string, windowMs = 45000): AIImageJob | null {
    const db = getDb();
    const since = new Date(Date.now() - windowMs).toISOString();
    const row = db.prepare(`
      SELECT * FROM ai_image_jobs
      WHERE session_id = ? AND prompt = ? AND style_preset = ? AND created_at >= ?
      ORDER BY created_at DESC LIMIT 1
    `).get(sessionId, prompt, stylePreset, since) as AIImageJobRow | undefined;
    return row ? rowToAIImageJob(row) : null;
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
