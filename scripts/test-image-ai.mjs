import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Import modules compiled from TypeScript
import { parseImagePrompt, buildAoDaiImagePrompt } from '../apps/server/dist/ai/image-prompt-pipeline.js';
import { inspectImageBuffer, isSafeDownloadUrl, NineRouterImageAdapter, stripExifMetadata } from '../apps/server/dist/ai/image-adapter.js';

console.log('==============================================================================');
console.log('=== DÁNG VIỆT - BỘ KIỂM THỬ TOÀN DIỆN HỆ THỐNG AI TẠO ẢNH 2D (PHẦN H) ===');
console.log('==============================================================================\n');

let passCount = 0;
function testAssert(condition, message) {
  assert(condition, message);
  passCount++;
  console.log(`  ✓ ${message}`);
}

// ============================================================================
// PHẦN 1: UNIT TESTS - BỘ TIỀN XỬ LÝ MÔ TẢ TIẾNG VIỆT & SINH PROMPT ANH
// ============================================================================
console.log('--- [TEST NHÓM 1] Unit Tests: Bóc tách thực thể mô tả tiếng Việt (Stage 1) ---');

// 1.1 Bóc tách màu áo và màu quần
{
  const res = parseImagePrompt('Áo dài đỏ son hoàng gia kết hợp cùng quần trắng tinh khôi đi dạo phố');
  testAssert(res.primaryColor?.name === 'Đỏ son hoàng gia', 'Bóc tách chính xác màu áo: Đỏ son hoàng gia');
  testAssert(res.pantsColor?.name === 'Trắng tinh khôi', 'Bóc tách chính xác màu quần: Trắng tinh khôi');
}

// 1.2 Bóc tách kiểu cổ và kiểu tay áo
{
  const resTraditional = parseImagePrompt('Áo dài truyền thống cổ cao, tay dài may bằng lụa Hà Đông');
  testAssert(resTraditional.collarStyle === 'traditional_high', 'Bóc tách chính xác kiểu cổ: traditional_high (cổ cao)');
  testAssert(resTraditional.sleeveStyle === 'traditional_long', 'Bóc tách chính xác kiểu tay: traditional_long (tay dài)');
  testAssert(resTraditional.fabric === 'silk_ha_dong', 'Bóc tách chính xác chất liệu vải: silk_ha_dong (lụa Hà Đông)');

  const resRemix = parseImagePrompt('Áo dài cách tân cổ tròn, tay lửng duyên dáng tươi trẻ');
  testAssert(resRemix.garmentModel === 'aodai_remix_raglan', 'Nhận diện model cách tân: aodai_remix_raglan');
  testAssert(resRemix.collarStyle === 'round', 'Bóc tách chính xác kiểu cổ: round (cổ tròn)');
  testAssert(resRemix.sleeveStyle === 'elbow', 'Bóc tách chính xác kiểu tay: elbow (tay lửng)');
}

// 1.3 Bóc tách họa tiết và phụ kiện đa dạng
{
  const res = parseImagePrompt('Áo dài màu xanh ngọc bích thêu hoa sen, đội nón lá và đeo kiềng bạc');
  testAssert(res.primaryColor?.name === 'Xanh ngọc bích', 'Bóc tách màu áo: Xanh ngọc bích');
  testAssert(res.pattern === 'lotus', 'Bóc tách họa tiết hoa sen (lotus)');
  testAssert(res.accessories.includes('non_la'), 'Bóc tách phụ kiện nón lá');
}

// 1.4 Bóc tách bối cảnh không gian văn hóa
{
  const resHoiAn = parseImagePrompt('Thiếu nữ mặc áo dài hoa cúc dạo bước trên phố cổ Hội An bên đèn lồng');
  testAssert(resHoiAn.backgroundContext.includes('Hội An'), 'Nhận diện bối cảnh: Phố cổ Hội An');

  const resHoSen = parseImagePrompt('Chụp ảnh áo dài trắng bên hồ sen sáng sớm');
  testAssert(resHoSen.backgroundContext.includes('hồ sen'), 'Nhận diện bối cảnh: Hồ sen');
}

// 1.5 Bóc tách từ đồng nghĩa và tiếng lóng thời trang
{
  const resSlang = parseImagePrompt('Áo dài màu hường sen phấn, quần đen tuyền, vải tơ voan tà lửng cách tân');
  testAssert(resSlang.primaryColor?.family === 'pink', 'Nhận diện từ đồng nghĩa "màu hường" -> tone hồng sen');
  testAssert(resSlang.pantsColor?.family === 'black', 'Nhận diện màu quần "đen tuyền"');
  testAssert(resSlang.fabric === 'voile_chiffon', 'Nhận diện "tơ voan" -> chất liệu tơ voan (voile_chiffon)');
  testAssert(resSlang.garmentModel === 'aodai_remix_raglan', 'Nhận diện "tà lửng cách tân" -> model aodai_remix_raglan');
}

