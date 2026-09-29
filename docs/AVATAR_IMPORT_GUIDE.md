# HƯỚNG DẪN NHẬP AVATAR BÊN NGOÀI VÀ KIỂM TRA TƯƠNG THÍCH (AVATAR IMPORT GUIDE)

**Dự án:** Dáng Việt (viet-phoi)  
**Tài liệu:** Hướng dẫn kỹ thuật nhập, thẩm định và đăng ký Avatar nữ 3D từ công cụ AI  
**Phiên bản:** 2.0.0  
**Ngày phát hành:** 2026-09-29  

---

## 1. Mục đích và Phạm vi

Tài liệu này chuẩn hóa quy trình tiếp nhận mô hình Avatar 3D nữ trưởng thành được tạo ra từ các công cụ AI thế hệ mới (Tripo 3D, Meshy, Rodin, CSM, Luma Genie...) hoặc từ các phần mềm DCC (Blender, Maya, ZBrush), đưa vào hệ sinh thái **Dáng Việt** an toàn mà **không phá vỡ mô hình hiện tại, Lookbook, vật liệu PBR hoặc logic phối đồ**.

Hệ thống quản lý tính tương thích theo kiến trúc **Tri-factor Compatibility Matrix**:
$$\text{Tương thích} = f(\text{AvatarId@Version}, \text{GarmentModelId@Version}, \text{BodyShape})$$

Ba trạng thái tương thích:
- `verified` (Đã kiểm chứng - Khung xanh): Khớp hoàn toàn phom dáng, không xuyên mesh.
- `untested` (Chưa thử nghiệm - Khung vàng): Avatar mới nhập, chưa qua kiểm thử thực tế với mẫu áo.
- `unsupported` (Không tương thích - Khung đỏ): Chênh lệch tỷ lệ giải phẫu, cảnh báo hoặc ngăn chọn.

---

## 2. Tiêu chuẩn Hình học & Nhân trắc học (Anthropometric Standards)

Mọi mô hình Avatar AI muốn tích hợp vào Dáng Việt cần tuân thủ các chỉ số nhân trắc học nữ trưởng thành Việt Nam:

### 2.1 Hệ trục tọa độ và Kích thước
- **Đơn vị hệ thống (Scene Unit):** Metric (Mét), Unit Scale = `1.0`.
- **Hệ trục tọa độ chuẩn glTF 2.0:**
  - Trục $+Y$: Hướng lên trên (đỉnh đầu).
  - Trục $+Z$: Hướng ra phía trước (hướng nhìn của nhân vật).
  - Trục $+X$: Hướng sang bên phải nhân vật.
- **Gốc tọa độ (Origin Point):** Đặt tại $(0, 0, 0)$ trên mặt đất, chính giữa hai gót chân.
- **Chiều cao tiêu chuẩn:** $1.60\text{m} - 1.70\text{m}$ (ngưỡng chấp nhận trong pipeline: $1.50\text{m} - 1.80\text{m}$).
  - *Mô hình tham chiếu V2 (`avatar_v2.glb`):* $1.643\text{m}$.
  - *Mô hình tham chiếu cơ bản (`avatar_base.glb`):* $1.669\text{m}$.
- **Tư thế chuẩn (Rest Pose):** A-pose (hai cánh tay dang nghiêng $30^\circ - 45^\circ$, lòng bàn tay úp hoặc hướng nhẹ về trước, hai chân đứng thẳng song song cách nhau $15\text{cm} - 20\text{cm}$).

### 2.2 Tối ưu hóa Mesh (Topology & Budget)
- **Số lượng tam giác (Polygon Count):** Khuyến nghị $30,000 - 80,000$ triangles (tối đa không vượt quá $120,000$ triangles).
- **Pháp tuyến đỉnh (Vertex Normals):** Bắt buộc phải là vector đơn vị ($\|\vec{n}\| = 1.0$), không chứa vector suy biến $(0, 0, 0)$ để vượt qua kiểm định `ACCESSOR_VECTOR3_NON_UNIT` của Khronos glTF Validator.

---

