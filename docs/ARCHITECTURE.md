# KIẾN TRÚC HỆ THỐNG DÁNG VIỆT (ARCHITECTURE.md)

## 1. Tổng quan & Triết lý thiết kế

**Dáng Việt** (*"Khám phá Việt phục, tạo nên dáng riêng"*) là ứng dụng web toàn diện kết hợp công nghệ hiện đại và chiều sâu văn hóa dân tộc. Dự án được xây dựng phục vụ đề bài thi *"Việt phục Remix — Phối trang phục truyền thống theo phong cách Gen Z"*, tập trung vào 4 trụ cột:

1. **Tính chân thực văn hóa (Cultural Integrity):** Phân định nghiêm ngặt giữa cứ liệu lịch sử có nguồn trích dẫn học thuật đã kiểm chứng, lời khuyên thẩm mỹ theo bối cảnh, và các thiết kế cách tân ngẫu hứng.
2. **Kiến trúc hướng lệnh & Đồng quy lạc quan (Command Bus & Optimistic Concurrency):** Mọi tương tác của người dùng và hành động của AI đều thông qua một bus lệnh thống nhất, kiểm soát số hiệu phiên bản (`revision`) để loại bỏ xung đột ghi đè.
3. **Mô hình trực quan hóa đồ họa vector thuần túy (Interactive Layered SVG):** Không phụ thuộc vào thư viện ngoài nặng nề, kết xuất áo dài nhiều lớp động phản chiếu chuẩn xác màu sắc, chất liệu và phụ kiện.
4. **Cô lập trạng thái Lookbook (Snapshot Isolation):** Lưu trữ bộ sưu tập theo bản chụp độc lập, bảo vệ thiết kế đã lưu khỏi những biến động ngầm khi người dùng tiếp tục thao tác.

---

## 2. Cấu trúc Monorepo (npm workspaces)

Dự án tổ chức theo mô hình Monorepo chuẩn hóa bằng npm workspaces:

```
viet-phoi/
├── apps/
│   ├── server/               # Backend Fastify, SQLite, REST API, Static File Server
│   │   ├── src/
│   │   │   ├── ai/           # Mock Adapter & 9router Gateway Adapter
│   │   │   ├── routes/       # Health, Meta, Looks, Lookbook, Culture, AI
│   │   │   ├── db.ts         # node:sqlite DatabaseSync abstraction
│   │   │   └── index.ts      # Server bootstrap & Single-port SPA delivery
│   └── web/                  # Frontend React 19 + TypeScript + Vite
│       ├── src/
│       │   ├── components/   # AoDaiVisualizer, OutfitRoom, DesignStudio, Lookbook, Compare
│       │   ├── App.tsx       # State coordination, Header, Navigation tabs
│       │   └── index.css     # Vietnamese Heritage color palette & CSS design tokens
├── packages/
│   ├── contracts/            # Schemas Zod & TypeScript Interfaces dùng chung
│   └── domain/               # Logic nghiệp vụ thuần túy: command-handler, styling-rules
├── content/                  # Dữ liệu tĩnh: events, styles, colors, catalog, presets, culture-cards
├── migrations/               # 001_initial.sql (Schema SQLite có phiên bản)
├── scripts/                  # doctor, setup, test-flow, backup, restore
└── docs/                     # PROGRESS.md, ARCHITECTURE.md, RUNBOOK.md
```

---

## 3. Kiến trúc Bus lệnh & Kiểm soát phiên bản (Command Bus & Concurrency)

Nhằm đảm bảo người dùng và trợ lý AI có thể cùng thao tác trên một bản phối mà không gây mất mát dữ liệu hoặc ghi đè trạng thái cũ, Dáng Việt ứng dụng mô hình **Optimistic Concurrency Control**:

```
[Thao tác UI người dùng] ──┐
                          ├─► [Command Payload] ──► [executeCommand(look, command)] ──► [New Revision]
[Đề xuất từ Trợ lý AI]  ──┘    expectedRevision           Kiểm tra Lock / Revision          look_revisions
```