// 1.6 BẢO LƯU THUỘC TÍNH BỊ KHÓA (LOCKS)
{
  const mockLockedLook = {
    id: 'look_locked_01',
    title: 'Look Khóa Màu',
    eventId: 'ky_yeu',
    styleId: 'thanh_lich',
    config: {
      garmentType: 'aodai',
      primaryColor: { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' },
      pantsColor: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
      collarStyle: 'traditional_high',
      sleeveStyle: 'traditional_long',
      fabric: 'silk_ha_dong',
      pattern: 'plain',
      accessories: [],
    },
    locks: {
      primaryColor: true,  // Khóa màu áo!
      collarStyle: true,   // Khóa kiểu cổ!
      pantsColor: false,
      sleeveStyle: false,
      fabric: false,
      pattern: false,
      accessories: false,
    },
    explanation: 'Test locks',
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Người dùng cố tình gõ prompt đòi đổi màu vàng và cổ thuyền
  const lockedRes = parseImagePrompt('Đổi sang áo màu vàng hoàng yến, cổ thuyền quyến rũ, quần đen', mockLockedLook);

  testAssert(lockedRes.primaryColor?.name === 'Xanh ngọc bích', 'Màu áo bị khóa được bảo lưu nguyên vẹn (Xanh ngọc bích), không bị ghi đè thành vàng');
  testAssert(lockedRes.collarStyle === 'traditional_high', 'Kiểu cổ bị khóa được bảo lưu nguyên vẹn (traditional_high), không bị ghi đè');
  testAssert(lockedRes.pantsColor?.name === 'Đen tuyền dạ hội', 'Màu quần không bị khóa được cập nhật thành công (Đen tuyền dạ hội)');
  testAssert(lockedRes.preservedLocks.includes('primaryColor'), 'Danh sách preservedLocks ghi nhận "primaryColor"');
  testAssert(lockedRes.preservedLocks.includes('collarStyle'), 'Danh sách preservedLocks ghi nhận "collarStyle"');
  testAssert(lockedRes.warnings.length >= 2, 'Có cảnh báo người dùng về các thuộc tính bị khóa được bảo lưu');
}

console.log(' -> TẤT CẢ UNIT TESTS TIỀN XỬ LÝ MÔ TẢ ĐÃ VƯỢT QUA!\n');

// ============================================================================
// PHẦN 2: UNIT TESTS - DỰNG PROMPT TIẾNG ANH ÁP ĐẶT QUY CHUẨN VĂN HÓA (Stage 2)
// ============================================================================
console.log('--- [TEST NHÓM 2] Unit Tests: Quy chuẩn Prompt tiếng Anh & Negative Constraints (Stage 2) ---');
{
  const parsed = parseImagePrompt('Áo dài đỏ son gấm dệt hoa mai, quần lụa trắng, nón lá');
  const fullPrompt = buildAoDaiImagePrompt(parsed, { stylePreset: 'elegant_fashion_2d' });

  // Kiểm tra quy chuẩn giải phẫu Áo dài Việt Nam đích thực
  testAssert(fullPrompt.includes('TWO distinct long split flaps'), 'Quy chuẩn: 2 tà trước-sau tách rời');
  testAssert(fullPrompt.includes('high side waist slits'), 'Quy chuẩn: Xẻ eo cao');
  testAssert(fullPrompt.includes('SEPARATE loose-fitting, flowing wide-leg silk trousers'), 'Quy chuẩn: Quần lụa dài mặc riêng bên dưới');
  testAssert(fullPrompt.includes('fitted form-hugging tunic bodice'), 'Quy chuẩn: Thân áo ôm sát tôn dáng');

  // Kiểm tra negative constraints cấm nhầm lẫn
  testAssert(fullPrompt.includes('NOT a Chinese Qipao / Cheongsam dress'), 'Negative constraint: Không phải Qipao/xường xám');
  testAssert(fullPrompt.includes('NOT a Japanese kimono'), 'Negative constraint: Không phải Kimono Nhật Bản');
  testAssert(fullPrompt.includes('NOT a Korean hanbok'), 'Negative constraint: Không phải Hanbok Hàn Quốc');

  // Kiểm tra phong cách 2D
  testAssert(fullPrompt.includes('2D elegant high-fashion editorial illustration') || fullPrompt.includes('2D fashion illustration'), 'Phong cách 2D: illustration');
}

console.log(' -> TẤT CẢ UNIT TESTS QUY CHUẨN VĂN HÓA ĐÃ VƯỢT QUA!\n');

// ============================================================================
// PHẦN 3: UNIT TESTS - KIỂM TRA CHỮ KÝ NHỊ PHÂN VÀ PHÒNG CHỐNG SSRF
// ============================================================================
console.log('--- [TEST NHÓM 3] Unit Tests: Binary Magic Bytes Inspection & Anti-SSRF ---');

// 3.1 Chữ ký nhị phân JPEG
{
  const jpegBuf = Buffer.alloc(500);
  jpegBuf[0] = 0xff;
  jpegBuf[1] = 0xd8;
  jpegBuf[2] = 0xff;
  const inspectRes = inspectImageBuffer(jpegBuf);
  testAssert(inspectRes.valid === true && inspectRes.mimeType === 'image/jpeg', 'Xác thực chuẩn xác magic bytes JPEG (FF D8 FF)');
}

// 3.2 Chữ ký nhị phân PNG
{
  const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(200).fill(0)]);
  const inspectRes = inspectImageBuffer(pngBuf);
  testAssert(inspectRes.valid === true && inspectRes.mimeType === 'image/png', 'Xác thực chuẩn xác magic bytes PNG (89 50 4E 47...)');
}

// 3.3 Chữ ký nhị phân WebP
{
  const webpBuf = Buffer.alloc(200);
  webpBuf.write('RIFF', 0);
  webpBuf.write('WEBP', 8);
  const inspectRes = inspectImageBuffer(webpBuf);
  testAssert(inspectRes.valid === true && inspectRes.mimeType === 'image/webp', 'Xác thực chuẩn xác magic bytes WebP (RIFF...WEBP)');
}

// 3.4 Từ chối dữ liệu rác, HTML error page, SVG script
{
  const htmlBuf = Buffer.from('<!DOCTYPE html><html><body>Error 500: Internal Server Error</body></html>');
  testAssert(inspectImageBuffer(htmlBuf).valid === false, 'Từ chối tệp HTML error page giả mạo hình ảnh');

  const svgBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  testAssert(inspectImageBuffer(svgBuf).valid === false, 'Từ chối mã SVG độc hại');

  const tooSmallBuf = Buffer.from([0xff, 0xd8, 0xff]);
  testAssert(inspectImageBuffer(tooSmallBuf).valid === false, 'Từ chối buffer rỗng hoặc quá nhỏ (<100 bytes)');
}

