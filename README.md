# Dáng Việt — Khám phá Việt phục, tạo nên dáng riêng

> Dự án dự thi chủ đề **"Việt phục Remix — Phối trang phục truyền thống theo phong cách Gen Z"**

Ứng dụng web toàn diện hỗ trợ khám phá, phối màu, lựa chọn chất liệu và phụ kiện cho trang phục truyền thống Việt Nam (Áo dài, Cổ phục) kết hợp phong cách hiện đại cho Gen Z trong 3 bối cảnh thực tế: **Chụp ảnh kỷ yếu**, **Đi chơi Tết**, và **Ngày hội văn hóa ở trường**.

---

## 🌟 Tính năng nổi bật

1. **Phòng phối đồ tương tác (Outfit Room):**
   - Trực quan hóa vector SVG nhiều lớp động (Layered SVG Visualizer) đạt chuẩn 60fps.
   - Thử nghiệm bảng màu truyền thống & Gen Z, phom cổ áo, tay áo (truyền thống, raglan, lỡ, xẻ), chất liệu (lụa Hà Đông, gấm Huế, voan tơ), và phụ kiện (mấn, nón lá, chuỗi ngọc, quạt xếp, túi cói, guốc mộc).
   - Khóa thuộc tính yêu thích (`LockState`) để thử phối tự động mà không làm mất chi tiết đã chọn.
   - Hỗ trợ hoàn tác (`Undo`) không giới hạn dựa trên lịch sử phiên bản (`look_revisions`).

2. **Xưởng thiết kế AI (Remix Studio):**
   - Sinh bản thiết kế cách tân có cấu trúc an toàn từ mô tả ý tưởng tự do của người dùng.
   - Luôn kèm nhãn cảnh báo quy chuẩn: *"Thiết kế cách điệu do AI hỗ trợ — Không thể dùng trực tiếp làm bản rập may."*

3. **Lookbook cá nhân & So sánh đối chiếu:**
   - Lưu trữ bản phối theo cơ chế chụp sâu độc lập (Snapshot Isolation) trong SQLite. Sửa đổi mới trong phòng phối không làm thay đổi bản ghi đã lưu.
   - So sánh trực quan song song (Side-by-side) 2 bản phối bất kỳ kèm bảng đối chiếu đặc tính chi tiết.

4. **Trợ lý AI Văn hóa & Bus Lệnh (Command Bus):**
   - Nhận diện câu lệnh tiếng Việt tự nhiên và chuyển thành lệnh có cấu trúc gửi về bus lệnh.
   - Tra cứu tri thức văn hóa từ các tài liệu học thuật đã kiểm chứng (*Ngàn năm áo mũ*, nhà may Dung Đakao 1960, họa sĩ Cát Tường 1934, làng lụa Vạn Phúc...).
   - Kiến trúc Adapter kép: Tự động chạy với Intelligent Mock Adapter khi chưa có API Key và kết nối 9router / OpenAI-compatible API khi được cấu hình.
   - Kiểm soát đồng quy lạc quan (`Optimistic Concurrency Control`) chống xung đột ghi đè giữa người dùng và AI.

---

## 🛠 Kiến trúc Công nghệ (Monorepo)

- **Frontend:** React 19, TypeScript, Vite, SVG Vector Graphics, Lucide Icons, Thiết kế Responsive tối ưu Desktop & Mobile.
- **Backend:** Node.js v24, Fastify, Embedded SQLite (`node:sqlite DatabaseSync` — không phụ thuộc C++ build toolchains trên Windows).
- **Gói dùng chung:**
  - `@dangviet/contracts`: Định nghĩa Schemas dữ liệu chuẩn hóa bằng Zod và TypeScript.
  - `@dangviet/domain`: Logic thuần túy xử lý bus lệnh, kiểm tra revision, khóa thuộc tính và bộ luật phối đồ theo bối cảnh.
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
# Kiểm thử luồng nghiệp vụ cơ bản
npm run test

# Kiểm thử chuyên sâu hệ thống (Hoàn tác đa cấp tuần tự, OCC, Khóa, AI Parser, Backup)
node scripts/test-harden.mjs
```
*Bộ kiểm thử `scripts/test-harden.mjs` xác minh chi tiết 5 nhóm kịch bản: chuỗi 3 sửa - 3 hoàn tác liên tiếp - 1 sửa mới, chống vượt khóa `force: true`, từ chối phụ kiện ngoài catalog, chống duplicate command ID, xử lý xung đột 409 khi lệnh gửi đồng thời, lọc lệnh của AI qua parser và kiểm chứng phục hồi an toàn.*

### 5. Khởi động ứng dụng
```bash
# Chạy ứng dụng hoàn chỉnh (API + Web trên cổng 3001)
npm start
```
Mở trình duyệt tại: **http://localhost:3001**

Để phát triển với Hot-Reloading:
```bash
npm run dev
# Server API: http://localhost:3001 | Web Vite: http://localhost:5173
```

---

## ⚙️ Cấu hình Môi trường (.env)

Sao chép `.env.example` thành `.env`:
```env
PORT=3001
HOST=127.0.0.1
DATABASE_PATH=data/dangviet.db
AI_BASE_URL=https://api.9router.com/v1
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=12000
```
*Lưu ý: Nếu không điền `AI_API_KEY`, ứng dụng tự động chạy ở chế độ **Mock AI thông minh** nội bộ với đầy đủ khả năng hiểu câu lệnh và trích dẫn văn hóa mà không phát sinh bất kỳ lỗi nào.*

---

## 📖 Tài liệu dự án

- [Tiến độ & Nhật ký các mốc](docs/PROGRESS.md)
- [Kiến trúc hệ thống chi tiết](docs/ARCHITECTURE.md)
- [Cẩm nang vận hành & Triển khai](docs/RUNBOOK.md)

---

## 📄 Bản quyền & Trách nhiệm nội dung

- Dáng Việt tôn trọng bản quyền tư liệu lịch sử và nghiên cứu văn hóa dân tộc. Mọi thông tin văn hóa đều được ghi rõ nguồn khảo cứu.
- Các thiết kế phối màu và hoa văn cách điệu là đề xuất thẩm mỹ mở, khuyến khích tình yêu trang phục truyền thống trong giới trẻ.
