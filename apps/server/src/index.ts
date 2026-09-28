import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { healthRoutes } from './routes/health.js';
import { metaRoutes } from './routes/meta.js';
import { lookRoutes } from './routes/looks.js';
import { lookbookRoutes } from './routes/lookbook.js';
import { cultureRoutes } from './routes/culture.js';
import { aiRoutes } from './routes/ai.js';
import { getDb } from './db.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register CORS
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
});

// Initialize DB check
getDb();

// Register API Routes
await fastify.register(healthRoutes, { prefix: '/api' });
await fastify.register(metaRoutes, { prefix: '/api' });
await fastify.register(lookRoutes, { prefix: '/api' });
await fastify.register(lookbookRoutes, { prefix: '/api' });
await fastify.register(cultureRoutes, { prefix: '/api' });
await fastify.register(aiRoutes, { prefix: '/api' });

// Serve static frontend build if present
const webDistPath = path.resolve('../web/dist');
const altWebDistPath = path.resolve('apps/web/dist');
const resolvedDist = fs.existsSync(webDistPath)
  ? webDistPath
  : fs.existsSync(altWebDistPath)
  ? altWebDistPath
  : null;

if (resolvedDist) {
  await fastify.register(fastifyStatic, {
    root: resolvedDist,
    prefix: '/',
  });

  fastify.setNotFoundHandler((request, reply) => {
    if (request.raw.url && request.raw.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'Tài nguyên API không tồn tại' });
    }
    return reply.sendFile('index.html');
  });
}

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 3001;

const start = async () => {
  try {
    await fastify.listen({ port, host });
    console.log(`[DÁNG VIỆT SERVER] Máy chủ API đang chạy tại http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
