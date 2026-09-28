import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export interface AppConfig {
  projectRoot: string;
  databasePath: string;
  contentDir: string;
  migrationsDir: string;
  webDistDir: string;
  port: number;
  host: string;
  logLevel: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiTimeoutMs: number;
}

/**
 * Robust project root finder.
 * Traverses parent directories to locate package.json with name: "dang-viet".
 */
export function findProjectRoot(customStart?: string): string {
  if (process.env.PROJECT_ROOT) {
    const candidate = path.resolve(process.env.PROJECT_ROOT);
    if (fs.existsSync(candidate)) return candidate;
  }

  let moduleDir = '';
  try {
    moduleDir = path.dirname(fileURLToPath(import.meta.url));
  } catch {}

  const candidates = [customStart, moduleDir, process.cwd()].filter(Boolean) as string[];

  for (const start of candidates) {
    let curr = path.resolve(start);
    while (true) {
      const pkgPath = path.join(curr, 'package.json');
      const contentCheck = path.join(curr, 'content', 'events.json');
      const migrationsCheck = path.join(curr, 'migrations');
      if (fs.existsSync(pkgPath) && fs.existsSync(contentCheck) && fs.existsSync(migrationsCheck)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (pkg.name === 'dang-viet' || Array.isArray(pkg.workspaces)) {
            return curr;
          }
        } catch {}
      }
      const parent = path.dirname(curr);
      if (parent === curr) break;
      curr = parent;
    }
  }

  // Fallback relative to moduleDir
  if (moduleDir) {
    return path.resolve(moduleDir, '../../..');
  }
  return process.cwd();
}

/**
 * Load .env from project root.
 * External environment variables have higher precedence (override: false).
 */
export function loadEnv(projectRoot: string): void {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

/**
 * Resolve database path relative to projectRoot unless already absolute.
 */
export function resolveDatabasePath(rawPath?: string, projectRoot?: string): string {
  const root = projectRoot || findProjectRoot();
  const p = rawPath || process.env.DATABASE_PATH || './data/dangviet.db';
  return path.isAbsolute(p) ? path.normalize(p) : path.resolve(root, p);
}

/**
 * Get unified application configuration.
 */
export function getAppConfig(options: {
  startDir?: string;
  databasePath?: string;
  contentDir?: string;
  migrationsDir?: string;
} = {}): AppConfig {
  const projectRoot = findProjectRoot(options.startDir);
  loadEnv(projectRoot);

  const databasePath = resolveDatabasePath(options.databasePath, projectRoot);
  const contentDir = options.contentDir ? path.resolve(options.contentDir) : path.join(projectRoot, 'content');
  const migrationsDir = options.migrationsDir ? path.resolve(options.migrationsDir) : path.join(projectRoot, 'migrations');
  const webDistDir = path.join(projectRoot, 'apps', 'web', 'dist');

  return {
    projectRoot,
    databasePath,
    contentDir,
    migrationsDir,
    webDistDir,
    port: process.env.PORT !== undefined && process.env.PORT !== '' ? Number(process.env.PORT) : 3088,
    host: process.env.HOST || '127.0.0.1',
    logLevel: process.env.LOG_LEVEL || 'info',
    aiBaseUrl: (process.env.AI_BASE_URL || 'https://api.9router.com/v1').replace(/\/+$/, ''),
    aiApiKey: process.env.AI_API_KEY || '',
    aiModel: process.env.AI_MODEL || 'gemini-2.5-flash',
    aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 25000,
  };
}

/**
 * Validate that mandatory migrations and content directories/files exist.
 */
export function validateRequiredPaths(config: AppConfig): void {
  if (!fs.existsSync(config.migrationsDir)) {
    throw new Error(`[FATAL] Không tìm thấy thư mục migration bắt buộc tại: ${config.migrationsDir}`);
  }
  if (!fs.existsSync(config.contentDir)) {
    throw new Error(`[FATAL] Không tìm thấy thư mục content bắt buộc tại: ${config.contentDir}`);
  }
  const requiredContentFiles = [
    'events.json',
    'styles.json',
    'colors.json',
    'catalog.json',
    'presets.json',
    'culture-cards.json',
  ];
  for (const f of requiredContentFiles) {
    const fullPath = path.join(config.contentDir, f);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`[FATAL] Thiếu tệp dữ liệu văn hóa bắt buộc: ${fullPath}`);
    }
  }
}
