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
} from '@dangviet/contracts';
import { type AIAdapter } from './adapter.js';
import { dbRepo } from '../db.js';

export class MockAIAdapter implements AIAdapter {
  async getStatus(): Promise<AIStatus> {
    return {
      configured: false,
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

      if (text.includes('raglan') || text.includes('nách') || text.includes('dung đakao')) {
        const c = cards.find((x) => x.slug.includes('raglan'));
        if (c) {
          reply = `Về kỹ thuật tay raglan: ${c.summary}\n\n${c.content}`;
          citations.push({ title: c.title, source: c.sourceName, ref: c.sourceEvidence });
        }
      } else if (text.includes('lemur') || text.includes('cát tường') || text.includes('tân thời')) {
        const c = cards.find((x) => x.slug.includes('lemur'));
        if (c) {
          reply = `Về cuộc cách tân áo dài Lemur: ${c.summary}\n\n${c.content}`;
          citations.push({ title: c.title, source: c.sourceName, ref: c.sourceEvidence });
        }
      } else if (text.includes('ngũ thân') || text.includes('năm thân') || text.includes('tiền thân')) {
        const c = cards.find((x) => x.slug.includes('ngu_than'));
        if (c) {
          reply = `Về nguồn gốc áo ngũ thân: ${c.summary}\n\n${c.content}`;
          citations.push({ title: c.title, source: c.sourceName, ref: c.sourceEvidence });
        }
      } else if (text.includes('lụa') || text.includes('vạn phúc') || text.includes('chất liệu')) {
        const c = cards.find((x) => x.slug.includes('van_phuc') || x.slug.includes('lua'));
        if (c) {
          reply = `Về làng lụa Vạn Phúc - Hà Đông: ${c.summary}\n\n${c.content}`;
          citations.push({ title: c.title, source: c.sourceName, ref: c.sourceEvidence });
        }
      } else if (text.includes('mấn') || text.includes('khăn đóng') || text.includes('đội đầu')) {
        const c = cards.find((x) => x.slug.includes('man') || x.slug.includes('khan_dong'));
        if (c) {
          reply = `Về khăn đóng và mấn lụa: ${c.summary}\n\n${c.content}`;
          citations.push({ title: c.title, source: c.sourceName, ref: c.sourceEvidence });
        }
      } else {
        // Default cultural overview for current look
        const c1 = cards.find((x) => x.slug.includes('ngu_than'));
        const c2 = cards.find((x) => x.slug.includes('lua'));
        reply = `Bộ phối hiện tại lấy cảm hứng từ cấu trúc áo dài truyền thống với phom dáng chuẩn mực. Tà áo dài kết nối di sản áo ngũ thân cung đình với sự cách tân thanh thoát.`;
        if (c1) citations.push({ title: c1.title, source: c1.sourceName, ref: c1.sourceEvidence });
        if (c2) citations.push({ title: c2.title, source: c2.sourceName, ref: c2.sourceEvidence });
      }

      if (!reply) {
        reply = 'Hiện tại kho tư liệu văn hóa đã kiểm chứng chưa có đủ dẫn chứng xác thực cho câu hỏi cụ thể này. Trợ lý khuyến nghị tham khảo thêm tại Bảo tàng Lịch sử Quốc gia hoặc Bảo tàng Áo dài.';
      }

      return {
        reply,
        citations,
      };
    }

    // 2. Change Pants Color (e.g. "đổi quần sang trắng", "quần đen")
    if (text.includes('quần') && (text.includes('đổi') || text.includes('sang') || text.includes('màu') || text.includes('chọn'))) {
      if (look.locks.pantsColor) {
        return {
          reply: 'Màu quần hiện đang bị KHÓA. Bạn vui lòng mở khóa màu quần trước khi yêu cầu thay đổi.',
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
      return { reply, explanation, commands };
    }

    // 3. Change Primary Shirt Color (e.g. "đổi áo màu đỏ", "áo xanh", "màu đỏ")
    if ((text.includes('áo') || text.includes('màu')) && (text.includes('đổi') || text.includes('sang') || text.includes('chọn'))) {
      if (look.locks.primaryColor) {
        return {
          reply: 'Màu áo hiện đang bị KHÓA. Bạn vui lòng mở khóa áo để thực hiện đổi màu.',
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
      return { reply, commands };
    }

    // 4. Toggle Accessories (e.g. "bỏ túi, thêm nón lá", "thêm mấn", "bỏ quạt")
    if (text.includes('túi') || text.includes('nón') || text.includes('mấn') || text.includes('quạt') || text.includes('ngọc') || text.includes('phụ kiện')) {
      if (look.locks.accessories) {
        return {
          reply: 'Phần phụ kiện đang bị KHÓA. Hãy mở khóa phụ kiện trước.',
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
      return { reply, commands };
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
      return { reply, explanation, commands };
    }

    // Default polite and helpful guidance
    reply = `Trợ lý Dáng Việt sẵn sàng hỗ trợ bạn. Bạn có thể yêu cầu:\n- "Đổi quần sang màu trắng"\n- "Phối bộ đi chơi Tết màu đỏ son rực rỡ"\n- "Bỏ nón lá, thêm quạt xếp và chuỗi ngọc"\n- "Giải thích nguồn gốc tay raglan và trích dẫn tư liệu"\n- "Tạo thiết kế mới phá cách cho ngày hội trường"`;
    return { reply };
  }

  async generateStructuredDesign(
    req: StructuredDesignRequest,
    baseLook?: Look
  ): Promise<{ config: GarmentConfig; title: string; explanation: string }> {
    const text = req.prompt.toLowerCase();

    // Gen Z remix style logic
    let primaryColor: Color = { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' };
    let pantsColor: Color = { hex: '#E8A598', name: 'Hồng sen phấn', family: 'pink' };
    let collarStyle: CollarStyle = 'v_neck';
    let sleeveStyle: SleeveStyle = 'slit';
    let fabric: Fabric = 'voile_chiffon';
    let pattern: Pattern = 'geometric_genz';
    const accessories = ['quat_xep', 'tui_coi'];

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

    return { config, title, explanation };
  }

  async generateConceptImage(prompt: string): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
    return {
      success: false,
      message: 'Tính năng tạo ảnh concept bằng AI chưa có model tạo ảnh được kết nối. Hiện chỉ hỗ trợ Thiết kế có cấu trúc và hiển thị qua mô hình SVG thời gian thực.',
    };
  }
}
