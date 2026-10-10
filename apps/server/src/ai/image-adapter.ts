import { type AIImageStylePreset } from '@dangviet/contracts';
import { getAppConfig } from '../config.js';

export interface ImageGenerationResult {
  success: boolean;
  imageBuffer?: Buffer;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  width?: number;
  height?: number;
  modelUsed?: string;
  durationMs?: number;
  error?: string;
  statusCode?: number;
}

export interface ImageAIAdapter {
  isConfigured(): boolean;
  verifyCapability(): Promise<{ available: boolean; message: string; verifiedLive?: boolean }>;
  generateImage(options: {
    prompt: string;
    stylePreset?: AIImageStylePreset;
    aspectRatio?: '3:4' | '1:1';
  }): Promise<ImageGenerationResult>;
  generateImageWithReference(options: {
    prompt: string;
    referenceImageBuffer?: Buffer;
    referenceMimeType?: string;
    stylePreset?: AIImageStylePreset;
    aspectRatio?: '3:4' | '1:1';
  }): Promise<ImageGenerationResult>;
}

/**
 * Strip EXIF, GPS, and camera metadata from image buffer (JPEG, PNG, WebP)
 * to ensure strict privacy (Section F).
 */
export function stripExifMetadata(buffer: Buffer): Buffer {
  if (!buffer || buffer.length < 16) return buffer;

  // 1. JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const chunks: Buffer[] = [buffer.subarray(0, 2)]; // Keep SOI: FF D8
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        chunks.push(buffer.subarray(offset));
        break;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd9) {
        // EOI
        chunks.push(buffer.subarray(offset, offset + 2));
        break;
      }
      if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        chunks.push(buffer.subarray(offset, offset + 2));
        offset += 2;
        continue;
      }

      if (offset + 4 > buffer.length) {
        chunks.push(buffer.subarray(offset));
        break;
      }

      const length = buffer.readUInt16BE(offset + 2);
      const segmentEnd = offset + 2 + length;
      if (segmentEnd > buffer.length) {
        chunks.push(buffer.subarray(offset));
        break;
      }

      // Marker 0xE1 = APP1 (Exif/XMP), 0xFE = Comment
      if (marker === 0xe1 || marker === 0xfe) {
        // Skip Exif / Comment segment
        offset = segmentEnd;
      } else {
        chunks.push(buffer.subarray(offset, segmentEnd));
        offset = segmentEnd;
      }

      // If marker is SOS (Start of Scan 0xDA), entropy-coded image data follows until EOI
      if (marker === 0xda) {
        chunks.push(buffer.subarray(offset));
        break;
      }
    }
    return Buffer.concat(chunks);
  }

  // 2. PNG
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const chunks: Buffer[] = [buffer.subarray(0, 8)]; // 8-byte PNG header
    let offset = 8;
    const strippedTypes = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const chunkType = buffer.subarray(offset + 4, offset + 8).toString('ascii');
      const totalChunkSize = 4 + 4 + length + 4; // len + type + data + crc

      if (offset + totalChunkSize > buffer.length) {
        chunks.push(buffer.subarray(offset));
        break;
      }

      if (strippedTypes.has(chunkType)) {
        offset += totalChunkSize;
      } else {
        chunks.push(buffer.subarray(offset, offset + totalChunkSize));
        offset += totalChunkSize;
      }

      if (chunkType === 'IEND') break;
    }
    return Buffer.concat(chunks);
  }

  // 3. WebP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    let offset = 12;
    const validChunks: Buffer[] = [];
    const strippedChunks = new Set(['EXIF', 'XMP ']);

    while (offset + 8 <= buffer.length) {
      const fourCC = buffer.subarray(offset, offset + 4).toString('ascii');
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const paddedSize = chunkSize + (chunkSize % 2);
      const totalSize = 8 + paddedSize;

      if (offset + totalSize > buffer.length) {
        validChunks.push(buffer.subarray(offset));
        break;
      }

      if (strippedChunks.has(fourCC)) {
        offset += totalSize;
      } else {
        validChunks.push(buffer.subarray(offset, offset + totalSize));
        offset += totalSize;
      }
    }

    const payload = Buffer.concat(validChunks);
    const newHeader = Buffer.alloc(12);
    newHeader.write('RIFF', 0, 4, 'ascii');
    newHeader.writeUInt32LE(payload.length + 4, 4);
    newHeader.write('WEBP', 8, 4, 'ascii');
    return Buffer.concat([newHeader, payload]);
  }

  return buffer;
}

