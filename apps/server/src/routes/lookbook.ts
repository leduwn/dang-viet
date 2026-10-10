import { type FastifyPluginAsync } from 'fastify';
import { LookbookItemSchema } from '@dangviet/contracts';
import { dbRepo } from '../db.js';

export const lookbookRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. List all items in Lookbook (scoped to current session)
  fastify.get('/lookbook', async (request) => {
    return dbRepo.getLookbook(request.sessionId);
  });

  // 2. Get single item in Lookbook (scoped to current session)
  fastify.get('/lookbook/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = dbRepo.getLookbookItem(id, request.sessionId);
    if (!item) {
      return reply.code(404).send({ error: 'Không tìm thấy mục trong Lookbook', code: 'LOOKBOOK_ITEM_NOT_FOUND', id });
    }
    return item;
  });

  // 3. Save a snapshot into Lookbook (scoped to current session)
  fastify.post('/lookbook', async (request, reply) => {
    const parse = LookbookItemSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Dữ liệu Lookbook không hợp lệ', details: parse.error.format() });
    }

    const item = {
      ...parse.data,
      sessionId: request.sessionId,
    };
    const saveResult = dbRepo.saveToLookbook(item, request.sessionId);
    if (!saveResult.ok) {
      return reply.code(saveResult.statusCode).send({ error: saveResult.error });
    }
    return reply.code(201).send(item);
  });

  // 4. Remove an item from Lookbook (scoped to current session)
  fastify.delete('/lookbook/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = dbRepo.deleteFromLookbook(id, request.sessionId);
    if (!success) {
      return reply.code(404).send({ error: 'Không tìm thấy mục trong Lookbook để xóa', code: 'LOOKBOOK_ITEM_NOT_FOUND' });
    }
    return { success: true, id };
  });
};
