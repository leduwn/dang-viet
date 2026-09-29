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

---

## Mốc 7: Củng cố Hệ thống Toàn diện, Kiểm soát Đồng quy OCC & Liêm chính Văn hóa
- **Trạng thái:** Hoàn thành 100% (Đã xác minh trên Windows)
- **Các thành phần đã triển khai:**
  - **Hoàn tác đa cấp tuần tự (Sequential Multi-level Undo):** Bổ sung cột `undo_stack_json` vào bảng `looks` qua migration `002_undo_and_constraints.sql`. Hoàn tác liên tiếp pop snapshot cũ nhưng số `revision` luôn tăng đơn điệu (`revision + 1`) để giữ vững OCC, không quay vòng trạng thái, rẽ nhánh lịch sử an toàn khi có thao tác mới, bảo toàn tuyệt đối snapshot trong Lookbook.
  - **Củng cố Command Bus & Giao dịch nguyên tử SQLite:**
    - Loại bỏ hoàn toàn cờ `force: true`. Mọi nỗ lực vượt khóa bị từ chối `HTTP 400`.
    - Lệnh `APPLY_DESIGN` và `APPLY_PRESET` tự động giữ nguyên các thuộc tính đang bị khóa.
    - Đối chiếu phụ kiện và thuộc tính với Zod enum catalogs (`VALID_ACCESSORY_IDS`, `VALID_COLLARS`, `VALID_SLEEVES`, `VALID_FABRICS`, `VALID_PATTERNS`). Giá trị lạ bị từ chối `HTTP 400`.
    - Hàm domain thuần túy không mutate tham số `currentLook`.
    - Chống trùng lặp lệnh (`DUPLICATE_COMMAND_ID` HTTP 409) dựa trên `commandId` duy nhất trong bảng `commands`.
    - Toàn bộ chu trình kiểm tra revision, cập nhật look, thêm revision, đẩy undo stack và lưu command được đóng gói trong giao dịch nguyên tử SQLite `BEGIN IMMEDIATE`.
  - **Tách biệt ranh giới AI & Bộ phân tích đầu ra mô hình:**
    - Tạo `apps/server/src/ai/parser.ts`: Trích xuất JSON actions có cấu trúc từ phản hồi của mô hình 9router, tự động lọc bỏ hành động đụng chạm thuộc tính bị khóa và phụ kiện ngoài danh mục, khống chế tối đa 3 hành động mỗi lượt.
    - Không tráo đổi command của Mock sang câu trả lời của 9router.
    - Hiển thị minh bạch trên giao diện trạng thái "AI Trực tuyến" vs "AI Mô phỏng (Mock)".
    - Chống ghi đè khi lệnh AI đến muộn (xung đột `expectedRevision` -> từ chối 409).
  - **Khảo cứu & Kiểm chứng nguồn văn hóa trung thực:**
    - Rà soát thực tế toàn bộ 6 thẻ qua công cụ mạng: phát hiện liên kết 404, bài viết tổng quát hoặc trang tra cứu chung -> chuyển cả 6 thẻ sang trạng thái `review` (hiện tại: 0 published, 6 review, 1 draft).
    - Tạo nhật ký kiểm chứng chi tiết tại `docs/CULTURAL_SOURCES.md`.
    - Cơ chế tự động đồng bộ thẻ văn hóa từ JSON vào SQLite đang hoạt động (`syncCultureCardsFromDisk`).
    - AI chỉ trích dẫn thẻ `published`. Khi người dùng hỏi về tri thức đang ở trạng thái `review`, AI thông báo trung thực tư liệu đang thẩm định.
  - **Quy trình Sao lưu VACUUM INTO & Phục hồi Độc lập:**
    - Nâng cấp `scripts/backup.mjs` sử dụng lệnh nguyên tử `VACUUM INTO`, kiểm tra `PRAGMA integrity_check` và tạo `manifest.json`.
    - Nâng cấp `scripts/restore.mjs` kiểm tra lock tệp database, hỗ trợ khôi phục an toàn vào thư mục thử nghiệm độc lập `--target-dir`.
  - **Trực quan hóa & Minh bạch Giao diện:**
    - Gán nhãn vector SVG minh bạch, không gọi là ảnh do AI tạo.
    - Bổ sung CSS responsive chống tràn ngang (`overflow-x: hidden`) trên điện thoại di động và tablet.
  - **Bộ kiểm thử chuyên sâu `scripts/test-harden.mjs`:** Kiểm chứng tự động toàn bộ 5 nhóm tình huống nghiệp vụ trên Windows.