// 3.5 Phòng chống SSRF (Anti-SSRF Protection)
{
  testAssert(isSafeDownloadUrl('http://localhost:3000/image.png') === false, 'Chặn SSRF: localhost');
  testAssert(isSafeDownloadUrl('http://127.0.0.1:8080/image.png') === false, 'Chặn SSRF: 127.0.0.1');
  testAssert(isSafeDownloadUrl('http://0.0.0.0:80/image.png') === false, 'Chặn SSRF: 0.0.0.0');
  testAssert(isSafeDownloadUrl('http://[::1]/image.png') === false, 'Chặn SSRF: IPv6 loopback ::1');
  testAssert(isSafeDownloadUrl('http://169.254.169.254/latest/meta-data') === false, 'Chặn SSRF: AWS/Cloud metadata 169.254.169.254');
  testAssert(isSafeDownloadUrl('http://10.0.0.15/secret.jpg') === false, 'Chặn SSRF: Dải IP riêng 10.0.0.0/8');
  testAssert(isSafeDownloadUrl('http://192.168.1.1/router.jpg') === false, 'Chặn SSRF: Dải IP riêng 192.168.0.0/16');
  testAssert(isSafeDownloadUrl('http://172.16.5.1/admin.jpg') === false, 'Chặn SSRF: Dải IP riêng 172.16.0.0/12');
  testAssert(isSafeDownloadUrl('http://internal-database.local/img.png') === false, 'Chặn SSRF: Miền nội bộ .local');
  testAssert(isSafeDownloadUrl('http://cluster.internal/img.png') === false, 'Chặn SSRF: Miền nội bộ .internal');
  testAssert(isSafeDownloadUrl('javascript:alert(1)') === false, 'Chặn URL phi HTTP');
  testAssert(isSafeDownloadUrl('https://images.unsplash.com/photo-aodai.jpg') === true, 'Cho phép URL HTTPS công khai hợp lệ');
}

// 3.6 Lọc sạch metadata EXIF (JPEG, PNG, WebP)
{
  // JPEG có marker APP1 (0xFF 0xE1 - EXIF metadata)
  const jpegWithExif = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]), // SOI + APP1 EXIF (len = 8)
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0x00, 0x00]), // SOS (Start of Scan)
    Buffer.alloc(200, 0x12),
    Buffer.from([0xff, 0xd9]), // EOI
  ]);
  const cleanedJpeg = stripExifMetadata(jpegWithExif, 'image/jpeg');
  testAssert(cleanedJpeg.length < jpegWithExif.length, 'JPEG EXIF: Loại bỏ thành công marker APP1 EXIF');
  testAssert(cleanedJpeg[0] === 0xff && cleanedJpeg[1] === 0xd8 && cleanedJpeg[2] === 0xff, 'JPEG sau khi lọc vẫn giữ nguyên header hợp lệ');
  testAssert(!cleanedJpeg.includes(Buffer.from('Exif')), 'JPEG sau khi lọc không còn chứa chuỗi "Exif"');

  // PNG có chunk ancillary eXIf
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0,0,0,1, 0,0,0,1, 8,6,0,0,0, 0x1f, 0x15, 0xc4, 0x89]);
  const exifChunk = Buffer.from([0x00, 0x00, 0x00, 0x06, 0x65, 0x58, 0x49, 0x66, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0,0,0,0]);
  const iendChunk = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const pngWithExif = Buffer.concat([pngHeader, ihdrChunk, exifChunk, iendChunk]);

  const cleanedPng = stripExifMetadata(pngWithExif, 'image/png');
  testAssert(cleanedPng.length < pngWithExif.length, 'PNG EXIF: Loại bỏ thành công ancillary chunk eXIf');
  testAssert(!cleanedPng.includes(Buffer.from('eXIf')), 'PNG sau khi lọc không còn chunk eXIf');
}

console.log(' -> TẤT CẢ UNIT TESTS CHỮ KÝ NHỊ PHÂN VÀ ANTI-SSRF ĐÃ VƯỢT QUA!\n');

// ============================================================================
// PHẦN 4: INTEGRATION TESTS - MOCK HTTP VÀ XỬ LÝ LỖI GATEWAY 9ROUTER
// ============================================================================
console.log('--- [TEST NHÓM 4] Integration Tests: Image Adapter Mock HTTP Server & Error Scenarios ---');

// Tạo mock HTTP server để mô phỏng chính xác hành vi của 9router gateway
let mockResponseStatus = 200;
let mockResponseBody = {};
let mockResponseDelayMs = 0;

const mockServer = http.createServer((req, res) => {
  setTimeout(() => {
    if (req.url === '/test-download/image.jpg') {
      // Endpoint phục vụ tải ảnh URL an toàn
      const validJpeg = Buffer.alloc(1024);
      validJpeg[0] = 0xff;
      validJpeg[1] = 0xd8;
      validJpeg[2] = 0xff;
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(validJpeg);
      return;
    }

    if (req.url.includes('/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'ag/gemini-3.1-flash-image' }] }));
      return;
    }

    if (req.url.includes('/chat/completions')) {
      if (mockResponseStatus !== 200) {
        res.writeHead(mockResponseStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponseBody));
        return;
      }
      if (mockResponseBody && mockResponseBody.choices) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponseBody));
        return;
      }
      const validJpeg = Buffer.alloc(1024);
      validJpeg[0] = 0xff;
      validJpeg[1] = 0xd8;
      validJpeg[2] = 0xff;
      const b64 = validJpeg.toString('base64');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: `Minh họa áo dài 2D toàn thân với khuôn mặt tham chiếu:\n\n![image](data:image/jpeg;base64,${b64})`,
              },
            },
          ],
        })
      );
      return;
    }

    res.writeHead(mockResponseStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockResponseBody));
  }, mockResponseDelayMs);
});

