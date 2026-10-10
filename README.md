# Dáng Việt — Khám phá Việt phục, tạo nên dáng riêng

> Dự án dự thi chủ đề **"Việt phục Remix — Phối trang phục truyền thống theo phong cách Gen Z"**

Ứng dụng web toàn diện hỗ trợ khám phá, phối màu, lựa chọn chất liệu và phụ kiện cho trang phục truyền thống Việt Nam (Áo dài, Cổ phục) kết hợp phong cách hiện đại cho Gen Z trong 3 bối cảnh thực tế: **Chụp ảnh kỷ yếu**, **Đi chơi Tết**, và **Ngày hội văn hóa ở trường**.

---

## 🌟 Tính năng nổi bật

1. **Phòng phối đồ tương tác (Outfit Room):**
   - Trực quan hóa vector SVG nhiều lớp động (Layered SVG Visualizer) với định danh `useId` độc lập cho từng instance.
   - Thử nghiệm bảng màu truyền thống & Gen Z, phom cổ áo, tay áo (truyền thống, raglan, lỡ, xẻ), chất liệu (lụa Hà Đông, gấm Huế, voan tơ, đũi), và phụ kiện (mấn, nón lá, chuỗi ngọc, quạt xếp, túi cói, guốc mộc).
   - Khóa thuộc tính yêu thích (`LockState`) để thử phối tự động mà không làm mất chi tiết đã chọn.
   - Hỗ trợ hoàn tác (`Undo`) tuần tự đa cấp với số hiệu phiên bản (`revision`) tăng đơn điệu.

2. **Xưởng thiết kế AI (Remix Studio):**
   - Sinh bản thiết kế cách tân có cấu trúc an toàn từ mô tả ý tưởng tự do của người dùng.
   - Bảo toàn bối cảnh sự kiện (`eventId`) và định hướng phong cách (`styleId`) riêng của từng thiết kế.
   - Luôn kèm nhãn cảnh báo quy chuẩn: *"Thiết kế cách điệu do AI hỗ trợ — Không thể dùng trực tiếp làm bản rập may."*
   - Giao diện đáp ứng mượt mà trên mọi thiết bị di động (tối ưu cả màn hình hẹp < 360px).

3. **Lookbook cá nhân & Phân loại tài nguyên:**
   - Lưu trữ bản phối theo cơ chế chụp sâu độc lập (Snapshot Isolation) trong SQLite. Sửa đổi mới trong phòng phối không làm thay đổi bản ghi đã lưu.
   - Phân loại rõ ràng 3 nhóm tài nguyên thời trang: Bản phối SVG 2D (`svg_2d`), Ảnh AI tạo từ mô tả (`ai_prompt_image`), và Ảnh AI có khuôn mặt tham chiếu (`ai_face_ref_image`).
   - Mở thiết kế từ Lookbook vào phòng phối qua `APPLY_DESIGN` phục hồi đầy đủ định danh mà không bị các quy tắc phối đè thuộc tính chưa khóa.
   - Hiển thị rõ ràng trạng thái đang xem thiết kế gốc và phân biệt khi người dùng tiếp tục chỉnh sửa.
   - So sánh trực quan song song (Side-by-side) 2 bản phối bất kỳ kèm bảng đối chiếu đặc tính chi tiết.

4. **Trợ lý AI Văn hóa & Bus Lệnh (Command Bus):**
   - Nhận diện câu lệnh tiếng Việt tự nhiên và chuyển thành lệnh có cấu trúc gửi về bus lệnh với xác thực Zod discriminated union nghiêm ngặt.
   - Tra cứu tri thức văn hóa từ các tài liệu học thuật đã kiểm chứng (Bảo tàng Lịch sử Quốc gia, Thông tấn xã Việt Nam TTXVN...).
   - Chỉ công bố (`published`) các thẻ có bằng chứng lịch sử rõ ràng, các chủ đề chưa đủ dẫn chứng vật lý được đưa vào diện thẩm định (`review`) và AI từ chối trích dẫn nguồn chưa kiểm chứng.
   - Kiến trúc Adapter kép: Tự động chạy với Intelligent Mock Adapter khi chưa có API Key và kết nối 9router / OpenAI-compatible API khi được cấu hình.
   - Kiểm soát đồng quy lạc quan (`Optimistic Concurrency Control` - OCC 409) và chống thực thi trùng lặp Command ID.

