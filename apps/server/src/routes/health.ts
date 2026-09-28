import { type FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'dangviet-server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  });
};
