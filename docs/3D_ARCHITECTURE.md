# DÁNG VIỆT — KIẾN TRÚC MÔ PHỎNG 3D NHÂN VẬT & VIỆT PHỤC (3D ARCHITECTURE SPECIFICATION)

**Dự án:** Dáng Việt (viet-phoi)  
**Tài liệu:** Thiết kế kiến trúc chuyển đổi 3D  
**Ngày phát hành:** 2026-09-28  
**Trạng thái:** Được phê duyệt thực thi  

---

## 1. Mục tiêu và Giới hạn phạm vi (Scope & Boundaries)

### 1.1 Mục tiêu chính
Nâng cấp trải nghiệm tương tác trang phục Áo dài từ đồ họa vector 2D (SVG) sang không gian 3D thời gian thực với nhân vật có tỷ lệ giải phẫu tự nhiên:
- Xem nhân vật 3D toàn thân, xoay 360°, thu phóng và các góc xem tiêu chuẩn (trước, sau, trái, phải, góc 3/4).
- Quan sát đa vóc dáng với tối thiểu 5 preset hình thể tự nhiên (`petite`, `tall_slender`, `broad_shoulders`, `curvy_hips`, `plus_size`).
- Trang phục áo dài và quần biến dạng đồng bộ (synchronized deformation via morph targets) theo từng vóc dáng người mẫu, triệt tiêu hiện tượng xuyên lưới (mesh clipping).
- Đổi màu sắc, vật liệu PBR (Lụa Hà Đông bóng mịn, Gấm Huế dệt hoa văn, Linen tự nhiên, Voan mỏng), hoa văn bề mặt và phụ kiện.
- Bảo tồn toàn bộ tính năng cốt lõi: Khóa thuộc tính (Locks), Giao dịch lệnh tuần tự (Command Bus OCC), Hoàn tác (Undo/Redo), Trợ lý AI (9router Gateway), Lookbook và So sánh 2 bộ.
- Kiến trúc Catalog-Driven: Mẫu áo dài được định nghĩa qua Manifest JSON, mở rộng thêm mẫu mới mà không phải sửa lõi renderer.

### 1.2 Giới hạn kỹ thuật rõ ràng (Non-goals)
- Không giả lập vật lý vải mềm thời gian thực phức tạp (realtime cloth simulation / mass-spring / FEM); sử dụng phom dáng và nếp vải 3D được dựng thẩm mỹ có chủ ý.
- Không nhận số đo cơ thể người dùng để cam kết “vừa vặn may đo ngoài đời”; chỉ mang tính chất mô phỏng phối dáng trực quan.
- Không thay thế hoàn toàn SVG: Giữ SVG làm renderer 2D dự phòng khi thiết bị không hỗ trợ WebGL hoặc khi mẫu thiết kế chưa có bản dựng 3D.

---

## 2. Thư viện và Tính tương thích (Dependencies & Compatibility)

Căn cứ trên nền tảng hiện hữu (`react@18.3.1`, `react-dom@18.3.1`, `vite@5.4.3`):

| Thư viện | Phiên bản chọn dùng | Lý do tương thích & Kiến trúc |
|---|---|---|
| `three` | `0.169.0` | Thư viện WebGL 3D tiêu chuẩn, tương thích glTF 2.0 PBR, Sheen, Morph Targets, KHR_materials_variants |
| `@types/three` | `0.169.0` | Định nghĩa TypeScript đồng bộ phiên bản Three.js |
| `@react-three/fiber` | `8.17.10` | Phiên bản R3F dành riêng cho React 18 (PeerDep: `react: >=18.0`). Tránh xung đột React 19 của R3F v9 |
| `@react-three/drei` | `9.114.0` | Bộ tiện ích chuyên sâu: `OrbitControls`, `useGLTF`, `Center`, `ContactShadows`, `Environment` |

Quy tắc: Không cài cẩu thả `latest`, không dùng `--force` hoặc `--legacy-peer-deps`. Tất cả dependencies được giải quyết tương thích 100%.

