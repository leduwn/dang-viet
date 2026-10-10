import { type FastifyPluginAsync } from 'fastify';
import {
  AIChatRequestSchema,
  StructuredDesignRequestSchema,
  DesignProposalRequestSchema,
  DesignProposalSchema,
  AIImageGenerateRequestSchema,
  FaceReferenceUploadRequestSchema,
  ConversationalEditRequestSchema,
} from '@dangviet/contracts';
import { validateDesignProposal } from '@dangviet/domain';
import { aiAdapter } from '../ai/nine-router-adapter.js';
import { imageService } from '../ai/image-service.js';
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
    const look = dbRepo.getLook(lookId, request.sessionId);
    if (!look) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối tương ứng để trò chuyện', code: 'LOOK_NOT_FOUND' });
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
      baseLook = dbRepo.getLook(parse.data.baseLookId, request.sessionId) || undefined;
      if (!baseLook) {
        return reply.code(404).send({ error: 'Không tìm thấy bộ phối gốc', code: 'LOOK_NOT_FOUND' });
      }
    }

    const result = await aiAdapter.generateStructuredDesign(parse.data, baseLook);
    return result;
  });

  // 4. Generate Design Proposal
  fastify.post('/ai/proposal', async (request, reply) => {
    const parse = DesignProposalRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Yêu cầu proposal không hợp lệ', details: parse.error.format() });
    }

    const baseLook = dbRepo.getLook(parse.data.targetLookId, request.sessionId);
    if (!baseLook) {
      return reply.code(404).send({ error: 'Không tìm thấy bộ phối mục tiêu để tạo đề xuất', code: 'LOOK_NOT_FOUND' });
    }

    const proposal = await aiAdapter.generateProposal(parse.data, baseLook);
    return proposal;
  });

  // 5. Validate Design Proposal
  fastify.post('/ai/proposal/validate', async (request, reply) => {
    const parse = DesignProposalSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: 'Dữ liệu proposal không hợp lệ', details: parse.error.format() });
    }

    const proposal = parse.data;
    const currentLook = dbRepo.getLook(proposal.targetLookId, request.sessionId);
    if (!currentLook) {
      return reply.code(404).send({ error: 'Không tìm thấy Look mục tiêu để xác thực', code: 'LOOK_NOT_FOUND' });
    }

    const publishedCards = dbRepo.getCultureCards('published');
    const allowedSlugs = publishedCards.map((c) => c.slug);

    const validation = validateDesignProposal(proposal, currentLook, allowedSlugs);
    return validation;
  });

  // 6. Concept Image Generation (Legacy/Lightweight)
  fastify.post('/ai/concept', async (request, reply) => {
    const { prompt } = request.body as { prompt?: string };
    if (!prompt) {
      return reply.code(400).send({ error: 'Thiếu mô tả ý tưởng prompt' });
    }
    const result = await aiAdapter.generateConceptImage(prompt);
    return result;
  });

  // 7. 2D Ao Dai AI Image Generation (POST /api/ai/images/generate)
  fastify.post('/ai/images/generate', async (request, reply) => {
    const parse = AIImageGenerateRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        error: 'Dữ liệu yêu cầu tạo ảnh không hợp lệ',
        details: parse.error.format(),
      });
    }

    const result = await imageService.requestImageGeneration(request.sessionId, parse.data);
    if (!result.ok) {
      return reply.code(result.statusCode || 500).send({
        error: result.error || 'Tạo ảnh thất bại',
        job: result.job,
      });
    }

    return reply.code(result.isExisting ? 200 : 201).send({
      success: true,
      job: result.job,
      isExisting: result.isExisting || false,
    });
  });

  // 8. List all AI Image jobs for current session (GET /api/ai/images)
  fastify.get('/ai/images', async (request) => {
    const jobs = dbRepo.getAIImageJobsBySession(request.sessionId, 30);
    return { jobs };
  });

  // 9. Get specific AI Image job details & status (GET /api/ai/images/jobs/:id or /api/ai/images/:id)
  const getJobHandler = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const job = dbRepo.getAIImageJob(id, request.sessionId);
    if (!job) {
      return reply.code(404).send({
        error: 'Không tìm thấy tác vụ tạo ảnh hoặc bạn không có quyền truy cập',
        code: 'IMAGE_JOB_NOT_FOUND',
        id,
      });
    }
    return { job };
  };

  fastify.get('/ai/images/jobs/:id', getJobHandler);
  fastify.get('/ai/images/:id', getJobHandler);

  // 10. Serve Image File directly from storage (GET /api/ai/images/:id/file)
  fastify.get('/ai/images/:id/file', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { download?: string };
    const isDownload = query.download === '1' || query.download === 'true';

    // Allow serving image if belongs to session
    const fileResult = imageService.getImageFile(id, request.sessionId);
    if (!fileResult.ok) {
      return reply.code(fileResult.statusCode).send({
        error: fileResult.error,
        code: 'IMAGE_FILE_ERROR',
        id,
      });
    }

    reply.header('Content-Type', fileResult.mimeType);
    reply.header('Cache-Control', 'public, max-age=86400, immutable');
    if (isDownload) {
      reply.header('Content-Disposition', `attachment; filename="${fileResult.filename}"`);
    } else {
      reply.header('Content-Disposition', `inline; filename="${fileResult.filename}"`);
    }

    return reply.send(fileResult.buffer);
  });

  // 11. Delete an image and clean up storage (DELETE /api/ai/images/:id)
  fastify.delete('/ai/images/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = imageService.deleteImageJob(id, request.sessionId);
    if (!success) {
      return reply.code(404).send({
        error: 'Không tìm thấy ảnh để xóa hoặc bạn không có quyền xóa',
        code: 'IMAGE_NOT_FOUND',
        id,
      });
    }
    return { success: true, id };
  });

  // 12. Upload Face Reference portrait photo (POST /api/ai/images/upload-reference)
  fastify.post('/ai/images/upload-reference', async (request, reply) => {
    const parse = FaceReferenceUploadRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        error: 'Dữ liệu tải ảnh chân dung không hợp lệ',
        details: parse.error.format(),
      });
    }

    const result = await imageService.uploadFaceReference(
      request.sessionId,
      parse.data.data,
      parse.data.filename
    );

    if (!result.ok) {
      return reply.code(result.statusCode).send({
        error: result.error,
      });
    }

    return reply.code(201).send({
      success: true,
      reference: result.reference,
    });
  });

  // 13. Delete Face Reference photo (DELETE /api/ai/images/references/:id)
  fastify.delete('/ai/images/references/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = imageService.deleteFaceReference(id, request.sessionId);
    if (!result.ok) {
      return reply.code(result.statusCode).send({
        error: result.error,
        id,
      });
    }
    return { success: true, id };
  });

  // 14. Conversational Multi-Turn Image Refinement (POST /api/ai/images/edit)
  fastify.post('/ai/images/edit', async (request, reply) => {
    const parse = ConversationalEditRequestSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        error: 'Dữ liệu yêu cầu chỉnh sửa ảnh không hợp lệ',
        details: parse.error.format(),
      });
    }

    const result = await imageService.requestConversationalEdit(request.sessionId, parse.data);
    if (!result.ok) {
      return reply.code(result.statusCode || 500).send({
        error: result.error || 'Chỉnh sửa ảnh thất bại',
        job: result.job,
      });
    }

    return reply.code(201).send({
      success: true,
      job: result.job,
    });
  });

  // 15. Get Image Version Lineage / Parent-Child History (GET /api/ai/images/:id/lineage)
  fastify.get('/ai/images/:id/lineage', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lineage = imageService.getJobLineage(id, request.sessionId);
    return { lineage };
  });
};
