import { randomUUID } from 'node:crypto';
import {
  type AIStatus,
  type Look,
  type AIChatResponse,
  type StructuredDesignRequest,
  type GarmentConfig,
  type CommandPayload,
  type Color,
  type Fabric,
  type Pattern,
  type CollarStyle,
  type SleeveStyle,
  type AccessoryId,
} from '@dangviet/contracts';
import { type AIAdapter } from './adapter.js';
import { dbRepo } from '../db.js';

export class MockAIAdapter implements AIAdapter {
  async getStatus(): Promise<AIStatus> {
    return {
      configured: false,
      endpointConnected: false,
      modelVerified: false,
      mode: 'mock',
      provider: 'Mock / Quy tắc thông minh nội bộ',
      model: 'dangviet-rules-v1',
      capabilities: {
        textChat: true,
        structuredCommands: true,
        imageGen: false,
      },
      message: 'Đang hoạt động ở chế độ mô phỏng an toàn (Mock Adapter). Có thể cấu hình AI_API_KEY trong .env để kết nối 9router.',
    };
  }

  async chat(
    look: Look,
    message: string,
    history: Array<{ role: string; content: string }>
  ): Promise<AIChatResponse> {
    const text = message.toLowerCase().trim();
    const commands: CommandPayload[] = [];
    const citations: Array<{ title: string; source: string; ref: string }> = [];
    let reply = '';
    let explanation = '';
    let expectedRev = look.revision;

    // Helper: make command
    const createCmd = (action: any, payload: any): CommandPayload => {
      const cmd: CommandPayload = {
        commandId: randomUUID(),
        lookId: look.id,
        expectedRevision: expectedRev,
        action,
        payload,
        timestamp: new Date().toISOString(),
      };
      expectedRev++;
      return cmd;
    };

    // 1. Check for Cultural Explanation questions or "giải thích" / "nguồn"
    if (text.includes('giải thích') || text.includes('nguồn') || text.includes('lịch sử') || text.includes('văn hóa') || text.includes('tại sao')) {
      const cards = dbRepo.getCultureCards('published');

      if (text.includes('trạch xá') || text.includes('tay trong tay ngoài') || text.includes('bảo tàng lịch sử') || text.includes('hà thành')) {
        const c = cards.find((x) => x.id === 'card_verified_lich_su_ao_dai');
        if (c) {
          reply = `Về tà Áo dài Hà thành và kỹ nghệ may đo Trạch Xá: ${c.summary}\n\n${c.content}`;
          citations.push({ title: c.title, source: c.sourceName, ref: c.sourceEvidence, ...(c.sourceUrl ? { sourceUrl: c.sourceUrl } : {}) });
        }
      } else if (text.includes('lụa') || text.includes('vạn phúc') || text.includes('chất liệu')) {
        const c = cards.find((x) => x.id === 'card_verified_lua_van_phuc');
        if (c) {
          reply = `Về di sản dệt lụa Vạn Phúc - Hà Đông: ${c.summary}\n\n${c.content}`;
          citations.push({ title: c.title, source: c.sourceName, ref: c.sourceEvidence, ...(c.sourceUrl ? { sourceUrl: c.sourceUrl } : {}) });
        }
      } else if (text.includes('ngũ thân') || text.includes('năm thân') || text.includes('tiền thân') || text.includes('minh mạng') || text.includes('nguyễn phúc khoát') || text.includes('raglan') || text.includes('lemur') || text.includes('cát tường') || text.includes('khăn đóng') || text.includes('mấn') || text.includes('gấm')) {
        // Explicitly unverified topics currently in review
        reply = 'Hiện tại kho tư liệu văn hóa đã kiểm chứng (trạng thái published) chưa có đủ dẫn chứng xác thực độc lập cho câu hỏi này (các tư liệu liên quan hiện đang ở trạng thái thẩm định - review). Trợ lý xin phép không trích dẫn thông tin chưa kiểm chứng.';
      } else {
        // Default cultural overview for current look using published cards only
        const cTrachXa = cards.find((x) => x.id === 'card_verified_lich_su_ao_dai');
        const cLua = cards.find((x) => x.id === 'card_verified_lua_van_phuc');
        if (cTrachXa || cLua) {
          reply = `Bộ phối hiện tại tôn vinh phom dáng áo dài truyền thống với kỹ nghệ dệt lụa và may đo chuẩn mực của người Việt.`;
          if (cTrachXa) citations.push({ title: cTrachXa.title, source: cTrachXa.sourceName, ref: cTrachXa.sourceEvidence, ...(cTrachXa.sourceUrl ? { sourceUrl: cTrachXa.sourceUrl } : {}) });
          if (cLua) citations.push({ title: cLua.title, source: cLua.sourceName, ref: cLua.sourceEvidence, ...(cLua.sourceUrl ? { sourceUrl: cLua.sourceUrl } : {}) });
        }
      }

      if (!reply || (citations.length === 0 && !reply.includes('chưa có đủ dẫn chứng'))) {
        reply = 'Hiện tại kho tư liệu văn hóa đã kiểm chứng (trạng thái published) chưa có đủ dẫn chứng xác thực độc lập cho câu hỏi này (các tư liệu liên quan hiện đang ở trạng thái thẩm định - review). Trợ lý xin phép không trích dẫn thông tin chưa kiểm chứng.';
      }

      return {
        reply,
        citations: citations.length > 0 ? citations : undefined,
        mode: 'mock',
        model: 'dangviet-rules-v1',
        commandsStatus: 'none',
      };
    }

    // 2. Change Pants Color (e.g. "đổi quần sang trắng", "quần đen")
    if (text.includes('quần') && (text.includes('đổi') || text.includes('sang') || text.includes('màu') || text.includes('chọn'))) {
      if (look.locks.pantsColor) {
        return {
          reply: 'Màu quần hiện đang bị KHÓA. Bạn vui lòng mở khóa màu quần trước khi yêu cầu thay đổi.',
          mode: 'mock',
          model: 'dangviet-rules-v1',
          commandsStatus: 'none',
        };
      }

      let newPantsColor: Color = { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' };
      if (text.includes('đen')) {
        newPantsColor = { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black' };
      } else if (text.includes('vàng')) {
        newPantsColor = { hex: '#E5A93C', name: 'Vàng hoàng yến', family: 'yellow' };
      } else if (text.includes('hồng')) {
        newPantsColor = { hex: '#E8A598', name: 'Hồng sen phấn', family: 'pink' };
      } else if (text.includes('xanh')) {
        newPantsColor = { hex: '#70A9A1', name: 'Xanh thiên thanh', family: 'blue' };
      }

      commands.push(createCmd('SET_PANTS_COLOR', { color: newPantsColor }));
      reply = `Đã gửi lệnh đổi màu quần sang "${newPantsColor.name}".`;
      explanation = `Màu quần ${newPantsColor.name} tạo điểm nhấn cân bằng thị giác với màu áo.`;
      return { reply, explanation, commands, mode: 'mock', model: 'dangviet-rules-v1', commandsStatus: 'planned' };
    }

    // 3. Change Primary Shirt Color (e.g. "đổi áo màu đỏ", "áo xanh", "màu đỏ")
    if ((text.includes('áo') || text.includes('màu')) && (text.includes('đổi') || text.includes('sang') || text.includes('chọn'))) {
      if (look.locks.primaryColor) {
        return {
          reply: 'Màu áo hiện đang bị KHÓA. Bạn vui lòng mở khóa áo để thực hiện đổi màu.',
          mode: 'mock',
          model: 'dangviet-rules-v1',
          commandsStatus: 'none',
        };
      }

      let newColor: Color = { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' };
      if (text.includes('xanh')) {
        newColor = { hex: '#1F4E5B', name: 'Xanh cố đô trầm', family: 'blue' };
      } else if (text.includes('trắng')) {
        newColor = { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' };
      } else if (text.includes('vàng')) {
        newColor = { hex: '#E5A93C', name: 'Vàng hoàng yến', family: 'yellow' };
      } else if (text.includes('hồng')) {
        newColor = { hex: '#E8A598', name: 'Hồng sen phấn', family: 'pink' };
      } else if (text.includes('tím')) {
        newColor = { hex: '#5D3A68', name: 'Tím huế trầm', family: 'purple' };
      } else if (text.includes('nâu')) {
        newColor = { hex: '#6E473B', name: 'Nâu đất phù sa', family: 'neutral' };
      }

      commands.push(createCmd('SET_PRIMARY_COLOR', { color: newColor }));
      reply = `Đã gửi lệnh chuyển màu áo sang "${newColor.name}".`;
      return { reply, commands, mode: 'mock', model: 'dangviet-rules-v1', commandsStatus: 'planned' };
    }

    // 4. Toggle Accessories (e.g. "bỏ túi, thêm nón lá", "thêm mấn", "bỏ quạt")
    if (text.includes('túi') || text.includes('nón') || text.includes('mấn') || text.includes('quạt') || text.includes('ngọc') || text.includes('phụ kiện')) {
      if (look.locks.accessories) {
        return {
          reply: 'Phần phụ kiện đang bị KHÓA. Hãy mở khóa phụ kiện trước.',
          mode: 'mock',
          model: 'dangviet-rules-v1',
          commandsStatus: 'none',
        };
      }

      const curAccs = new Set(look.config.accessories);

      if (text.includes('bỏ túi') || text.includes('không lấy túi')) {
        curAccs.delete('tui_coi');
      } else if (text.includes('thêm túi') || text.includes('túi cói')) {
        curAccs.add('tui_coi');
      }

      if (text.includes('thêm nón') || text.includes('nón lá')) {
        curAccs.add('non_la');
        curAccs.delete('man_truyen_thong'); // Avoid both headwears
      } else if (text.includes('bỏ nón')) {
        curAccs.delete('non_la');
      }

      if (text.includes('thêm mấn') || text.includes('mấn')) {
        curAccs.add('man_truyen_thong');
        curAccs.delete('non_la');
      } else if (text.includes('bỏ mấn')) {
        curAccs.delete('man_truyen_thong');
      }

      if (text.includes('thêm quạt') || text.includes('quạt')) {
        curAccs.add('quat_xep');
      } else if (text.includes('bỏ quạt')) {
        curAccs.delete('quat_xep');
      }

      if (text.includes('thêm ngọc') || text.includes('chuỗi ngọc')) {
        curAccs.add('chuoi_ngoc');
      } else if (text.includes('bỏ ngọc')) {
        curAccs.delete('chuoi_ngoc');
      }

      commands.push(createCmd('SET_ACCESSORIES', { accessories: Array.from(curAccs) }));
      reply = 'Đã cập nhật phụ kiện theo yêu cầu của bạn.';
      return { reply, commands, mode: 'mock', model: 'dangviet-rules-v1', commandsStatus: 'planned' };
    }

    // 5. Preset / Event recommendation (e.g. "phối cho mình bộ đi kỷ yếu màu xanh", "đi tết", "ngày hội")
    if (text.includes('kỷ yếu') || text.includes('tết') || text.includes('hội') || text.includes('phối')) {
      let targetEvent = look.eventId;
      if (text.includes('kỷ yếu')) targetEvent = 'ky_yeu';
      else if (text.includes('tết')) targetEvent = 'choi_tet';
      else if (text.includes('hội')) targetEvent = 'ngay_hoi_truong';

      let targetStyle = look.styleId;
      if (text.includes('tươi trẻ') || text.includes('năng động')) targetStyle = 'tuoi_tre';
      else if (text.includes('tối giản') || text.includes('mộc')) targetStyle = 'toi_gian';
      else if (text.includes('thanh lịch') || text.includes('nhẹ nhàng')) targetStyle = 'thanh_lich';

      if (targetEvent !== look.eventId) {
        commands.push(createCmd('SET_EVENT', { eventId: targetEvent }));
      }
      if (targetStyle !== look.styleId) {
        commands.push(createCmd('SET_STYLE', { styleId: targetStyle }));
      }

      if (text.includes('xanh')) {
        commands.push(createCmd('SET_PRIMARY_COLOR', {
          color: { hex: '#70A9A1', name: 'Xanh thiên thanh', family: 'blue' }
        }));
      }

      reply = `Đã đề xuất phương án phối đồ phù hợp với bối cảnh ${targetEvent === 'ky_yeu' ? 'Chụp ảnh kỷ yếu' : targetEvent === 'choi_tet' ? 'Đi chơi Tết' : 'Ngày hội văn hóa'} theo phong cách ${targetStyle}.`;
      explanation = 'Sự kết hợp này đảm bảo phom dáng trang trọng, tinh tế nhưng vẫn mang nét trẻ trung Gen Z.';
      return { reply, explanation, commands, mode: 'mock', model: 'dangviet-rules-v1', commandsStatus: 'planned' };
    }

    // Default polite and helpful guidance
    reply = `Trợ lý Dáng Việt sẵn sàng hỗ trợ bạn. Bạn có thể yêu cầu:\n- "Đổi quần sang màu trắng"\n- "Phối bộ đi chơi Tết màu đỏ son rực rỡ"\n- "Bỏ nón lá, thêm quạt xếp và chuỗi ngọc"\n- "Giải thích nguồn gốc tay raglan và trích dẫn tư liệu"\n- "Tạo thiết kế mới phá cách cho ngày hội trường"`;
    return { reply, mode: 'mock', model: 'dangviet-rules-v1', commandsStatus: 'none' };
  }

  async generateStructuredDesign(
    req: StructuredDesignRequest,
    baseLook?: Look
  ): Promise<{ config: GarmentConfig; title: string; explanation: string; mode?: 'mock' | 'live'; model?: string }> {
    const text = req.prompt.toLowerCase();

    // Gen Z remix style logic
    let primaryColor: Color = { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' };
    let pantsColor: Color = { hex: '#E8A598', name: 'Hồng sen phấn', family: 'pink' };
    let collarStyle: CollarStyle = 'v_neck';
    let sleeveStyle: SleeveStyle = 'slit';
    let fabric: Fabric = 'voile_chiffon';
    let pattern: Pattern = 'geometric_genz';
    const accessories: AccessoryId[] = ['quat_xep', 'tui_coi'];

    if (text.includes('sen') || text.includes('hồng')) {
      primaryColor = { hex: '#E8A598', name: 'Hồng sen phấn', family: 'pink' };
      pantsColor = { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' };
      pattern = 'lotus';
    } else if (text.includes('gấm') || text.includes('vàng') || text.includes('hoàng gia')) {
      primaryColor = { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' };
      pantsColor = { hex: '#E5A93C', name: 'Vàng hoàng yến', family: 'yellow' };
      fabric = 'brocade_hue';
      pattern = 'cloud';
    } else if (text.includes('mây') || text.includes('xanh')) {
      primaryColor = { hex: '#1F4E5B', name: 'Xanh cố đô trầm', family: 'blue' };
      pantsColor = { hex: '#70A9A1', name: 'Xanh thiên thanh', family: 'blue' };
      pattern = 'cloud';
    }

    // Preserve locked fields from baseLook if provided
    if (baseLook) {
      if (baseLook.locks.primaryColor) primaryColor = baseLook.config.primaryColor;
      if (baseLook.locks.pantsColor) pantsColor = baseLook.config.pantsColor;
      if (baseLook.locks.collarStyle) collarStyle = baseLook.config.collarStyle;
      if (baseLook.locks.sleeveStyle) sleeveStyle = baseLook.config.sleeveStyle;
      if (baseLook.locks.fabric) fabric = baseLook.config.fabric;
      if (baseLook.locks.pattern) pattern = baseLook.config.pattern;
      if (baseLook.locks.accessories) {
        accessories.length = 0;
        accessories.push(...baseLook.config.accessories);
      }
    }

    const title = `Thiết kế Remix: ${primaryColor.name} & ${pantsColor.name}`;
    const explanation = `Thiết kế phá cách kết hợp giữa phom dáng áo dài truyền thống với phong cách phối màu tương phản Gen Z (${primaryColor.name} cùng ${pantsColor.name}), họa tiết ${pattern === 'geometric_genz' ? 'kỷ hà đương đại' : pattern} tạo diện mạo tràn đầy năng lượng tươi mới.`;

    const config: GarmentConfig = {
      garmentType: 'aodai',
      primaryColor,
      pantsColor,
      collarStyle,
      sleeveStyle,
      fabric,
      pattern,
      accessories,
    };

    return { config, title, explanation, mode: 'mock', model: 'dangviet-rules-v1' };
  }

  async generateConceptImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
    return {
      success: false,
      message: 'Tính năng tạo ảnh concept bằng AI chưa có model tạo ảnh được kết nối. Hiện chỉ hỗ trợ Thiết kế có cấu trúc và hiển thị qua mô hình SVG thời gian thực.',
    };
  }
}