## 3. Tiêu chuẩn Morph Targets & Bảng quy đổi Danh xưng (Aliases)

Để phối hợp đồng bộ với 6 vóc dáng cơ thể trong Dáng Việt (`standard`, `petite`, `tall_slender`, `broad_shoulders`, `curvy_hips`, `plus_size`), mesh của Avatar cần chứa các Shape Keys (Morph Targets) tương ứng.

Hệ thống tích hợp sẵn từ điển ánh xạ thông minh (`MORPH_ALIASES`), tự động nhận diện các danh xưng thông dụng từ các công cụ AI:

| Morph Target Chuẩn Dáng Việt | Danh xưng từ AI ngoài được hỗ trợ tự động | Ý nghĩa Nhân trắc học |
|---|---|---|
| `morph_petite` | `petite`, `slender_short`, `short`, `body_petite` | Thu nhỏ chiều cao về 1.56m, thu gọn khung xương vai và ngực |
| `morph_tall_slender` | `tall_slender`, `tall`, `slender_tall`, `body_tall` | Kéo dài chiều cao lên 1.72m, kéo dài chân, eo thon gọn |
| `morph_broad_shoulders` | `broad_shoulders`, `shoulders_wide`, `wide_shoulder` | Mở rộng bờ vai ngang thêm +2.4cm mỗi bên ($Y \in [1.25\text{m}, 1.45\text{m}]$) |
| `morph_curvy_hips` | `curvy_hips`, `hips_wide`, `wide_hip`, `body_curvy` | Mở rộng hông +2.8cm tại $Y \in [0.75\text{m}, 1.02\text{m}]$, thắt eo |
| `morph_plus_size` | `plus_size`, `full_body`, `heavy`, `body_plus` | Làm đầy đặn thân người +18% chiều ngang ($X$) và +20% chiều sâu ($Z$) |

*Lưu ý:* Nếu mô hình AI thiếu một số morph targets, Avatar vẫn có thể hiển thị ở dáng `standard`, nhưng các vóc dáng thiếu morph sẽ được đánh dấu `unsupported` trên ma trận tương thích.

---

## 4. Điểm neo Phụ kiện (Attachment Sockets)

Hệ thống xác định vị trí phụ kiện trang sức (mấn đội đầu, chuỗi ngọc, nón lá, túi cói, guốc mộc) thông qua 5 điểm neo giải phẫu:

1. `head` $(0, 1.604, -0.010)$: Đỉnh đầu (crown) $\rightarrow$ Dành cho Mấn, Nón lá.
2. `neck` $(0, 1.374, -0.012)$: Xương quai xanh / cổ (clavicle) $\rightarrow$ Dành cho Chuỗi ngọc.
3. `right_hand` $(+0.903, 0.761, 0.000)$: Cổ tay phải $\rightarrow$ Dành cho Quạt xếp, Túi cói.
4. `left_hand` $(-0.903, 0.761, 0.000)$: Cổ tay trái $\rightarrow$ Dành cho Phụ kiện cầm tay.
5. `feet` $(0, 0.002, 0.015)$: Tiếp giáp mặt sàn $\rightarrow$ Dành cho Guốc mộc.

### Cơ chế Deformed Sockets Tracking
Khi người dùng thay đổi thanh trượt vóc dáng, `MorphController.getSocketTransform` tự động tính toán bù trừ tọa độ điểm neo thời gian thực:
- Khi chuyển sang dáng `plus_size`: Socket `right_hand` tự động dạt ra ngoài theo trục $+X$ ($+0.05\text{m}$), socket `left_hand` dạt theo trục $-X$ ($-0.05\text{m}$) để phụ kiện cầm tay không bị xuyên vào hông và đùi.
- Khi chuyển sang dáng `tall_slender`: Socket `head` và `neck` tự động nâng cao theo trục $+Y$ ($+0.07\text{m}$ và $+0.04\text{m}$).

---

## 5. Quy tắc Bảo toàn Vật liệu & Texture (Material Preservation)

