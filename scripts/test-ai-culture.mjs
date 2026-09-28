import assert from 'node:assert';
import { MockAIAdapter } from '../apps/server/dist/ai/mock-adapter.js';
import { parseModelChatOutput } from '../apps/server/dist/ai/parser.js';
import { dbRepo } from '../apps/server/dist/db.js';

console.log('=== KIỂM THỬ TÍCH HỢP AI & TRÍCH DẪN TƯ LIỆU VĂN HÓA ĐÃ KIỂM CHỨNG ===\n');

// Ensure db and culture cards are loaded
const publishedCards = dbRepo.getCultureCards('published');
console.log(`[DB] Đã tải ${publishedCards.length} thẻ văn hóa ở trạng thái 'published':`);
for (const c of publishedCards) {
  console.log(`  - [${c.slug}] ${c.title} (${c.sourceName})`);
}
assert.strictEqual(publishedCards.length, 3, 'Phải có chính xác 3 thẻ văn hóa ở trạng thái published');

const mockLook = {
  id: 'look_test_ai',
  title: 'Áo dài kiểm thử',
  eventId: 'ky_yeu',
  styleId: 'thanh_lich',
  config: {
    garmentType: 'aodai',
    primaryColor: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' },
    pantsColor: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
    collarStyle: 'high_mandarin',
    sleeveStyle: 'long_traditional',
    fabric: 'silk_van_phuc',
    pattern: 'plain',
    accessories: [],
  },
  locks: {
    primaryColor: false,
    pantsColor: false,
    collarStyle: false,
    sleeveStyle: false,
    fabric: false,
    pattern: false,
    accessories: false,
  },
  explanation: 'Ghi chú',
  revision: 1,
  isDesign: false,
  createdAt: '2026-09-28',
  updatedAt: '2026-09-28',
};

const mockAI = new MockAIAdapter();

// TEST 1: Query matching verified published card (Áo ngũ thân thời Nguyễn)
console.log('\n[TEST 1] Hỏi về Áo ngũ thân (Có trong thẻ published: card_verified_ngu_than_dinh_che)...');
const resNguThan = await mockAI.chat(mockLook, 'Hãy giải thích lịch sử nguồn gốc áo ngũ thân và dẫn nguồn');
assert(resNguThan.reply.includes('Nguyễn Phúc Khoát') || resNguThan.reply.includes('Minh Mạng'), 'Phải chứa nội dung lịch sử định chế');
assert(resNguThan.citations && resNguThan.citations.length > 0, 'Phải có citations');
const cNguThan = resNguThan.citations[0];
assert(cNguThan.title.includes('Áo ngũ thân'), 'Citation phải trỏ đúng thẻ Áo ngũ thân');
assert(cNguThan.source.includes('Ngàn năm áo mũ'), 'Nguồn trích dẫn phải là sách Ngàn năm áo mũ');
assert(cNguThan.ref.includes('trang 377-380'), 'Dẫn chứng phải ghi rõ số trang 377-380');
console.log(' -> PASSED: Trích dẫn chính xác thẻ đã kiểm chứng kèm nguồn sách và số trang.\n');

// TEST 2: Query matching verified published card (Lụa Vạn Phúc)
console.log('[TEST 2] Hỏi về Di sản dệt lụa Vạn Phúc (Có trong thẻ published: card_verified_lua_van_phuc)...');
const resLua = await mockAI.chat(mockLook, 'Văn hóa và chất liệu lụa Vạn Phúc thế nào, có nguồn không?');
assert(resLua.citations && resLua.citations.length > 0, 'Phải có citations');
const cLua = resLua.citations[0];
assert(cLua.title.includes('Lụa Vạn Phúc') || cLua.title.includes('lụa Vạn Phúc'), 'Citation phải trỏ đúng thẻ Lụa Vạn Phúc');
assert(cLua.source.includes('Thông tấn xã Việt Nam') || cLua.source.includes('Báo ảnh Việt Nam'), 'Nguồn trích dẫn phải từ cơ quan báo chí');
assert(cLua.ref.includes('2969/QĐ-BVHTTDL'), 'Dẫn chứng phải có quyết định di sản quốc gia');
console.log(' -> PASSED: Trích dẫn chính xác thẻ đã kiểm chứng kèm quyết định công nhận di sản.\n');