5. **Xưởng vẽ Áo dài AI 2D & Thử trang phục với khuôn mặt của bạn (Face Reference):**
   - Kết xuất hình minh họa thời trang 2D toàn thân sắc nét (1024x1024) từ mô tả tiếng Việt tự do hoặc đồng bộ trực tiếp từ cấu hình Outfit Room.
   - Hỗ trợ tải ảnh chân dung khuôn mặt thực tế (JPG, PNG, WebP tối đa 8MB) làm ảnh tham chiếu nhận diện (Face Reference).
   - Bảo vệ quyền riêng tư nghiêm ngặt: Kiểm tra chữ ký nhị phân (magic bytes) ngăn tệp giả mạo, lọc sạch toàn bộ metadata EXIF nhạy cảm (GPS, thông tin thiết bị), tự động dọn dẹp và xóa ảnh sau 24 giờ, phân vùng dữ liệu nghiêm ngặt theo phiên (`sessionId`), cấm log dữ liệu Base64 ra nhật ký hệ thống.
   - Áp đặt rào chắn quy chuẩn văn hóa Áo dài: Áo dài 2 tà trước/sau xẻ eo cao, quần lụa dài chạm mu bàn chân; negative constraints loại trừ hoàn toàn Qipao/xường xám, Kimono, Hanbok.

6. **Chỉnh sửa ảnh bằng hội thoại đa lượt (Multi-turn Conversational Refinement):**
   - Tinh chỉnh hình ảnh bằng câu lệnh tự nhiên (ví dụ: *"Giữ khuôn mặt nhưng đổi áo sang màu đỏ thêu hoa sen"*, *"Đổi nền thành phố cổ Hà Nội"*).
   - Truy vết phả hệ phiên bản (`lineage`: v1 -> v2 -> v3) kế thừa thuộc tính đã khóa và liên kết cha-con (`parentImageId`).
   - Chế độ so sánh trước/sau (Side-by-side) trực quan giữa bản trước và bản mới tinh chỉnh.
   - Tải ảnh chất lượng cao về máy hoặc lưu trữ vào Lookbook kèm siêu dữ liệu đầy đủ.

---

## 🛠 Kiến trúc Công nghệ (Monorepo)

- **Frontend:** React 19, TypeScript, Vite, SVG Vector Graphics, Lucide Icons, Thiết kế Responsive tối ưu Desktop & Mobile.
- **Backend:** Node.js v24, Fastify, Embedded SQLite (`node:sqlite DatabaseSync` — không phụ thuộc C++ build toolchains trên Windows).
- **Gói dùng chung:**
  - `@dangviet/contracts`: Định nghĩa Schemas dữ liệu chuẩn hóa bằng Zod và TypeScript.
  - `@dangviet/domain`: Logic thuần túy xử lý bus lệnh, kiểm tra revision, khóa thuộc tính và bộ luật phối đồ theo bối cảnh.
- **Package Dev Mode:** Hỗ trợ phát triển nóng với `export conditions development` trỏ thẳng vào `src/index.ts` mà không cần build thủ công các package nội bộ.
- **Phục vụ nguyên khối:** Fastify tích hợp `@fastify/static` phân phối cả REST API (`/api/*`) và Single Page Application từ cổng duy nhất.

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Yêu cầu hệ thống

- Node.js >= 22 (Khuyến nghị **Node.js v24.16.0**).
- npm >= 10.
- Không cần cài đặt Docker hoặc Visual Studio C++ build tools.

### 2. Cài đặt phụ thuộc & Kiểm tra môi trường

```bash
# Kiểm tra môi trường hệ thống
npm run doctor

# Khởi tạo cơ sở dữ liệu SQLite ban đầu
npm run setup
```

### 3. Biên dịch hệ thống

```bash
npm run build
```

### 4. Chạy kiểm thử tự động

```bash
# Kiểm thử luồng nghiệp vụ người dùng trọn vẹn E2E (Khởi tạo -> Phối đồ -> Khóa -> AI -> Thiết kế -> Lưu -> Mở lại)
npm test

# Kiểm thử hệ thống AI Tạo ảnh 2D & Thử khuôn mặt (125 kịch bản unit, bảo mật magic bytes, lọc EXIF, anti-SSRF, phả hệ, Lookbook)
npm run test:image-ai

# Kiểm thử củng cố hệ thống (Hoàn tác đa cấp tuần tự, OCC 409, Khóa, AI Parser, Chống trùng lặp)
node scripts/test-harden.mjs

# Kiểm thử upstream AI giả lập toàn diện 7 kịch bản (JSON hợp lệ, JSON hỏng, lệnh sai, timeout, 401/429/500, fallback, kiểm tra key)
node scripts/test-ai-upstream.mjs

# Kiểm thử di chuyển lược đồ nguyên tử, rollback và bảo toàn dữ liệu
node scripts/test-migrations.mjs

# Kiểm thử sao lưu an toàn VACUUM INTO, xác thực SHA-256, và khôi phục độc lập vào thư mục riêng
node scripts/test-backup-restore.mjs

# Kiểm thử tích hợp AI và rào chắn liêm chính trích dẫn tư liệu văn hóa đã kiểm chứng
node scripts/test-ai-culture.mjs
```

