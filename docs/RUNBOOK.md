# CẨM NANG VẬN HÀNH & HƯỚNG DẪN CÀI ĐẶT (RUNBOOK.md)

## 1. Yêu cầu Hệ thống

- **Hệ điều hành:** Windows 10/11, macOS, hoặc Linux.
- **Node.js:** Phiên bản 22 trở lên (Khuyến nghị **Node.js v24.16.0** để sử dụng tính năng nhúng SQLite nguyên bản `node:sqlite`).
- **npm:** Phiên bản 10 trở lên.
- **Không yêu cầu cài đặt Docker, Python hay công cụ C++ Build Tools (như Visual Studio C++ build tools).**

---

## 2. Hướng dẫn Khởi động Nhanh (Quickstart)

### Bước 1: Kiểm tra môi trường với công cụ Doctor

```powershell
npm run doctor
```

*Lệnh này sẽ kiểm tra phiên bản Node.js, khả dụng của `node:sqlite`, tính toàn vẹn của các tệp dữ liệu văn hóa và cấu hình project root.*

### Bước 2: Thiết lập cơ sở dữ liệu ban đầu

```powershell
npm run setup
```

*Lệnh này xác định project root, khởi tạo tệp SQLite `data/dangviet.db`, chạy các bản migration và nạp sẵn các thẻ tri thức văn hóa có nguồn kiểm chứng.*

### Bước 3: Biên dịch toàn bộ Monorepo

```powershell
npm run build
```

*Biên dịch các gói thư viện `@dangviet/contracts`, `@dangviet/domain`, backend server và xây dựng gói tĩnh cho frontend web vào thư mục `apps/web/dist`.*

### Bước 4: Chạy kiểm thử tự động toàn diện

```powershell
# Chạy bộ kiểm thử luồng nghiệp vụ người dùng đầy đủ (E2E User Journey)
npm test

# Chạy bài kiểm thử củng cố hệ thống (Undo đa cấp, OCC, Khóa, AI Parser, OCC 409)
node scripts/test-harden.mjs

# Chạy kiểm thử an toàn sao lưu & khôi phục (SHA-256, Integrity Check, Staging Isolation)
node scripts/test-backup-restore.mjs

# Chạy kiểm thử cơ chế migration & bảo toàn dữ liệu
node scripts/test-migrations.mjs

# Chạy kiểm thử AI & liêm chính trích dẫn văn hóa (Citations Guardrails)
node scripts/test-ai-culture.mjs
```

### Bước 5: Khởi động Ứng dụng (Chế độ Production - Cổng đơn 3001)

```powershell
npm start
```

