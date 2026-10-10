import { type FastifyPluginAsync } from 'fastify';
import {
  LookSchema,
  CommandPayloadSchema,
  UndoRequestSchema,
} from '@dangviet/contracts';
import { dbRepo } from '../db.js';

export const lookRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Get Look by ID (with session ownership validation)
  fastify.get('/looks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const look = dbRepo.getLook(id, request.sessionId);
    if (!look) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối', code: 'LOOK_NOT_FOUND', id });
    }
    return look;
  });

  // 2. Create Look (scoped to current session)
  fastify.post('/looks', async (request, reply) => {
    const parse = LookSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Dữ liệu bộ phối không hợp lệ', details: parse.error.format() });
    }
    const lookData = {
      ...parse.data,
      sessionId: request.sessionId,
    };
    dbRepo.createLook(lookData, request.sessionId);
    dbRepo.updateSessionCurrentLook(request.sessionId, lookData.id);
    return reply.code(201).send(lookData);
  });

  // 3. Command execution (Single transaction: duplicate check, concurrency OCC, ownership, lock enforcement)
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

    // Execute via transactional database repository with session ownership check
    const execution = dbRepo.executeCommandTransaction(id, command, request.sessionId);
    if (!execution.ok) {
      return reply.code(execution.statusCode).send({
        error: execution.error,
        code: execution.code,
        currentRevision: execution.currentRevision,
      });
    }

    return execution.result;
  });

  // 4. Sequential Multi-level Undo (Transaction, monotonic revision, ownership, conflict protection)
  fastify.post('/looks/:id/undo', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parse = UndoRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        error: 'Dữ liệu hoàn tác không hợp lệ: ' + parse.error.issues.map((i: { message: string }) => i.message).join(', '),
        code: 'INVALID_UNDO_REQUEST',
        details: parse.error.issues,
      });
    }

    const undoResult = dbRepo.executeUndoTransaction(id, parse.data, request.sessionId);
    if (!undoResult.ok) {
      return reply.code(undoResult.statusCode).send({
        error: undoResult.error,
        code: undoResult.code,
        currentRevision: undoResult.currentRevision,
      });
    }

    return undoResult.result;
  });

  // 5. Look revisions history
  fastify.get('/looks/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    const look = dbRepo.getLook(id, request.sessionId);
    if (!look) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối', code: 'LOOK_NOT_FOUND', id });
    }
    const history = dbRepo.getAllRevisions(id, request.sessionId);
    return { lookId: id, history };
  });
};
