import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  type Look,
  type LookbookItem,
  type CultureCard,
  type CommandPayload,
} from '@dangviet/contracts';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  const dbPath = process.env.DATABASE_PATH || './data/dangviet.db';
  const resolvedPath = path.resolve(dbPath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  dbInstance = new DatabaseSync(resolvedPath);
  return dbInstance;
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

  createLook(look: Look): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO looks (
        id, user_id, title, event_id, style_id, config_json, locks_json, explanation, revision, is_design, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      look.updatedAt
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

  updateLook(look: Look, command?: CommandPayload): void {
    const db = getDb();
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
        updated_at = ?
      WHERE id = ?
    `).run(
      look.title,
      look.eventId,
      look.styleId,
      JSON.stringify(look.config),
      JSON.stringify(look.locks),
      look.explanation,
      look.revision,
      look.isDesign ? 1 : 0,
      look.updatedAt,
      look.id
    );

    // Record revision
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

    // Record command if provided
    if (command) {
      db.prepare(`
        INSERT INTO commands (id, look_id, revision, action, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        command.commandId,
        look.id,
        look.revision,
        command.action,
        JSON.stringify(command.payload),
        command.timestamp
      );
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
};