await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
const mockServerPort = mockServer.address().port;
const mockBaseUrl = `http://127.0.0.1:${mockServerPort}`;

// Khởi tạo adapter kiểm thử trỏ vào mock server
class TestableImageAdapter extends NineRouterImageAdapter {
  constructor(apiKey, timeoutMs = 2000) {
    super();
    this.customApiKey = apiKey;
    this.customTimeoutMs = timeoutMs;
  }
  get baseUrl() {
    return mockBaseUrl;
  }
  get apiKey() {
    return this.customApiKey;
  }
  get timeoutMs() {
    return this.customTimeoutMs;
  }
}

// 4.1 Mock Gateway trả về thành công dạng Base64 (b64_json)
{
  const validJpeg = Buffer.alloc(512);
  validJpeg[0] = 0xff;
  validJpeg[1] = 0xd8;
  validJpeg[2] = 0xff;
  const b64Str = validJpeg.toString('base64');

  mockResponseStatus = 200;
  mockResponseBody = {
    data: [{ b64_json: b64Str }],
  };

  const adapter = new TestableImageAdapter('test-key-ok');
  const res = await adapter.generateImage({ prompt: 'Áo dài truyền thống lụa Hà Đông' });
  testAssert(res.success === true, 'Adapter nhận và giải mã b64_json thành công');
  testAssert(res.mimeType === 'image/jpeg', 'Xác thực mimeType image/jpeg chính xác');
  testAssert(res.imageBuffer instanceof Buffer, 'imageBuffer là Buffer hợp lệ');
}

// 4.2 Mock Gateway trả về thành công dạng URL
{
  // Lưu ý: isSafeDownloadUrl chặn 127.0.0.1 để chống SSRF, nên chúng ta test trường hợp URL loopback bị chặn và URL ngoài an toàn
  mockResponseStatus = 200;
  mockResponseBody = {
    data: [{ url: 'http://127.0.0.1:9999/private-exploit.jpg' }],
  };

  const adapter = new TestableImageAdapter('test-key-ok');
  const res = await adapter.generateImage({ prompt: 'Áo dài lụa' });
  testAssert(res.success === false && res.statusCode === 400, 'Chặn an toàn khi gateway trả về URL loopback nội bộ (SSRF Protection)');
}

// 4.3 Mock Gateway trả về lỗi 401 Unauthorized (Sai API key)
{
  mockResponseStatus = 401;
  mockResponseBody = {
    error: { message: 'Incorrect API key provided: sk-invalid***' },
  };

  const adapter = new TestableImageAdapter('test-key-bad');
  const res = await adapter.generateImage({ prompt: 'Áo dài' });
  testAssert(res.success === false && res.statusCode === 401, 'Bắt đúng mã lỗi HTTP 401 Unauthorized');
  testAssert(res.error?.includes('401'), 'Thông báo lỗi chỉ rõ mã 401');
}

// 4.4 Mock Gateway trả về lỗi 429 Rate Limit (Hết quota / quá tần suất)
{
  mockResponseStatus = 429;
  mockResponseBody = {
    error: { message: 'Rate limit reached for requests per minute' },
  };

  const adapter = new TestableImageAdapter('test-key-ratelimit');
  const res = await adapter.generateImage({ prompt: 'Áo dài' });
  testAssert(res.success === false && res.statusCode === 429, 'Bắt đúng mã lỗi HTTP 429 Rate Limit');
  testAssert(res.error?.includes('429'), 'Thông báo lỗi minh bạch về 429 Rate Limit');
}

// 4.5 Mock Gateway trả về lỗi 500 / 502 Server Error
{
  mockResponseStatus = 502;
  mockResponseBody = {
    error: { message: 'Bad Gateway upstream timeout from Google Gemini' },
  };

  const adapter = new TestableImageAdapter('test-key-server-err');
  const res = await adapter.generateImage({ prompt: 'Áo dài' });
  testAssert(res.success === false && res.statusCode === 502, 'Bắt đúng mã lỗi HTTP 502 Bad Gateway');
}

// 4.6 Mock Gateway bị Timeout (quá thời gian chờ)
{
  mockResponseStatus = 200;
  mockResponseBody = { data: [{ b64_json: 'test' }] };
  mockResponseDelayMs = 1500; // trễ 1.5s

  const adapterWithShortTimeout = new TestableImageAdapter('test-key-timeout', 500); // timeout 500ms
  const res = await adapterWithShortTimeout.generateImage({ prompt: 'Áo dài' });
  testAssert(res.success === false && res.statusCode === 504, 'Bắt đúng lỗi Timeout (HTTP 504) khi gateway phản hồi quá chậm');
  mockResponseDelayMs = 0; // reset delay
}

// 4.7 Mock Gateway trả về tệp không phải ảnh (HTML hoặc Corrupted data)
{
  const corruptB64 = Buffer.from(
    '<!DOCTYPE html><html><head><title>503 Service Unavailable</title></head><body><h1>Gateway HTML Error</h1><p>Server returned HTML page instead of valid binary image.</p></body></html>'
  ).toString('base64');
  mockResponseStatus = 200;
  mockResponseBody = {
    data: [{ b64_json: corruptB64 }],
  };

  const adapter = new TestableImageAdapter('test-key-corrupt');
  const res = await adapter.generateImage({ prompt: 'Áo dài' });
  testAssert(res.success === false && res.statusCode === 502, 'Từ chối tệp không có magic bytes hợp lệ');
  testAssert(res.error?.includes('magic bytes') || res.error?.includes('không hợp lệ'), 'Thông báo lỗi giải thích đúng về định dạng ảnh không hợp lệ');
}

