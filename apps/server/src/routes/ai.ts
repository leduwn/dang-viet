import { type FastifyPluginAsync } from 'fastify';
import {
  AIChatRequestSchema,
  StructuredDesignRequestSchema,
} from '@dangviet/contracts';
import { aiAdapter } from '../ai/nine-router-adapter.js';
import { dbRepo } from '../db.js';

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Check AI Gateway status
  fastify.get('/ai/status', async () => {
    return aiAdapter.getStatus();
  });

  // 2. Chat with AI assistant
  fastify.post('/ai/chat', async (request, reply) => {
    const parse = AIChatRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Nội dung tin nhắn không hợp lệ', details: parse.error.format() });
    }

    const { lookId, message, history } = parse.data;
    const look = dbRepo.getLook(lookId);
    if (!look) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối tương ứng để trò chuyện' });
    }

    const response = await aiAdapter.chat(look, message, history);
    return response;
  });

  // 3. Structured Design Generation
  fastify.post('/ai/design', async (request, reply) => {
    const parse = StructuredDesignRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Yêu cầu thiết kế không hợp lệ', details: parse.error.format() });
    }

    let baseLook = undefined;
    if (parse.data.baseLookId) {
      baseLook = dbRepo.getLook(parse.data.baseLookId) || undefined;
    }

    const result = await aiAdapter.generateStructuredDesign(parse.data, baseLook);
    return result;
  });

  // 4. Concept Image Generation
  fastify.post('/ai/concept', async (request, reply) => {
    const { prompt } = request.body as { prompt?: string };
    if (!prompt) {
      return reply.code(400).send({ error: 'Thiếu mô tả ý tưởng prompt' });
    }
    const result = await aiAdapter.generateConceptImage(prompt);
    return result;
  });
};
