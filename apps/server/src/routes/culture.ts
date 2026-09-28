import { type FastifyPluginAsync } from 'fastify';
import { dbRepo } from '../db.js';

export const cultureRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/culture', async (request) => {
    const { status } = request.query as { status?: string };
    const filter = status === 'all' ? 'all' : 'published';
    const cards = dbRepo.getCultureCards(filter);
    return cards;
  });

  fastify.get('/culture/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const card = dbRepo.getCultureCardBySlug(slug);
    if (!card) {
      return reply.code(404).send({ error: 'Không tìm thấy thẻ văn hóa', slug });
    }
    return card;
  });
};