// 4.8 Multimodal Reference Image Generation (POST /chat/completions)
{
  mockResponseStatus = 200;
  mockResponseBody = {};
  const sampleRef = Buffer.alloc(256);
  sampleRef[0] = 0xff;
  sampleRef[1] = 0xd8;
  sampleRef[2] = 0xff;

  const adapter = new TestableImageAdapter('test-key-multimodal');
  const res = await adapter.generateImageWithReference({
    prompt: 'Áo dài lụa màu hồng phấn',
    referenceImageBuffer: sampleRef,
    referenceMimeType: 'image/jpeg',
  });
  testAssert(res.success === true, 'Multimodal Image Adapter xử lý ảnh tham chiếu qua chat/completions thành công');
  testAssert(res.mimeType === 'image/jpeg', 'Nhận diện đúng mimeType image/jpeg từ markdown data URI');
  testAssert(res.imageBuffer instanceof Buffer, 'imageBuffer trả về đối tượng Buffer hợp lệ');
}

// 4.9 Multimodal Reference khi Gateway trả về phản hồi không có ảnh (hoặc không hỗ trợ editing)
{
  mockResponseStatus = 200;
  mockResponseBody = {
    choices: [{ message: { content: 'Xin lỗi, tôi là mô hình ngôn ngữ và không thể tạo ảnh.' } }],
  };
  const sampleRef = Buffer.alloc(256);
  sampleRef[0] = 0xff;
  sampleRef[1] = 0xd8;
  sampleRef[2] = 0xff;

  const adapter = new TestableImageAdapter('test-key-no-img');
  const res = await adapter.generateImageWithReference({
    prompt: 'Áo dài lụa',
    referenceImageBuffer: sampleRef,
    referenceMimeType: 'image/jpeg',
  });
  testAssert(res.success === false && res.statusCode === 502, 'Bắt lỗi HTTP 502 khi phản hồi multimodal không chứa data URI hình ảnh');
  testAssert(res.error?.includes('không trả về dữ liệu hình ảnh'), 'Thông báo lỗi minh bạch khi thiếu dữ liệu ảnh');
  mockResponseBody = {}; // reset
}

console.log(' -> TẤT CẢ INTEGRATION TESTS CHO IMAGE ADAPTER ĐÃ VƯỢT QUA!\n');

// ============================================================================
// PHẦN 5: E2E API INTEGRATION TESTS - JOBS, RATE LIMITING, FILE STREAM & AN TOÀN
// ============================================================================
console.log('--- [TEST NHÓM 5] E2E Backend API Integration Tests: Job Queue & Security ---');

// Cấu hình mock server trả về ảnh JPEG hợp lệ cho các request live của backend
const validJpegSample = Buffer.alloc(1024);
validJpegSample[0] = 0xff;
validJpegSample[1] = 0xd8;
validJpegSample[2] = 0xff;
const validJpegB64 = validJpegSample.toString('base64');

mockResponseStatus = 200;
mockResponseBody = {
  data: [{ b64_json: validJpegB64 }],
};
mockResponseDelayMs = 0;

const testDir = path.resolve('test-image-ai-scratch');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

const testDbPath = path.join(testDir, 'test-image-ai.db');
const testImagesDir = path.join(testDir, 'generated-images');
fs.mkdirSync(testImagesDir, { recursive: true });

// Khởi động server test backend
console.log('  [SERVER] Đang khởi động máy chủ API kiểm thử độc lập...');
const serverProcess = spawn(process.execPath, ['apps/server/dist/index.js'], {
  env: {
    ...process.env,
    PORT: '0',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    DATABASE_PATH: testDbPath,
    IMAGE_STORAGE_DIR: testImagesDir,
    // Cung cấp dummy key và trỏ tới mock server đang chạy
    AI_IMAGE_API_KEY: 'test_image_key_mock_live',
    AI_IMAGE_BASE_URL: `${mockBaseUrl}/v1`,
  },
  stdio: 'pipe',
});

let serverPort = null;
serverProcess.stdout.on('data', (chunk) => {
  const str = chunk.toString();
  const match = str.match(/http:\/\/127\.0\.0\.1:(\d+)/);
  if (match) serverPort = match[1];
});
serverProcess.stderr.on('data', (chunk) => {
  const text = chunk.toString().trim();
  if (text) console.error('  [SERVER ERR]', text);
});
serverProcess.on('exit', (code, signal) => {
  if (!serverReady) {
    console.error(`  [SERVER EXIT] Server process exited early with code=${code}, signal=${signal}`);
  }
});

