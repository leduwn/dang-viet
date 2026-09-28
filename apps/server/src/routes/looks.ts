import { type FastifyPluginAsync } from 'fastify';
import {
  LookSchema,
  CommandPayloadSchema,
} from '@dangviet/contracts';
import { executeCommand } from '@dangviet/domain';
import { dbRepo } from '../db.js';

export const lookRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Get Look by ID
  fastify.get('/looks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const look = dbRepo.getLook(id);
    if (!look) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối', id });
    }
    return look;
  });

  // 2. Create Look
  fastify.post('/looks', async (request, reply) => {
    const parse = LookSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Dữ liệu bộ phối không hợp lệ', details: parse.error.format() });
    }
    dbRepo.createLook(parse.data);
    return reply.code(201).send(parse.data);
  });

  // 3. Command execution (The single source of truth for changes)
  fastify.post('/looks/:id/command', async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentLook = dbRepo.getLook(id);
    if (!currentLook) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối', id });
    }

    const parse = CommandPayloadSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Lệnh không hợp lệ', details: parse.error.format() });
    }

    const command = parse.data;
    if (command.lookId !== id) {
      return reply.code(400).send({ error: 'lookId trong lệnh không khớp với URL' });
    }

    // Execute via pure domain engine
    const execution = executeCommand(currentLook, command);
    if (!execution.ok) {
      return reply.code(execution.statusCode).send({ error: execution.error });
    }

    // Persist new state and record command
    dbRepo.updateLook(execution.result.look, command);

    return execution.result;
  });

  // 4. Undo command
  fastify.post('/looks/:id/undo', async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentLook = dbRepo.getLook(id);
    if (!currentLook) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối', id });
    }

    if (currentLook.revision <= 1) {
      return reply.code(400).send({ error: 'Đang ở phiên bản gốc ban đầu, không thể hoàn tác tiếp.' });
    }

    const prevRevisionNum = currentLook.revision - 1;
    const prevRev = dbRepo.getRevision(id, prevRevisionNum);
    if (!prevRev) {
      return reply.code(404).send({ error: `Không tìm thấy lịch sử phiên bản ${prevRevisionNum}` });
    }

    const rolledBackLook = {
      ...currentLook,
      config: prevRev.config,
      locks: prevRev.locks,
      explanation: prevRev.explanation,
      revision: currentLook.revision + 1, // increment revision to maintain monotonic audit trail
      updatedAt: new Date().toISOString(),
    };

    dbRepo.updateLook(rolledBackLook);

    return {
      success: true,
      message: `Đã hoàn tác về nội dung của phiên bản ${prevRevisionNum}`,
      look: rolledBackLook,
    };
  });

  // 5. Look revisions history
  fastify.get('/looks/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const history = dbRepo.getAllRevisions(id);
    return { lookId: id, history };
  });
};