/**
 * Validate image buffer using magic bytes and size constraints.
 * Protects against HTML error pages masquerading as images, SVG injection, or truncated files.
 */
export function inspectImageBuffer(buffer: Buffer): {
  valid: boolean;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  error?: string;
} {
  if (!buffer || buffer.length < 100) {
    return { valid: false, error: 'Dữ liệu ảnh nhận được quá nhỏ hoặc rỗng (<100 bytes).' };
  }
  if (buffer.length > 15 * 1024 * 1024) {
    return { valid: false, error: 'Kích thước tệp ảnh vượt quá giới hạn an toàn 15MB.' };
  }

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
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
    return { valid: true, mimeType: 'image/png' };
  }

  // WebP magic bytes: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { valid: true, mimeType: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Chữ ký tệp (magic bytes) không khớp định dạng ảnh hợp lệ (chỉ chấp nhận JPEG, PNG, WebP).',
  };
}

/**
 * Anti-SSRF check for remote image URLs returned by external gateway.
 * Forbids localhost, loopback, private IP ranges and AWS metadata IPs.
 */
export function isSafeDownloadUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const rawHostname = parsed.hostname.toLowerCase();
    const hostname = rawHostname.replace(/^\[|\]$/g, '');
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '::' ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }

    // Reject private IPv4 ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    if (
      /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(
        hostname
      )
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Live Image Generation Adapter connected to 9router POST /v1/images/generations.
 */
export class NineRouterImageAdapter implements ImageAIAdapter {
  private lastLiveVerification: { timestamp: number; ok: boolean; message: string } | null = null;

  private get baseUrl(): string {
    return getAppConfig().aiImageBaseUrl.replace(/\/+$/, '');
  }

  private get apiKey(): string {
    return getAppConfig().aiImageApiKey;
  }

  private get model(): string {
    return getAppConfig().aiImageModel || 'ag/gemini-3.1-flash-image';
  }

