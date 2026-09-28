# QUY TRÌNH SẢN XUẤT VÀ NẠP ASSET 3D DÁNG VIỆT (3D ASSET PIPELINE)

**Dự án:** Dáng Việt (viet-phoi)  
**Tài liệu:** Hướng dẫn kỹ thuật dựng hình Blender & Đóng gói glTF 2.0  
**Ngày phát hành:** 2026-09-28  

---

## 1. Mục đích và Tiêu chuẩn Chung

Tài liệu này chuẩn hóa quy trình tạo dựng, xuất khẩu và tích hợp mô hình 3D (Avatar người mẫu, Áo dài, Quần lụa, Phụ kiện) vào hệ thống Dáng Việt theo kiến trúc **Catalog-Driven**, cho phép thêm mẫu mới mà không phải viết lại mã nguồn renderer.

---

## 2. Quy ước Blender (Dành cho 3D Artists)

### 2.1 Hệ trục và Đơn vị
- **Scene Unit:** Metric, Unit Scale: `1.0` (1 Blender Unit = 1 Mét).
- **Trục tọa độ:**
  - $Y$ hướng lên trên (Up axis = $+Y$).
  - $Z$ hướng ra trước mặt nhân vật (Forward axis = $+Z$).
  - $X$ hướng sang tay phải nhân vật (Right axis = $+X$).
- **Gốc tọa độ (Origin):** Đặt tại $(0, 0, 0)$ trên mặt sàn, nằm chính giữa hai gót chân của avatar.

### 2.2 Quy ước Đặt tên Node & Mesh Hierarchy
| Đối tượng | Tên Node / Mesh | Ghi chú |
|---|---|---|
| Avatar Cơ Thể | `Avatar_Base_Node` / `Avatar_Base_Mesh` | Chứa da mặt, cổ, tay, thân, chân, búi tóc |
| Áo Dài | `AoDai_[ModelId]_Node` / `AoDai_[ModelId]_Mesh` | VD: `AoDai_Classic_01_Mesh` |
| Quần Lụa | `Pants_Silk_Node` / `Pants_Silk_Mesh` | Quần suông hai ống rộng riêng biệt |
| Mấn đội đầu | `Accessory_Man_Node` / `Accessory_Man_Mesh` | Gắn tại socket `head` |
| Nón lá | `Accessory_NonLa_Node` / `Accessory_NonLa_Mesh` | Gắn tại socket `head` |
| Chuỗi ngọc | `Accessory_ChuoiNgoc_Node` / `Accessory_ChuoiNgoc_Mesh` | Gắn tại socket `neck` |
| Quạt xếp | `Accessory_QuatXep_Node` / `Accessory_QuatXep_Mesh` | Gắn tại socket `hand_right` |

### 2.3 Bắt buộc 5 Morph Targets (Shape Keys)
Mọi mesh trang phục (`AoDai` và `Pants`) **bắt buộc** phải có cùng 5 Morph Targets với cùng tên chính xác như Avatar để đồng bộ biến dạng qua GPU:
1. `morph_petite`: Thu nhỏ chiều cao về 1.56m, thu gọn khung xương vai và eo 10%.
2. `morph_tall_slender`: Kéo dài chiều cao lên 1.72m, kéo dài chân, eo thon gọn.
3. `morph_broad_shoulders`: Mở rộng bờ vai ngang thêm +2.4cm mỗi bên tại $Y \in [1.25\text{m}, 1.45\text{m}]$.
4. `morph_curvy_hips`: Mở rộng hông +2.8cm tại $Y \in [0.75\text{m}, 1.02\text{m}]$, giữ thắt eo.
5. `morph_plus_size`: Làm đầy đặn thân người +18% chiều ngang ($X$) và +20% chiều sâu ($Z$).

---

## 3. Cấu hình Vật liệu PBR (Principled BSDF)

- **Nguyên tắc:** Dùng shader `Principled BSDF` chuẩn của Blender.
- **Vải Lụa Hà Đông:** Roughness `0.35 - 0.40`, Sheen `0.40`, Metallic `0.0`.
- **Vải Gấm Huế:** Roughness `0.50 - 0.55`, Metallic `0.10 - 0.20`.
- **Vải Linen:** Roughness `0.80 - 0.90`, Metallic `0.0`.
- **Vải Voan Chiffon:** Roughness `0.30`, Alpha Transmission `0.45` (Blend mode: Alpha Blend).

---

## 4. Xuất file Khronos glTF Binary (.glb)

Trong hộp thoại **File > Export > glTF 2.0 (.glb)** của Blender:
1. **Format:** `glTF Binary (.glb)`
2. **Include:** Selected Objects, Custom Properties.
3. **Transform:** $+Y$ Up.
4. **Geometry:**
   - [x] Apply Modifiers
   - [x] Normals
   - [x] UVs
   - [x] Shape Keys (Morph Targets) — *Bắt buộc*
   - [ ] Compression (Tắt Draco compression để tăng tốc giải mã runtime hoặc nén nhẹ)

---

## 5. Quy trình Đăng ký Mẫu mới vào Catalog Manifest

Khi thêm một mẫu áo dài mới (Ví dụ: `aodai_remix_raglan`):
1. Đặt file `.glb` vào thư mục `apps/web/public/models/`.
2. Mở file `apps/web/public/models/catalog_manifest.json`.
3. Thêm cấu hình mẫu vào mảng `models`:
```json
{
  "id": "aodai_remix_raglan",
  "name": "Áo Dài Cổ Thuyền Tay Raglan Cách Tân",
  "category": "modern",
  "meshUrl": "/models/aodai_remix_raglan.glb",
  "pantsUrl": "/models/pants_silk.glb",
  "avatarUrl": "/models/avatar_base.glb",
  "features": {
    "collar": "Cổ thuyền thanh thoát",
    "sleeve": "Tay raglan ôm vai",
    "flaps": "Tà lỡ midi hiện đại xẻ eo",
    "pants": "Quần lụa ống rộng hai ống"
  },
  "supportedMorphs": [
    "morph_petite",
    "morph_tall_slender",
    "morph_broad_shoulders",
    "morph_curvy_hips",
    "morph_plus_size"
  ]
}
```

---

## 6. Công cụ Kiểm tra Tự Động (Asset Validator)

Trước khi commit mã nguồn hoặc đẩy lên production, luôn chạy:
```bash
node scripts/validate-3d-assets.mjs
```
Kịch bản sẽ tự động xác minh:
- Tiêu đề nhị phân glTF 2.0 hợp lệ (`0x46546C67`).
- Đủ 5 morph targets bắt buộc.
- Kích thước file không vượt ngưỡng ngân sách (< 5MB mỗi asset, thực tế ~60KB - 90KB).
- Tọa độ đỉnh, normal và bounding box không bị lỗi số học (NaN, Infinity).
