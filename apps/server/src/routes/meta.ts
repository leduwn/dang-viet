import fs from 'node:fs';
import path from 'node:path';
import { type FastifyPluginAsync } from 'fastify';
import { getAppConfig } from '../config.js';

export const metaRoutes: FastifyPluginAsync = async (fastify) => {
  const config = getAppConfig();
  const events = JSON.parse(fs.readFileSync(path.join(config.contentDir, 'events.json'), 'utf-8'));
  const styles = JSON.parse(fs.readFileSync(path.join(config.contentDir, 'styles.json'), 'utf-8'));
  const colors = JSON.parse(fs.readFileSync(path.join(config.contentDir, 'colors.json'), 'utf-8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(config.contentDir, 'catalog.json'), 'utf-8'));
  const presets = JSON.parse(fs.readFileSync(path.join(config.contentDir, 'presets.json'), 'utf-8'));

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