### Cấu trúc Lệnh (`CommandPayload`):
- `commandId`: Chuỗi UUID duy nhất xác thực từng thao tác.
- `lookId`: Định danh bộ phối đang thao tác.
- `expectedRevision`: Số phiên bản hiện tại mà lệnh kỳ vọng áp dụng lên.
- `action`: Hành động nghiệp vụ (`SET_PRIMARY_COLOR`, `SET_PANTS_COLOR`, `SET_COLLAR`, `SET_SLEEVE`, `SET_FABRIC`, `SET_PATTERN`, `TOGGLE_ACCESSORY`, `TOGGLE_LOCK`, `APPLY_PRESET`, `RESET_CONFIG`, `SET_CONTEXT`).
- `payload`: Tham số tương ứng với hành động.
- `timestamp`: Thời gian phát sinh lệnh.

### Cơ chế hoạt động:

1. Khi máy chủ nhận lệnh, hệ thống mở một giao dịch nguyên tử SQLite `BEGIN IMMEDIATE` để khóa ghi độc quyền ngay từ đầu, ngăn chặn race condition.
2. Kiểm tra trùng lặp lệnh (`DUPLICATE_COMMAND_ID`): Nếu `commandId` đã tồn tại trong bảng `commands`, hủy giao dịch và trả về `HTTP 409 Conflict`.
3. Kiểm tra kiểm soát đồng quy lạc quan (OCC): Kiểm tra `command.expectedRevision === currentLook.revision`. Nếu không khớp, hủy giao dịch và trả về `HTTP 409 Conflict (REVISION_CONFLICT)`.
4. Kiểm tra khóa thuộc tính: Nếu trường dữ liệu tương ứng đang có cờ khóa `locks[field] === true`, lệnh bị từ chối `HTTP 400 Bad Request`. Cờ `force: true` đã bị loại bỏ hoàn toàn.
5. Đối chiếu danh mục: Các giá trị cổ, tay, vải, họa tiết và phụ kiện được kiểm tra tính hợp lệ qua Zod enum catalogs (`VALID_ACCESSORY_IDS`, v.v.).
6. Hàm domain `executeCommand` xử lý chuyển đổi trạng thái thuần túy (pure function), không sửa đổi đối tượng `currentLook` truyền vào.
7. Nếu hợp lệ, hệ thống đẩy trạng thái hiện tại vào ngăn xếp hoàn tác `undo_stack_json`, tăng `revision = currentLook.revision + 1` (đơn điệu tăng), lưu vào bảng `looks`, thêm bản ghi lịch sử vào `look_revisions` và ghi vết vào `commands`.
8. Tính năng **Hoàn tác Tuần tự Đa cấp (Sequential Multi-level Undo):** Lấy snapshot đỉnh từ `undo_stack_json` khôi phục lại cấu hình và khóa, đồng thời tăng `revision` lên một đơn vị mới (`revision + 1`). Nhờ đó, revision luôn tăng đơn điệu, bảo vệ kiểm soát xung đột OCC, cho phép hoàn tác liên tiếp nhiều bước mà không bị lặp vòng trạng thái, và rẽ nhánh lịch sử an toàn khi có chỉnh sửa mới.

---

## 4. Kiến trúc Cô lập Trạng thái Lookbook (Snapshot Isolation)

Một vấn đề phổ biến trong các ứng dụng thời trang là khi lưu một bộ phối vào Lookbook, các thay đổi tiếp theo trên phòng phối vô tình làm thay đổi cả bản đã lưu do dùng chung tham chiếu con trỏ.

Dáng Việt giải quyết triệt để vấn đề này bằng kiến trúc **Deep Snapshot**:
- Khi người dùng nhấn "Lưu vào Lookbook", ứng dụng gửi một `LookbookItem` chứa bản sao chép sâu (`deep copy`) của `GarmentConfig` cùng `revision` tại thời điểm đó.
- Bảng `lookbook` trong SQLite lưu trữ `snapshot_config` độc lập dưới dạng chuỗi JSON nguyên vẹn.
- Khi người dùng tiếp tục đổi màu, chất liệu hay phụ kiện của bộ phối trên phòng phối, dữ liệu trong `lookbook` hoàn toàn không bị ảnh hưởng.
- Người dùng có thể đối chiếu hai bản phối bất kỳ trong Lookbook thông qua cửa sổ `CompareModal` với chế độ hiển thị song song (Side-by-side).

---

## 5. Kiến trúc Trực quan hóa Áo dài Vector nhiều lớp (Layered SVG)