Nhiều công cụ tạo ảnh AI sinh ra mô hình với texture màu da/tóc tả thực nướng sẵn (baked texture). Pipeline Dáng Việt tuân thủ nguyên tắc **Bảo toàn chi tiết gốc**:
- Khi nạp mesh: `MaterialFactory` và `AvatarInstance` kiểm tra xem primitive có gắn `baseColorTexture` hay không.
- **Có texture gốc:** Hệ thống nhân nhẹ hệ số phối màu (color tint) hoặc bảo lưu nguyên bản bản đồ vân bề mặt, **tuyệt đối không đè màu phẳng (flat color)** làm bẹp chi tiết sống động của khuôn mặt và làn da.
- **Không có texture gốc:** Áp dụng màu da/tóc mặc định từ bảng cấu hình (`Avatar_Skin`: `#ebba9e`, `Avatar_Hair`: `#0d0a0a`, `Avatar_Eyes`: `#1f140d`).
- **Cô lập Instance:** Mỗi khung nhìn 3D clone vật liệu riêng biệt, không mutate trực tiếp cache chia sẻ giữa Phòng phối và Modal so sánh.

---

## 6. Quy trình Nhập Avatar Từng Bước (Step-by-Step Workflow)

### Bước 1: Kiểm tra tính hợp lệ bằng CLI (Inspect)
Chạy lệnh kiểm định chỉ đọc trên tệp `.glb` vừa tải về từ công cụ AI:
```bash
node scripts/avatar-pipeline.mjs inspect "path/to/my_avatar.glb"
```
Hoặc xuất báo cáo định dạng JSON để tích hợp tự động:
```bash
node scripts/avatar-pipeline.mjs inspect "path/to/my_avatar.glb" --json
```

**Bảng tiêu chí thẩm định tự động:**
- Header nhị phân glTF 2.0 (`magic: 0x46546C67`, `version: 2`).
- Kiểm tra toàn vẹn Khronos glTF Validator: 0 Error.
- Bounding Box AABB: Chiều cao nằm trong khoảng $1.50\text{m} - 1.80\text{m}$.
- Phát hiện các Morph Targets chuẩn hoặc alias tương ứng.
- Đếm số lượng material slots và phát hiện texture maps.
- Kiểm tra 5 điểm neo phụ kiện (sockets).

### Bước 2: Xem trước và Thẩm định Trực quan trên Web (Avatar Inspector)
1. Khởi động môi trường phát triển:
   ```bash
   npm run dev
   ```
2. Truy cập thanh điều hướng trên cùng, chọn tab **"Thẩm định Avatar"** (URL route: `/inspector`).
3. Các công cụ hỗ trợ thẩm định trên giao diện:
   - **4 Góc máy ảnh chuẩn:** Trước (Front), Nghiêng (Side), Sau (Back), Góc 3/4 (Perspective).
   - **Nút Fit Bounds:** Tự động định vị và zoom camera bao trọn nhân vật theo kích thước thực tế.
   - **Công tắc Khung dây (Wireframe):** Phân tích mật độ lưới đa giác, phát hiện tam giác méo hoặc lỗi cực đỉnh.
   - **5 Thanh trượt Morphs:** Thử nghiệm biến dạng cơ thể từ 0% đến 100% để kiểm tra độ mượt mà.
   - **Gizmo Điểm neo Phụ kiện:** Bật hiển thị các khối cầu màu đánh dấu vị trí `head`, `neck`, `right_hand`, `left_hand`, `feet`.
   - **Bảng Thống kê Kỹ thuật:** Hiển thị chiều cao đo được, số slot vật liệu, mã băm SHA-256.

### Bước 3: Đăng ký Avatar vào Hệ thống (Register)
Sau khi asset đã đạt chuẩn kiểm định kỹ thuật và thẩm mỹ, thực hiện đăng ký chính thức:
```bash
node scripts/avatar-pipeline.mjs register "path/to/my_avatar.glb" --id "avatar_tripo_01" --version "1.0.0" --name "Avatar Nữ Tripo AI Hiện Đại"
```