  private get timeoutMs(): number {
    return getAppConfig().aiImageTimeoutMs || 120000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Verify capability status.
   * If not configured, immediately returns false without network calls.
   * Caches verified state for 10 minutes to avoid redundant checks.
   */
  async verifyCapability(): Promise<{ available: boolean; message: string; verifiedLive?: boolean }> {
    if (!this.isConfigured()) {
      return {
        available: false,
        message: 'Chưa cấu hình AI_IMAGE_API_KEY hoặc AI_API_KEY trong tệp cấu hình.',
        verifiedLive: false,
      };
    }

    const now = Date.now();
    if (this.lastLiveVerification && now - this.lastLiveVerification.timestamp < 10 * 60 * 1000) {
      return {
        available: this.lastLiveVerification.ok,
        message: this.lastLiveVerification.message,
        verifiedLive: this.lastLiveVerification.ok,
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const msg = `Cổng 9router hoạt động sẵn sàng (Mô hình tạo ảnh: ${this.model}).`;
        this.lastLiveVerification = { timestamp: now, ok: true, message: msg };
        return {
          available: true,
          message: msg,
          verifiedLive: true,
        };
      } else {
        const msg = `Cổng 9router phản hồi mã HTTP ${response.status} khi kiểm tra endpoint.`;
        this.lastLiveVerification = { timestamp: now, ok: false, message: msg };
        return {
          available: false,
          message: msg,
          verifiedLive: false,
        };
      }
    } catch (err: any) {
      const msg = `Không thể kết nối đến cổng tạo ảnh 9router: ${err.message}`;
      this.lastLiveVerification = { timestamp: now, ok: false, message: msg };
      return {
        available: false,
        message: msg,
        verifiedLive: false,
      };
    }
  }

  /**
   * Mark live verification as confirmed (e.g. following successful generation test).
   */
  markVerifiedLive(): void {
    this.lastLiveVerification = {
      timestamp: Date.now(),
      ok: true,
      message: `Đã xác thực hoạt động thực tế với model ${this.model}`,
    };
  }

  async generateImage(options: {
    prompt: string;
    stylePreset?: AIImageStylePreset;
    aspectRatio?: '3:4' | '1:1';
  }): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        statusCode: 401,
        error: 'Chưa cấu hình AI_IMAGE_API_KEY. Vui lòng cung cấp khóa API trong .env.',
      };
    }

    const startTime = Date.now();
    const cleanPrompt = options.prompt.trim();

    try {
      const requestPayload = {
        model: this.model,
        prompt: cleanPrompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      };

      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let cleanError = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const parsedErr = JSON.parse(errorText);
          if (parsedErr?.error?.message) {
            cleanError = `[${response.status}] ${parsedErr.error.message}`;
          }
        } catch {
          if (errorText.length > 0) {
            cleanError = `[${response.status}] ${errorText.slice(0, 200)}`;
          }
        }

        if (response.status === 401) {
          return {
            success: false,
            statusCode: 401,
            error: `Xác thực thất bại với 9router (HTTP 401): Khóa API không hợp lệ hoặc đã hết hạn.`,
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            statusCode: 403,
            error: `Không có quyền truy cập mô hình ${this.model} trên 9router (HTTP 403).`,
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            statusCode: 429,
            error: `Đã vượt giới hạn tần suất yêu cầu tạo ảnh 9router (HTTP 429 Rate Limit). Vui lòng đợi trong giây lát rồi thử lại.`,
          };
        }

        return {
          success: false,
          statusCode: response.status,
          error: `Máy chủ tạo ảnh 9router trả về lỗi: ${cleanError}`,
        };
      }

      const data = (await response.json()) as any;
      const firstItem = data?.data?.[0];

      if (!firstItem) {
        return {
          success: false,
          statusCode: 502,
          error: 'Gateway 9router không trả về dữ liệu hình ảnh (mảng data rỗng).',
        };
      }

      let rawBuffer: Buffer | null = null;

      // Case A: Gateway returned b64_json
      if (typeof firstItem.b64_json === 'string' && firstItem.b64_json.length > 0) {
        try {
          rawBuffer = Buffer.from(firstItem.b64_json, 'base64');
        } catch (err: any) {
          return {
            success: false,
            statusCode: 502,
            error: `Không thể giải mã base64 hình ảnh: ${err.message}`,
          };
        }
      }
      // Case B: Gateway returned remote url
      else if (typeof firstItem.url === 'string' && firstItem.url.length > 0) {
        const downloadUrl = firstItem.url;
        if (!isSafeDownloadUrl(downloadUrl)) {
          return {
            success: false,
            statusCode: 400,
            error: 'Địa chỉ URL tải ảnh bị từ chối do không an toàn (SSRF Protection).',
          };
        }

        try {
          const dlResponse = await fetch(downloadUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(30000),
          });
          if (!dlResponse.ok) {
            return {
              success: false,
              statusCode: 502,
              error: `Tải ảnh từ URL trung gian thất bại (HTTP ${dlResponse.status}).`,
            };
          }
          const arrayBuf = await dlResponse.arrayBuffer();
          rawBuffer = Buffer.from(arrayBuf);
        } catch (dlErr: any) {
          return {
            success: false,
            statusCode: 502,
            error: `Lỗi tải ảnh từ URL: ${dlErr.message}`,
          };
        }
      }

      if (!rawBuffer) {
        return {
          success: false,
          statusCode: 502,
          error: 'Không tìm thấy dữ liệu ảnh b64_json hoặc URL trong phản hồi của gateway.',
        };
      }

      // Check buffer integrity and signature
      const inspection = inspectImageBuffer(rawBuffer);
      if (!inspection.valid || !inspection.mimeType) {
        return {
          success: false,
          statusCode: 502,
          error: inspection.error || 'Dữ liệu trả về không phải là tệp ảnh hợp lệ.',
        };
      }

      // Mark live verification confirmed
      this.markVerifiedLive();

      return {
        success: true,
        imageBuffer: rawBuffer,
        mimeType: inspection.mimeType,
        width: 1024,
        height: 1024,
        modelUsed: this.model,
        durationMs,
      };
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
        return {
          success: false,
          statusCode: 504,
          error: `Yêu cầu tạo ảnh quá thời gian chờ (${this.timeoutMs / 1000}s). Vui lòng thử lại sau.`,
        };
      }
      return {
        success: false,
        statusCode: 500,
        error: `Lỗi ngoại lệ khi gọi cổng tạo ảnh: ${err.message}`,
      };
    }
  }

  async generateImageWithReference(options: {
    prompt: string;
    referenceImageBuffer?: Buffer;
    referenceMimeType?: string;
    stylePreset?: AIImageStylePreset;
    aspectRatio?: '3:4' | '1:1';
  }): Promise<ImageGenerationResult> {
    if (!options.referenceImageBuffer) {
      return this.generateImage(options);
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        statusCode: 401,
        error: 'Chưa cấu hình AI_IMAGE_API_KEY. Vui lòng cung cấp khóa API trong .env.',
      };
    }

    const startTime = Date.now();
    const cleanPrompt = options.prompt.trim();
    const refMime = options.referenceMimeType || 'image/jpeg';
    const refB64 = options.referenceImageBuffer.toString('base64');
    const dataUri = `data:${refMime};base64,${refB64}`;

    try {
      const requestPayload = {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: cleanPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUri,
                },
              },
            ],
          },
        ],
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let cleanError = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const parsedErr = JSON.parse(errorText);
          if (parsedErr?.error?.message) {
            cleanError = `[${response.status}] ${parsedErr.error.message}`;
          }
        } catch {
          if (errorText.length > 0) {
            cleanError = `[${response.status}] ${errorText.slice(0, 200)}`;
          }
        }

        if (response.status === 401) {
          return {
            success: false,
            statusCode: 401,
            error: `Xác thực thất bại với 9router (HTTP 401): Khóa API không hợp lệ hoặc đã hết hạn.`,
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            statusCode: 403,
            error: `Không có quyền truy cập mô hình ${this.model} trên 9router (HTTP 403).`,
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            statusCode: 429,
            error: `Đã vượt giới hạn tần suất yêu cầu tạo ảnh 9router (HTTP 429 Rate Limit). Vui lòng đợi trong giây lát rồi thử lại.`,
          };
        }

        return {
          success: false,
          statusCode: response.status,
          error: `Máy chủ multimodal 9router trả về lỗi: ${cleanError}`,
        };
      }

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content || '';

      // Match markdown image data URI: ![image](data:image/...;base64,...) or raw data:image/...;base64,...
      const match = content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]+)/);
      let rawBuffer: Buffer | null = null;

      if (match && match[1]) {
        try {
          rawBuffer = Buffer.from(match[1], 'base64');
        } catch (err: any) {
          return {
            success: false,
            statusCode: 502,
            error: `Không thể giải mã base64 hình ảnh từ phản hồi multimodal: ${err.message}`,
          };
        }
      } else {
        // Fallback: check if content itself is pure base64
        const trimmed = content.trim();
        if (/^[A-Za-z0-9+/=]{100,}$/.test(trimmed)) {
          rawBuffer = Buffer.from(trimmed, 'base64');
        }
      }

      if (!rawBuffer) {
        return {
          success: false,
          statusCode: 502,
          error: 'Mô hình multimodal 9router không trả về dữ liệu hình ảnh (không tìm thấy data URI hợp lệ trong phản hồi).',
        };
      }

      // Check buffer integrity and signature
      const inspection = inspectImageBuffer(rawBuffer);
      if (!inspection.valid || !inspection.mimeType) {
        return {
          success: false,
          statusCode: 502,
          error: inspection.error || 'Dữ liệu trả về không phải là tệp ảnh hợp lệ.',
        };
      }

      this.markVerifiedLive();

      return {
        success: true,
        imageBuffer: rawBuffer,
        mimeType: inspection.mimeType,
        width: 1024,
        height: 1024,
        modelUsed: this.model,
        durationMs,
      };
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
        return {
          success: false,
          statusCode: 504,
          error: `Yêu cầu tạo ảnh multimodal quá thời gian chờ (${this.timeoutMs / 1000}s). Vui lòng thử lại sau.`,
        };
      }
      return {
        success: false,
        statusCode: 500,
        error: `Lỗi ngoại lệ khi gọi cổng tạo ảnh multimodal: ${err.message}`,
      };
    }
  }
}

export const imageAIAdapter: ImageAIAdapter = new NineRouterImageAdapter();
