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
# Chạy bộ kiểm thử luồng cơ bản 12 ca nghiệp vụ
npm run test

# Chạy bộ kiểm thử chuyên sâu củng cố hệ thống (Undo đa cấp, OCC, Khóa, AI Parser, Backup)
node scripts/test-harden.mjs
```
*Bộ kiểm thử `scripts/test-harden.mjs` xác minh chi tiết 5 nhóm kịch bản: chuỗi 3 sửa - 3 hoàn tác liên tiếp - 1 sửa mới, chống vượt khóa `force: true`, từ chối phụ kiện ngoài catalog, chống duplicate command ID, xử lý xung đột 409 khi lệnh gửi đồng thời, lọc lệnh của AI qua parser và kiểm chứng phục hồi an toàn.*

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

## 5. Quy trình Sao lưu & Phục hồi Dữ liệu An toàn

### 5.1. Sao lưu trực tuyến không gián đoạn (Online Zero-Downtime Backup)

```powershell
npm run backup
```

*Cơ chế:*
- Sử dụng trực tiếp `VACUUM INTO` của SQLite để tạo bản chụp snapshot nguyên tử, không làm nghẽn các tác vụ đọc/ghi đang chạy.
- Tự động chạy `PRAGMA integrity_check` trên tệp sao lưu để đảm bảo snapshot hoàn chỉnh.
- Tính toán mã băm mật mã **SHA-256** của tệp `dangviet.db` và lưu kèm vào `manifest.json`.
- Sao lưu toàn bộ thư mục `content/` văn hóa đi kèm.
- Thư mục sao lưu đặt tại `backups/backup-<timestamp>/`.

### 5.2. Kiểm tra trạng thái máy chủ trước khi phục hồi (Windows PowerShell)

Trước khi khôi phục trực tiếp lên cơ sở dữ liệu chính, bắt buộc phải tắt máy chủ Fastify để tránh hỏng tệp SQLite và xung đột bộ nhớ chia sẻ.

```powershell
# Kiểm tra máy chủ có đang lắng nghe tại cổng 3001 hay không:
Test-NetConnection -ComputerName 127.0.0.1 -Port 3001

# Xem tiến trình đang chiếm dụng cổng 3001:
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess, State

# Dừng máy chủ trên Windows bằng PowerShell:
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force
```

### 5.3. Phục hồi dữ liệu an toàn (Safe Restore)

#### Cách A: Phục hồi đè lên cơ sở dữ liệu chính (Yêu cầu server đã dừng)

```powershell
# Phục hồi từ bản sao lưu mới nhất trong thư mục backups/:
npm run restore

# Hoặc chỉ định rõ thư mục sao lưu cần phục hồi:
node scripts/restore.mjs backups/backup-2026-09-28T...
```

*Quy trình bảo vệ tự động của `restore.mjs`:*
1. **Kiểm tra máy chủ:** Nếu phát hiện server đang chạy trên cổng 3001 (hoặc `PORT` cấu hình), lập tức **từ chối** và dừng với mã lỗi 1, đưa ra hướng dẫn chi tiết.
2. **Xác thực mã băm SHA-256:** So khớp mã băm tệp sao lưu với `manifest.json`. Nếu tệp bị hỏng hoặc sửa đổi, từ chối khôi phục.
3. **Kiểm tra tính toàn vẹn:** Chạy `PRAGMA integrity_check` trên tệp sao lưu trước khi chạm vào đích.
4. **Staging Rollback:** Tạo bản sao lưu dự phòng cho thư mục đích vào `.staging_rollback_<timestamp>`. Nếu quá trình khôi phục gặp sự cố, tự động hoàn tác (rollback) trạng thái ban đầu.
5. **Dọn dẹp tệp nhật ký WAL/SHM:** Loại bỏ các tệp `-wal` và `-shm` cũ để tránh SQLite nạp lại bộ nhớ tạm cũ làm sai lệch dữ liệu.
6. **Tuân thủ `DATABASE_PATH`:** Tự động đọc và định vị file SQLite theo biến môi trường `DATABASE_PATH`.

#### Cách B: Phục hồi vào thư mục riêng biệt để kiểm thử / trích xuất dữ liệu

Không cần tắt máy chủ chính khi dùng cờ `--target-dir`:

```powershell
node scripts/restore.mjs backups/backup-2026-09-28T... --target-dir ./test-restored-data
```

### 5.4. Chạy kiểm thử tự động quy trình di chuyển schema & sao lưu/khôi phục

```powershell
# Kiểm thử cơ chế migration nguyên tử, rollback và bảo toàn dữ liệu:
node scripts/test-migrations.mjs

# Kiểm thử sao lưu, phục hồi, xác thực SHA-256, từ chối server đang chạy và dọn dẹp WAL/SHM:
node scripts/test-backup-restore.mjs
```

---

## 6. Kiểm tra Tính toàn vẹn Mã nguồn (Typecheck & Lint)

Để kiểm tra toàn bộ kiểu dữ liệu TypeScript trên cả 4 workspace:
```powershell
npm run check
```
