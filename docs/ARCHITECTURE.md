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
1. Khi máy chủ nhận lệnh, hệ thống kiểm tra `command.expectedRevision === currentLook.revision`.
2. Nếu không khớp (do người dùng đã đổi thuộc tính khác trong lúc AI đang suy nghĩ), lệnh bị từ chối với mã lỗi `HTTP 409 Conflict`.
3. Kiểm tra khóa thuộc tính: Nếu trường dữ liệu tương ứng đang có cờ khóa `locks[field] === true`, lệnh bị từ chối với mã lỗi `HTTP 400 Bad Request`.
4. Nếu hợp lệ, hệ thống tạo `nextConfig`, tăng `revision = currentLook.revision + 1`, lưu vào bảng `looks`, thêm bản ghi lịch sử vào `look_revisions` và ghi vết vào `commands`.
5. Tính năng **Hoàn tác (Undo):** Truy vấn bản ghi liền trước trong `look_revisions`, cập nhật lại `looks` và loại bỏ revision hiện tại.

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

## 6. Trình tích hợp AI (Dual-Adapter Pattern) & Rào chắn An toàn Văn hóa

```
                         ┌──► [9router Adapter] ──► Kết nối AI Gateway (nếu có API Key)
[API Client /api/ai/*] ──┤
                         └──► [Mock AI Adapter] ──► Xử lý NLP nội bộ, quy tắc văn hóa (Fallback)
```

1. **Dual-Adapter:** Hệ thống tự động kiểm tra biến môi trường `AI_API_KEY`. Nếu không có khóa hoặc mạng gặp sự cố, hệ thống chuyển suốt sang `MockAIAdapter`. Người dùng luôn nhận được phản hồi phân tích văn hóa chính xác và lệnh điều khiển mượt mà 100% không bị ngắt quãng.
2. **Rào chắn Văn hóa & Trích dẫn Nguồn:**
   - Dữ liệu thẻ văn hóa trong `content/culture-cards.json` được phân định rõ ràng giữa `published` (đã có nguồn khảo cứu: Bảo tàng Áo dài, sách *Ngàn năm áo mũ*, tài liệu Cát Tường 1934, v.v.) và `draft` (đang xác minh).
   - AI chỉ trích dẫn các thẻ ở trạng thái `published`.
3. **Cảnh báo Bản rập:** Mọi thiết kế do AI sinh ra đều mang nhãn bắt buộc:
   *"Thiết kế cách điệu do AI hỗ trợ — Không thể dùng trực tiếp làm bản rập may."*

---

## 7. An ninh & Bảo mật

- **Không lưu khóa bí mật:** Tuyệt đối không hardcode khóa API trong mã nguồn, kho Git, nhật ký log hay lưu trữ phía client (`localStorage`).
- **Mẫu môi trường:** Cung cấp `.env.example` với đầy đủ tên biến, mô tả và giá trị mặc định an toàn.
- **Xác thực đầu vào:** Toàn bộ payload gửi lên API đều được kiểm tra chặt chẽ bằng thư viện Zod trước khi đưa vào cơ sở dữ liệu.