**Hệ thống sẽ tự động thực hiện các thao tác an toàn:**
1. Chạy lại toàn bộ bộ kiểm tra `inspect`. Dừng ngay nếu phát hiện lỗi vi phạm.
2. Tính toán mã băm mật mã SHA-256 của tệp GLB.
3. Sao chép tệp an toàn vào thư mục: `apps/web/public/models/avatars/avatar_tripo_01_1.0.0.glb`.
4. Cập nhật nguyên tử (atomic update qua file tạm và `renameSync`) danh mục `apps/web/public/models/catalog_manifest.json`.
5. Tạo ma trận tương thích khởi điểm: Khởi tạo trạng thái `untested` cho tất cả các mẫu áo dài hiện có.

### Bước 4: Kiểm thử Tương thích trong Phòng Phối Đồ (Outfit Room)
- Mở tab **Phòng phối**, chọn Avatar mới từ thanh công cụ nhân vật.
- Quan sát huy hiệu tương thích ở thanh điều khiển trên:
  - Nếu hiển thị `[Chưa thử nghiệm]` màu vàng: Mặc thử các mẫu áo và quần lụa, di chuyển thanh trượt 6 vóc dáng để kiểm tra xem có hiện tượng xuyên thủng vải (clipping) hay không.
  - Khi đã xác nhận phom dáng vừa vặn hoàn hảo, cập nhật bản ghi trong `catalog_manifest.json` từ `untested` thành `verified`.

---

## 7. Xử lý Lỗi Thường Gặp (Troubleshooting)

### 7.1 Lỗi `ERR_INVALID_GLTF` (Tệp không phải định dạng glTF nhị phân hợp lệ)
- **Hiện tượng:** CLI báo lỗi `Header magic không hợp lệ: 0x...`.
- **Nguyên nhân:** Tệp tải về bị hỏng, tải chưa xong, hoặc tệp định dạng OBJ/FBX/JSON ASCII đổi đuôi thành `.glb`.
- **Khắc phục:** Mở tệp trong Blender, kiểm tra xem mesh có hiển thị đúng hay không, sau đó chọn `File -> Export -> glTF 2.0 (.glb)`.

### 7.2 Lỗi `ERR_KHRONOS_VALIDATION` (Vi phạm quy chuẩn Khronos glTF 2.0)
- **Hiện tượng:** `ACCESSOR_VECTOR3_NON_UNIT: Normal vector has non-unit length`.
- **Nguyên nhân:** Đỉnh tóc cực bắc hoặc đỉnh chóp nón lá có các mặt tam giác suy biến làm tổng vector tích lũy bằng $(0, 0, 0)$.
- **Khắc phục:** Trong Blender, chọn Edit Mode $\rightarrow$ Mesh $\rightarrow$ Normals $\rightarrow$ Recalculate Outside ($Shift + N$). Hoặc áp dụng thuật toán phục hồi cực đỉnh trong `avatar-mesh.mjs`.

### 7.3 Lỗi `ERR_OUT_OF_BOUNDS` (Kích thước nhân vật vượt chuẩn)
- **Hiện tượng:** Chiều cao đo được nằm ngoài khoảng $[1.50\text{m}, 1.80\text{m}]$ (ví dụ: $164\text{m}$ do đơn vị centimet hoặc $0.16\text{m}$).
- **Khắc phục:** Trong Blender, chuyển đơn vị Scene Unit sang Metric, tỷ lệ $1.0$. Thu phóng (Scale) mô hình về đúng chiều cao thực tế ($1.64\text{m}$), sau đó bắt buộc nhấn $Ctrl + A \rightarrow \text{Apply All Transforms}$.

### 7.4 Lỗi `ERR_MISSING_MORPHS` (Thiếu shape keys vóc dáng)
- **Hiện tượng:** CLI cảnh báo thiếu các morph targets chuẩn.
- **Khắc phục:** Nếu không thể bổ sung shape keys trong DCC, Avatar vẫn được đăng ký nhưng sẽ bị hạn chế chỉ sử dụng được ở vóc dáng `standard`. Các vóc dáng khác sẽ hiển thị cảnh báo `unsupported`.
