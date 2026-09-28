# NHẬT KÝ KIỂM CHỨNG TƯ LIỆU VĂN HÓA (CULTURAL SOURCES AUDIT)

Dự án: **Dáng Việt**  
Thời điểm kiểm chứng độc lập: **28/09/2026**  
Môi trường thực hiện: Windows 11 / Node.js v24  
Công cụ xác minh: Network Fetch (`WebFetch`), DNS Resolution, Domain Validation

---

## 1. Nguyên tắc kiểm chứng

1. **Không suy diễn**: Sự hiện diện của `sourceName` hoặc `sourceUrl` không phải bằng chứng đã xác minh.
2. **Tiêu chuẩn `published`**: URL nguồn phải truy cập được (HTTP 200), không chuyển hướng sai lệch, và nội dung tại nguồn phải hỗ trợ trực tiếp từng luận điểm của thẻ tư liệu.
3. **Chuyển trạng thái sang `review`**: Tất cả các thẻ có URL 404, tên miền không tồn tại, URL chuyển hướng sai nội dung hoặc thiếu dẫn chứng trang sách số hóa đều chuyển sang trạng thái `review`.
4. **Không tự sáng tác nguồn**: Giữ nguyên thông tin nguồn gốc ban đầu và ghi rõ các bước xác minh còn thiếu.
5. **AI Q&A Guardrail**: Chỉ các thẻ có trạng thái `published` mới được AI trích dẫn làm kiến thức đã xác nhận. Nếu người dùng hỏi chủ đề thuộc thẻ `review`/`draft`, hệ thống thông báo dữ liệu đang trong quá trình thẩm định.

---

## 2. Kết quả kiểm chứng chi tiết từng thẻ

### Thẻ 1: `card_ngu_than_tien_than`
- **Tiêu đề**: Áo ngũ thân: Tiền thân cấu trúc của Áo dài hiện đại
- **Nhận định chính**: Năm 1744 chúa Nguyễn Phúc Khoát ban hành quy định trang phục; 1827-1837 vua Minh Mạng chuẩn hóa áo ngũ thân; cấu trúc 5 thân tượng trưng tứ thân phụ mẫu và người mặc; 5 khuy tượng trưng Ngũ thường.
- **Nguồn ghi nhận**: Sách *Ngàn năm áo mũ* (Trần Quang Đức, NXB Nhã Nam & Tri Thức, 2013) & URL Bảo tàng Lịch sử Quốc gia (`https://baotanglichsu.vn/vi/Articles/3091/14101/ao-dai-viet-nam-qua-cac-thoi-ky-lich-su.html`).
- **Kết quả kiểm tra URL**: URL truy cập được (HTTP 200) nhưng nội dung thực tế trên trang hiển thị bài viết *"Tìm hiểu Di sản văn hóa Phật giáo Việt Nam"*, không chứa nội dung áo ngũ thân.
- **Kết luận thẩm định**: **Chuyển sang `review`**.
- **Việc cần làm**: Tra cứu lại đường dẫn chính xác bài viết trên cổng thông tin Bảo tàng Lịch sử Quốc gia; đối chiếu số trang cụ thể (tr. 280-310) trong sách in *Ngàn năm áo mũ*.

---

### Thẻ 2: `card_lemur_cach_tan`
- **Tiêu đề**: Áo dài Lemur (1934): Cuộc cách mạng thẩm mỹ tân thời
- **Nhận định chính**: Họa sĩ Cát Tường trên tuần báo Phong Hóa số 85 (tháng 2/1934) khởi xướng cải cách y phục, bỏ thân con, ráp 2 tà trước sau ôm sát cơ thể.
- **Nguồn ghi nhận**: Tuần báo Phong Hóa số 85 & URL Bảo tàng Áo dài (`https://baotangaodai.com.vn/nghien-cuu/ao-dai-lemur`).
- **Kết quả kiểm tra URL**: Máy chủ trả về **HTTP 404 Not Found**.
- **Kết luận thẩm định**: **Chuyển sang `review`**.
- **Việc cần làm**: Khai thác bản scan số hóa của tuần báo Phong Hóa số 85 (Thư viện Quốc gia Việt Nam); liên hệ hoặc tra cứu lại đường dẫn mục Nghiên cứu trên website Bảo tàng Áo dài TP.HCM.

---

### Thẻ 3: `card_tay_raglan_1960`
- **Tiêu đề**: Kỹ thuật tay Raglan (1960): Giải pháp triệt tiêu nếp nhăn nách áo
- **Nhận định chính**: Nhà may Dung Đakao (Sài Gòn, 1960) áp dụng đường cắt raglan nối từ cổ chéo xuống nách, giúp tà áo phẳng phiu ôm sát nách.
- **Nguồn ghi nhận**: Kỷ yếu nghiên cứu trang phục miền Nam & URL Bảo tàng Áo dài (`https://baotangaodai.com.vn/lich-su-ao-dai-raglan`).
- **Kết quả kiểm tra URL**: Máy chủ trả về **HTTP 404 Not Found**.
- **Kết luận thẩm định**: **Chuyển sang `review`**.
- **Việc cần làm**: Tìm kiếm tư liệu phỏng vấn nhân chứng / tài liệu hồi ký may mặc Sài Gòn thập niên 1960 của Viện Văn hóa Nghệ thuật để kiểm chứng độc lập.

