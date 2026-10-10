import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { getAppConfig, validateRequiredPaths } from './config.js';
import { healthRoutes } from './routes/health.js';
import { metaRoutes } from './routes/meta.js';
import { lookRoutes } from './routes/looks.js';
import { lookbookRoutes } from './routes/lookbook.js';
import { cultureRoutes } from './routes/culture.js';
import { aiRoutes } from './routes/ai.js';
import { sessionRoutes } from './routes/session.js';
import { getDb, dbRepo } from './db.js';
import { imageService } from './ai/image-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    sessionId: string;
  }
}

const appConfig = getAppConfig();
try {
  validateRequiredPaths(appConfig);
} catch (err: any) {
  console.error('[FATAL] Lỗi cấu hình đường dẫn tài nguyên:', err.message);
  process.exit(1);
}

const fastify = Fastify({
  logger: {
    level: appConfig.logLevel,
  },
  bodyLimit: 16 * 1024 * 1024, // 16 MB limit to support high-resolution portrait uploads
});

// Cookie secret for signing session cookies
const SESSION_SECRET = process.env.SESSION_SECRET || 'dang_viet_session_hmac_secret_key_secure_2026';

// Register Fastify Cookie plugin
await fastify.register(cookie, {
  secret: SESSION_SECRET,
  hook: 'onRequest',
  parseOptions: {},
});

// Register CORS with credentials: true
await fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow non-browser requests (curl, mobile, backend-to-backend)
    if (!origin) return cb(null, true);
    try {
      const parsed = new URL(origin);
      const isLocal =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '0.0.0.0';
      if (isLocal || parsed.hostname.endsWith('dangviet.vn') || process.env.NODE_ENV !== 'production') {
        return cb(null, true);
      }
    } catch {
      return cb(null, false);
    }
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
});

// Session resolution and anonymous cookie management hook
fastify.addHook('onRequest', async (request, reply) => {
  // 1. Session resolution from signed cookie 'dv_session'
  const rawCookie = request.cookies['dv_session'];
  let sessionId: string | null = null;

  if (rawCookie) {
    const unsigned = request.unsignCookie(rawCookie);
    if (unsigned.valid && unsigned.value) {
      sessionId = unsigned.value;
    }
  }

  // Optional: support test session header in test environment only
  if (!sessionId && process.env.NODE_ENV === 'test' && request.headers['x-test-session-id']) {
    sessionId = String(request.headers['x-test-session-id']);
  }

  // If no valid session or session does not exist in DB, create new session
  let validSessionId = sessionId && dbRepo.getSession(sessionId) ? sessionId : null;
  if (!validSessionId) {
    validSessionId = `sess_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    dbRepo.getOrCreateSession(validSessionId);
    reply.setCookie('dv_session', validSessionId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      signed: true,
    });
  }

  request.sessionId = validSessionId;
});

// CSRF Protection Hook for mutating requests
fastify.addHook('preHandler', async (request, reply) => {
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!mutatingMethods.includes(request.method)) {
    return;
  }

  // 1. Sec-Fetch-Site mitigation
  const secFetchSite = request.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    return reply.code(403).send({
      error: 'Yêu cầu cross-site bị từ chối (CSRF Protection)',
      code: 'CSRF_REJECTED',
    });
  }

  // 2. Origin validation on mutating requests
  const origin = request.headers['origin'];
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const isLocal =
        originUrl.hostname === 'localhost' ||
        originUrl.hostname === '127.0.0.1' ||
        originUrl.hostname === '0.0.0.0';
      if (!isLocal && !originUrl.hostname.endsWith('dangviet.vn') && process.env.NODE_ENV === 'production') {
        return reply.code(403).send({
          error: 'Nguồn gốc request không được phép (CSRF Origin Protection)',
          code: 'CSRF_ORIGIN_MISMATCH',
        });
      }
    } catch {
      return reply.code(403).send({
        error: 'Origin header không hợp lệ',
        code: 'INVALID_ORIGIN',
      });
    }
  }
});

// Allow empty JSON body on POST/PUT requests
fastify.removeContentTypeParser('application/json');
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const text = typeof body === 'string' ? body.trim() : '';
    const json = text.length > 0 ? JSON.parse(text) : {};
    done(null, json);
  } catch (err: any) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// Initialize DB check and run migrations
try {
  getDb();
} catch (err: any) {
  console.error('[FATAL] Không thể khởi động server do lỗi cơ sở dữ liệu/migration:', err.message);
  process.exit(1);
}

// Register API Routes
await fastify.register(healthRoutes, { prefix: '/api' });
await fastify.register(sessionRoutes, { prefix: '/api' });
await fastify.register(metaRoutes, { prefix: '/api' });
await fastify.register(lookRoutes, { prefix: '/api' });
await fastify.register(lookbookRoutes, { prefix: '/api' });
await fastify.register(cultureRoutes, { prefix: '/api' });
await fastify.register(aiRoutes, { prefix: '/api' });

// Serve static frontend build if present
if (fs.existsSync(appConfig.webDistDir)) {
  await fastify.register(fastifyStatic, {
    root: appConfig.webDistDir,
    prefix: '/',
  });

  fastify.setNotFoundHandler((request, reply) => {
    if (request.raw.url && request.raw.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'Tài nguyên API không tồn tại' });
    }
    return reply.sendFile('index.html');
  });
}

// Periodic cleanup of expired face references (> 24 hours, Section F)
const cleanupInterval = setInterval(() => {
  try {
    imageService.cleanupExpiredReferences();
  } catch (err: any) {
    console.error('[CLEANUP] Lỗi dọn dẹp ảnh tham chiếu hết hạn:', err.message);
  }
}, 60 * 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

const start = async () => {
  try {
    await fastify.listen({ port: appConfig.port, host: appConfig.host });
    const address = fastify.server.address();
    const boundPort = typeof address === 'object' && address ? address.port : appConfig.port;
    console.log(`[DÁNG VIỆT SERVER] Máy chủ API đang chạy tại http://${appConfig.host}:${boundPort}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
