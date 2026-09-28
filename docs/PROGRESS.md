# TIẾN ĐỘ THỰC HIỆN DỰ ÁN DÁNG VIỆT (PROGRESS.md)

**Đề thi:** *Việt phục Remix — Phối trang phục truyền thống theo phong cách Gen Z*  
**Khẩu hiệu:** *"Khám phá Việt phục, tạo nên dáng riêng"*  
**Môi trường:** Windows 11, Node.js v24.16.0, Monorepo npm workspaces, SQLite embedded (`node:sqlite`).

---

## Mốc 1: Khởi tạo kiến trúc Monorepo & Dữ liệu cốt lõi
- **Trạng thái:** Hoàn thành 100%
- **Các thành phần đã triển khai:**
  - Khởi tạo npm workspaces gồm: `packages/contracts`, `packages/domain`, `apps/server`, `apps/web`.
  - Thiết lập kịch bản quản trị hệ thống: `scripts/doctor.mjs`, `scripts/setup.mjs`, `scripts/backup.mjs`, `scripts/restore.mjs`.
  - Bản di chuyển cơ sở dữ liệu `migrations/001_initial.sql` với 6 bảng: `schema_migrations`, `looks`, `look_revisions`, `lookbook`, `commands`, `culture_cards`.
  - Cơ sở dữ liệu văn hóa và thời trang: `content/events.json` (3 bối cảnh), `content/styles.json` (3 phong cách), `content/colors.json` (bảng màu truyền thống & Gen Z), `content/catalog.json` (phom cổ, tay, vải, phụ kiện), `content/presets.json` (12 bản phối mẫu chuẩn hóa).
  - Tệp mẫu môi trường `.env.example` tuân thủ tuyệt đối quy định bảo mật (không lưu API key hay bí mật).
- **Lệnh kiểm tra:**
  ```powershell
  node scripts/doctor.mjs
  node scripts/setup.mjs
  ```

---

## Mốc 2: Hợp đồng dữ liệu & Mô hình hiển thị SVG tương tác
- **Trạng thái:** Hoàn thành 100%
- **Các thành phần đã triển khai:**
  - `packages/contracts`: Định nghĩa toàn bộ schema kiểu dữ liệu với Zod và TypeScript (GarmentConfig, LockState, Look, CommandPayload, CultureCard, AI status/chat/design).
  - `packages/domain`: Bộ xử lý lệnh thuần túy `executeCommand` với kiểm tra xung đột phiên bản lạc quan (`expectedRevision`), bảo vệ thuộc tính bị khóa, tính toán chuyển đổi cấu hình.
  - Bộ luật phong cách `packages/domain/src/rules.ts`: Khuyến nghị phom dáng, hòa sắc theo cặp (sự kiện, phong cách) mà không phá vỡ các thuộc tính người dùng đã khóa.
  - `apps/web/src/components/AoDaiVisualizer.tsx`: Trực quan hóa vector nhiều lớp (Layered SVG): bóng đổ chân, ống quần lụa, tà sau, silhouette cơ thể/khuôn mặt, tay áo (dài, raglan, lỡ, xẻ), thân áo và họa tiết (sen, mây, hạc, kỷ hà), cổ áo (cao truyền thống, tròn, thuyền, chữ V), và phụ kiện (mấn, nón lá, chuỗi ngọc, quạt xếp, túi cói, guốc mộc).
  - `apps/web/src/components/OutfitRoom.tsx`: Không gian phòng phối tương tác với chuyển đổi sự kiện, phong cách, chọn màu sắc trực quan kèm thông báo trợ năng (ARIA), phím tắt, khóa thuộc tính, hoàn tác (undo), và ngăn kéo trợ lý AI.
- **Lệnh kiểm tra:**
  ```powershell
  npm --workspace=@dangviet/contracts run check
  npm --workspace=@dangviet/domain run check
  ```

---

## Mốc 3: SQLite Repository, Bus điều khiển & Trình tích hợp AI
- **Trạng thái:** Hoàn thành 100%
- **Các thành phần đã triển khai:**
  - `apps/server/src/db.ts`: Tích hợp module SQLite thuần túy của Node.js v24 (`node:sqlite DatabaseSync`), không phụ thuộc C++ compiler trên Windows.
  - Bus điều khiển đồng bộ và bất biến: Ghi nhận lịch sử `look_revisions` theo số revision đơn điệu tăng dần, ghi nhận lịch sử lệnh `commands`.
  - `apps/server/src/ai/mock-adapter.ts`: Trợ lý AI NLP thông minh nội bộ, nhận diện ý định tiếng Việt của người dùng ("đổi quần sang trắng", "thêm nón lá", v.v.), tra cứu thẻ văn hóa đã kiểm chứng và phát sinh lệnh có cấu trúc chuẩn mực.
  - `apps/server/src/ai/nine-router-adapter.ts`: Kết nối cổng 9router tương thích OpenAI API, tự động kích hoạt chế độ Fallback sang Mock AI khi chưa có cấu hình API Key mà không làm gián đoạn trải nghiệm người dùng.
