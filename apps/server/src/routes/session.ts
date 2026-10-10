import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { dbRepo, createInitialLookForSession } from '../db.js';

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Get current session info & current active look
  fastify.get('/session', async (request, reply) => {
    const sessionState = dbRepo.getOrCreateSession(request.sessionId);
    return {
      sessionId: sessionState.sessionId,
      currentLookId: sessionState.currentLookId,
      look: sessionState.look,
    };
  });

  // 2. Update current active look for session
  const SwitchLookBodySchema = z.object({
    lookId: z.string().min(1, 'lookId không được để trống'),
  });

  fastify.put('/session/current', async (request, reply) => {
    const parse = SwitchLookBodySchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Dữ liệu không hợp lệ', details: parse.error.issues });
    }

    const { lookId } = parse.data;
    const look = dbRepo.getLook(lookId, request.sessionId);
    if (!look) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối hoặc bạn không có quyền sở hữu', code: 'LOOK_NOT_FOUND' });
    }

    dbRepo.updateSessionCurrentLook(request.sessionId, lookId);
    return {
      sessionId: request.sessionId,
      currentLookId: lookId,
      look,
    };
  });

  // 3. Reset to new fresh outfit for current session
  fastify.post('/session/reset', async (request, reply) => {
    const newLook = createInitialLookForSession(request.sessionId);
    dbRepo.updateSessionCurrentLook(request.sessionId, newLook.id);
    return {
      sessionId: request.sessionId,
      currentLookId: newLook.id,
      look: newLook,
    };
  });
};