---

### Thẻ 4: `card_lua_van_phuc`
- **Tiêu đề**: Lụa Vạn Phúc - Hà Đông: Nghìn năm tinh hoa dệt lụa tơ tằm
- **Nhận định chính**: Nghề dệt lụa có lịch sử nghìn năm; bà A Lã Thị Nương là Thành hoàng làng; năm 2014 được công nhận là Di sản văn hóa phi vật thể quốc gia theo Quyết định số 2969/QĐ-BVHTTDL.
- **Nguồn ghi nhận**: Hồ sơ Cục Di sản Văn hóa (`http://dsvh.gov.vn/nghe-det-lua-van-phuc-2746`).
- **Kết quả kiểm tra URL**: URL tự động chuyển hướng về trang chủ `http://dsvh.gov.vn/`, không giữ nội dung bài viết chi tiết số 2746.
- **Kết luận thẩm định**: **Chuyển sang `review`**.
- **Việc cần làm**: Tìm bản lưu trữ Quyết định số 2969/QĐ-BVHTTDL trên Cổng thông tin điện tử Bộ Văn hóa Thể thao và Du lịch hoặc Cơ sở dữ liệu Quốc gia về Di sản Văn hóa.

---

### Thẻ 5: `card_man_khan_dong`
- **Tiêu đề**: Từ Khăn đóng ngũ thân đến Mấn lụa đương đại
- **Nhận định chính**: Khăn vấn là dải vải khổ hẹp quấn quanh đầu; Bắc Bộ có lối vấn lộ tóc đuôi gà; Trung/Nam phổ biến khăn đóng định hình sẵn; sang thế kỷ 21 mấn được bọc nhung/lụa cách tân.
- **Nguồn ghi nhận**: Sách *Trang phục Thăng Long - Hà Nội* (PGS.TS Nguyễn Thị Đức, NXB Hà Nội, 2010) & URL (`https://thuvienquocgia.vn/trang-phuc-thang-long`).
- **Kết quả kiểm tra URL**: Máy chủ trả về mã chuyển hướng 301 Moved Permanently về trang chủ `thuvienquocgia.vn`.
- **Kết luận thẩm định**: **Chuyển sang `review`**.
- **Việc cần làm**: Rà soát mục lục và tra cứu bản in sách tại Thư viện Quốc gia hoặc Thư viện Hà Nội để kiểm chứng số trang (tr. 145-160).

---

### Thẻ 6: `card_gam_hue_van_may`
- **Tiêu đề**: Họa tiết Vân mây và Gấm hoa triều đình Huế
- **Nhận định chính**: Họa tiết vân mây và gấm hoa cung đình tượng trưng cho thiên ân, phúc lành và trật tự thái hòa; xuất hiện cùng bát bửu hoặc ngũ phúc trên long bào, nhật bình triều Nguyễn.
- **Nguồn ghi nhận**: Sách *Mỹ thuật Nguyễn trên đất Cố đô* & URL Bảo tàng Cổ vật Cung đình Huế (`https://baotangcotrinhhue.vn/hoa-van-cung-dinh`).
- **Kết quả kiểm tra URL**: Tên miền không thể phân giải DNS (`ENOTFOUND baotangcotrinhhue.vn`). Tên miền bị sai chính tả hoặc không tồn tại.
- **Kết luận thẩm định**: **Chuyển sang `review`**.
- **Việc cần làm**: Rà soát cổng thông tin chính thức của Trung tâm Bảo tồn Di tích Cố đô Huế (`hueworldheritage.org.vn`) hoặc Bảo tàng Cổ vật Cung đình Huế; đối chiếu hiện vật áo Nhật bình hoàng tộc lưu giữ tại Huế.

---

### Thẻ 7: `card_draft_ao_tu_than`
- **Tiêu đề**: Áo tứ thân miền Bắc: Nét đẹp lao động và lễ hội dân gian
- **Nhận định chính**: Hai vạt sau may liền sống lưng, hai vạt trước buông tự do thắt múi; đi kèm yếm, thắt lưng bao và nón quai thao.
- **Nguồn ghi nhận**: *Tập tục và nghi lễ dân gian Việt Nam* (Toan Ánh). Chưa có URL.
- **Kết luận thẩm định**: Giữ nguyên trạng thái **`draft`**.
- **Việc cần làm**: Bổ sung tư liệu hình ảnh và số trang cụ thể từ các ấn phẩm văn hóa dân gian Bắc Bộ.

---

## 3. Thống kê tổng hợp sau kiểm chứng

| Trạng thái | Số lượng ban đầu | Số lượng sau kiểm chứng | Ghi chú |
| :--- | :---: | :---: | :--- |
| **`published`** (Đã kiểm chứng độc lập) | 6 | **0** | Đảm bảo tính trung thực học thuật: không có thẻ nào đủ link sống và trích dẫn trực tiếp hoàn toàn khớp. |
| **`review`** (Đang thẩm định tư liệu) | 0 | **6** | Giữ nguyên nội dung và ghi nhận rõ lý do cần bổ sung tài liệu. |
| **`draft`** (Bản thảo) | 1 | **1** | Chờ bổ sung nguồn và đối sánh hiện vật. |
| **Tổng số thẻ** | 7 | **7** | |
