import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type AIImageJob,
  type AIImageGenerateRequest,
  type AIImageStylePreset,
  type ConversationalEditRequest,
  type FaceReference,
  type Look,
  AIImageJobSchema,
} from '@dangviet/contracts';
import { getAppConfig } from '../config.js';
import { dbRepo } from '../db.js';
import { imageAIAdapter, stripExifMetadata } from './image-adapter.js';
import {
  parseImagePrompt,
  buildAoDaiImagePrompt,
  buildFaceReferencedAoDaiPrompt,
  buildConversationalRefinementPrompt,
} from './image-prompt-pipeline.js';

export interface GenerateImageResult {
  ok: boolean;
  job?: AIImageJob;
  statusCode?: number;
  error?: string;
  isExisting?: boolean;
}

function detectMimeAndValidate(buffer: Buffer): {
  valid: boolean;
  mimeType?: string;
  extension?: string;
  error?: string;
} {
  if (!buffer || buffer.length < 16) {
    return { valid: false, error: 'Tệp rỗng hoặc quá nhỏ để là hình ảnh hợp lệ' };
  }

  // Check SVG / HTML injection attempts
  const prefixAscii = buffer.subarray(0, 128).toString('ascii').toLowerCase();
  if (
    prefixAscii.includes('<svg') ||
    prefixAscii.includes('<?xml') ||
    prefixAscii.includes('<!doctype html') ||
    prefixAscii.includes('<html')
  ) {
    return { valid: false, error: 'Định dạng SVG hoặc văn bản không được chấp nhận vì lý do an toàn' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: 'image/png', extension: 'png' };
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { valid: true, mimeType: 'image/webp', extension: 'webp' };
  }

  return { valid: false, error: 'Chỉ chấp nhận các định dạng ảnh JPEG, PNG và WebP' };
}

export class ImageService {
  private activeJobsCount = 0;
  private readonly maxGlobalConcurrency = 4;
  private readonly maxSessionConcurrency = 2;

  /**
   * Ensure image storage directory exists on disk.
   */
  private ensureStorageDirectory(): string {
    const config = getAppConfig();
    const storageDir = path.resolve(config.imageStorageDir);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    return storageDir;
  }

