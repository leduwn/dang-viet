# NHẬT KÝ KIỂM CHỨNG TƯ LIỆU VĂN HÓA (CULTURAL SOURCES AUDIT)

Dự án: **Dáng Việt**  
Thời điểm kiểm chứng độc lập: **28/09/2026**  
Môi trường thực hiện: Windows 11 / Node.js v24  
Công cụ xác minh: Network Fetch (`WebFetch`), DNS Resolution, Domain Validation, Thẩm định Thư mục Học thuật

---

## 1. Nguyên tắc kiểm chứng

1. **Không suy diễn**: Sự hiện diện của `sourceName` hoặc `sourceUrl` không phải bằng chứng đã xác minh.
2. **Tiêu chuẩn `published`**:
   - Nguồn điện tử: URL của bảo tàng, cổng thông tin cơ quan nhà nước, hoặc cơ quan báo chí chính thống đang hoạt động thực tế (HTTP 200), nội dung trang phải khớp trực tiếp với từng luận điểm của thẻ.
   - Nguồn sách in nghiên cứu: Phải là ấn phẩm được cấp phép xuất bản chính thức, có tên sách, tác giả, nhà xuất bản, năm xuất bản, mã định danh (ISBN), và chỉ rõ chương mục, số trang cụ thể chứa bằng chứng.
3. **Minh bạch trạng thái**:
   - Tất cả các thẻ có URL 404, tên miền không tồn tại, URL chuyển hướng sai nội dung hoặc thiếu dẫn chứng trang sách số hóa được chuyển sang trạng thái **`review`**.
   - Tuyệt đối không xóa bỏ các thẻ chưa kiểm chứng nhằm đảm bảo tính minh bạch học thuật; không giả mạo thành công.
4. **AI Q&A Guardrail**:
   - Chỉ các thẻ có trạng thái **`published`** mới được bộ chuyển đổi AI (kể cả Mock Adapter và 9router) trích dẫn làm kiến thức đã xác nhận.
   - Nếu người dùng truy vấn chủ đề thuộc thẻ `review`/`draft` hoặc ngoài phạm vi tư liệu đã kiểm chứng, hệ thống phải trả lời rõ ràng: "Hiện chưa đủ thông tin văn hóa đã kiểm chứng để khẳng định điều này."

---

## 2. Nhóm thẻ đã kiểm chứng xuất bản (`published`)

### Thẻ V1: `card_verified_lich_su_ao_dai`
- **Slug**: `ao-dai-ha-thanh-va-nghe-may-trach-xa`
- **Tiêu đề**: Tà Áo dài Hà thành và kỹ nghệ may đo Trạch Xá
- **Chủ đề**: Lịch sử trang phục & Làng nghề may truyền thống
- **Luận điểm chính được kiểm chứng**:
  1. Tà áo dài truyền thống gắn liền với dòng chảy lịch sử Thăng Long - Hà Nội qua các thời kỳ.
  2. Làng nghề may Trạch Xá (xã Hòa Lâm, huyện Ứng Hòa, Hà Nội) có bề dày lịch sử lập làng may từ thời Tiền Lê.
  3. Kỹ thuật may đo thủ công độc đáo "tay trong tay ngoài" (giấu mũi kim bên ngoài tà áo, bên trong đều đặn) tạo nên dáng áo buông thẳng, không gợn sóng.
- **Nguồn trích dẫn**:
  - Cơ quan: Bảo tàng Lịch sử Quốc gia - Chuyên mục Di sản Văn hóa.
  - Tác giả: Hà An (phản ánh chuyên đề trưng bày hiện vật áo dài tại Bảo tàng Lịch sử Quốc gia).
  - URL: `https://baotanglichsu.vn/vi/Articles/3091/76718/net-ha-thanh-ke-chuyen-ha-noi-qua-ta-ao-dai-va-nhung-chiec-xe-co.html`
  - Ngày đăng bài: 11/09/2026.
  - Ngày kiểm chứng độc lập: 28/09/2026 (Nội dung bài viết bảo tàng xác nhận trực tiếp kỹ thuật may Trạch Xá và tiến trình áo dài qua các thời kỳ).
- **Trạng thái**: **`published`**.

---

### Thẻ V2: `card_verified_lua_van_phuc`
- **Slug**: `di-san-det-lua-van-phuc-ha-dong-chinh-thuc`
- **Tiêu đề**: Nghề dệt lụa Vạn Phúc - Hà Đông và phom dáng Áo dài
- **Chủ đề**: Chất liệu lụa tơ tằm truyền thống
- **Luận điểm chính được kiểm chứng**:
  1. Làng lụa Vạn Phúc (phường Vạn Phúc, quận Hà Đông, Hà Nội) là một trong những cái nôi dệt lụa tơ tằm cổ xưa của vùng đồng bằng Bắc Bộ.
  2. Lụa Vạn Phúc dệt từ sợi tự nhiên với hoa văn truyền thống nổi tiếng như Vân (mây trời), Cúc, Thọ, Song hạc.
  3. Đặc tính tơ tằm mềm mại, phản quang tự nhiên, mùa đông ấm, mùa hè mát; độ rủ tự nhiên không tích điện tạo tà áo dài bay bổng, kín đáo.