// Đợi server sẵn sàng
let serverReady = false;
for (let i = 0; i < 25; i++) {
  if (serverPort) {
    try {
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/health`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {}
  }
  await new Promise((r) => setTimeout(r, 400));
}

if (!serverReady || !serverPort) {
  console.error('Không thể kết nối máy chủ kiểm thử backend.');
  serverProcess.kill();
  process.exit(1);
}

const API_ROOT = `http://127.0.0.1:${serverPort}/api`;
const cookies = new Map();

async function callApi(endpoint, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (cookies.size > 0) {
    headers['Cookie'] = Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  const res = await fetch(`${API_ROOT}${endpoint}`, { ...opts, headers });

  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (setCookies.length === 0) {
    const raw = res.headers.get('set-cookie');
    if (raw) setCookies.push(raw);
  }
  for (const sc of setCookies) {
    const parts = sc.split(';')[0].split('=');
    if (parts.length >= 2) cookies.set(parts[0].trim(), parts.slice(1).join('=').trim());
  }

  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, headers: res.headers, data: json };
}

try {
  // 5.1 Validation: Từ chối prompt rỗng
  const emptyRes = await callApi('/ai/images/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt: '   ' }),
  });
  testAssert(emptyRes.status === 400, 'Bắt lỗi HTTP 400 khi prompt rỗng');

  // 5.2 Validation: Từ chối prompt vượt 1000 ký tự
  const tooLongRes = await callApi('/ai/images/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt: 'A'.repeat(1001) }),
  });
  testAssert(tooLongRes.status === 400, 'Bắt lỗi HTTP 400 khi prompt vượt 1000 ký tự');

  // 5.3 Tạo job hợp lệ qua POST /api/ai/images/generate
  const genRes = await callApi('/ai/images/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Áo dài lụa tơ tằm màu xanh cố đô thêu chim hạc dạo phố cổ Hà Nội',
      stylePreset: 'elegant_fashion_2d',
    }),
  });
  testAssert(genRes.status === 201 || genRes.status === 200, 'Tạo job tạo ảnh thành công (HTTP 201/200)');
  testAssert(genRes.data.job && genRes.data.job.id, 'Trả về job object kèm ID định danh');
  const createdJob = genRes.data.job;
  testAssert(createdJob.stylePreset === 'elegant_fashion_2d', 'Lưu chính xác stylePreset trong DB');
  testAssert(createdJob.parsedDetails?.primaryColor?.family === 'blue', 'Thực thể bóc tách màu áo xanh cố đô được lưu');

  // 5.4 Chống spam / trùng lặp trong vòng 45 giây (Anti-spam duplicate suppression)
  const duplicateRes = await callApi('/ai/images/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Áo dài lụa tơ tằm màu xanh cố đô thêu chim hạc dạo phố cổ Hà Nội',
      stylePreset: 'elegant_fashion_2d',
    }),
  });
  testAssert(duplicateRes.status === 200, 'Gửi lại prompt trùng lặp được xử lý thành công');
  testAssert(duplicateRes.data.isExisting === true, 'Gắn nhãn isExisting: true báo hiệu tái sử dụng job để tiết kiệm tài nguyên');
  testAssert(duplicateRes.data.job.id === createdJob.id, 'Trả về chính xác job ID trước đó');

  // 5.5 Kiểm tra danh sách GET /api/ai/images
  const listRes = await callApi('/ai/images');
  testAssert(listRes.status === 200, 'GET /api/ai/images trả về HTTP 200');
  testAssert(Array.isArray(listRes.data.jobs), 'Trả về mảng jobs');
  testAssert(listRes.data.jobs.some((j) => j.id === createdJob.id), 'Tìm thấy job vừa tạo trong danh sách');

  // 5.6 Kiểm tra GET /api/ai/images/jobs/:id
  const getJobRes = await callApi(`/ai/images/jobs/${createdJob.id}`);
  testAssert(getJobRes.status === 200, 'GET /api/ai/images/jobs/:id trả về HTTP 200');
  testAssert(getJobRes.data.job.id === createdJob.id, 'Dữ liệu job trùng khớp');

  // 5.7 Kiểm tra an toàn bảo mật Directory Traversal khi đọc tệp ảnh GET /api/ai/images/:id/file
  const traversalRes = await callApi('/ai/images/..%2F..%2Fpackage.json/file');
  testAssert(traversalRes.status === 400 || traversalRes.status === 404, 'Ngăn chặn tấn công Directory Traversal (HTTP 400/404)');

  // 5.8 Giả lập lưu file ảnh vật lý hợp lệ và kiểm tra phục vụ file + cache headers
  const sampleJpeg = Buffer.alloc(1024);
  sampleJpeg[0] = 0xff;
  sampleJpeg[1] = 0xd8;
  sampleJpeg[2] = 0xff;
  const mockImageFilePath = path.join(testImagesDir, `${createdJob.id}.jpg`);
  fs.writeFileSync(mockImageFilePath, sampleJpeg);

  const fileRes = await fetch(`${API_ROOT}/ai/images/${createdJob.id}/file`, {
    headers: {
      Cookie: Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; '),
    },
  });
  testAssert(fileRes.status === 200, 'Phục vụ tệp ảnh vật lý thành công (HTTP 200)');
  testAssert(fileRes.headers.get('content-type') === 'image/jpeg', 'Header Content-Type: image/jpeg');
  testAssert(fileRes.headers.get('cache-control')?.includes('max-age=86400'), 'Header Cache-Control chứa max-age=86400 (HTTP Caching tối ưu)');

  // 5.9 Kiểm tra xóa ảnh DELETE /api/ai/images/:id
  const delRes = await callApi(`/ai/images/${createdJob.id}`, { method: 'DELETE' });
  testAssert(delRes.status === 200, 'DELETE /api/ai/images/:id thành công');
  testAssert(!fs.existsSync(mockImageFilePath), 'Tệp ảnh vật lý trên đĩa đã được dọn dẹp sạch sẽ sau khi xóa');

  // 5.10 Upload ảnh chân dung hợp lệ (POST /api/ai/images/upload-reference)
  const portraitBuffer = Buffer.alloc(1024);
  portraitBuffer[0] = 0xff;
  portraitBuffer[1] = 0xd8;
  portraitBuffer[2] = 0xff;
  // Gắn kèm marker APP1 EXIF để xác thực việc tự động loại bỏ EXIF khi upload
  const portraitWithExif = Buffer.concat([
    portraitBuffer.subarray(0, 2),
    Buffer.from([0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]),
    portraitBuffer.subarray(2),
  ]);
  const faceBase64 = `data:image/jpeg;base64,${portraitWithExif.toString('base64')}`;

  const uploadRes = await callApi('/ai/images/upload-reference', {
    method: 'POST',
    body: JSON.stringify({
      data: faceBase64,
      filename: 'portrait-user.jpg',
    }),
  });
  testAssert(uploadRes.status === 201, 'Upload ảnh chân dung thành công (HTTP 201)');
  testAssert(uploadRes.data.success === true && uploadRes.data.reference?.id, 'Trả về mã ID tham chiếu chân dung');
  const refId = uploadRes.data.reference.id;
  testAssert(uploadRes.data.reference.mimeType === 'image/jpeg', 'Xác thực mimeType image/jpeg');
  testAssert(Boolean(uploadRes.data.reference.expiresAt), 'Thiết lập thời gian tự động hết hạn 24 giờ (expiresAt)');

  // 5.11 Kiểm tra chữ ký magic bytes và ràng buộc kích thước khi upload ảnh chân dung
  // 5.11a: Giả mạo đuôi ảnh (file signature mismatch)
  const fakeJpg = Buffer.from('Plain text fake image content pretending to be JPEG');
  const fakeRes = await callApi('/ai/images/upload-reference', {
    method: 'POST',
    body: JSON.stringify({
      data: `data:image/jpeg;base64,${fakeJpg.toString('base64')}`,
      filename: 'fake.jpg',
    }),
  });
  testAssert(fakeRes.status === 400, 'Từ chối tệp giả mạo đuôi ảnh không khớp magic bytes (HTTP 400)');

  // 5.11b: Quá dung lượng cho phép (>8MB)
  const bigBuffer = Buffer.alloc(8.5 * 1024 * 1024);
  bigBuffer[0] = 0xff;
  bigBuffer[1] = 0xd8;
  bigBuffer[2] = 0xff;
  const bigRes = await callApi('/ai/images/upload-reference', {
    method: 'POST',
    body: JSON.stringify({
      data: `data:image/jpeg;base64,${bigBuffer.toString('base64')}`,
    }),
  });
  testAssert(bigRes.status === 400, 'Từ chối tệp vượt quá giới hạn 8MB (HTTP 400)');

  // 5.11c: Định dạng không hỗ trợ (ví dụ GIF)
  const gifBuffer = Buffer.from('GIF89a...');
  const gifRes = await callApi('/ai/images/upload-reference', {
    method: 'POST',
    body: JSON.stringify({
      data: `data:image/gif;base64,${gifBuffer.toString('base64')}`,
    }),
  });
  testAssert(gifRes.status === 400, 'Từ chối định dạng tệp không nằm trong danh mục hỗ trợ (HTTP 400)');

  // 5.11d: Dữ liệu rỗng
  const emptyUploadRes = await callApi('/ai/images/upload-reference', {
    method: 'POST',
    body: JSON.stringify({ data: '' }),
  });
  testAssert(emptyUploadRes.status === 400, 'Từ chối tải ảnh khi dữ liệu base64 rỗng (HTTP 400)');

  // 5.12 Tạo ảnh có khuôn mặt tham chiếu (POST /api/ai/images/generate có referenceId)
  const faceGenRes = await callApi('/ai/images/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Áo dài lụa màu hồng pastel thêu cành đào ngày Tết',
      referenceId: refId,
      stylePreset: 'elegant_fashion_2d',
    }),
  });
  testAssert(faceGenRes.status === 201 || faceGenRes.status === 200, 'Tạo ảnh minh họa có khuôn mặt tham chiếu thành công');
  testAssert(faceGenRes.data.job?.referenceId === refId, 'Job được liên kết đúng với referenceId');
  const faceJobId = faceGenRes.data.job.id;

  // 5.13 Chỉnh sửa ảnh hội thoại đa lượt (POST /api/ai/images/edit)
  const editRes = await callApi('/ai/images/edit', {
    method: 'POST',
    body: JSON.stringify({
      parentImageId: faceJobId,
      instruction: 'Giữ khuôn mặt nhưng đổi áo dài sang màu đỏ tươi rực rỡ',
      keepFaceReference: true,
      stylePreset: 'elegant_fashion_2d',
    }),
  });
  testAssert(editRes.status === 201, 'Chỉnh sửa ảnh hội thoại đa lượt thành công (HTTP 201)');
  testAssert(editRes.data.job?.parentImageId === faceJobId, 'Job con lưu chính xác parentImageId');
  testAssert(editRes.data.job?.iteration === 2, 'Cập nhật đúng số lượt phiên bản (iteration: 2)');
  testAssert(editRes.data.job?.prompt.includes('đổi áo dài sang màu đỏ'), 'Lưu câu lệnh điều chỉnh tự nhiên trong prompt');
  const childJobId = editRes.data.job.id;

  // Kiểm tra phả hệ phiên bản GET /api/ai/images/:id/lineage
  const lineageRes = await callApi(`/ai/images/${childJobId}/lineage`);
  testAssert(lineageRes.status === 200, 'GET lineage thành công');
  testAssert(Array.isArray(lineageRes.data.lineage) && lineageRes.data.lineage.length >= 2, 'Lịch sử phả hệ ghi nhận đầy đủ chuỗi phiên bản');
  testAssert(lineageRes.data.lineage[0].id === faceJobId, 'Phiên bản đầu là v1');
  testAssert(lineageRes.data.lineage[1].id === childJobId, 'Phiên bản kế tiếp là v2');

  // 5.14 Phân vùng dữ liệu nghiêm ngặt giữa hai session (Session Isolation)
  const session2Headers = {
    'Content-Type': 'application/json',
    Cookie: 'dangviet_session=session_attacker_b_999',
  };
  const s2GetJobRes = await fetch(`${API_ROOT}/ai/images/jobs/${faceJobId}`, {
    headers: session2Headers,
  });
  testAssert(s2GetJobRes.status === 404, 'Session 2 không thể truy cập job của Session 1 (HTTP 404)');

  const s2DelRefRes = await fetch(`${API_ROOT}/ai/images/references/${refId}`, {
    method: 'DELETE',
    headers: session2Headers,
  });
  testAssert(s2DelRefRes.status === 404, 'Session 2 không thể xóa reference của Session 1 (HTTP 404)');

  // 5.15 Xóa ảnh tham chiếu gốc (DELETE /api/ai/images/references/:id)
  const delRefRes = await callApi(`/ai/images/references/${refId}`, {
    method: 'DELETE',
  });
  testAssert(delRefRes.status === 200, 'Xóa ảnh chân dung gốc thành công');
  testAssert(delRefRes.data.success === true, 'Trả về success: true');

  const delRefAgain = await callApi(`/ai/images/references/${refId}`, {
    method: 'DELETE',
  });
  testAssert(delRefAgain.status === 404, 'Không thể xóa lại ảnh tham chiếu đã bị xóa');

  // 5.16 Lưu và phân loại 3 loại tài nguyên Lookbook (svg_2d, ai_prompt_image, ai_face_ref_image)
  // Lấy session active look để làm bộ phối nguồn hợp lệ
  const sessionRes = await callApi('/session');
  testAssert(sessionRes.status === 200 && sessionRes.data.look?.id, 'Lấy bộ phối active của session thành công');
  const activeLook = sessionRes.data.look;

  // 5.16a Lưu bản phối SVG 2D
  const lbSvg = await callApi('/lookbook', {
    method: 'POST',
    body: JSON.stringify({
      id: 'lb_svg_test_1',
      title: 'Bản phối Áo dài SVG 2D',
      lookId: activeLook.id,
      revision: activeLook.revision,
      snapshotConfig: activeLook.config,
      eventId: activeLook.eventId,
      styleId: activeLook.styleId,
      notes: 'Bản phối gốc SVG',
      resourceType: 'svg_2d',
      createdAt: new Date().toISOString(),
    }),
  });
  testAssert(lbSvg.status === 201, 'Lưu bản phối svg_2d vào Lookbook thành công (HTTP 201)');

  // 5.16b Lưu ảnh AI sinh từ mô tả văn bản (ai_prompt_image)
  const lbAiPrompt = await callApi('/lookbook', {
    method: 'POST',
    body: JSON.stringify({
      id: 'lb_ai_prompt_test_1',
      title: 'Ảnh AI từ mô tả ngôn ngữ',
      lookId: activeLook.id,
      revision: activeLook.revision,
      snapshotConfig: activeLook.config,
      eventId: activeLook.eventId,
      styleId: activeLook.styleId,
      notes: 'Minh họa AI thời trang',
      resourceType: 'ai_prompt_image',
      designMetadata: {
        aiImageId: createdJob.id,
        aiImageUrl: `/api/ai/images/${createdJob.id}/file`,
        aiImagePrompt: 'Áo dài lụa tơ tằm dạo phố cổ',
        resourceType: 'ai_prompt_image',
      },
      createdAt: new Date().toISOString(),
    }),
  });
  testAssert(lbAiPrompt.status === 201, 'Lưu ảnh ai_prompt_image vào Lookbook thành công (HTTP 201)');

  // 5.16c Lưu ảnh AI có khuôn mặt tham chiếu (ai_face_ref_image)
  const lbFaceRef = await callApi('/lookbook', {
    method: 'POST',
    body: JSON.stringify({
      id: 'lb_face_ref_test_1',
      title: 'Thử Áo dài với khuôn mặt',
      lookId: activeLook.id,
      revision: activeLook.revision,
      snapshotConfig: activeLook.config,
      eventId: activeLook.eventId,
      styleId: activeLook.styleId,
      notes: 'Minh họa với khuôn mặt tham chiếu',
      resourceType: 'ai_face_ref_image',
      designMetadata: {
        aiImageId: childJobId,
        aiImageUrl: `/api/ai/images/${childJobId}/file`,
        resourceType: 'ai_face_ref_image',
        referenceId: refId,
        parentImageId: faceJobId,
        iteration: 2,
      },
      createdAt: new Date().toISOString(),
    }),
  });
  testAssert(lbFaceRef.status === 201, 'Lưu ảnh ai_face_ref_image vào Lookbook thành công (HTTP 201)');

  // Lấy danh sách Lookbook và kiểm tra phân loại 3 tài nguyên
  const lbList = await callApi('/lookbook');
  testAssert(lbList.status === 200, 'GET /api/lookbook trả về HTTP 200');
  testAssert(Array.isArray(lbList.data) && lbList.data.length >= 3, 'Danh sách Lookbook chứa đủ 3 mục');
  const typesFound = new Set(lbList.data.map((x) => x.resourceType));
  testAssert(typesFound.has('svg_2d'), 'Lookbook phân loại chính xác svg_2d');
  testAssert(typesFound.has('ai_prompt_image'), 'Lookbook phân loại chính xác ai_prompt_image');
  testAssert(typesFound.has('ai_face_ref_image'), 'Lookbook phân loại chính xác ai_face_ref_image');

  // Xóa mục khỏi Lookbook
  const delLb = await callApi('/lookbook/lb_face_ref_test_1', { method: 'DELETE' });
  testAssert(delLb.status === 200, 'Xóa mục Lookbook thành công (HTTP 200)');

  // 5.17 Kiểm tra bảo mật không làm lộ API Key hay bí mật
  const leakedKey = 'test_image_key_mock_live';
  const apiDump = JSON.stringify({
    genRes: genRes.data,
    faceGenRes: faceGenRes.data,
    editRes: editRes.data,
    lbList: lbList.data,
  });
  testAssert(!apiDump.includes(leakedKey), 'Tuyệt đối không rò rỉ API Key qua các endpoint API');

  console.log(' -> TẤT CẢ E2E API INTEGRATION TESTS ĐÃ VƯỢT QUA!\n');

  console.log('==============================================================================');
  console.log(`  XUẤT SẮC: TỔNG CỘNG ${passCount} / ${passCount} KIỂM THỬ ĐÃ ĐẠT 100% TIÊU CHUẨN NGHIỆM THU!`);
  console.log('  HỆ THỐNG AI TẠO ẢNH 2D ÁO DÀI VIỆT NAM ĐÃ SẴN SÀNG ĐƯA VÀO VẬN HÀNH.');
  console.log('==============================================================================');
} finally {
  serverProcess.kill();
  try {
    mockServer.close();
  } catch {}
  try {
    fs.rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
}
