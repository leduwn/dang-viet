import {
  type AIStatus,
  type Look,
  type AIChatResponse,
  type StructuredDesignRequest,
  type GarmentConfig,
} from '@dangviet/contracts';
import { type AIAdapter } from './adapter.js';
import { MockAIAdapter } from './mock-adapter.js';

export class NineRouterAdapter implements AIAdapter {
  private fallbackMock = new MockAIAdapter();
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = (process.env.AI_BASE_URL || 'https://api.9router.com/v1').replace(/\/+$/, '');
    this.apiKey = process.env.AI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'gemini-2.5-flash';
    this.timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 30000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async getStatus(): Promise<AIStatus> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        mode: 'mock',
        provider: '9router (Chưa cấu hình API Key)',
        model: this.model,
        capabilities: {
          textChat: true,
          structuredCommands: true,
          imageGen: false,
        },
        message: 'Chưa cấu hình AI_API_KEY trong .env. Ứng dụng tự động kích hoạt Mock Adapter an toàn.',
      };
    }

    // Try a ping check
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return {
          configured: true,
          mode: 'live',
          provider: '9router Live Gateway',
          model: this.model,
          capabilities: {
            textChat: true,
            structuredCommands: true,
            imageGen: false,
          },
          message: 'Đã kết nối thành công tới cổng dịch vụ 9router.',
        };
      } else {
        return {
          configured: true,
          mode: 'mock',
          provider: `9router (HTTP ${response.status})`,
          model: this.model,
          capabilities: {
            textChat: true,
            structuredCommands: true,
            imageGen: false,
          },
          message: `Dịch vụ 9router phản hồi mã lỗi ${response.status}. Tự động chuyển tiếp sang Mock Adapter.`,
        };
      }
    } catch (err: any) {
      return {
        configured: true,
        mode: 'mock',
        provider: '9router (Không thể kết nối mạng)',
        model: this.model,
        capabilities: {
          textChat: true,
          structuredCommands: true,
          imageGen: false,
        },
        message: `Lỗi kết nối tới 9router (${err.message}). Đang hoạt động ở chế độ Mock Adapter an toàn.`,
      };
    }
  }

  async chat(
    look: Look,
    message: string,
    history: Array<{ role: string; content: string }>
  ): Promise<AIChatResponse> {
    if (!this.isConfigured()) {
      return this.fallbackMock.chat(look, message, history);
    }

    try {
      const systemPrompt = `Bạn là Trợ lý Dáng Việt chuyên gia về Việt phục truyền thống và phong cách remix Gen Z.
Quy tắc:
1. Trả lời bằng tiếng Việt lịch thiệp, gợi cảm hứng, dựa trên sự thật lịch sử.
2. Bộ phối hiện tại:
   - Sự kiện: ${look.eventId}
   - Phong cách: ${look.styleId}
   - Màu áo: ${look.config.primaryColor.name} (${look.config.primaryColor.hex}) [Khóa: ${look.locks.primaryColor}]
   - Màu quần: ${look.config.pantsColor.name} (${look.config.pantsColor.hex}) [Khóa: ${look.locks.pantsColor}]
   - Cổ áo: ${look.config.collarStyle}
   - Tay áo: ${look.config.sleeveStyle}
   - Phụ kiện: ${look.config.accessories.join(', ') || 'Không có'}
3. Nếu người dùng muốn đổi chi tiết trang phục, hãy đưa ra gợi ý thẩm mỹ và giải thích.`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-4), // Last 4 messages only to avoid token overflow
            { role: 'user', content: message },
          ],
          max_tokens: 600,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`9router API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content || '';

      // Also use fallback mock to extract structured commands if user requested action
      const mockResult = await this.fallbackMock.chat(look, message, history);

      return {
        reply: text,
        explanation: mockResult.explanation,
        commands: mockResult.commands,
        citations: mockResult.citations,
      };
    } catch (err: any) {
      // Fallback to mock adapter gracefully on error
      const mockResult = await this.fallbackMock.chat(look, message, history);
      return {
        ...mockResult,
        reply: `${mockResult.reply}\n\n*(Lưu ý: Không kết nối được 9router, phản hồi tự động bởi Mock Adapter)*`,
      };
    }
  }

  async generateStructuredDesign(
    req: StructuredDesignRequest,
    baseLook?: Look
  ): Promise<{ config: GarmentConfig; title: string; explanation: string }> {
    return this.fallbackMock.generateStructuredDesign(req, baseLook);
  }

  async generateConceptImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
    return this.fallbackMock.generateConceptImage(prompt);
  }
}

export const aiAdapter: AIAdapter = new NineRouterAdapter();