- **Lệnh kiểm tra:**
  ```powershell
  npm --workspace=@dangviet/server run check
  ```

---

## Mốc 4: Kho tri thức văn hóa & Cơ chế tra cứu có nguồn kiểm chứng
- **Trạng thái:** Hoàn thành 100%
- **Các thành phần đã triển khai:**
  - `content/culture-cards.json`: Cơ sở dữ liệu tri thức văn hóa độc lập phân tách rõ ràng giữa trạng thái `published` (đã kiểm chứng từ bảo tàng, sách nghiên cứu) và `draft` (đang thẩm định).
  - Trích dẫn nghiên cứu học thuật chân thực: *Ngàn năm áo mũ* (học giả Trần Quang Đức), Tuần báo Phong Hóa số 85 (Họa sĩ Cát Tường - Áo Lemur), Kỹ thuật tay raglan nhà may Dung Đakao 1960 (Bảo tàng Áo dài TP.HCM), Quyết định 2969/QĐ-BVHTTDL (Lụa Vạn Phúc - Hà Đông), Nghiên cứu của PGS.TS Nguyễn Thị Đức về Khăn đóng mấn, Cổ vật áo Nhật Bình & gấm vân mây triều Nguyễn (Bảo tàng Cổ vật Cung đình Huế).
  - API `GET /api/culture?status=published` và thẻ tư liệu có liên kết mở sang Phòng phối trực tiếp.
  - Giao diện `CultureCardsModal.tsx` phân tách minh bạch: Thẻ văn hóa gốc vs Lời khuyên thẩm mỹ vs Sáng tạo cách tân.
- **Lệnh kiểm tra:**
  ```powershell
  curl http://127.0.0.1:3001/api/culture?status=published
  ```

---

## Mốc 5: Xưởng thiết kế Remix Studio, Lookbook & So sánh đối chiếu
- **Trạng thái:** Hoàn thành 100%
- **Các thành phần đã triển khai:**
  - `apps/web/src/components/DesignStudio.tsx`: Sinh thiết kế có cấu trúc an toàn, hiển thị nhãn cảnh báo quy chuẩn: *"Thiết kế cách điệu do AI hỗ trợ — Không thể dùng trực tiếp làm bản rập may."*
  - `apps/web/src/components/LookbookSection.tsx`: Lưu trữ các bản phối yêu thích theo snapshot revision độc lập trong SQLite. Sửa đổi trên phòng phối không làm thay đổi bản ghi trong Lookbook.
  - `apps/web/src/components/CompareModal.tsx`: So sánh đối chiếu trực quan 2 bản phối song song (Side-by-side SVG) và bảng đặc tính chi tiết (Màu áo, màu quần, cổ áo, tay áo, chất liệu, phụ kiện).
- **Lệnh kiểm tra:**
  ```powershell
  npm --workspace=@dangviet/web run build
  ```

---

## Mốc 6: Kiểm thử tự động E2E, Triển khai nguyên khối & Nghiệm thu
- **Trạng thái:** Hoàn thành 100%
- **Các thành phần đã triển khai:**
  - `scripts/test-flow.mjs`: Bộ kiểm thử tự động 12 kịch bản nghiệp vụ:
    1. Kiểm tra /health
    2. Tải danh mục /meta
    3. Tải bộ phối mẫu
    4. Gửi lệnh đổi thuộc tính & tăng revision
    5. Khóa thuộc tính và chặn vi phạm khi đang khóa (HTTP 400)
    6. Thay đổi màu quần và bật tắt phụ kiện
    7. Lưu snapshot vào Lookbook
    8. Xác minh tính cô lập (Snapshot Isolation) của Lookbook khi look tiếp tục thay đổi
    9. Kiểm tra hoàn tác (Undo) phục hồi chính xác revision trước
    10. Kiểm tra thẻ văn hóa và phân định trạng thái `published` / `draft`
    11. Kiểm tra trạng thái AI Adapter
    12. Kiểm tra trợ lý AI trò chuyện văn hóa có trích dẫn nguồn
  - Tích hợp `@fastify/static` vào backend: Chạy toàn bộ ứng dụng (SPA React + REST API) trên một cổng duy nhất (3001) chỉ với lệnh `npm start`.
- **Lệnh kiểm tra:**
  ```powershell
  npm run test
  ```