- **Lệnh kiểm tra:**
  ```powershell
  node scripts/test-harden.mjs
  ```

---

## Mốc 8: Kiên cố hóa Khởi động Di chuyển Dữ liệu, Phục hồi An toàn & Xuất bản 3 Thẻ Văn hóa Kiểm chứng Chân thực

- **Trạng thái:** Hoàn thành 100% (Đã xác minh toàn bộ trên Windows)
- **Các thành phần đã triển khai:**
  - **Di chuyển lược đồ nguyên tử & Ngắt khởi động khi gặp lỗi (Atomic Migration Abort):**
    - Sửa `runPendingMigrations` trong `apps/server/src/db.ts`: Mỗi tệp di chuyển được bọc trong giao dịch nguyên tử `BEGIN IMMEDIATE` ... `COMMIT` kèm thao tác ghi nhận vào bảng `schema_migrations`.
    - Bất kỳ lỗi SQL nào đều kích hoạt `ROLLBACK`, in tên tệp lỗi và quăng ngoại lệ làm dừng tiến trình khởi động máy chủ Fastify (`process.exit(1)`).
    - Loại bỏ hoàn toàn việc nuốt lỗi (bỏ qua `duplicate column name`), đảm bảo lược đồ cơ sở dữ liệu không bao giờ ở trạng thái nửa vời.
    - Bảo toàn 100% dữ liệu looks, look_revisions và lookbook khi nâng cấp cơ sở dữ liệu có sẵn.
    - Bộ kiểm thử độc lập: `scripts/test-migrations.mjs` (4 bài kiểm thử: chạy sạch 001/002, chạy lại không trùng lặp, rollback khi lỗi cố ý, nâng cấp bảo toàn dữ liệu).
  - **Khôi phục an toàn chống ghi đè khi Server đang chạy & Mã băm SHA-256 (Safe Restore & Verification):**
    - Sửa `scripts/restore.mjs`: Loại bỏ kiểm tra lock bằng `fs.openSync`. Bổ sung kiểm tra kết nối cổng mạng TCP thực tế (`checkServerRunning`) trên cổng 3001/biến môi trường để phát hiện máy chủ đang chạy trên Windows.
    - Từ chối ngay việc ghi đè lên database chính nếu máy chủ đang chạy, in thông điệp hướng dẫn chi tiết cách tắt server hoặc dùng cờ `--target-dir`.
    - Xác thực cấu trúc `manifest.json` và kiểm tra mã băm SHA-256 của tệp `dangviet.db` trước khi chạm vào đích đến.
    - Kiểm tra `PRAGMA integrity_check` của SQLite trên tệp sao lưu.
    - Cơ chế **Staging Rollback**: Tạo bản lưu dự phòng `.staging_rollback_<timestamp>` cho đích đến trước khi chép đè, tự động khôi phục nếu xảy ra lỗi giữa chừng.
    - Tự động dọn dẹp các tệp `-wal` và `-shm` cũ tại thư mục đích để tránh nạp bộ đệm lỗi thời.
    - Tôn trọng cấu hình `DATABASE_PATH` và cho phép khôi phục sang thư mục riêng bằng `--target-dir <path>`.
    - Bộ kiểm thử độc lập: `scripts/test-backup-restore.mjs` (6 bước kiểm tra toàn diện).
  - **Xuất bản 3 Thẻ Tri thức Văn hóa Đã Kiểm chứng Chân thực (Published Culture Cards):**
    - Nghiên cứu và bổ sung 3 thẻ văn hóa đạt tiêu chuẩn `published` với nguồn kiểm chứng độc lập:
      1. `card_verified_lich_su_ao_dai`: Tư liệu Bảo tàng Lịch sử Quốc gia và kỹ nghệ may đo Trạch Xá (URL sống, HTTP 200).
      2. `card_verified_lua_van_phuc`: Báo ảnh Việt Nam - TTXVN & Bộ VHTTDL (Quyết định 2969/QĐ-BVHTTDL ngày 10/09/2014, URL sống, HTTP 200).
      3. `card_verified_ngu_than_dinh_che`: Sách khảo cứu *Ngàn năm áo mũ*, nhà nghiên cứu Trần Quang Đức (NXB Tri thức & Nhã Nam, 2013, ISBN 978-604-908-724-4, Chương V, tr. 377-380).
    - Giữ nguyên 6 thẻ chưa đủ bằng chứng ở trạng thái `review` và 1 thẻ ở `draft` để đảm bảo tính minh bạch học thuật tuyệt đối.
    - Cập nhật nhật ký kiểm chứng chi tiết tại `docs/CULTURAL_SOURCES.md`.
    - Giao diện `apps/web/src/components/ExploreSection.tsx`: Bổ sung bộ lọc chuyển đổi ("Đã kiểm chứng (3)" vs "Tất cả tư liệu (10)"), hiển thị huy hiệu xác thực, trích dẫn chi tiết số trang sách/quyết định và đường dẫn liên kết ngoài `<ExternalLink />` đến nguồn gốc.
  - **Rào chắn Trích dẫn của AI (AI Citation Guardrails):**
    - `MockAIAdapter` và `NineRouterAdapter` chỉ được phép trích dẫn các thẻ ở trạng thái `published`.
    - Khi người dùng hỏi về các chủ đề đang ở trạng thái `review` (như tay raglan 1960 Dung Đakao, áo dài Lemur Cát Tường 1934, mấn khăn đóng), AI từ chối đưa trích dẫn và thông báo trung thực rằng tư liệu đang trong diện thẩm định học thuật.
    - `apps/server/src/ai/parser.ts`: Tự động loại bỏ mọi trích dẫn giả mạo hoặc trỏ vào các thẻ chưa kiểm chứng từ đầu ra của mô hình LLM.
    - Bộ kiểm thử độc lập: `scripts/test-ai-culture.mjs` (6 kịch bản kiểm thử bảo vệ trích dẫn).
  - **Cập nhật tài liệu vận hành:**
    - `docs/RUNBOOK.md` cập nhật hướng dẫn lệnh kiểm tra và dừng server bằng PowerShell trên Windows.
