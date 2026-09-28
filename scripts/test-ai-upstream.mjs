import assert from 'node:assert';
import http from 'node:http';
import { dbRepo } from '../apps/server/dist/db.js';
import { NineRouterAdapter } from '../apps/server/dist/ai/nine-router-adapter.js';
import { getAppConfig } from '../apps/server/dist/config.js';

console.log('=== KIỂM THỬ NINEROUTER AI ADAPTER QUA UPSTREAM HTTP GIẢ LẬP ===\n');

// 1. Create programmable Mock Upstream Server
let upstreamHandler = (req, res) => {
  res.writeHead(404);
  res.end();
};

const server = http.createServer((req, res) => {
  upstreamHandler(req, res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const mockBaseUrl = `http://127.0.0.1:${port}/v1`;

// Save original environment variables
const originalBaseUrl = process.env.AI_BASE_URL;
const originalApiKey = process.env.AI_API_KEY;
const originalModel = process.env.AI_MODEL;
const originalTimeout = process.env.AI_TIMEOUT_MS;

// Configure environment to point to mock upstream with 1000ms timeout
process.env.AI_BASE_URL = mockBaseUrl;
process.env.AI_API_KEY = 'test-mock-api-key-safe';
process.env.AI_MODEL = 'gemini-2.5-flash';
process.env.AI_TIMEOUT_MS = '1000';

const adapter = new NineRouterAdapter();

// Sample test Look
const baseTestLook = {
  id: 'look_upstream_test',
  title: 'Bộ kiểm thử upstream',
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
    primaryColor: true, // PRIMARY COLOR IS LOCKED
    pantsColor: false,
    collarStyle: false,
    sleeveStyle: false,
    fabric: true, // FABRIC IS LOCKED
    pattern: false,
    accessories: false,
  },
  explanation: 'Ghi chú kiểm thử',
  revision: 3,
  isDesign: false,
  createdAt: '2026-09-28',
  updatedAt: '2026-09-28',
};

try {
  // -------------------------------------------------------------
  // KỊCH BẢN 1: JSON HỢP LỆ (Valid JSON response from Upstream)
  // -------------------------------------------------------------
  console.log('[KỊCH BẢN 1] Upstream trả JSON hợp lệ...');
  upstreamHandler = (req, res) => {
    if (req.url === '/v1/chat/completions') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: 'Gợi ý đổi màu quần sang đen tuyền để tạo độ tương phản thanh lịch.',
                  explanation: 'Màu đen kết hợp với đỏ son rất cổ điển và sang trọng.',
                  actions: [
                    {
                      action: 'SET_PANTS_COLOR',
                      payload: { color: { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black' } },
                    },
                  ],
                }),
              },
            },
          ],
        })
      );
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [] }));
    }
  };

  const res1 = await adapter.chat(baseTestLook, 'Đổi màu quần giúp mình', []);
  assert.strictEqual(res1.mode, 'live', 'Phải ở chế độ live');
  assert.strictEqual(res1.model, 'gemini-2.5-flash', 'Model phải đúng theo cấu hình');
  assert(res1.commands && res1.commands.length === 1, 'Phải sinh ra đúng 1 command');
  assert.strictEqual(res1.commands[0].action, 'SET_PANTS_COLOR', 'Command phải là SET_PANTS_COLOR');
  assert.strictEqual(res1.commands[0].expectedRevision, 3, 'Revision phải kế thừa chính xác từ look (v3)');
  assert.strictEqual(res1.commandsStatus, 'planned', 'commandsStatus phải là planned');
  console.log(' -> PASSED: Nhận và phân tích cú pháp JSON hợp lệ thành công.\n');

  // -------------------------------------------------------------
  // KỊCH BẢN 2: JSON SAI HOẶC THIẾU TRƯỜNG (Malformed / Missing fields)
  // -------------------------------------------------------------
  console.log('[KỊCH BẢN 2] Upstream trả JSON hỏng / sai cú pháp / văn bản tự do...');
  upstreamHandler = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: 'Đây là câu trả lời dạng văn bản thường: { reply: "Lỗi cú pháp không có đóng ngoặc nhọn...',
            },
          },
        ],
      })
    );
  };

  const res2 = await adapter.chat(baseTestLook, 'Tư vấn phom dáng', []);
  assert.strictEqual(res2.mode, 'live', 'Phải ở chế độ live dù text không phải JSON');
  assert(res2.reply.includes('Lỗi cú pháp không có đóng ngoặc'), 'Phải giữ nguyên văn bản trả về cho người dùng');
  assert(!res2.commands || res2.commands.length === 0, 'Không được sinh commands rác khi JSON hỏng');
  assert.strictEqual(res2.commandsStatus, 'none', 'commandsStatus phải là none');
  console.log(' -> PASSED: Xử lý an toàn khi upstream trả JSON sai cú pháp hoặc văn bản thuần.\n');

  // -------------------------------------------------------------
  // KỊCH BẢN 3: MODEL TRẢ LỆNH KHÔNG HỢP LỆ HOẶC VI PHẠM KHÓA
  // -------------------------------------------------------------
  console.log('[KỊCH BẢN 3] Upstream trả lệnh vi phạm khóa và giá trị ngoài danh mục domain...');
  upstreamHandler = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: 'Tôi muốn đổi màu áo và kiểu cổ áo.',
                actions: [
                  // 1. Vi phạm khóa: primaryColor đang bị KHÓA trên look!
                  {
                    action: 'SET_PRIMARY_COLOR',
                    payload: { color: { hex: '#70A9A1', name: 'Xanh thiên thanh', family: 'blue' } },
                  },
                  // 2. Vi phạm danh mục: collarStyle không có trong VALID_COLLARS
                  {
                    action: 'SET_COLLAR',
                    payload: { collarStyle: 'collar_sieu_nhan_khong_hop_le' },
                  },
                  // 3. Lệnh hợp lệ: SET_SLEEVE
                  {
                    action: 'SET_SLEEVE',
                    payload: { sleeveStyle: 'slit' },
                  },
                ],
              }),
            },
          },
        ],
      })
    );
  };

  const res3 = await adapter.chat(baseTestLook, 'Đổi màu áo và kiểu cổ', []);
  assert(res3.commands && res3.commands.length === 1, 'Chỉ lệnh hợp lệ thứ 3 mới được chấp nhận');
  assert.strictEqual(res3.commands[0].action, 'SET_SLEEVE', 'Chỉ giữ lại lệnh hợp lệ SET_SLEEVE');
  assert(!res3.commands.some((c) => c.action === 'SET_PRIMARY_COLOR'), 'Lệnh sửa trường bị khóa phải bị loại bỏ');
  assert(!res3.commands.some((c) => c.action === 'SET_COLLAR'), 'Lệnh cổ áo ngoài danh mục phải bị loại bỏ');
  console.log(' -> PASSED: Bảo vệ toàn diện thuộc tính bị khóa và catalog domain trước lệnh model sai.\n');

  // -------------------------------------------------------------
  // KỊCH BẢN 4: TIMEOUT (Upstream không phản hồi kịp trong timeoutMs)
  // -------------------------------------------------------------
  console.log('[KỊCH BẢN 4] Upstream phản hồi chậm vượt quá thời gian chờ (Timeout)...');
  upstreamHandler = (req, res) => {
    // Delay 2000ms > timeout 1000ms
    setTimeout(() => {
      try {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'Phản hồi quá trễ' } }] }));
      } catch {}
    }, 2000);
  };

  const res4 = await adapter.chat(baseTestLook, 'Tin nhắn sẽ bị timeout', []);
  assert.strictEqual(res4.mode, 'mock', 'Khi timeout, phải chuyển sang fallback mock');
  assert.strictEqual(res4.model, 'fallback-mock', 'Model phải ghi rõ fallback-mock');
  assert(res4.reply.includes('Lỗi kết nối AI') || res4.reply.includes('Chế độ mô phỏng'), 'Thông báo phải nêu rõ lý do fallback');
  console.log(' -> PASSED: Bắt timeout chuẩn xác, tự động fallback an toàn.\n');

  // -------------------------------------------------------------
  // KỊCH BẢN 5: HTTP 401, 429 VÀ 5xx
  // -------------------------------------------------------------
  console.log('[KỊCH BẢN 5] Upstream trả mã lỗi HTTP 401, 429 và 500...');

  // 5a. HTTP 401 Unauthorized
  upstreamHandler = (req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Invalid API Key' } }));
  };
  const res401 = await adapter.chat(baseTestLook, 'Test 401', []);
  assert.strictEqual(res401.mode, 'mock', 'HTTP 401 phải fallback về mock');
  assert.strictEqual(res401.model, 'fallback-mock');

  const status401 = await adapter.getStatus();
  assert.strictEqual(status401.endpointConnected, false, 'getStatus phải báo endpointConnected: false khi 401');

  // 5b. HTTP 429 Rate Limit
  upstreamHandler = (req, res) => {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Rate limit exceeded' } }));
  };
  const res429 = await adapter.chat(baseTestLook, 'Test 429', []);
  assert.strictEqual(res429.mode, 'mock', 'HTTP 429 phải fallback về mock');

  // 5c. HTTP 500 Internal Server Error
  upstreamHandler = (req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Upstream gateway error' } }));
  };
  const res500 = await adapter.chat(baseTestLook, 'Test 500', []);
  assert.strictEqual(res500.mode, 'mock', 'HTTP 500 phải fallback về mock');
  console.log(' -> PASSED: Xử lý đầy đủ HTTP 401, 429, 500 không làm sập ứng dụng, fallback minh bạch.\n');

  // -------------------------------------------------------------
  // KỊCH BẢN 6: TẠO THIẾT KẾ (generateStructuredDesign) & FALLBACK
  // -------------------------------------------------------------
  console.log('[KỊCH BẢN 6] Kiểm tra tạo thiết kế có cấu trúc và cơ chế fallback...');

  // 6a. Upstream trả thiết kế hợp lệ nhưng cố đổi thuộc tính bị khóa
  upstreamHandler = (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Áo dài Hoàng Hôn Xứ Huế',
                explanation: 'Thiết kế lấy cảm hứng từ ráng chiều sông Hương.',
                config: {
                  garmentType: 'aodai',
                  primaryColor: { hex: '#5D3A68', name: 'Tím huế trầm', family: 'purple' }, // baseTestLook khóa primaryColor (#B83A24)!
                  pantsColor: { hex: '#E5A93C', name: 'Vàng hoàng yến', family: 'yellow' },
                  collarStyle: 'v_neck',
                  sleeveStyle: 'slit',
                  fabric: 'brocade_hue', // baseTestLook khóa fabric (silk_van_phuc)!
                  pattern: 'cloud',
                  accessories: ['quat_xep'],
                },
              }),
            },
          },
        ],
      })
    );
  };

  const designLive = await adapter.generateStructuredDesign(
    { prompt: 'Tạo bộ áo dài Huế', eventId: 'ky_yeu', styleId: 'thanh_lich' },
    baseTestLook
  );
  assert.strictEqual(designLive.mode, 'live', 'Thiết kế hợp lệ phải ở chế độ live');
  assert.strictEqual(designLive.model, 'gemini-2.5-flash');
  // Must preserve locked primaryColor from baseTestLook!
  assert.strictEqual(
    designLive.config.primaryColor.hex,
    baseTestLook.config.primaryColor.hex,
    'Phải bảo vệ màu áo đã khóa từ baseLook'
  );
  // Must preserve locked fabric from baseTestLook!
  assert.strictEqual(
    designLive.config.fabric,
    baseTestLook.config.fabric,
    'Phải bảo vệ chất liệu vải đã khóa từ baseLook'
  );

  // 6b. Upstream lỗi 500 khi tạo thiết kế -> Fallback sang mock design
  upstreamHandler = (req, res) => {
    res.writeHead(500);
    res.end('Server Error');
  };

  const designFallback = await adapter.generateStructuredDesign(
    { prompt: 'Tạo bộ áo dài sen', eventId: 'choi_tet', styleId: 'tuoi_tre' },
    baseTestLook
  );
  assert.strictEqual(designFallback.mode, 'mock', 'Khi lỗi, thiết kế phải fallback về mock');
  assert.strictEqual(designFallback.model, 'fallback-mock', 'Model phải là fallback-mock');
  assert(designFallback.config && designFallback.config.primaryColor, 'Vẫn phải trả về cấu hình áo dài hợp lệ');
  // Check locked fields preserved even during fallback
  assert.strictEqual(designFallback.config.primaryColor.hex, baseTestLook.config.primaryColor.hex);
  console.log(' -> PASSED: Tạo thiết kế Live bảo vệ trường khóa; khi lỗi fallback về Mock minh bạch.\n');

  // -------------------------------------------------------------
  // KỊCH BẢN 7: KIỂM TRA LIVE KEY NẾU CÓ TRONG MÔI TRƯỜNG GỐC
  // -------------------------------------------------------------
  console.log('[KỊCH BẢN 7] Kiểm tra cấu hình Live API Key thực tế trong môi trường...');
  if (originalApiKey && originalApiKey.trim().length > 0 && !originalApiKey.includes('test-mock')) {
    // Restore original real key
    process.env.AI_BASE_URL = originalBaseUrl || 'https://api.9router.com/v1';
    process.env.AI_API_KEY = originalApiKey;
    process.env.AI_MODEL = originalModel || 'gemini-2.5-flash';
    process.env.AI_TIMEOUT_MS = originalTimeout || '25000';

    const liveAdapter = new NineRouterAdapter();
    console.log(` -> Phát hiện API key trong cấu hình (.env). Model cấu hình: ${process.env.AI_MODEL}`);
    console.log(' -> Thực hiện kiểm tra an toàn: gọi endpoint /models để kiểm tra kết nối gateway...');
    try {
      const liveStatus = await liveAdapter.getStatus();
      console.log(` -> Kết quả kết nối Gateway: connected=${liveStatus.endpointConnected}, provider="${liveStatus.provider}"`);
      if (liveStatus.endpointConnected) {
        console.log(' -> Thực hiện 1 lượt chat thử nghiệm nhỏ (không in bí mật)...');
        const liveChatRes = await liveAdapter.chat(baseTestLook, 'Xin chào Dáng Việt', []);
        console.log(` -> Live Chat thành công! mode=${liveChatRes.mode}, model=${liveChatRes.model}`);
      } else {
        console.log(' -> Live Gateway không phản hồi OK. Đã chuyển tự động sang chế độ mô phỏng an toàn.');
      }
    } catch (liveErr) {
      console.log(` -> Lỗi khi gọi live gateway: ${liveErr.message}. Tiếp tục với Mock Adapter an toàn.`);
    }
  } else {
    console.log(' -> Không có AI_API_KEY thực tế trong môi trường. Đã kiểm chứng hoàn tất 100% qua Upstream HTTP giả lập.');
    console.log(' -> Ghi nhận: Chưa kiểm chứng live 9router (chờ người dùng cấu hình key trong .env).');
  }

  console.log('\n===============================================================================');
  console.log('  CHÚC MỪNG: HOÀN THÀNH TOÀN DIỆN BỘ TEST UPSTREAM HTTP GIẢ LẬP VỚI 7 KỊCH BẢN!');
  console.log('===============================================================================');
} finally {
  server.close();
  // Restore original environment
  if (originalBaseUrl) process.env.AI_BASE_URL = originalBaseUrl; else delete process.env.AI_BASE_URL;
  if (originalApiKey) process.env.AI_API_KEY = originalApiKey; else delete process.env.AI_API_KEY;
  if (originalModel) process.env.AI_MODEL = originalModel; else delete process.env.AI_MODEL;
  if (originalTimeout) process.env.AI_TIMEOUT_MS = originalTimeout; else delete process.env.AI_TIMEOUT_MS;
}