Thay vì dùng hình ảnh tĩnh mờ nhòe hoặc mô hình 3D cồng kềnh, Dáng Việt ứng dụng kiến trúc SVG nhiều lớp (`AoDaiVisualizer.tsx`):

```
[Layer 0] Bóng đổ chân thực mặt sàn (Ground Shadow Gradient)
[Layer 1] Ống quần lụa ống rộng hai bên (Pants Layer, pantsHex)
[Layer 2] Tà áo sau (Back Flap Silhouette)
[Layer 3] Silhouette cơ thể, cổ, mặt, tóc búi truyền thống, bàn tay
[Layer 4] Tay áo linh hoạt (Traditional Long / Raglan Cut / Raglan Lỡ / Xẻ tà Gen Z)
[Layer 5] Thân áo trước & Tà trước lượn sóng (Front Bodice & Front Flap)
[Layer 6] Họa tiết hoa văn vector (Pattern Fills: Sen, Mây, Hạc, Kỷ hà Gen Z)
[Layer 7] Cổ áo đặc trưng (Cổ cao 3cm truyền thống / Cổ tròn / Cổ thuyền / Cổ V)
[Layer 8] Phụ kiện đính kèm (Mấn đội đầu, Nón lá, Chuỗi ngọc, Quạt xếp, Túi cói, Guốc mộc)
[Layer 9] Ánh sáng và độ bóng bề mặt vải (Silk / Velvet / Brocade sheen filters)
```

Kiến trúc này giúp tốc độ hiển thị đạt 60fps trên mọi thiết bị di động, co giãn vô hạn không vỡ nét, hỗ trợ Dark/Light mode tự nhiên và hoàn toàn tương thích với các trình đọc màn hình hỗ trợ tiếp cận (Accessibility).

---

## 6. Trình tích hợp AI (Dual-Adapter Pattern) & Bộ phân tích đầu ra mô hình

```
                         ┌──► [9router Adapter] ──► Gọi API OpenAI Compatible (Prompt JSON Actions)
[API Client /api/ai/*] ──┤                                 │
                         │                                 ▼
                         │                        [apps/server/src/ai/parser.ts]
                         │                        (Lọc thuộc tính khóa & catalog Zod)
                         │
                         └──► [Mock AI Adapter] ──► Xử lý NLP nội bộ, quy tắc văn hóa (Fallback)
```

1. **Dual-Adapter:**
   - Hệ thống tự động kiểm tra biến môi trường `AI_API_KEY`. Nếu không có khóa hoặc mạng gặp sự cố, hệ thống chuyển sang `MockAIAdapter` với nhãn hiển thị minh bạch `AI Mô phỏng (Mock)`.
   - Khi có `AI_API_KEY`, hệ thống kết nối mô hình thật qua 9router, yêu cầu mô hình trả về phản hồi kèm mảng hành động có cấu trúc `actions` định dạng JSON.
   - Đầu ra của mô hình được thẩm định chặt chẽ qua `parseModelChatOutput`: loại bỏ mọi hành động cố can thiệp vào thuộc tính bị khóa, loại bỏ phụ kiện không thuộc danh mục và giới hạn tối đa 3 hành động mỗi lượt.
   - Không tráo đổi command do Mock sinh gán vào câu trả lời của mô hình thật.
2. **Rào chắn Văn hóa & Trích dẫn Nguồn:**
   - Dữ liệu thẻ văn hóa trong `content/culture-cards.json` được phân định nghiêm ngặt: chỉ thẻ ở trạng thái `published` mới được AI trích dẫn làm bằng chứng đã kiểm chứng.
   - Khi khảo sát nguồn cho thấy liên kết hỏng (404), tên miền không phân giải được hoặc bài viết chung chung chưa có số trang tài liệu, thẻ lập tức chuyển sang trạng thái `review`.
   - Khi người dùng hỏi về tri thức ở trạng thái `review`, AI thông báo trung thực rằng tư liệu đang trong giai đoạn thẩm định học thuật, không tự tạo trích dẫn giả mạo.
3. **Cảnh báo Bản rập & Minh bạch Thiết kế:** Mọi thiết kế do AI sinh ra đều mang nhãn bắt buộc:
   *"Thiết kế cách điệu do AI hỗ trợ — Không thể dùng trực tiếp làm bản rập may."*
   Hình ảnh hiển thị là mô hình vector SVG tùy biến trực quan, không phải ảnh raster do AI sinh.

