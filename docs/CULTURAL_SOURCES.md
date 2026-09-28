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
- **Luận điểm chính**:
  1. Tà áo dài truyền thống gắn liền với dòng chảy lịch sử Thăng Long - Hà Nội qua các thời kỳ.
  2. Làng nghề may Trạch Xá (xã Hòa Lâm, huyện Ứng Hòa, Hà Nội) có bề dày hơn 1.000 năm lịch sử lập làng may từ thời Tiền Lê.
  3. Kỹ thuật may đo thủ công độc đáo "tay trong tay ngoài" (giấu mũi kim bên ngoài tà áo, bên trong đều đặn) tạo nên dáng áo buông thẳng, không gợn sóng.
- **Nguồn trích dẫn**:
  - Cơ quan: Bảo tàng Lịch sử Quốc gia - Chuyên mục Di sản Văn hóa.
  - Tác giả: Hà An (phản ánh chuyên đề trưng bày hiện vật áo dài tại Bảo tàng Lịch sử Quốc gia).
  - URL: `https://baotanglichsu.vn/vi/Articles/3091/76718/net-ha-thanh-ke-chuyen-ha-noi-qua-ta-ao-dai-va-nhung-chiec-xe-co.html`
  - Ngày đăng bài: 11/09/2026.
  - Ngày kiểm chứng độc lập: 28/09/2026 (HTTP 200 OK, nội dung xác nhận kỹ thuật may Trạch Xá và tiến trình áo dài qua các thời kỳ).
- **Trạng thái**: **`published`**.

---

### Thẻ V2: `card_verified_lua_van_phuc`
- **Slug**: `di-san-det-lua-van-phuc-ha-dong-chinh-thuc`
- **Tiêu đề**: Di sản dệt lụa Vạn Phúc - Hà Đông: Nghề truyền thống và phom dáng Áo dài
- **Chủ đề**: Chất liệu lụa tơ tằm truyền thống
- **Luận điểm chính**:
  1. Làng dệt lụa Vạn Phúc (Hà Đông, Hà Nội) là một trong những cái nôi dệt lụa tơ tằm cổ xưa nhất Việt Nam.
  2. Nghề dệt lụa Vạn Phúc được Bộ Văn hóa, Thể thao và Du lịch đưa vào Danh mục Di sản văn hóa phi vật thể Quốc gia (Quyết định số 2969/QĐ-BVHTTDL ngày 10/09/2014).
  3. Lụa Vạn Phúc làm từ 100% tơ tằm tự nhiên, mặt cắt tam giác của sợi tơ tạo độ óng ả phản quang dưới ánh nắng, mùa đông ấm, mùa hè mát.
  4. Hoa văn cổ truyền như Vân (mây bay), Cúc, Thọ, Song hạc cùng độ rủ mềm mại tạo nên phom dáng chuẩn mực cho Áo dài.
- **Nguồn trích dẫn**:
  - Cơ quan: Báo ảnh Việt Nam - Thông tấn xã Việt Nam & Bộ Văn hóa, Thể thao và Du lịch.
  - Tác giả: Bài: Ngân Hà, Ảnh: Khánh Long (Thông tấn xã Việt Nam).
  - URL: `https://vietnam.vnanet.vn/vietnamese/long-form/lang-nghe-lua-van-phuc-doi-moi-sang-tao-de-phat-trien-468288.html`
  - Ngày đăng bài: 06/03/2026.
  - Văn bản pháp lý: Quyết định 2969/QĐ-BVHTTDL ngày 10/09/2014 của Bộ VHTTDL.
  - Ngày kiểm chứng độc lập: 28/09/2026 (HTTP 200 OK, nội dung xác nhận đầy đủ tư liệu dệt lụa tơ tằm và ứng dụng áo dài).
- **Trạng thái**: **`published`**.

---

### Thẻ V3: `card_verified_ngu_than_dinh_che`
- **Slug**: `dinh-che-ao-ngu-than-lap-linh-trieu-nguyen`
- **Tiêu đề**: Định chế Áo ngũ thân lập lĩnh thời Nguyễn: Cội nguồn cấu trúc Áo dài
- **Chủ đề**: Lịch sử quy chế trang phục thời Nguyễn
- **Luận điểm chính**:
  1. Áo dài truyền thống có tiền thân trực tiếp từ áo ngũ thân cổ đứng (lập lĩnh).
  2. Năm 1744, chúa Vũ Vương Nguyễn Phúc Khoát ban sắc dụ cải cách trang phục tại xứ Đàng Trong để phân định phong hóa với Đàng Ngoài, quy định thường phục cài khuy bên phải, nẹp cổ đứng.
  3. Triều vua Minh Mạng (từ năm 1827 đến năm 1837) ban sắc lệnh thống nhất quy chế y phục toàn quốc, đưa áo ngũ thân lập lĩnh trở thành thường phục chuẩn tắc.
  4. Cấu trúc năm thân gồm bốn thân lớn bên ngoài (tứ thân phụ mẫu) và thân con thứ năm (bảo vệ người mặc) lót bên trong, đi cùng năm chiếc khuy đại diện cho Ngũ thường (Nhân, Lễ, Nghĩa, Trí, Tín).