  /**
   * Create and trigger image generation job.
   * Supports asynchronous background execution or synchronous awaiting.
   */
  async requestImageGeneration(
    sessionId: string,
    req: AIImageGenerateRequest
  ): Promise<GenerateImageResult> {
    const cleanPrompt = req.prompt.trim();
    if (!cleanPrompt) {
      return { ok: false, statusCode: 400, error: 'Mô tả hình ảnh không được để trống' };
    }
    if (cleanPrompt.length > 1000) {
      return { ok: false, statusCode: 400, error: 'Mô tả hình ảnh vượt quá giới hạn 1000 ký tự' };
    }

    // 1. Rate limiting & session concurrency check
    const activeSessionJobs = dbRepo.countActiveJobsForSession(sessionId);
    if (activeSessionJobs >= this.maxSessionConcurrency) {
      return {
        ok: false,
        statusCode: 429,
        error: `Bạn đang có ${activeSessionJobs} tác vụ tạo ảnh đang chạy. Vui lòng chờ hoàn thành trước khi gửi yêu cầu mới.`,
      };
    }

    // 2. Global concurrency throttle
    if (this.activeJobsCount >= this.maxGlobalConcurrency) {
      return {
        ok: false,
        statusCode: 503,
        error: 'Hệ thống đang phục vụ tối đa các tác vụ tạo ảnh đồng thời. Vui lòng thử lại sau vài giây.',
      };
    }

    // 3. Duplicate request suppression (anti-spam within 45s)
    const effectivePreset = req.stylePreset || 'elegant_fashion_2d';
    const recentDuplicate = dbRepo.findRecentDuplicateJob(sessionId, cleanPrompt, effectivePreset, 45000);
    if (recentDuplicate) {
      if (recentDuplicate.status === 'pending' || recentDuplicate.status === 'processing') {
        return {
          ok: true,
          job: recentDuplicate,
          isExisting: true,
        };
      }
      // If completed within last 30s, reuse to save tokens
      if (
        recentDuplicate.status === 'completed' &&
        Date.now() - new Date(recentDuplicate.createdAt).getTime() < 30000
      ) {
        return {
          ok: true,
          job: recentDuplicate,
          isExisting: true,
        };
      }
    }

    // 4. Resolve base look (if requested)
    let baseLook: Look | undefined = undefined;
    if (req.lookId) {
      const foundLook = dbRepo.getLook(req.lookId, sessionId);
      if (foundLook) {
        baseLook = foundLook;
      }
    } else if (req.useCurrentLookAsBase) {
      const session = dbRepo.getSession(sessionId);
      if (session?.current_look_id) {
        const currentLook = dbRepo.getLook(session.current_look_id, sessionId);
        if (currentLook) {
          baseLook = currentLook;
        }
      }
    }

    // 5. Stage 1: Natural language entity parsing
    const parsedDetails = parseImagePrompt(cleanPrompt, baseLook, req.stylePreset, req.customConfig);

    // 6. Stage 2: Face reference resolution & prompt building
    let referenceBuffer: Buffer | undefined = undefined;
    let referenceMime: string | undefined = undefined;

    if (req.referenceId) {
      const faceRef = dbRepo.getFaceReference(req.referenceId, sessionId);
      if (!faceRef) {
        return {
          ok: false,
          statusCode: 400,
          error: 'Ảnh tham chiếu khuôn mặt không tồn tại hoặc đã hết hạn',
        };
      }
      if (!fs.existsSync(faceRef.storage_path)) {
        return {
          ok: false,
          statusCode: 400,
          error: 'Tệp ảnh tham chiếu không tìm thấy trên hệ thống',
        };
      }
      referenceBuffer = fs.readFileSync(faceRef.storage_path);
      referenceMime = faceRef.mime_type;
    }

    let finalPrompt: string;
    if (referenceBuffer) {
      finalPrompt = buildFaceReferencedAoDaiPrompt(parsedDetails, {
        facePreservation: req.facePreservation ?? true,
        backgroundSetting: req.backgroundSetting,
        poseStyle: req.poseStyle,
        stylePreset: req.stylePreset,
      });
    } else {
      finalPrompt = buildAoDaiImagePrompt(parsedDetails, { stylePreset: req.stylePreset });
    }
    parsedDetails.finalPrompt = finalPrompt;

    // 7. Create Job Record
    const jobId = `img_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const job: AIImageJob = {
      id: jobId,
      sessionId,
      lookId: baseLook?.id,
      prompt: cleanPrompt,
      stylePreset: req.stylePreset || 'elegant_fashion_2d',
      status: 'processing',
      modelUsed: getAppConfig().aiImageModel,
      parsedDetails,
      referenceId: req.referenceId || null,
      parentImageId: req.parentImageId || null,
      iteration: 1,
      backgroundSetting: req.backgroundSetting,
      poseStyle: req.poseStyle,
      createdAt: now,
      updatedAt: now,
    };

    dbRepo.createAIImageJob(job);

    // 8. If caller requested async mode: trigger in background and return job immediately
    if (req.async) {
      void this.executeJobInBackground(job, finalPrompt, referenceBuffer, referenceMime);
      return {
        ok: true,
        job,
      };
    }

    // Synchronous execution mode: await generation and return complete result
    const completedJob = await this.executeJob(job, finalPrompt, referenceBuffer, referenceMime);
    if (completedJob.status === 'failed') {
      return {
        ok: false,
        statusCode: 502,
        job: completedJob,
        error: completedJob.errorMessage || 'Tạo ảnh thất bại qua cổng 9router AI.',
      };
    }

    return {
      ok: true,
      job: completedJob,
    };
  }

  /**
   * Conversational Multi-Turn Image Refinement (Section E).
   * Refines an existing completed image using natural language commands.
   */
  async requestConversationalEdit(
    sessionId: string,
    req: ConversationalEditRequest
  ): Promise<GenerateImageResult> {
    const cleanInstruction = req.instruction.trim();
    if (!cleanInstruction) {
      return { ok: false, statusCode: 400, error: 'Câu lệnh chỉnh sửa không được để trống' };
    }
    if (cleanInstruction.length > 1000) {
      return { ok: false, statusCode: 400, error: 'Câu lệnh chỉnh sửa vượt quá giới hạn 1000 ký tự' };
    }

    // 1. Resolve parent image job
    const parentJob = dbRepo.getAIImageJob(req.parentImageId, sessionId);
    if (!parentJob) {
      return {
        ok: false,
        statusCode: 404,
        error: 'Không tìm thấy ảnh gốc để chỉnh sửa hoặc bạn không có quyền truy cập',
      };
    }
    if (parentJob.status !== 'completed') {
      return {
        ok: false,
        statusCode: 400,
        error: 'Ảnh gốc chưa được tạo xong hoặc đã bị lỗi',
      };
    }

    // 2. Read parent image buffer for multimodal reference
    const fileResult = this.getImageFile(parentJob.id, sessionId);
    if (!fileResult.ok) {
      return { ok: false, statusCode: fileResult.statusCode, error: fileResult.error };
    }

    // 3. Concurrency check
    const activeSessionJobs = dbRepo.countActiveJobsForSession(sessionId);
    if (activeSessionJobs >= this.maxSessionConcurrency) {
      return {
        ok: false,
        statusCode: 429,
        error: `Bạn đang có ${activeSessionJobs} tác vụ tạo ảnh đang chạy. Vui lòng chờ hoàn thành trước khi gửi yêu cầu mới.`,
      };
    }

    if (this.activeJobsCount >= this.maxGlobalConcurrency) {
      return {
        ok: false,
        statusCode: 503,
        error: 'Hệ thống đang phục vụ tối đa các tác vụ tạo ảnh đồng thời. Vui lòng thử lại sau vài giây.',
      };
    }

    // 4. Build conversational refinement prompt
    const nextIteration = (parentJob.iteration || 1) + 1;
    const finalPrompt = buildConversationalRefinementPrompt(
      parentJob.parsedDetails?.finalPrompt || parentJob.prompt,
      cleanInstruction,
      {
        backgroundSetting: req.backgroundSetting,
        poseStyle: req.poseStyle,
        stylePreset: req.stylePreset || parentJob.stylePreset,
      }
    );

    // 5. Create child job
    const jobId = `img_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    const childJob: AIImageJob = {
      id: jobId,
      sessionId,
      lookId: parentJob.lookId,
      prompt: cleanInstruction,
      stylePreset: req.stylePreset || parentJob.stylePreset,
      status: 'processing',
      modelUsed: getAppConfig().aiImageModel,
      parentImageId: parentJob.id,
      referenceId: parentJob.referenceId,
      iteration: nextIteration,
      refinementPrompt: cleanInstruction,
      backgroundSetting: req.backgroundSetting || parentJob.backgroundSetting,
      poseStyle: req.poseStyle || parentJob.poseStyle,
      parsedDetails: {
        ...(parentJob.parsedDetails || {
          unsupportedRequests: [],
          warnings: [],
          preservedLocks: [],
        }),
        finalPrompt,
      },
      createdAt: now,
      updatedAt: now,
    };

    dbRepo.createAIImageJob(childJob);

    // 6. Execution (async or sync)
    if (req.async) {
      void this.executeJobInBackground(childJob, finalPrompt, fileResult.buffer, fileResult.mimeType);
      return {
        ok: true,
        job: childJob,
      };
    }

    const completedJob = await this.executeJob(
      childJob,
      finalPrompt,
      fileResult.buffer,
      fileResult.mimeType
    );
    if (completedJob.status === 'failed') {
      return {
        ok: false,
        statusCode: 502,
        job: completedJob,
        error: completedJob.errorMessage || 'Chỉnh sửa ảnh thất bại qua cổng 9router AI.',
      };
    }

    return {
      ok: true,
      job: completedJob,
    };
  }

