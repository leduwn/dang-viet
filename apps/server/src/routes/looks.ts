import { type FastifyPluginAsync } from 'fastify';
import {
  LookSchema,
  CommandPayloadSchema,
} from '@dangviet/contracts';
import { dbRepo } from '../db.js';

export const lookRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Get Look by ID
  fastify.get('/looks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const look = dbRepo.getLook(id);
    if (!look) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối', code: 'LOOK_NOT_FOUND', id });
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

  // 3. Command execution (Single transaction: duplicate check, concurrency OCC, lock enforcement)
  fastify.post('/looks/:id/command', async (request, reply) => {
    const { id } = request.params as { id: string };

    const parse = CommandPayloadSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        error: 'Lệnh không hợp lệ theo chuẩn schema',
        code: 'INVALID_COMMAND_PAYLOAD',
        details: parse.error.format(),
      });
    }

    const command = parse.data;
    if (command.lookId !== id) {
      return reply.code(400).send({
        error: 'lookId trong lệnh không khớp với URL',
        code: 'LOOK_ID_MISMATCH',
      });
    }

    // Execute via transactional database repository
    const execution = dbRepo.executeCommandTransaction(id, command);
    if (!execution.ok) {
      return reply.code(execution.statusCode).send({
        error: execution.error,
        code: execution.code,
        currentRevision: execution.currentRevision,
      });
    }

    return execution.result;
  });

  // 4. Sequential Multi-level Undo (Transaction, monotonic revision)
  fastify.post('/looks/:id/undo', async (request, reply) => {
    const { id } = request.params as { id: string };

    const undoResult = dbRepo.executeUndoTransaction(id);
    if (!undoResult.ok) {
      return reply.code(undoResult.statusCode).send({
        error: undoResult.error,
        code: undoResult.code,
      });
    }

    return undoResult.result;
  });

  // 5. Look revisions history
  fastify.get('/looks/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const history = dbRepo.getAllRevisions(id);
    return { lookId: id, history };
  });
};