- **Lệnh kiểm tra:**
  ```powershell
  node scripts/test-migrations.mjs
  node scripts/test-backup-restore.mjs
  node scripts/test-ai-culture.mjs
  node scripts/test-harden.mjs
  npm run test
  npm run check
  npm run build
  ```

---

## Mốc 9: Không Gian Mô Phỏng 3D Tương Tác, Đa Dáng Người & Vật Liệu PBR

- **Trạng thái:** Hoàn thành 100% (Đã kiểm chứng toàn diện trên Windows, Playwright & Visual Test Suite)
- **Các thành phần đã triển khai:**
  - **Khảo sát kiến trúc & Khóa phiên bản tương thích React 18.3.1:**
    - Khóa chuẩn tương thích: `three@0.169.0`, `@types/three@0.169.0`, `@react-three/fiber@8.17.10`, `@react-three/drei@9.114.0`.
    - Cài đặt sạch sẽ, không dùng cờ `--force` hay `--legacy-peer-deps`.
    - Biên soạn `docs/3D_ARCHITECTURE.md`: Định hình kiến trúc tổng thể, quy chuẩn hệ tọa độ (Y-up, Z-fwd, gốc sàn Y=0, tỷ lệ 1.0 = 1 mét), giải pháp morph targets đồng bộ chống xuyên lưới, ánh sáng studio và pipeline PBR.
  - **Khronos glTF 2.0 Binary (.glb) Custom Builder & Pipeline Asset:**
    - `scripts/3d-generators/glb-writer.mjs`: Bộ sinh nhị phân glTF 2.0 thuần túy tuân thủ đặc tả Khronos 100% (magic `0x46546C67`, version 2, JSON chunk đệm khoảng trắng bội số 4 byte, BIN chunk đệm `0x00`).
    - `scripts/3d-generators/avatar-mesh.mjs`: Lưới nhân vật nữ Việt Nam tỷ lệ tự nhiên 1.666m (đầu, mặt, búi tóc, cổ, thân trên, tay A-pose 22°, chân, bàn chân) kèm tính toán pháp tuyến vertex normal và 5 morph targets.
    - `scripts/3d-generators/garment-mesh.mjs`: Lưới Áo dài truyền thống cổ đứng 3.5cm (`aodai_classic_01`), Áo dài cách tân raglan (`aodai_remix_raglan`) và Quần lụa hai ống rộng riêng biệt (`pants_silk`), tích hợp cùng không gian 5 morph targets.
    - `scripts/3d-generators/accessories-mesh.mjs`: Lưới 3D cho 4 phụ kiện truyền thống: mấn đội đầu (`man_truyen_thong`), nón lá bài thơ (`non_la`), chuỗi ngọc trai (`chuoi_ngoc`), quạt xếp (`quat_xep`).
    - `scripts/3d-generators/generate-all-assets.mjs`: Xuất 8 file `.glb` vào `apps/web/public/models/` và ghi danh mục `catalog_manifest.json`.
    - `scripts/validate-3d-assets.mjs`: Bộ công cụ kiểm thử asset tự động (kiểm tra header, chunks, kích thước file <5MB, 5 morph targets bắt buộc, bounding box hợp lệ không NaN/Infinity).
    - `docs/3D_ASSET_PIPELINE.md`: Tài liệu quy chuẩn kỹ thuật Blender, quy ước socket gắn phụ kiện và quy trình thêm mẫu áo mới qua cấu hình catalog mà không cần sửa code renderer lõi.
  - **Mở rộng Hợp đồng dữ liệu & Command Bus:**
    - `packages/contracts`: Bổ sung enum `VALID_BODY_SHAPES` (`standard`, `petite`, `tall_slender`, `broad_shoulders`, `curvy_hips`, `plus_size`), `VALID_GARMENT_MODELS` (`aodai_classic_01`, `aodai_remix_raglan`), schemas `SET_BODY_SHAPE`, `SET_GARMENT_MODEL`, cập nhật `GarmentConfigSchema` và `LockStateSchema`.
    - `packages/domain`: Cập nhật `command-handler.ts` xử lý 2 lệnh mới, tuân thủ khóa thuộc tính `locks.bodyShape` và `locks.modelId`. Cập nhật `rules.ts` bảo toàn vóc dáng và mẫu áo khi đổi sự kiện/phong cách.
    - `apps/server`: Cập nhật `db.ts` parse dữ liệu qua Zod để tự động gán giá trị mặc định cho bản ghi cũ mà không làm hỏng dữ liệu SQLite; cập nhật `ai/parser.ts` và `ai/mock-adapter.ts`.
  - **Bộ Renderer 3D & Trải nghiệm Người dùng Tương tác:**
    - `apps/web/src/components/AoDai3DViewer.tsx`:
      - Canvas React Three Fiber với OrbitControls (xoay 360°, zoom mượt, giới hạn góc cực chống lật sàn).
      - CameraDirector hỗ trợ 5 góc nhìn cố định: Trước (Front), Sau (Back), Trái (Left), Phải (Right), Đặt lại (Reset) với chuyển động góc nội suy mượt mà.
      - Thanh công cụ chọn 5 preset vóc dáng và 2 mẫu áo dài; nút bật/tắt tự động xoay 360°.
      - WebGL Error Boundary tự động fallback sang mô hình 2D SVG khi thiết bị không hỗ trợ WebGL.
      - Vật liệu PBR cho 4 chất liệu vải truyền thống: Lụa Hà Đông (`roughness = 0.35, metalness = 0.05`), Gấm Huế (`roughness = 0.52, metalness = 0.18`), Linen (`roughness = 0.85, metalness = 0.00`), Voan Chiffon (`roughness = 0.28, metalness = 0.02, transparent, opacity = 0.88`).
    - Tích hợp công tắc chuyển đổi linh hoạt `✨ 3D Không gian` và `🎨 2D Vector` tại:
      - `OutfitRoom.tsx`: Cột hiển thị chính của Phòng phối.
      - `DesignStudio.tsx`: Khu vực hiển thị kết quả thiết kế AI của Xưởng thiết kế Remix Studio.
      - `CompareModal.tsx`: Hỗ trợ xem đối sánh 2 bộ trang phục song song trong không gian 3D.
  - **Kiểm thử Playwright Tự động & Đo đạc Hiệu năng:**
    - Nâng cấp `scripts/test-playwright.mjs`:
      - Khởi chạy headless browser với cờ WebGL.
      - Thao tác kéo chuột xoay nhân vật 360° tự do.
      - Kiểm tra và chụp ảnh 5 góc nhìn camera (`3d-view-front.png`, `3d-view-back.png`, `3d-view-left.png`, `3d-view-right.png`, `3d-view-reset.png`).
      - Kiểm tra biến dạng đồng bộ 5 vóc dáng (`3d-body-petite.png`, `3d-body-plus-size.png`, `3d-body-tall-slender.png`, `3d-body-standard.png`).
      - Kiểm tra nạp mẫu áo cách tân Raglan từ catalog (`3d-model-raglan.png`).
      - Kiểm tra cập nhật chất liệu Gấm Huế và sắc vàng hoàng yến (`3d-material-updated.png`).
      - Kiểm tra chuyển đổi qua lại giữa 2D và 3D (`2d-fallback-active.png`).
      - Kiểm tra đối sánh 2 bộ trong Lookbook ở chế độ 3D (`3d-compare-modal.png`).
      - Đo đạc hiệu năng: Đạt trung bình **61 FPS**, thời gian khung hình **16.4 ms/frame**.