- **Nguồn trích dẫn**:
  - Tên sách: *Ngàn năm áo mũ* (Nghiên cứu về trang phục Việt Nam qua các thời kỳ lịch sử).
  - Tác giả: Trần Quang Đức.
  - Nhà xuất bản: NXB Tri thức & Công ty Văn hóa và Truyền thông Nhã Nam.
  - Năm xuất bản: 2013 (Hà Nội).
  - Mã chuẩn quốc tế: ISBN 978-604-908-724-4.
  - Vị trí cụ thể: Chương V: "Trang phục triều Nguyễn", tiểu mục "Thường phục thế kỷ 18-19", trang 377-380.
  - Đối chiếu tư liệu gốc: *Đại Nam thực lục tiền biên* và *Đại Nam thực lục chính biên*.
  - Ngày kiểm chứng độc lập: 28/09/2026.
- **Trạng thái**: **`published`**.

---

## 3. Nhóm thẻ đang trong quá trình thẩm định (`review` & `draft`)

*Ghi chú: Giữ nguyên vẹn toàn bộ 6 thẻ ban đầu để minh bạch dữ liệu, không xóa hay giả mạo đã thẩm định.*

| Mã định danh | Tiêu đề | Nguồn trích ghi nhận | Lý do chuyển `review` / Việc cần làm |
| :--- | :--- | :--- | :--- |
| `card_ngu_than_tien_than` | Áo ngũ thân: Tiền thân cấu trúc của Áo dài hiện đại | Sách *Ngàn năm áo mũ* & URL Bảo tàng Lịch sử QG | URL cũ hiển thị bài di sản Phật giáo; đã lập thẻ V3 thay thế với số trang cụ thể (tr. 377-380). Thẻ này lưu giữ để theo dõi đối chiếu. |
| `card_lemur_cach_tan` | Áo dài Lemur (1934): Cuộc cách mạng thẩm mỹ tân thời | Tuần báo Phong Hóa số 85 & Bảo tàng Áo dài | URL trả về HTTP 404. Cần số hóa bản in gốc báo Phong Hóa số 85 (2/1934) từ Thư viện Quốc gia. |
| `card_tay_raglan_1960` | Kỹ thuật tay Raglan (1960): Triệt tiêu nếp nhăn nách áo | Tư liệu tiệm may Dung Đakao & Bảo tàng Áo dài | URL trả về HTTP 404. Cần phỏng vấn nghệ nhân hoặc kỷ yếu nghiên cứu thời trang Sài Gòn. |
| `card_lua_van_phuc` | Lụa Vạn Phúc - Hà Đông: Nghìn năm tinh hoa dệt lụa | Cục Di sản Văn hóa (`dsvh.gov.vn`) | URL cũ bị chuyển hướng trang chủ; đã lập thẻ V2 thay thế với bài viết chuyên đề TTXVN và Quyết định 2969/QĐ-BVHTTDL. Thẻ này lưu giữ lịch sử. |
| `card_man_khan_dong` | Từ Khăn đóng ngũ thân đến Mấn lụa đương đại | Sách *Trang phục Thăng Long - Hà Nội* (PGS.TS Nguyễn Thị Đức) | URL thư viện chuyển hướng 301. Cần tra cứu bản in NXB Hà Nội năm 2010 tại thư viện. |
| `card_gam_hue_van_may` | Họa tiết Vân mây và Gấm hoa triều đình Huế | Sách *Mỹ thuật Nguyễn* & Bảo tàng Cổ vật Cung đình Huế | Tên miền DNS lỗi (`ENOTFOUND`). Cần xin tư liệu số hóa từ Trung tâm Bảo tồn Di tích Cố đô Huế. |
| `card_draft_ao_tu_than` | Áo tứ thân miền Bắc: Nét đẹp lao động và lễ hội dân gian | *Tập tục và nghi lễ dân gian Việt Nam* (Toan Ánh) | Trạng thái `draft`. Chờ bổ sung số trang và đối chiếu hiện vật dân tộc học. |

---

## 4. Thống kê tổng hợp hiện tại

| Trạng thái | Số lượng ban đầu | Số lượng hiện tại | Ghi chú |
| :--- | :---: | :---: | :--- |
| **`published`** (Đã kiểm chứng độc lập) | 0 | **3** | Đầy đủ nguồn bảo tàng / cơ quan báo chí chính thống / số trang sách in chính thức. |
| **`review`** (Đang thẩm định tư liệu) | 6 | **6** | Giữ nguyên vẹn để minh bạch lịch sử khảo cứu. |
| **`draft`** (Bản thảo sơ khởi) | 1 | **1** | Chờ thu thập tư liệu thực địa. |
| **Tổng số thẻ** | 7 | **10** | Hệ thống lưu trữ an toàn trong SQLite và file JSON. |