- **Phần đã lược bỏ theo nguyên tắc liêm chính học thuật**:
  - Nhận định về "Quyết định số 2969/QĐ-BVHTTDL ngày 10/09/2014": Bỏ khỏi nội dung thẻ published do chưa tiếp cận được văn bản công báo chính thức trực tiếp để đối soát số quyết định và ngày ký.
- **Nguồn trích dẫn**:
  - Cơ quan: Báo ảnh Việt Nam - Thông tấn xã Việt Nam.
  - Tác giả: Bài: Ngân Hà, Ảnh: Khánh Long (Thông tấn xã Việt Nam).
  - URL: `https://vietnam.vnanet.vn/vietnamese/long-form/lang-nghe-lua-van-phuc-doi-moi-sang-tao-de-phat-trien-468288.html`
  - Ngày đăng bài: 06/03/2026.
  - Ngày kiểm chứng độc lập: 28/09/2026 (Nội dung bài báo xác nhận trực tiếp kỹ thuật dệt lụa tơ tằm, các loại hoa văn truyền thống và ứng dụng may áo dài).
- **Trạng thái**: **`published`**.

---

## 3. Nhóm thẻ đang trong quá trình thẩm định (`review` & `draft`)

*Ghi chú: Giữ nguyên vẹn toàn bộ các thẻ chưa đủ nguồn kiểm chứng trực tiếp để minh bạch dữ liệu, không xóa hay giả mạo đã thẩm định.*

| Mã định danh | Tiêu đề | Nguồn trích ghi nhận | Lý do chuyển `review` / Việc cần làm |
| :--- | :--- | :--- | :--- |
| `card_verified_ngu_than_dinh_che` | Định chế Áo ngũ thân lập lĩnh thời Nguyễn | Sách *Ngàn năm áo mũ* | Chờ đối soát bản in vật lý hoặc bản số hóa chính thức có số trang cụ thể; không tự bịa số trang hoặc tư liệu. |
| `card_ngu_than_tien_than` | Áo ngũ thân: Tiền thân cấu trúc của Áo dài hiện đại | Sách *Ngàn năm áo mũ* & URL Bảo tàng Lịch sử QG | URL cũ hiển thị bài di sản Phật giáo; cần thu thập tư liệu hiện vật đối sánh. |
| `card_lemur_cach_tan` | Áo dài Lemur (1934): Cuộc cách mạng thẩm mỹ tân thời | Tuần báo Phong Hóa số 85 & Bảo tàng Áo dài | URL trả về HTTP 404. Cần số hóa bản in gốc báo Phong Hóa số 85 (2/1934) từ Thư viện Quốc gia. |
| `card_tay_raglan_1960` | Kỹ thuật tay Raglan (1960): Triệt tiêu nếp nhăn nách áo | Tư liệu tiệm may Dung Đakao & Bảo tàng Áo dài | URL trả về HTTP 404. Cần phỏng vấn nghệ nhân hoặc kỷ yếu nghiên cứu thời trang Sài Gòn. |
| `card_lua_van_phuc` | Lụa Vạn Phúc - Hà Đông: Nghìn năm tinh hoa dệt lụa | Cục Di sản Văn hóa (`dsvh.gov.vn`) | URL cũ bị chuyển hướng trang chủ; thẻ V2 thay thế đã biên tập theo bài TTXVN. Thẻ này lưu giữ lịch sử. |
| `card_man_khan_dong` | Từ Khăn đóng ngũ thân đến Mấn lụa đương đại | Sách *Trang phục Thăng Long - Hà Nội* (PGS.TS Nguyễn Thị Đức) | URL thư viện chuyển hướng 301. Cần tra cứu bản in NXB Hà Nội năm 2010 tại thư viện. |
| `card_gam_hue_van_may` | Họa tiết Vân mây và Gấm hoa triều đình Huế | Sách *Mỹ thuật Nguyễn* & Bảo tàng Cổ vật Cung đình Huế | Tên miền DNS lỗi (`ENOTFOUND`). Cần xin tư liệu số hóa từ Trung tâm Bảo tồn Di tích Cố đô Huế. |
| `card_draft_ao_tu_than` | Áo tứ thân miền Bắc: Nét đẹp lao động và lễ hội dân gian | *Tập tục và nghi lễ dân gian Việt Nam* (Toan Ánh) | Trạng thái `draft`. Chờ bổ sung số trang và đối chiếu hiện vật dân tộc học. |

---

## 4. Thống kê tổng hợp hiện tại

| Trạng thái | Số lượng ban đầu | Số lượng hiện tại | Ghi chú |
| :--- | :---: | :---: | :--- |
| **`published`** (Đã kiểm chứng độc lập) | 0 | **2** | Đầy đủ nguồn bảo tàng / cơ quan báo chí chính thống với nội dung xác minh trực tiếp. |
| **`review`** (Đang thẩm định tư liệu) | 6 | **7** | Giữ nguyên vẹn để minh bạch lịch sử khảo cứu, không tự ý bịa số trang. |
| **`draft`** (Bản thảo sơ khởi) | 1 | **1** | Chờ thu thập tư liệu thực địa. |
| **Tổng số thẻ** | 7 | **10** | Hệ thống lưu trữ an toàn trong SQLite và file JSON. |