### 5. Khởi động ứng dụng

```bash
# Chạy ứng dụng hoàn chỉnh (API + Web trên cổng 3088)
npm start
```

Mở trình duyệt tại: [http://localhost:3088](http://localhost:3088)

Để phát triển với Hot-Reloading:

```bash
npm run dev
# Server API: http://localhost:3088 | Web Vite: http://localhost:5188 (strictPort: true)
```

---

## 🧭 Hướng dẫn Thử nghiệm Hành trình Demo

1. **Khám phá bối cảnh & phong cách:** Truy cập trang chủ, lựa chọn bối cảnh phù hợp: *Chụp ảnh kỷ yếu*, *Đi chơi Tết*, hoặc *Ngày hội trường*.
2. **Phòng phối đồ tương tác (Outfit Room):**
   - Lựa chọn màu áo, màu quần, kiểu cổ áo, tay áo, chất liệu và phụ kiện.
   - Bấm biểu tượng 🔒 để **khóa thuộc tính** (ví dụ: khóa màu áo Đỏ son hoàng gia).
3. **Trò chuyện cùng Trợ lý AI:**
   - Đưa ra yêu cầu bằng tiếng Việt tự nhiên (ví dụ: *"Gợi ý đổi màu quần sang đen tuyền dạ hội"*).
   - AI phân tích câu lệnh, bảo vệ thuộc tính đã khóa và sinh lệnh thay đổi có cấu trúc.
4. **Sáng tạo thiết kế tại Remix Studio:**
   - Nhập mô tả ý tưởng tự do kèm bối cảnh sự kiện và phong cách.
   - Nhận bản thiết kế có cấu trúc và giải trình thẩm mỹ, kèm nhãn cảnh báo quy chuẩn.
5. **Lưu vào Lookbook cá nhân:**
   - Bấm nút **Lưu vào Lookbook**; bản thiết kế được chụp sâu độc lập (Snapshot Isolation) trong SQLite, bảo toàn trọn vẹn `eventId`, `styleId`, tiêu đề và ghi chú.
6. **Mở lại và tùy biến tiếp:**
   - Vào tab **Lookbook**, bấm **Mở trong phòng phối**; bộ phối được phục hồi qua `APPLY_DESIGN`.
   - Tiếp tục chỉnh sửa thêm chi tiết; bản snapshot trong Lookbook giữ nguyên tính toàn vẹn.
7. **Hoàn tác (Undo) đa cấp:**
   - Bấm **Hoàn tác** để lùi lại từng bước thay đổi; số hiệu `revision` tăng đơn điệu và lịch sử rẽ nhánh an toàn.
8. **So sánh đối chiếu:**
   - Chọn hai bản phối bất kỳ trong Lookbook và bấm **So sánh** để đối chiếu trực quan song song và xem bảng đối chiếu đặc tính.

---

## ⚠️ Hạn chế đã biết (Known Limitations)

1. **Mô hình đồ họa minh họa:** Hình ảnh trang phục được dựng bằng vector SVG 2D nhiều lớp động, mô phỏng màu sắc, phom dáng cắt may và vân dệt bề mặt. Hệ thống hiện **chưa mô phỏng độ rủ vi sợi 3D** hoặc độ vừa vặn cơ thể thực tế theo từng số đo nhân trắc học.
2. **Thiết kế do AI hỗ trợ:** Các mẫu do AI sinh ra là gợi ý sáng tạo thẩm mỹ phong cách cách tân, **không thể dùng trực tiếp làm bản rập kỹ thuật may đo**.
3. **Dữ liệu tư liệu văn hóa:** Tuân thủ nguyên tắc liêm chính học thuật, hiện tại hệ thống chỉ công bố (`published`) 2 thẻ tư liệu đã được đối soát nguồn công báo/báo chí chính thống trực tiếp (Làng may Trạch Xá và Dệt lụa Vạn Phúc - TTXVN). Các tư liệu văn hóa khác đang được lưu trữ ở trạng thái thẩm định (`review`) và AI từ chối trích dẫn tự động cho tới khi hoàn tất đối soát số trang/công báo vật lý.
4. **Độ tương đồng khuôn mặt trong AI Image 2D:** Kết quả từ tính năng "Thử áo dài với khuôn mặt" là tranh minh họa thời trang 2D toàn thân chuyển thể nghệ thuật đặc điểm nhận dạng khuôn mặt, **không phải phép thử đồ đảm bảo chính xác 100% danh tính, vóc dáng hoặc số đo cơ thể thực tế**.
5. **Khả năng hỗ trợ của Gateway ngoài:** Khả năng kết xuất hình ảnh multimodal và tinh chỉnh hội thoại đa lượt phụ thuộc vào tính sẵn sàng của mô hình `ag/gemini-3.1-flash-image` qua cổng 9router Gateway. Nếu cổng gateway không trả về dữ liệu ảnh hợp lệ, hệ thống báo lỗi minh bạch và từ chối sinh ảnh giả mạo.

---

## 🔄 Hướng dẫn Khôi phục Dữ liệu sang Thư mục Mới

Để khôi phục dữ liệu từ bản sao lưu sang một thư mục độc lập an toàn:

```bash
# 1. Chạy khôi phục sang thư mục riêng biệt (chẳng hạn: restored/demo-restore)
node scripts/restore.mjs backups/backup-<timestamp> --target-dir restored/demo-restore

# 2. Để sử dụng cơ sở dữ liệu vừa khôi phục cho máy chủ, khởi động với biến DATABASE_PATH:
$env:DATABASE_PATH="restored/demo-restore/dangviet.db"; npm start
```

*Lưu ý an toàn:* Trình khôi phục từ chối mọi thao tác ghi đè lên thư mục database đang hoạt động hoặc thư mục có sẵn tệp. Tuyệt đối không sao chép đè trực tiếp khi máy chủ đang chạy.

---

## ⚙️ Cấu hình Môi trường (.env)

Sao chép `.env.example` thành `.env`:

```env
PORT=3088
HOST=127.0.0.1
DATABASE_PATH=data/dangviet.db

# 9router / OpenAI-compatible AI Provider (Text / Chat / Structured Design)
AI_BASE_URL=https://api.9router.com/v1
AI_MODEL=gemini-2.5-flash
AI_API_KEY=
AI_TIMEOUT_MS=30000

# 9router AI Image Generation Provider (2D Ao Dai Illustration & Face Reference)
AI_IMAGE_BASE_URL=https://9router.duwn.id.vn/v1
AI_IMAGE_MODEL=ag/gemini-3.1-flash-image
AI_IMAGE_API_KEY=
AI_IMAGE_TIMEOUT_MS=120000
```

*Lưu ý:*

- Biến môi trường truyền từ bên ngoài (`process.env`) luôn có quyền ưu tiên cao hơn tệp `.env`.
- `DATABASE_PATH` luôn được chuẩn hóa từ Project Root, không phụ thuộc vào thư mục hiện hành (`cwd`).
- Nếu không điền `AI_API_KEY`, ứng dụng tự động chạy ở chế độ **Mock AI thông minh** nội bộ với đầy đủ khả năng hiểu câu lệnh và trích dẫn văn hóa mà không phát sinh bất kỳ lỗi nào.
- Nếu không điền `AI_IMAGE_API_KEY`, hệ thống tự động kế thừa `AI_API_KEY`. Khi chưa cấu hình key, xưởng vẽ AI hiển thị thông báo mô phỏng an toàn minh bạch.

---

## 📖 Tài liệu dự án

- [Tiến độ & Nhật ký các mốc](docs/PROGRESS.md)
- [Kiến trúc hệ thống chi tiết](docs/ARCHITECTURE.md)
- [Cẩm nang vận hành & Triển khai](docs/RUNBOOK.md)
- [Khảo cứu nguồn gốc tư liệu văn hóa](docs/CULTURAL_SOURCES.md)

---

## 📄 Bản quyền & Trách nhiệm nội dung

- Dáng Việt tôn trọng bản quyền tư liệu lịch sử và nghiên cứu văn hóa dân tộc. Mọi thông tin văn hóa đều được ghi rõ nguồn khảo cứu.
- Các thiết kế phối màu và hoa văn cách điệu là đề xuất thẩm mỹ mở, khuyến khích tình yêu trang phục truyền thống trong giới trẻ.
