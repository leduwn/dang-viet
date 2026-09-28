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
*Lệnh này sẽ kiểm tra phiên bản Node.js, khả dụng của `node:sqlite`, tính toàn vẹn của các tệp dữ liệu văn hóa và các cổng mạng cần thiết.*

### Bước 2: Thiết lập cơ sở dữ liệu ban đầu
```powershell
npm run setup
```
*Lệnh này tạo thư mục `data/`, khởi tạo tệp SQLite `data/dangviet.db`, chạy bản di chuyển `migrations/001_initial.sql` và nạp sẵn 12 bộ phối mẫu cùng các thẻ tri thức văn hóa có nguồn kiểm chứng.*

### Bước 3: Biên dịch toàn bộ Monorepo
```powershell
npm run build
```
*Biên dịch các gói thư viện `@dangviet/contracts`, `@dangviet/domain`, backend server và xây dựng gói tĩnh cho frontend web vào thư mục `apps/web/dist`.*

### Bước 4: Chạy kiểm thử tự động toàn diện
```powershell
npm run test
```
*Chạy 12 ca kiểm thử luồng nghiệp vụ tự động (`scripts/test-flow.mjs`): kiểm tra /health, bus lệnh, tăng revision, chặn vi phạm khóa thuộc tính, lưu Lookbook độc lập, hoàn tác (undo), phân định thẻ văn hóa và trợ lý AI.*

### Bước 5: Khởi động Ứng dụng (Chế độ Production - Cổng đơn 3001)
```powershell
npm start
```
*Máy chủ Fastify khởi động tại cổng **3001**, vừa cung cấp REST API (`/api/*`), vừa phân phối trực tiếp giao diện người dùng Single Page Application (SPA). Mở trình duyệt tại:*
👉 **http://localhost:3001**

---

## 3. Chế độ Phát triển (Development Mode)

Để phát triển với tính năng Hot-Reloading cho cả Frontend (Vite) và Backend:
```powershell
npm run dev
```
- Máy chủ API chạy tại: `http://localhost:3001`
- Giao diện Vite chạy tại: `http://localhost:5173`

---

## 4. Cấu hình Môi trường (.env)

Tạo tệp `.env` tại thư mục gốc dựa trên `.env.example`:

```bash
# Cấu hình máy chủ API
PORT=3001
HOST=127.0.0.1
LOG_LEVEL=info

# Đường dẫn cơ sở dữ liệu SQLite
DATABASE_PATH=data/dangviet.db

# Cấu hình Cổng kết nối AI (9router / OpenAI Compatible)
# Bỏ trống hoặc không điền khóa để tự động sử dụng Intelligent Mock AI Adapter
AI_BASE_URL=https://api.9router.com/v1
AI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=12000
```

> **Lưu ý bảo mật:**
> - Tuyệt đối không lưu API Key vào Git. Tệp `.env` đã được liệt kê trong `.gitignore`.
> - Khi không cung cấp `AI_API_KEY`, ứng dụng tự động kích hoạt `MockAIAdapter` chất lượng cao, phản hồi tức thì với tri thức văn hóa chính xác và tạo lệnh phối đồ chuẩn mực.

---

## 5. Quy trình Sao lưu & Phục hồi Dữ liệu

### Sao lưu (Backup):
```powershell
npm run backup
```
*Tạo một thư mục con trong `backups/backup-<timestamp>` chứa tệp cơ sở dữ liệu `dangviet.db`, toàn bộ thư mục dữ liệu văn hóa `content/` và tệp chỉ mục `manifest.json`.*

### Phục hồi (Restore):
```powershell
# Phục hồi từ bản sao lưu gần nhất:
npm run restore

# Hoặc chỉ định một thư mục sao lưu cụ thể:
node scripts/restore.mjs backups/backup-2026-09-28T06-35-21-556Z
```

---

## 6. Kiểm tra Tính toàn vẹn Mã nguồn (Typecheck & Lint)

Để kiểm tra toàn bộ kiểu dữ liệu TypeScript trên cả 4 workspace:
```powershell
npm run check
```