---

## Mốc 10: Bộ Mẫu 3D Chuẩn Đầu Tiên — Avatar Nữ Bán Hiện Thực, Áo Dài Cổ Đứng 4.2cm, Quần Lụa & Pipeline Asset V2

- **Trạng thái:** Hoàn thành 100% (Đã kiểm chứng toàn diện trên Windows, Playwright & Visual Test Suite)
- **Các thành phần đã triển khai:**
  - **Môi trường DCC & Nguồn Base Mesh mở CC0 chuẩn xác thực:**
    - Khởi tạo công cụ tải tự động `scripts/setup-3d-tools.mjs`: Tải và giải nén Blender 3.6.23 LTS Portable vào `tools/blender/` (cô lập trong repository, không đụng chạm PATH hay registry hệ thống, được loại trừ qua `.gitignore`).
    - Nạp base mesh nữ giải phẫu chuẩn `GEO-body_female_realistic` (10,582 đỉnh, quad topology, tỷ lệ giải phẫu chân thực) từ **Blender Studio — Human Base Meshes Bundle v1.4.1** (giấy phép Creative Commons CC0 1.0 Universal).
    - Lưu trữ giấy phép CC0 tại `assets_src/vendor/blender-studio/LICENSE.txt`.
  - **File nguồn tác nghiệp Master Scene & Headless Pipeline Script:**
    - `assets_src/models/dangviet_master_v2.blend`: File Blender master scene chứa toàn bộ mesh nhân vật, tóc búi truyền thống, áo dài v2, quần lụa v2, modifier, UV unwrapped và 5 shape keys đồng bộ.
    - `assets_src/scripts/export_v2.py`: Kịch bản Python headless tự động hóa toàn bộ pipeline dựng hình, áp dụng shape keys, làm dày nẹp viền (solid folded hem 1.8mm) và xuất các file glTF binary (`.glb`) tuân thủ 100% đặc tả Khronos glTF 2.0.
  - **Bộ Asset 3D Runtime có phiên bản (V2):**
    - `apps/web/public/models/avatar_v2.glb` (7,454 KB, 42,340 đỉnh, chiều cao 1.639m):
      - Phân tách 3 slot vật liệu PBR độc lập: `Avatar_Skin` (da), `Avatar_Hair` (tóc), `Avatar_Eyes` (mắt).
      - Búi tóc chignon truyền thống tại ụ chẩm kết hợp màng tóc ôm sát da đầu trích xuất trực tiếp từ 440 đa giác vòm sọ của base mesh với độ dôi pháp tuyến 3.5mm, không xuyên thủng hộp sọ.
      - Mắt có giác mạc và con ngươi độc lập.
      - 5 shape keys đồng bộ: `morph_petite`, `morph_tall_slender`, `morph_broad_shoulders`, `morph_curvy_hips`, `morph_plus_size`.
    - `apps/web/public/models/aodai_traditional_v2.glb` (245 KB, 1,588 đỉnh, chiều cao 1.258m):
      - Cổ đứng cao 4.2cm (từ Z=1.395m đến Z=1.437m), thành nẹp gập 2 lớp kín mép (folded closed rim 1.8mm), không bị mất mặt hay đen viền khi quan sát 360°.
      - Tay raglan 3D quét theo khung trực chuẩn tiếp tuyến (orthonormal tangent frame) dọc quỹ đạo cánh tay A-pose, đỉnh vai có vòm cầu bo tròn tiếp giáp tự nhiên với cơ thang và xương đòn.
      - Hai tà trước và sau liền khối xẻ cao từ eo (Z=1.015m) rủ xuống trên mắt cá (Z=0.180m), độ dôi cơ thể 29mm-46mm ôm sát đường cong tự nhiên, nẹp gập viền tà 1.8mm.
      - 5 shape keys biến dạng đồng bộ hoàn toàn với Avatar.
    - `apps/web/public/models/pants_silk_v2.glb` (134 KB, 864 đỉnh, chiều cao 0.985m):
      - Cạp quần (Z=1.025m), cấu trúc xương chậu và đáy đũng 3D (Z=0.690m - 0.740m), hai ống suông palazzo riêng biệt rủ dài chạm mu bàn chân (Z=0.040m).
      - Bán kính hông và đũng mở rộng bao trùm hoàn toàn đùi và hông dưới khe xẻ tà, loại bỏ 100% hiện tượng lộ da hay xuyên thấu.
      - Nẹp gập viền gấu quần 1.5mm, 5 shape keys đồng bộ.
  - **Tích hợp Kiến trúc Renderer Độc lập & Manifest:**
    - Cập nhật `apps/web/public/models/catalog_manifest.json`: Khai báo model `aodai_traditional_v2` với các đường dẫn `/models/aodai_traditional_v2.glb`, `/models/pants_silk_v2.glb`, `/models/avatar_v2.glb`, 3 slots vật liệu và 5 morph targets.
    - Cập nhật `packages/contracts/src/index.ts`: Bổ sung `'aodai_traditional_v2'` vào `VALID_GARMENT_MODELS`.
    - `apps/web/src/3d/RenderSpec.ts`: Ánh xạ `GARMENT_MODEL_CATALOG` và bổ sung `eyesMaterial` spec.
    - `apps/web/src/3d/MaterialFactory.ts`: Bổ sung phương thức `createEyesMaterial`.
    - `apps/web/src/3d/AvatarInstance.tsx`: Phân bổ vật liệu theo tên slot `Avatar_Skin`, `Avatar_Hair`, `Avatar_Eyes`, giải phóng bộ nhớ khi unmount.
    - `apps/web/src/components/AoDai3DViewer.tsx`: Thêm nút chọn "Chuẩn V2 (Cổ 4.2cm)" và các góc nhìn cận cảnh: Cổ áo (`collar`), Eo/Tà (`waist`), Gấu/Quần (`flaps`).
  - **Tương thích Ngược & Tương thích AI DesignProposal:**
    - Giữ nguyên vẹn các asset v1 (`avatar_base.glb`, `aodai_classic_01.glb`, `pants_silk.glb`). Các Look cũ mở trong Lookbook tiếp tục render chính xác với asset v1.
    - Bản phối mới với model v2 hiển thị mượt mà; hỗ trợ so sánh đối chiếu song song v1 vs v2 trong `CompareModal` với 2 canvas 3D độc lập.
    - AI DesignProposal tôn trọng khả năng của model v2, không tạo lệnh vi phạm thuộc tính bị khóa.
  - **Kiểm chứng Toàn diện & Nghiệm thu Hình ảnh:**
    - `scripts/validate-3d-assets.mjs`: Xác thực 13/13 asset glTF 2.0 đạt chuẩn Khronos 100%.
    - `scripts/verify-3d-renderer.mjs`: Chạy Playwright Chromium WebGL, đo đạc hiệu năng render loop rAF thực tế trong trình duyệt và xuất 15 ảnh nghiệm thu tại `screenshots/3d-eval/`:
      - 4 góc nhìn toàn thân: Trước (`01_view_front.png`), Sau (`02_view_back.png`), Trái (`03_view_left.png`), Phải (`04_view_right.png`).
      - 3 góc cận cảnh kỹ thuật: Cổ áo 4.2cm nẹp viền (`05_closeup_collar.png`), Eo & Tà xẻ cao (`06_closeup_waist_slit.png`), Gấu tà & Quần lụa 2 ống (`07_closeup_hem_pants.png`).
      - 6 preset vóc dáng biến dạng đồng bộ: Dáng cơ bản (`08_shape_standard.png`), Nhỏ nhắn (`09_shape_petite.png`), Cao thanh mảnh (`10_shape_tall_slender.png`), Khung vai rộng (`11_shape_broad_shoulders.png`), Hông nở (`12_shape_curvy_hips.png`), Đầy đặn (`13_shape_plus_size.png`).
      - Đối sánh trực quan song song trong modal: `14_compare_v1_vs_v2.png`.
      - Giao diện di động iPhone 14 (390x844): `15_mobile_iphone14.png`.
    - Kiểm thử tự động hệ thống: `test-flow.mjs`, `test-harden.mjs`, `test-proposal-flow.mjs`, `test-viewer-isolation.mjs` đều vượt qua 100%.