*Máy chủ Fastify khởi động tại cổng **3001**, vừa cung cấp REST API (`/api/*`), vừa phân phối trực tiếp giao diện người dùng Single Page Application (SPA). Mở trình duyệt tại [http://localhost:3001](http://localhost:3001).*

---

## 3. Chế độ Phát triển (Development Mode)

Chế độ phát triển hỗ trợ **Package Dev Mode** thông qua Export Conditions `"development": "./src/index.ts"` trong `packages/contracts` và `packages/domain`. Các thay đổi tại packages có hiệu lực tức thì mà không cần build thủ công.

```powershell
npm run dev
```

- Máy chủ API chạy tại: `http://localhost:3001`
- Giao diện Vite chạy tại: `http://localhost:5173`

---

## 4. Cấu hình Môi trường (.env & Biến hệ thống)

Tạo tệp `.env` tại thư mục gốc dựa trên `.env.example`:

```bash
# Cấu hình máy chủ API
PORT=3001
HOST=127.0.0.1
LOG_LEVEL=info

# Đường dẫn cơ sở dữ liệu SQLite (resolve tương đối từ project root)
DATABASE_PATH=data/dangviet.db

# Cấu hình Cổng kết nối AI (9router / OpenAI Compatible)
# Bỏ trống hoặc không điền khóa để tự động sử dụng Intelligent Mock AI Adapter
AI_BASE_URL=https://api.9router.com/v1
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=12000
```

> **Nguyên tắc nạp cấu hình:**
>
> - Biến môi trường hệ thống (`process.env`) luôn có quyền ưu tiên cao hơn tệp `.env` (`override: false` trong dotenv).
> - `DATABASE_PATH` luôn được chuẩn hóa từ Project Root, không phụ thuộc vào `process.cwd()` khi chạy lệnh.
> - Tuyệt đối không lưu API Key vào Git. Tệp `.env` đã được liệt kê trong `.gitignore`.
> - Khi không có `AI_API_KEY`, ứng dụng tự động kích hoạt `MockAIAdapter` chất lượng cao, phản hồi an toàn với tri thức văn hóa chính xác và tạo lệnh phối đồ chuẩn mực.

---

## 5. Quy trình Sao lưu & Phục hồi Dữ liệu Độc lập, An toàn

### 5.1. Sao lưu trực tuyến không gián đoạn (Online Zero-Downtime Backup)

```powershell
npm run backup
```

*Cơ chế:*

- Kiểm tra cơ sở dữ liệu tồn tại trước khi backup, tuyệt đối không báo thành công trên DB rỗng.
- Làm sạch và chuẩn hóa đường dẫn trước khi đưa vào câu lệnh `VACUUM INTO` của SQLite để tạo bản chụp snapshot nguyên tử.
- Tự động chạy `PRAGMA integrity_check` trên tệp sao lưu.
- Tính toán mã băm mật mã **SHA-256** của tệp `dangviet.db` và tất cả tệp trong `content/`, ghi vào `manifest.json`.
- Thư mục sao lưu đặt tại `backups/backup-<timestamp>/`.

### 5.2. Khôi phục dữ liệu an toàn ra thư mục riêng biệt (Safe Isolated Restore)

Để loại trừ hoàn toàn nguy cơ ghi đè hoặc hỏng hóc cơ sở dữ liệu đang hoạt động, cơ chế restore hoạt động theo nguyên tắc:

```powershell
# Khôi phục mặc định ra thư mục riêng biệt mới: restored/restore-<timestamp>
npm run restore

# Hoặc chỉ định rõ thư mục đích mới hoàn toàn bằng --target-dir:
node scripts/restore.mjs backups/backup-2026-09-28T... --target-dir restored/test-restore
```

*Các chốt bảo vệ tự động của `restore.mjs`:*

1. **Từ chối nếu trùng thư mục database đang hoạt động:** Không cho phép ghi đè lên thư mục của database đang chạy (`DATABASE_PATH`).
2. **Từ chối nếu trùng chính thư mục backup nguồn:** Ngăn ngừa làm hỏng hoặc xóa bản backup.
3. **Từ chối nếu thư mục đích đã tồn tại và không rỗng:** Đảm bảo đích khôi phục là thư mục sạch hoàn toàn.
4. **Không hỗ trợ cờ `--force`:** Nghiêm cấm vượt qua các kiểm tra an toàn dữ liệu.
5. **Xác thực mã băm SHA-256 toàn diện:** So khớp mã băm SHA-256 của tệp `dangviet.db` và toàn bộ các tệp nội dung đối chiếu với `manifest.json`.
6. **Kiểm tra tính toàn vẹn:** Chạy `PRAGMA integrity_check` trên cơ sở dữ liệu trước khi chuyển giao.
7. **Thư mục Staging tạm thời:** Quá trình chuẩn bị tệp chỉ diễn ra trong `.staging_<id>`. Chỉ khi mọi khâu kiểm tra đạt 100%, thư mục staging mới được đổi tên nguyên tử thành thư mục đích cuối cùng.
8. **Dọn dẹp cô lập khi lỗi:** Nếu có lỗi, script chỉ dọn dẹp thư mục staging do chính lượt chạy đó tạo ra, không chạm vào bất kỳ tệp dữ liệu hay WAL/SHM nào khác.

---

## 6. Bộ Kiểm thử Tự động Độc lập (Independent Test Suites)

Tất cả các bộ kiểm thử đều hoạt động trên cổng mạng riêng biệt, database tạm độc lập và dọn dẹp sạch sẽ sau khi hoàn tất:

1. **`npm test` (`scripts/test-flow.mjs`):** Kiểm thử toàn diện luồng nghiệp vụ người dùng từ Explore -> chọn sự kiện -> Phòng phối -> đổi màu áo/quần -> khóa thuộc tính -> hỏi AI -> thi hành gợi ý -> tạo thiết kế Remix Studio -> lưu vào Lookbook (bảo toàn event/style) -> mở lại từ Lookbook qua `APPLY_DESIGN` -> tiếp tục chỉnh sửa. Chạy trên cổng 3188.
2. **`scripts/test-harden.mjs`:** Kiểm thử hoàn tác tuần tự đa cấp tăng đơn điệu revision, rào chắn khóa không cho vượt bằng `force: true`, loại bỏ phụ kiện ngoài catalog, chống duplicate command ID, kiểm soát xung đột phiên bản (OCC 409) và bộ phân tích AI Parser. Chạy trên cổng 3147.
3. **`scripts/test-backup-restore.mjs`:** Kiểm thử quy trình sao lưu `VACUUM INTO`, tạo manifest kèm SHA-256, khôi phục vào thư mục riêng, và 4 kịch bản từ chối an toàn (trùng active DB, trùng nguồn backup, đích không rỗng, phát hiện tệp bị sửa mã băm).
4. **`scripts/test-migrations.mjs`:** Kiểm thử chạy di chuyển schema trên DB trắng, tính lũy thừa (idempotency), rollback nguyên tử khi gặp script lỗi, và nâng cấp schema trên DB có dữ liệu thực tế mà không làm mất dữ liệu.
5. **`scripts/test-ai-culture.mjs`:** Kiểm thử tri thức văn hóa, đảm bảo AI chỉ trích dẫn các thẻ ở trạng thái `published` có nguồn gốc kiểm chứng thực tế và lịch sự từ chối trích dẫn đối với các chủ đề đang ở trạng thái `review`.

---

## 7. Kiểm tra Tính toàn vẹn Mã nguồn (Typecheck & Build)

```powershell
# Kiểm tra kiểu dữ liệu TypeScript trên toàn bộ 4 workspace
npm run check

# Biên dịch toàn bộ các gói và ứng dụng
npm run build
```
