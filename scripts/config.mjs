import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Robust project root finder.
 * Traverses parent directories to locate package.json with name: "dang-viet".
 */
export function findProjectRoot(customStart) {
  if (process.env.PROJECT_ROOT) {
    const candidate = path.resolve(process.env.PROJECT_ROOT);
    if (fs.existsSync(candidate)) return candidate;
  }

  const candidates = [customStart, __dirname, process.cwd()].filter(Boolean);

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

  return path.resolve(__dirname, '..');
}

/**
 * Load .env from project root.
 * External environment variables have higher precedence (override: false).
 */
export function loadEnv(projectRoot) {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

/**
 * Resolve database path relative to projectRoot unless already absolute.
 */
export function resolveDatabasePath(rawPath, projectRoot) {
  const p = rawPath || process.env.DATABASE_PATH || './data/dangviet.db';
  return path.isAbsolute(p) ? path.normalize(p) : path.resolve(projectRoot, p);
}

/**
 * Get unified application configuration.
 */
export function getAppConfig(options = {}) {
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
  };
}

/**
 * Validate that mandatory migrations and content directories/files exist.
 */
export function validateRequiredPaths(config) {
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