- **Lệnh kiểm tra:**

  ```powershell
  node scripts/validate-3d-assets.mjs
  node scripts/verify-3d-renderer.mjs
  node scripts/test-flow.mjs
  node scripts/test-harden.mjs
  node scripts/test-proposal-flow.mjs
  node scripts/test-viewer-isolation.mjs
  npm run build
  ```

---

## Mốc 11: Pipeline Nhập Avatar Bên Ngoài và Kiểm Tra Tương Thích

- **Trạng thái:** Hoàn thành 100% (Đã kiểm chứng toàn diện trên Windows & Khronos glTF Validator)
- **Các thành phần đã triển khai:**
  - **Khắc phục lỗi normal vector Khronos glTF Validator:**
    - Cập nhật thuật toán tính pháp tuyến `computeVertexNormals` trong `scripts/3d-generators/avatar-mesh.mjs`.
    - Phục hồi các vector suy biến độ dài bằng 0 tại cực đỉnh tóc và chóp nón lá về vector đơn vị chuẩn $(0, 1, 0)$ hoặc vành đai lân cận.
    - Chạy `validate-3d-assets.mjs`: Xác nhận 13/13 tài nguyên glTF 2.0 đạt 0 lỗi, 0 cảnh báo.
  - **Hợp đồng dữ liệu & Ma trận tương thích bộ ba (Tri-factor Compatibility Matrix):**
    - `packages/contracts/src/index.ts`: Bổ sung `AvatarSpecSchema`, `GarmentCompatibilitySchema`, lệnh `SET_AVATAR`, trường `avatarId` trong `GarmentConfig` và `LockState`.
    - `packages/domain/src/command-handler.ts`: Xử lý lệnh `SET_AVATAR` với kiểm tra revision OCC, khóa thuộc tính và rẽ nhánh undo.
    - `apps/web/public/models/catalog_manifest.json`: Khai báo mảng `avatars` (`avatar_v2`, `avatar_base`) và ma trận tương thích bộ ba `(avatarId@version, garmentModelId@version, bodyShape)` với 3 trạng thái (`verified`, `untested`, `unsupported`).
  - **Công cụ dòng lệnh CLI Avatar Pipeline (`scripts/avatar-pipeline.mjs`):**
    - Lệnh `inspect <path>`: Kiểm tra cấu trúc nhị phân glTF 2.0, Khronos Validator, AABB bounding box (chiều cao 1.50m - 1.80m), đếm morph targets, phân tích material slots và 5 điểm neo phụ kiện (sockets).
    - Lệnh `register <path>`: Tính mã băm mật mã SHA-256, sao chép tệp an toàn vào `public/models/avatars/`, cập nhật nguyên tử `catalog_manifest.json` và khởi tạo ma trận tương thích ban đầu (`untested`).
  - **Kiến trúc Mesh, Vật liệu & Dynamic Sockets Tracking:**
    - `apps/web/src/3d/MorphController.ts`: Bổ sung từ điển quy đổi danh xưng `MORPH_ALIASES` hỗ trợ các công cụ AI bên ngoài. Tính toán tọa độ biến dạng thời gian thực cho 5 attachment sockets (`head`, `neck`, `right_hand`, `left_hand`, `feet`) tránh xuyên mesh khi thay đổi vóc dáng.
    - `apps/web/src/3d/MaterialFactory.ts` & `AvatarInstance.tsx`: Bảo tồn `baseColorTexture` gốc khi avatar AI có sẵn texture nướng sẵn, clone mutable material riêng biệt theo từng viewer instance.
    - `apps/web/src/3d/RenderSpec.ts`: Tách `avatarUrl` độc lập theo `config.avatarId`, tương thích ngược với các bản phối cũ thiếu trường `avatarId`.
  - **Giao diện Thẩm định 3D Độc lập (Avatar Inspector UI):**
    - Tạo `apps/web/src/components/AvatarInspector.tsx` (route `/inspector`): Trang bị 4 góc máy ảnh cố định (Trước, Nghiêng, Sau, Góc 3/4), chức năng `Fit Bounds`, công tắc bật/tắt `Wireframe`, 5 thanh trượt morphs, gizmo điểm neo sockets và bảng thống kê kỹ thuật.
    - `AoDai3DViewer.tsx` & `OutfitRoom.tsx`: Hiển thị huy hiệu tương thích thời gian thực, thanh chọn avatar và nút khóa `locks.avatarId`.
  - **Bộ kiểm thử tự động toàn diện:**
    - `scripts/test-avatar-pipeline.mjs`: Bao phủ 20 ca kiểm thử thuộc 7 nhóm (contracts, tương thích ngược, ma trận tương thích, domain command, morph controller & sockets tracking, CLI inspect thực tế, fixtures hỏng, đăng ký manifest nguyên tử) - Đạt chuẩn 100%.
    - `scripts/test-playwright.mjs`: Bổ sung kịch bản kiểm tra rào chắn phản hồi AI muộn (Late AI response) và cô lập dữ liệu khi xuất PNG.
  - **Tài liệu hướng dẫn kỹ thuật:**
    - Biên soạn `docs/AVATAR_IMPORT_GUIDE.md`: Chuẩn hóa tiêu chuẩn nhân trắc học, morphs, sockets, bảo tồn vật liệu, hướng dẫn chạy CLI và khắc phục lỗi thường gặp.

- **Lệnh kiểm tra:**

  ```powershell
  node --experimental-strip-types scripts/test-avatar-pipeline.mjs
  node scripts/validate-3d-assets.mjs
  node scripts/test-flow.mjs
  node scripts/test-harden.mjs
  node scripts/test-playwright.mjs
  npm run build
  ```
