import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { getAppConfig, validateRequiredPaths } from './config.js';
import { healthRoutes } from './routes/health.js';
import { metaRoutes } from './routes/meta.js';
import { lookRoutes } from './routes/looks.js';
import { lookbookRoutes } from './routes/lookbook.js';
import { cultureRoutes } from './routes/culture.js';
import { aiRoutes } from './routes/ai.js';
import { getDb } from './db.js';

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
});

// Register CORS
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