  /**
   * Upload face reference portrait photo (Section B & F).
   * Validates size, magic bytes, strips EXIF, and sets 24h expiration.
   */
  async uploadFaceReference(
    sessionId: string,
    data: string,
    originalFilename?: string
  ): Promise<{ ok: true; reference: FaceReference } | { ok: false; statusCode: number; error: string }> {
    if (!data || typeof data !== 'string') {
      return { ok: false, statusCode: 400, error: 'Dữ liệu ảnh không hợp lệ' };
    }

    const base64Clean = data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    if (!base64Clean) {
      return { ok: false, statusCode: 400, error: 'Dữ liệu ảnh base64 rỗng' };
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Clean, 'base64');
    } catch {
      return { ok: false, statusCode: 400, error: 'Giải mã Base64 thất bại' };
    }

    const MAX_SIZE = 8 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Kích thước ảnh vượt quá giới hạn cho phép (tối đa 8 MB)',
      };
    }

    const validation = detectMimeAndValidate(buffer);
    if (!validation.valid || !validation.mimeType || !validation.extension) {
      return {
        ok: false,
        statusCode: 400,
        error: validation.error || 'Định dạng tệp không được hỗ trợ',
      };
    }

    // Strip EXIF metadata (GPS, camera model, timestamps)
    const strippedBuffer = stripExifMetadata(buffer);

    // Ensure secure reference storage directory
    const storageDir = this.ensureStorageDirectory();
    const refsDir = path.join(storageDir, 'references');
    if (!fs.existsSync(refsDir)) {
      fs.mkdirSync(refsDir, { recursive: true });
    }

    const refId = `ref_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const filename = `${refId}.${validation.extension}`;
    const storagePath = path.join(refsDir, filename);

    fs.writeFileSync(storagePath, strippedBuffer);

    // Retention: 24 hours
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const createdAt = now.toISOString();

    dbRepo.saveFaceReference({
      id: refId,
      sessionId,
      storagePath,
      mimeType: validation.mimeType,
      fileSize: strippedBuffer.length,
      createdAt,
      expiresAt,
    });

    console.log(
      `[FACE REFERENCE] Uploaded refId=${refId}, size=${strippedBuffer.length}B, mime=${validation.mimeType}`
    );

    return {
      ok: true,
      reference: {
        id: refId,
        mimeType: validation.mimeType,
        fileSize: strippedBuffer.length,
        createdAt,
        expiresAt,
      },
    };
  }

  /**
   * Delete face reference photo and clean up storage (Section F).
   */
  deleteFaceReference(
    referenceId: string,
    sessionId: string
  ): { ok: true } | { ok: false; statusCode: number; error: string } {
    const existing = dbRepo.getFaceReference(referenceId, sessionId);
    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        error: 'Không tìm thấy ảnh tham chiếu hoặc bạn không có quyền truy cập',
      };
    }

    if (existing.storage_path && fs.existsSync(existing.storage_path)) {
      try {
        fs.unlinkSync(existing.storage_path);
      } catch (err: any) {
        console.warn(`[FACE REFERENCE] Không thể xóa tệp ${existing.storage_path}:`, err.message);
      }
    }

    dbRepo.deleteFaceReference(referenceId, sessionId);
    return { ok: true };
  }

  /**
   * Cleanup expired face references (> 24 hours retention, Section F).
   */
  cleanupExpiredReferences(): number {
    const expiredList = dbRepo.getExpiredFaceReferences();
    let cleaned = 0;
    for (const item of expiredList) {
      if (item.storage_path && fs.existsSync(item.storage_path)) {
        try {
          fs.unlinkSync(item.storage_path);
        } catch {}
      }
      cleaned++;
    }
    dbRepo.deleteExpiredFaceReferences();
    if (cleaned > 0) {
      console.log(`[CLEANUP] Đã dọn dẹp ${cleaned} ảnh tham chiếu hết hạn (>24h)`);
    }
    return cleaned;
  }

  /**
   * Get version lineage tree for conversational refinement (Section E).
   */
  getJobLineage(jobId: string, sessionId?: string): AIImageJob[] {
    return dbRepo.getAIImageJobLineage(jobId, sessionId);
  }

  /**
   * Background execution handler for async queue.
   */
  private async executeJobInBackground(
    job: AIImageJob,
    finalPrompt: string,
    referenceBuffer?: Buffer,
    referenceMime?: string
  ): Promise<void> {
    try {
      await this.executeJob(job, finalPrompt, referenceBuffer, referenceMime);
    } catch (err: any) {
      console.error(`[IMAGE SERVICE] Lỗi không xử lý được trong background job ${job.id}:`, err.message);
    }
  }

  /**
   * Execute image generation through image adapter, validate binary, and save to disk.
   */
  private async executeJob(
    job: AIImageJob,
    finalPrompt: string,
    referenceBuffer?: Buffer,
    referenceMime?: string
  ): Promise<AIImageJob> {
    this.activeJobsCount++;
    const startTime = Date.now();

    try {
      // Check adapter configuration first
      if (!imageAIAdapter.isConfigured()) {
        const errorMsg = 'Chưa cấu hình API Key tạo ảnh trong biến môi trường (AI_IMAGE_API_KEY hoặc AI_API_KEY).';
        dbRepo.updateAIImageJob(job.id, {
          status: 'failed',
          errorMessage: errorMsg,
          durationMs: Date.now() - startTime,
        });
        return {
          ...job,
          status: 'failed',
          errorMessage: errorMsg,
          durationMs: Date.now() - startTime,
          updatedAt: new Date().toISOString(),
        };
      }

      // Call Image AI Adapter (multimodal if reference buffer is present)
      const result = referenceBuffer
        ? await imageAIAdapter.generateImageWithReference({
            prompt: finalPrompt,
            referenceImageBuffer: referenceBuffer,
            referenceMimeType: referenceMime,
            stylePreset: job.stylePreset,
            aspectRatio: '3:4',
          })
        : await imageAIAdapter.generateImage({
            prompt: finalPrompt,
            stylePreset: job.stylePreset,
            aspectRatio: '3:4',
          });

      const durationMs = Date.now() - startTime;

      if (!result.success || !result.imageBuffer) {
        const errorMsg = result.error || 'Gateway tạo ảnh không trả về dữ liệu hợp lệ.';
        dbRepo.updateAIImageJob(job.id, {
          status: 'failed',
          errorMessage: errorMsg,
          durationMs,
        });
        return {
          ...job,
          status: 'failed',
          errorMessage: errorMsg,
          durationMs,
          updatedAt: new Date().toISOString(),
        };
      }

      // Determine file extension from validated MIME type
      const mime = result.mimeType || 'image/jpeg';
      const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const filename = `${job.id}.${extension}`;

      // Save to disk
      const storageDir = this.ensureStorageDirectory();
      const absoluteStoragePath = path.join(storageDir, filename);

      fs.writeFileSync(absoluteStoragePath, result.imageBuffer);

      // Update DB record to completed
      dbRepo.updateAIImageJob(job.id, {
        status: 'completed',
        storagePath: absoluteStoragePath,
        mimeType: mime,
        fileSize: result.imageBuffer.length,
        width: result.width || 1024,
        height: result.height || 1024,
        modelUsed: result.modelUsed || getAppConfig().aiImageModel,
        durationMs,
      });

      const updatedJob = dbRepo.getAIImageJob(job.id);
      return updatedJob || {
        ...job,
        status: 'completed',
        imageUrl: `/api/ai/images/${job.id}/file`,
        downloadUrl: `/api/ai/images/${job.id}/file?download=1`,
        modelUsed: result.modelUsed || getAppConfig().aiImageModel,
        width: 1024,
        height: 1024,
        fileSize: result.imageBuffer.length,
        durationMs,
        updatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMsg = `Lỗi hệ thống khi tạo ảnh: ${err.message}`;
      dbRepo.updateAIImageJob(job.id, {
        status: 'failed',
        errorMessage: errorMsg,
        durationMs,
      });
      return {
        ...job,
        status: 'failed',
        errorMessage: errorMsg,
        durationMs,
        updatedAt: new Date().toISOString(),
      };
    } finally {
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
    }
  }

  /**
   * Get image file content and headers for HTTP serving.
   * Protects against directory traversal and ensures file exists.
   */
  getImageFile(
    jobId: string,
    sessionId?: string
  ): { ok: true; buffer: Buffer; mimeType: string; filename: string } | { ok: false; statusCode: number; error: string } {
    const meta = dbRepo.getAIImageJobStoragePath(jobId, sessionId);
    if (!meta) {
      return { ok: false, statusCode: 404, error: 'Không tìm thấy hình ảnh yêu cầu' };
    }

    if (meta.status !== 'completed' || !meta.storagePath) {
      return { ok: false, statusCode: 400, error: 'Hình ảnh chưa sẵn sàng hoặc đã tạo thất bại' };
    }

    // Resolve safe path
    const storageDir = path.resolve(getAppConfig().imageStorageDir);
    let resolvedPath = path.resolve(meta.storagePath);
    let rel = path.relative(storageDir, resolvedPath);

    // Verify path is strictly within storage directory
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      const candidate = path.resolve(storageDir, path.basename(meta.storagePath));
      const relCandidate = path.relative(storageDir, candidate);
      if (!relCandidate.startsWith('..') && !path.isAbsolute(relCandidate)) {
        resolvedPath = candidate;
      } else {
        return { ok: false, statusCode: 403, error: 'Đường dẫn tệp không hợp lệ' };
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      return { ok: false, statusCode: 404, error: 'Tệp hình ảnh không tồn tại trên máy chủ' };
    }

    try {
      const buffer = fs.readFileSync(resolvedPath);
      const mimeType = meta.mimeType || 'image/jpeg';
      const filename = path.basename(resolvedPath);
      return { ok: true, buffer, mimeType, filename };
    } catch (err: any) {
      return { ok: false, statusCode: 500, error: `Không thể đọc tệp ảnh: ${err.message}` };
    }
  }

  /**
   * Delete an image job and remove its file from disk.
   */
  deleteImageJob(jobId: string, sessionId?: string): boolean {
    const meta = dbRepo.getAIImageJobStoragePath(jobId, sessionId);
    if (meta?.storagePath) {
      try {
        const storageDir = path.resolve(getAppConfig().imageStorageDir);
        let resolvedPath = path.resolve(meta.storagePath);
        let rel = path.relative(storageDir, resolvedPath);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          resolvedPath = path.resolve(storageDir, path.basename(meta.storagePath));
          rel = path.relative(storageDir, resolvedPath);
        }
        if (!rel.startsWith('..') && !path.isAbsolute(rel) && fs.existsSync(resolvedPath)) {
          fs.unlinkSync(resolvedPath);
        }
      } catch (err: any) {
        console.warn(`[IMAGE SERVICE] Không thể xóa tệp ảnh ${jobId}:`, err.message);
      }
    }
    return dbRepo.deleteAIImageJob(jobId, sessionId);
  }
}

export const imageService = new ImageService();
