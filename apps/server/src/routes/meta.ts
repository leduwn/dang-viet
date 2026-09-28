import fs from 'node:fs';
import path from 'node:path';
import { type FastifyPluginAsync } from 'fastify';

export const metaRoutes: FastifyPluginAsync = async (fastify) => {
  const events = JSON.parse(fs.readFileSync(path.resolve('content/events.json'), 'utf-8'));
  const styles = JSON.parse(fs.readFileSync(path.resolve('content/styles.json'), 'utf-8'));
  const colors = JSON.parse(fs.readFileSync(path.resolve('content/colors.json'), 'utf-8'));
  const catalog = JSON.parse(fs.readFileSync(path.resolve('content/catalog.json'), 'utf-8'));
  const presets = JSON.parse(fs.readFileSync(path.resolve('content/presets.json'), 'utf-8'));

  fastify.get('/meta', async () => {
    return {
      events,
      styles,
      colors,
      catalog,
      presets,
    };
  });
};