---

## 7. Sao lưu, Phục hồi & Khởi động Di chuyển Dữ liệu (Atomic Migrations & Safe Restore)

- **Di chuyển lược đồ nguyên tử & Dừng khởi động khi lỗi (Atomic Migrations & Abort on Error):**
  - Trong `apps/server/src/db.ts`, mỗi tệp di chuyển (`migrations/*.sql`) được thực thi nguyên tử trong một khối `BEGIN IMMEDIATE` ... `COMMIT` riêng biệt cùng với thao tác chèn phiên bản vào bảng `schema_migrations`.
  - Nếu bất kỳ câu lệnh SQL nào trong tệp di chuyển thất bại, hệ thống thực hiện `ROLLBACK` ngay lập tức, không ghi nhận phiên bản di chuyển, ghi nhật ký lỗi rõ ràng tên tệp gặp sự cố và quăng ngoại lệ dừng toàn bộ tiến trình khởi động máy chủ (`process.exit(1)`).
  - Loại bỏ hoàn toàn việc nuốt lỗi (không còn bỏ qua lỗi `duplicate column name`), đảm bảo lược đồ cơ sở dữ liệu luôn ở trạng thái nhất quán và an toàn tuyệt đối.
  - Các database đã có dữ liệu thực tế (looks, look_revisions, lookbook) nâng cấp an toàn mà không làm mất mát bất kỳ bản ghi nào.

- **Sao lưu trực tiếp không ngắt quãng (Online Zero-Downtime Backup):**
  - Sử dụng lệnh nguyên bản của SQLite `VACUUM INTO '<destination>'`. Cơ chế này tạo bản sao lưu nhất quán tức thời (crash-consistent snapshot) mà không làm gián đoạn các tác vụ đọc/ghi.
  - Tự động chạy `PRAGMA integrity_check` trên tệp snapshot trước khi phê duyệt.
  - Tính toán mã băm mật mã **SHA-256** của tệp `dangviet.db` và lưu kèm thông tin kích thước, số lượng bảng vào `manifest.json`.

- **Khôi phục an toàn chống ghi đè khi Server hoạt động (Safe Restore Safeguards):**
  - `scripts/restore.mjs` sử dụng thăm dò kết nối cổng mạng TCP thực tế (`checkServerRunning`) trên cổng 3001/biến cấu hình để phát hiện chính xác máy chủ đang chạy trên môi trường Windows.
  - Nếu phát hiện máy chủ đang lắng nghe, lệnh khôi phục lập tức **từ chối** ghi đè lên cơ sở dữ liệu chính và in hướng dẫn dừng máy chủ hoặc sử dụng tham số `--target-dir`.
  - Kiểm tra tính hợp lệ của `manifest.json` và xác minh mã băm SHA-256 của tệp sao lưu trước khi thực hiện.
  - Kiểm tra tính toàn vẹn `PRAGMA integrity_check` trên tệp sao lưu.
  - **Staging Rollback:** Tạo thư mục dự phòng tạm thời `.staging_rollback_<timestamp>` cho đích đến trước khi sao chép, tự động khôi phục lại nguyên trạng nếu quá trình sao chép gặp lỗi.
  - **Dọn dẹp WAL/SHM cũ:** Tự động dọn dẹp các tệp `-wal` và `-shm` cũ tại thư mục đích để tránh SQLite nạp lại bộ nhớ đệm khung ghi cũ làm sai lệch dữ liệu phục hồi.
  - Hỗ trợ biến môi trường `DATABASE_PATH` và cờ `--target-dir <path>` để khôi phục vào thư mục cô lập độc lập phục vụ kiểm thử / trích xuất dữ liệu mà không cần tắt máy chủ chính.

---

## 7. An ninh & Bảo mật

- **Không lưu khóa bí mật:** Tuyệt đối không hardcode khóa API trong mã nguồn, kho Git, nhật ký log hay lưu trữ phía client (`localStorage`).
- **Mẫu môi trường:** Cung cấp `.env.example` với đầy đủ tên biến, mô tả và giá trị mặc định an toàn.
- **Xác thực đầu vào:** Toàn bộ payload gửi lên API đều được kiểm tra chặt chẽ bằng thư viện Zod trước khi đưa vào cơ sở dữ liệu.