---

## 3. Cấu trúc Avatar, Garment & Material

### 3.1 Hệ thống Tọa độ và Tỷ lệ chuẩn (Runtime Units & Conventions)
- **Đơn vị runtime:** Mét ($1.0 = 100\text{ cm}$).
- **Trục tọa độ:** Chuẩn glTF / Three.js (Trục $Y$ hướng lên trên, $Z$ hướng về phía trước camera, $X$ hướng sang phải).
- **Mặt sàn:** $Y = 0.0\text{ m}$. Bàn chân nhân vật tiếp xúc chính xác tại $Y = 0$.
- **Chiều cao cơ sở nhân vật nữ:** $1.65\text{ m}$ (Tỷ lệ đầu/thân khoảng $1 : 7.2$).
- **Tư thế gốc (Rest Pose):** A-pose nhẹ nhàng tự nhiên (hai tay mở góc 25° cách thân, bàn tay thả lỏng, không duỗi ngang T-pose thô cứng).

### 3.2 Phân rã Mesh & Node Hierarchy
```
AvatarScene (Root)
 ├── AvatarModel (Skinned/Morph Group)
 │    ├── Head_Hair_Mesh (Vùng đầu, khuôn mặt, búi tóc truyền thống)
 │    └── Body_Skin_Mesh (Cổ, vai, cánh tay, bàn tay, ngực, eo, hông, chân)
 ├── GarmentModel (Mẫu áo dài)
 │    ├── AoDai_Collar_Mesh (Cổ đứng truyền thống / Cổ thuyền / Cổ tròn)
 │    ├── AoDai_FrontFlap_Mesh (Thân & tà trước xẻ từ eo)
 │    ├── AoDai_BackFlap_Mesh (Thân & tà sau)
 │    ├── AoDai_Sleeves_Mesh (Tay dài / Tay raglan / Tay lỡ)
 │    └── AoDai_Pants_Mesh (Quần lụa ống rộng hai ống riêng biệt)
 └── Accessories (Attachment Points / Sockets)
      ├── Socket_Head (Vị trí mấn / nón lá)
      ├── Socket_Neck (Vị trí chuỗi ngọc)
      ├── Socket_Hand_Right (Vị trí quạt xếp / túi cói)
      └── Socket_Feet (Vị trí guốc mộc)
```

### 3.3 Hệ thống Vật liệu PBR (Physically Based Rendering)
- **Silk Hà Đông (`silk_ha_dong`):** Roughness thấp ($0.35$), Sheen color mềm mại ($0.4$), bắt sáng óng ả theo góc nhìn Fresnel, không bóng giả nhựa.
- **Brocade Huế (`brocade_hue`):** Roughness vừa ($0.55$), Normal map mô phỏng gân chỉ thêu và ánh kim thổ cẩm lấp lánh nhẹ ($0.15$).
- **Linen đương đại (`linen_modern`):** Roughness cao ($0.85$), Normal map vân sợi dệt tự nhiên, mờ lì nhã nhặn.
- **Voan Chiffon (`voile_chiffon`):** Bề mặt mỏng nhẹ, độ truyền quang tinh tế với alpha transparency có kiểm soát thứ tự render (depth write).

---

## 4. Chiến lược Biến dạng Vóc dáng (Body Morph Targets & Garment Fitting)

### 4.1 Danh mục 5 Preset Vóc dáng Chuẩn mực
Thiết kế theo ngôn ngữ trung tính, tôn vinh nét đẹp đa dạng của người phụ nữ Việt Nam:
1. `petite` (Nhỏ nhắn): Chiều cao $1.56\text{ m}$, khung xương vai và eo thon gọn.
2. `tall_slender` (Cao thanh): Chiều cao $1.72\text{ m}$, dáng vóc dong dỏng, tà áo và quần dài suôn.
3. `broad_shoulders` (Khung vai rộng): Bờ vai mở rộng đĩnh đạc, cầu vai ngang.
4. `curvy_hips` (Hông nở): Vòng hông nở nang, tạo đường lượn tà áo chữ S mềm mại.
5. `plus_size` (Đầy đặn): Thân hình đẫy đà, vòng eo và bắp tay tròn trịa.

