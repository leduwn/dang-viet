import {
  type AIStatus,
  type Look,
  type AIChatResponse,
  type StructuredDesignRequest,
  type GarmentConfig,
  VALID_ACCESSORY_IDS,
  VALID_COLLARS,
  VALID_SLEEVES,
  VALID_FABRICS,
  VALID_PATTERNS,
} from '@dangviet/contracts';
import { type AIAdapter } from './adapter.js';
import { MockAIAdapter } from './mock-adapter.js';
import { parseModelChatOutput, parseModelDesignOutput } from './parser.js';
import { dbRepo } from '../db.js';
import { getAppConfig } from '../config.js';

export class NineRouterAdapter implements AIAdapter {
  private fallbackMock = new MockAIAdapter();

  private get baseUrl(): string {
    return (getAppConfig().aiBaseUrl || 'https://api.9router.com/v1').replace(/\/+$/, '');
  }

  private get apiKey(): string {
    return getAppConfig().aiApiKey || '';
  }

  private get model(): string {
    return getAppConfig().aiModel || 'gemini-2.5-flash';
  }

  private get timeoutMs(): number {
    return getAppConfig().aiTimeoutMs || 25000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async getStatus(): Promise<AIStatus> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        endpointConnected: false,
        modelVerified: false,
        mode: 'mock',
        provider: 'Mock / 9router (Chưa cấu hình API Key)',
        model: this.model,
        capabilities: {
          textChat: true,
          structuredCommands: true,
          imageGen: false,
        },
        message: 'Chưa cấu hình AI_API_KEY trong .env. Ứng dụng hoạt động ở Chế độ mô phỏng an toàn.',
      };
    }

    // Ping check without leaking API key
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
          endpointConnected: true,
          modelVerified: false, // Connected to models endpoint, but functional chat test determines verified status
          mode: 'live',
          provider: '9router Live Gateway',
          model: this.model,
          capabilities: {
            textChat: true,
            structuredCommands: false, // Do not mark structuredCommands functional merely on GET /models
            imageGen: false,
          },
          message: 'Đã kết nối tới cổng 9router (/models). Trạng thái kiểm chứng tính năng lệnh có cấu trúc được xác thực qua từng lượt gọi thực tế.',
        };
      } else {
        return {
          configured: true,
          endpointConnected: false,
          modelVerified: false,
          mode: 'mock',
          provider: `9router (HTTP ${response.status})`,
          model: this.model,
          capabilities: {
            textChat: true,
            structuredCommands: false,
            imageGen: false,
          },
          message: `Dịch vụ 9router phản hồi mã lỗi ${response.status}. Tự động kích hoạt Chế độ mô phỏng.`,
        };
      }
    } catch (err: any) {
      return {
        configured: true,
        endpointConnected: false,
        modelVerified: false,
        mode: 'mock',
        provider: '9router (Không thể kết nối mạng)',
        model: this.model,
        capabilities: {
          textChat: true,
          structuredCommands: false,
          imageGen: false,
        },
        message: `Lỗi kết nối tới 9router (${err.message}). Đang hoạt động ở Chế độ mô phỏng an toàn.`,
      };
    }
  }

  async chat(
    look: Look,
    message: string,
    history: Array<{ role: string; content: string }>
  ): Promise<AIChatResponse> {
    // 1. If not configured, strictly use mock adapter
    if (!this.isConfigured()) {
      return this.fallbackMock.chat(look, message, history);
    }

    // 2. Bound inputs to guard against token overflow and attacks; do not repeat current message
    const boundedMessage = message.slice(0, 1000).trim();
    const boundedHistory = (history || [])
      .slice(-4)
      .filter((h) => h.role === 'user' || h.role === 'assistant')
      .filter((h, idx, arr) => !(idx === arr.length - 1 && h.role === 'user' && h.content.trim() === boundedMessage))
      .map((h) => ({
        role: h.role,
        content: String(h.content).slice(0, 1000),
      }));

    try {
      const publishedCards = dbRepo.getCultureCards('published');
      const cardsContext = publishedCards.length > 0
        ? publishedCards.map((c) => `- [ID: "${c.id}"] (slug: "${c.slug}") | Tiêu đề: "${c.title}" | Nguồn: ${c.sourceName}: ${c.summary}`).join('\n')
        : 'Hiện chưa có thẻ văn hóa nào ở trạng thái published.';

      const systemPrompt = `Bạn là Trợ lý Dáng Việt, chuyên gia tư vấn Việt phục truyền thống và phong cách remix đương đại.
Nhiệm vụ: Trả lời người dùng lịch thiệp bằng tiếng Việt, gợi ý phối đồ chuẩn xác và trả về JSON có cấu trúc.

Trạng thái bộ phối hiện tại:
- Sự kiện (eventId): ${look.eventId}
- Phong cách (styleId): ${look.styleId}
- Màu áo: ${look.config.primaryColor.name} (${look.config.primaryColor.hex}) [Đang khóa: ${look.locks.primaryColor}]
- Màu quần: ${look.config.pantsColor.name} (${look.config.pantsColor.hex}) [Đang khóa: ${look.locks.pantsColor}]
- Kiểu cổ áo: ${look.config.collarStyle} [Đang khóa: ${look.locks.collarStyle}]
- Kiểu tay áo: ${look.config.sleeveStyle} [Đang khóa: ${look.locks.sleeveStyle}]
- Chất liệu vải: ${look.config.fabric} [Đang khóa: ${look.locks.fabric}]
- Họa tiết: ${look.config.pattern} [Đang khóa: ${look.locks.pattern}]
- Phụ kiện: ${look.config.accessories.join(', ') || 'Không có'} [Đang khóa: ${look.locks.accessories}]

QUY TẮC BẮT BUỘC:
1. KHÔNG được thay đổi bất kỳ thuộc tính nào đang bị khóa [Đang khóa: true]. Nếu người dùng yêu cầu đổi phần đã khóa, hãy từ chối lịch sự và giải thích người dùng cần mở khóa trước.
2. Danh mục phụ kiện hợp lệ: ${VALID_ACCESSORY_IDS.join(', ')}.
3. Danh mục kiểu cổ hợp lệ: ${VALID_COLLARS.join(', ')}.
4. Danh mục kiểu tay hợp lệ: ${VALID_SLEEVES.join(', ')}.
5. Danh mục vải hợp lệ: ${VALID_FABRICS.join(', ')}.
6. Danh mục họa tiết hợp lệ: ${VALID_PATTERNS.join(', ')}.
7. NGUYÊN TẮC TRÍCH DẪN VĂN HÓA:
Chỉ được phép trích dẫn thông tin từ danh mục tư liệu văn hóa đã kiểm chứng (published) sau đây:
${cardsContext}
Nghiêm cấm bịa nguồn, không tự suy diễn hoặc dẫn các nguồn chưa kiểm chứng. Nếu câu hỏi nằm ngoài các tư liệu đã kiểm chứng trên hoặc hỏi về các chủ đề đang thẩm định (như kỹ thuật raglan, áo dài Lemur, mấn khăn đóng, gấm Huế), BẮT BUỘC phải trả lời: "Hiện chưa đủ thông tin văn hóa đã kiểm chứng để khẳng định điều này." và không đưa citations. Khi trích dẫn, BẮT BUỘC dùng định dạng {"cardId": "..."} với cardId khớp chính xác ID trong danh mục trên.
8. Định dạng phản hồi: BẮT BUỘC trả về một đối tượng JSON duy nhất (có thể bọc trong \`\`\`json ... \`\`\`):
{
  "reply": "Nội dung phản hồi tư vấn cho người dùng",
  "explanation": "Giải thích thẩm mỹ hoặc nguồn gốc văn hóa",
  "actions": [
    {
      "action": "SET_PRIMARY_COLOR" | "SET_PANTS_COLOR" | "SET_COLLAR" | "SET_SLEEVE" | "SET_FABRIC" | "SET_PATTERN" | "TOGGLE_ACCESSORY" | "SET_ACCESSORIES" | "SET_EVENT" | "SET_STYLE" | "RESET_OUTFIT",
      "payload": { ... }
    }
  ],
  "citations": [
    { "cardId": "ID_chính_xác_khớp_danh_mục_trên" }
  ]
}
Nếu người dùng chỉ hỏi han hoặc không yêu cầu chỉnh sửa trang phục, để mảng "actions": [].`;

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
            ...boundedHistory,
            { role: 'user', content: boundedMessage },
          ],
          max_tokens: 800,
          temperature: 0.5,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`9router HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const rawText = data.choices?.[0]?.message?.content || '';

      // Parse real model's output strictly through domain rules parser
      // DO NOT mix mock commands into real model responses
      const parsed = parseModelChatOutput(rawText, look);

      return {
        reply: parsed.reply,
        explanation: parsed.explanation,
        commands: parsed.commands.length > 0 ? parsed.commands : undefined,
        citations: parsed.citations,
        mode: 'live',
        model: this.model,
        commandsStatus: parsed.commands.length > 0 ? 'planned' : 'none',
      };
    } catch (err: any) {
      // Clear reporting: Do NOT pretend to be real AI when request fails, fallback safely to local mock rules
      const fallback = await this.fallbackMock.chat(look, message, history);
      return {
        ...fallback,
        reply: `[Lỗi kết nối AI - Tự động chuyển sang Mô phỏng an toàn]: ${fallback.reply}`,
        mode: 'mock',
        model: 'fallback-mock',
      };
    }
  }

  async generateStructuredDesign(
    req: StructuredDesignRequest,
    baseLook?: Look
  ): Promise<{ config: GarmentConfig; title: string; explanation: string; mode?: 'mock' | 'live'; model?: string }> {
    if (!this.isConfigured()) {
      return this.fallbackMock.generateStructuredDesign(req, baseLook);
    }

    try {
      const promptText = req.prompt.slice(0, 500).trim();
      const systemPrompt = `Bạn là Trợ lý Thiết kế Dáng Việt. Hãy sáng tạo một cấu hình trang phục Áo dài Việt Nam hoàn chỉnh dựa trên yêu cầu của người dùng.
Bối cảnh: ${req.eventId}, Phong cách: ${req.styleId}.

QUY TẮC:
1. Kiểu cổ áo (collarStyle) chỉ được chọn từ: ${VALID_COLLARS.join(', ')}.
2. Kiểu tay áo (sleeveStyle) chỉ được chọn từ: ${VALID_SLEEVES.join(', ')}.
3. Chất liệu (fabric) chỉ được chọn từ: ${VALID_FABRICS.join(', ')}.
4. Họa tiết (pattern) chỉ được chọn từ: ${VALID_PATTERNS.join(', ')}.
5. Phụ kiện (accessories) là mảng chứa các mã hợp lệ từ: ${VALID_ACCESSORY_IDS.join(', ')}.
6. Màu sắc (primaryColor, pantsColor) gồm { hex: string, name: string, family: string }.

BẮT BUỘC trả về định dạng JSON:
{
  "title": "Tên thiết kế sáng tạo",
  "explanation": "Ý nghĩa thẩm mỹ và thông điệp văn hóa của bộ phối",
  "config": {
    "garmentType": "aodai",
    "primaryColor": { "hex": "#...", "name": "...", "family": "..." },
    "pantsColor": { "hex": "#...", "name": "...", "family": "..." },
    "collarStyle": "...",
    "sleeveStyle": "...",
    "fabric": "...",
    "pattern": "...",
    "accessories": ["..."]
  }
}`;

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
            { role: 'user', content: promptText },
          ],
          max_tokens: 800,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`9router HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      const rawText = data.choices?.[0]?.message?.content || '';

      const parsedDesign = parseModelDesignOutput(rawText, req.prompt);
      if (parsedDesign) {
        if (baseLook) {
          if (baseLook.locks.primaryColor) parsedDesign.config.primaryColor = baseLook.config.primaryColor;
          if (baseLook.locks.pantsColor) parsedDesign.config.pantsColor = baseLook.config.pantsColor;
          if (baseLook.locks.collarStyle) parsedDesign.config.collarStyle = baseLook.config.collarStyle;
          if (baseLook.locks.sleeveStyle) parsedDesign.config.sleeveStyle = baseLook.config.sleeveStyle;
          if (baseLook.locks.fabric) parsedDesign.config.fabric = baseLook.config.fabric;
          if (baseLook.locks.pattern) parsedDesign.config.pattern = baseLook.config.pattern;
          if (baseLook.locks.accessories) {
            parsedDesign.config.accessories = [...baseLook.config.accessories];
          }
        }
        return {
          ...parsedDesign,
          mode: 'live',
          model: this.model,
        };
      }

      // If parsing fails, fall back to mock and label explicitly
      const fallback = await this.fallbackMock.generateStructuredDesign(req, baseLook);
      return {
        ...fallback,
        mode: 'mock',
        model: 'fallback-mock',
      };
    } catch {
      const fallback = await this.fallbackMock.generateStructuredDesign(req, baseLook);
      return {
        ...fallback,
        mode: 'mock',
        model: 'fallback-mock',
      };
    }
  }

  async generateConceptImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
    return this.fallbackMock.generateConceptImage(prompt);
  }
}

export const aiAdapter: AIAdapter = new NineRouterAdapter();
