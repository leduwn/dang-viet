import { type FastifyPluginAsync } from 'fastify';
import { LookbookItemSchema } from '@dangviet/contracts';
import { dbRepo } from '../db.js';

export const lookbookRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. List all items in Lookbook
  fastify.get('/lookbook', async () => {
    return dbRepo.getLookbook();
  });

  // 2. Save a snapshot into Lookbook
  fastify.post('/lookbook', async (request, reply) => {
    const parse = LookbookItemSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Dữ liệu Lookbook không hợp lệ', details: parse.error.format() });
    }

    const item = parse.data;
    dbRepo.saveToLookbook(item);
    return reply.code(201).send(item);
  });

  // 3. Remove an item from Lookbook
  fastify.delete('/lookbook/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = dbRepo.deleteFromLookbook(id);
    if (!success) {
      return reply.code(404).send({ error: 'Không tìm thấy mục trong Lookbook để xóa' });
    }
    return { success: true, id };
  });
};