### 4.2 Đồng bộ Morph Target giữa Avatar và Áo Dài
- Cả `Body_Skin_Mesh`, `AoDai_FrontFlap_Mesh`, `AoDai_BackFlap_Mesh`, `AoDai_Sleeves_Mesh` và `AoDai_Pants_Mesh` đều được tích hợp **5 Morph Targets tương ứng**:
  - `morph_petite`
  - `morph_tall_slender`
  - `morph_broad_shoulders`
  - `morph_curvy_hips`
  - `morph_plus_size`
- Khi người dùng chọn preset vóc dáng hoặc tinh chỉnh trọng số $\alpha_k \in [0, 1]$, hệ thống truyền đồng thời $\alpha_k$ vào toàn bộ mesh cây 3D:
  $$\text{Position}_{\text{deformed}} = \text{Position}_{\text{base}} + \sum_{k=1}^5 \alpha_k \cdot \Delta \text{Morph}_k$$
- **Lợi ích:** Áo dài và cơ thể giãn nở theo cùng vector gradient tại các điểm nách, eo, hông; bảo đảm tà áo không bao giờ cắt phạm vào đùi hay hông nhân vật.

---

## 5. Nguồn Asset, Tiêu chuẩn & Giấy phép (Assets & Provenance)

- **Nguyên tắc:** 100% asset có nguồn gốc pháp lý minh bạch, được xây dựng thủ công hoặc cấp phép tương thích mã nguồn mở (CC-BY-4.0 / MIT / Dáng Việt Cultural Commons).
- **Bộ Avatar cơ sở:** Hình học giải phẫu người mẫu Việt Nam tỷ lệ chuẩn Á Đông, tối ưu topology Low-Mid Poly (~12,000 tris cho avatar, ~8,000 tris cho áo dài & quần).
- **Bộ Áo Dài cơ sở #1 (Mã: `aodai_classic_01`):** Áo dài ngũ thân / tân thời truyền thống cổ đứng 3.5cm, tay dài, tà dài qua gối, quần suông trắng.
- **Bộ Áo Dài cách tân #2 (Mã: `aodai_remix_raglan`):** Áo dài cổ thuyền cách tân, tay raglan ôm vai thanh thoát, vạt áo hiện đại.
- **Phụ kiện 3D:** Mấn đội đầu truyền thống (`man_truyen_thong`), nón lá bài thơ (`non_la`), chuỗi ngọc đeo cổ (`chuoi_ngoc`), quạt xếp cầm tay (`quat_xep`).

---

## 6. Lộ trình Triển khai & Tiêu chí Nghiệm thu (Milestones)

- **Mốc 1 (Audit & Arch):** Hoàn thành tài liệu kiến trúc, kiểm tra dependencies và khóa tương thích.
- **Mốc 2 (Bộ 3D đầu tiên):** Avatar chuẩn + Áo dài cơ bản + Quần + Camera Studio 360° + Zoom + PBR Material.
- **Mốc 3 (5 Dáng người & Morphing):** Tích hợp 5 preset vóc dáng, đồng bộ morphing áo dài và quần, triệt tiêu xuyên lưới.
- **Mốc 4 (Catalog & Mẫu thứ hai):** Viết `docs/3D_ASSET_PIPELINE.md`, công cụ kiểm tra manifest validator, tích hợp mẫu áo thứ hai (`aodai_remix_raglan`).
- **Mốc 5 (Tích hợp State & AI):** Command bus hỗ trợ `SET_BODY_SHAPE`, `SET_GARMENT_MODEL`, Lookbook lưu 3D snapshot, 2D SVG fallback.
- **Mốc 6 (Kiểm thử & Báo cáo):** Chụp screenshot đa viewport, kiểm thử Playwright, đo FPS, cập nhật `docs/PROGRESS.md`.