// TEST 3: Query matching verified published card (May đo Trạch Xá / Áo dài Hà thành)
console.log('[TEST 3] Hỏi về Làng may Trạch Xá (Có trong thẻ published: card_verified_lich_su_ao_dai)...');
const resTrachXa = await mockAI.chat(mockLook, 'Giải thích kỹ thuật may đo làng nghề Trạch Xá');
assert(resTrachXa.citations && resTrachXa.citations.length > 0, 'Phải có citations');
const cTrachXa = resTrachXa.citations[0];
assert(cTrachXa.title.includes('Trạch Xá') || cTrachXa.title.includes('Hà thành'), 'Citation phải trỏ đúng thẻ Trạch Xá');
assert(cTrachXa.source.includes('Bảo tàng Lịch sử Quốc gia'), 'Nguồn trích dẫn phải từ Bảo tàng Lịch sử Quốc gia');
console.log(' -> PASSED: Trích dẫn chính xác tư liệu Bảo tàng Lịch sử Quốc gia.\n');

// TEST 4: Query about unverified topics currently in 'review' (e.g. Tay Raglan 1960 Dung Đakao)
console.log('[TEST 4] Hỏi về kỹ thuật tay Raglan (Hiện đang ở trạng thái review chờ thẩm định)...');
const resRaglan = await mockAI.chat(mockLook, 'Giải thích lịch sử tay raglan của nhà may Dung Đakao năm 1960');
assert(
  resRaglan.reply.includes('chưa có đủ dẫn chứng xác thực độc lập') ||
  resRaglan.reply.includes('trạng thái thẩm định') ||
  resRaglan.reply.includes('chưa đủ thông tin văn hóa đã kiểm chứng'),
  'Phải thông báo rõ ràng là chưa đủ thông tin văn hóa đã kiểm chứng'
);
assert(!resRaglan.citations || resRaglan.citations.length === 0, 'Tuyệt đối không được đưa citations khi thẻ đang ở review');
console.log(' -> PASSED: AI đã từ chối trích dẫn thẻ review và thông báo chưa đủ bằng chứng kiểm chứng.\n');

// TEST 5: Query about unverified topics currently in 'review' (Áo dài Lemur 1934)
console.log('[TEST 5] Hỏi về Áo dài Lemur Cát Tường (Thẻ review)...');
const resLemur = await mockAI.chat(mockLook, 'Giải thích nguồn gốc áo dài Lemur Cát Tường');
assert(
  resLemur.reply.includes('chưa có đủ dẫn chứng xác thực') ||
  resLemur.reply.includes('thẩm định') ||
  resLemur.reply.includes('chưa đủ thông tin'),
  'Phải thông báo tư liệu đang trong diện thẩm định'
);
assert(!resLemur.citations || resLemur.citations.length === 0, 'Tuyệt đối không có citations');
console.log(' -> PASSED: Không bịa nguồn, từ chối khẳng định thông tin chưa kiểm chứng.\n');

// TEST 6: Parser filters fabricated citations from raw model output
console.log('[TEST 6] Parser kiểm duyệt trích dẫn: Lọc bỏ citation bịa đặt, chỉ giữ citation published...');
const rawModelOutputWithFakeCitation = JSON.stringify({
  reply: 'Áo ngũ thân và gấm Huế rất đẹp.',
  actions: [],
  citations: [
    { title: 'Tà Áo dài Hà thành và kỹ nghệ may đo Trạch Xá', source: 'Bảo tàng Lịch sử Quốc gia' },
    { title: 'Họa tiết Vân mây và Gấm hoa triều đình Huế', source: 'Bảo tàng Cổ vật Cung đình Huế (Bịa nguồn)' },
    { title: 'Sách thần thoại tự chế', source: 'Nguồn không có trong DB' },
  ],
});

const parsed = parseModelChatOutput(rawModelOutputWithFakeCitation, mockLook);
assert(parsed.citations && parsed.citations.length === 1, 'Parser chỉ được giữ lại đúng 1 citation khớp với thẻ published');
assert.strictEqual(parsed.citations[0].title, 'Tà Áo dài Hà thành và kỹ nghệ may đo Trạch Xá');
assert(!parsed.citations.some((c) => c.title.includes('Gấm hoa') || c.title.includes('tự chế')), 'Các citation bịa đặt phải bị loại bỏ');
console.log(' -> PASSED: Parser bảo vệ nghiêm ngặt, loại bỏ hoàn toàn các citation bịa hoặc thuộc diện review.\n');

console.log('===============================================================================');
console.log('  CHÚC MỪNG: TẤT CẢ CÁC BÀI KIỂM THỬ AI & VĂN HÓA ĐỀU ĐẠT CHUẨN XUẤT SẮC!');
console.log('===============================================================================');
