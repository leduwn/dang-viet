/**
 * Master Script to Generate All 3D Binary GLB Assets and Catalog Manifest
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { GlbBuilder } from './glb-writer.mjs';
import { generateAvatarGeometry } from './avatar-mesh.mjs';
import { generateAoDaiGeometry, generatePantsGeometry } from './garment-mesh.mjs';
import {
  generateManGeometry,
  generateNonLaGeometry,
  generateChuoiNgocGeometry,
  generateQuatXepGeometry,
} from './accessories-mesh.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const OUTPUT_DIR = path.join(ROOT_DIR, 'apps/web/public/models');

console.log('[3D Builder] Output target directory:', OUTPUT_DIR);

function buildMeshGlb({
  name,
  geom,
  material = { name: 'DefaultMaterial', baseColor: [1, 1, 1, 1] },
}) {
  const builder = new GlbBuilder();
  const matIdx = builder.addMaterial(material);

  const posAcc = builder.addFloatAttributes(geom.positions, 3);
  const normAcc = builder.addFloatAttributes(geom.normals, 3);
  const uvAcc = builder.addFloatAttributes(geom.uvs, 2);
  const idxAcc = builder.addIndices(geom.indices);

  const attributes = {
    POSITION: posAcc,
    NORMAL: normAcc,
    TEXCOORD_0: uvAcc,
  };

  const targets = [];
  if (geom.morphDeltas && geom.morphDeltas.length > 0) {
    for (const delta of geom.morphDeltas) {
      const deltaPosAcc = builder.addFloatAttributes(delta, 3);
      targets.push({ POSITION: deltaPosAcc });
    }
  }

  const primitive = {
    attributes,
    indices: idxAcc,
    material: matIdx,
  };
  if (targets.length > 0) {
    primitive.targets = targets;
  }

  const weights = targets.length > 0 ? targets.map(() => 0.0) : undefined;
  const meshIdx = builder.addMesh({
    name: `${name}_Mesh`,
    primitives: [primitive],
    weights,
    targetNames: geom.targetNames,
  });

  const nodeIdx = builder.addNode({
    name: `${name}_Node`,
    mesh: meshIdx,
  });

  builder.scenes[0].nodes.push(nodeIdx);
  return builder;
}

// 1. Generate Avatar Base
console.log('Generating: avatar_base.glb...');
const avatarGeom = generateAvatarGeometry();
const avatarBuilder = buildMeshGlb({
  name: 'Avatar_Base',
  geom: avatarGeom,
  material: {
    name: 'SkinMaterial',
    baseColor: [0.93, 0.82, 0.74, 1.0], // Natural East Asian skin tone
    roughness: 0.65,
    metalness: 0.0,
  },
});
const avatarBytes = avatarBuilder.writeToFile(path.join(OUTPUT_DIR, 'avatar_base.glb'));
console.log(`  ✓ avatar_base.glb (${avatarBytes} bytes, ${avatarGeom.positions.length / 3} vertices)`);

// 2. Generate Classic Ao Dai (aodai_classic_01.glb)
console.log('Generating: aodai_classic_01.glb...');
const classicGeom = generateAoDaiGeometry({
  collarType: 'high_stand',
  sleeveType: 'long',
  flapLength: 'long',
});
const classicBuilder = buildMeshGlb({
  name: 'AoDai_Classic_01',
  geom: classicGeom,
  material: {
    name: 'AoDaiMaterial',
    baseColor: [0.92, 0.22, 0.16, 1.0], // Đỏ son hoàng gia
    roughness: 0.40,
    metalness: 0.05,
    doubleSided: true,
  },
});
const classicBytes = classicBuilder.writeToFile(path.join(OUTPUT_DIR, 'aodai_classic_01.glb'));
console.log(`  ✓ aodai_classic_01.glb (${classicBytes} bytes, ${classicGeom.positions.length / 3} vertices)`);

// 3. Generate Modern Raglan Ao Dai (aodai_remix_raglan.glb)
console.log('Generating: aodai_remix_raglan.glb...');
const raglanGeom = generateAoDaiGeometry({
  collarType: 'boat',
  sleeveType: 'raglan',
  flapLength: 'midi',
});
const raglanBuilder = buildMeshGlb({
  name: 'AoDai_Remix_Raglan',
  geom: raglanGeom,
  material: {
    name: 'AoDaiMaterial',
    baseColor: [0.95, 0.95, 0.95, 1.0], // Trắng tinh khôi
    roughness: 0.35,
    metalness: 0.02,
    doubleSided: true,
  },
});
const raglanBytes = raglanBuilder.writeToFile(path.join(OUTPUT_DIR, 'aodai_remix_raglan.glb'));
console.log(`  ✓ aodai_remix_raglan.glb (${raglanBytes} bytes, ${raglanGeom.positions.length / 3} vertices)`);

// 4. Generate Silk Pants (pants_silk.glb)
console.log('Generating: pants_silk.glb...');
const pantsGeom = generatePantsGeometry();
const pantsBuilder = buildMeshGlb({
  name: 'Pants_Silk',
  geom: pantsGeom,
  material: {
    name: 'PantsMaterial',
    baseColor: [0.98, 0.98, 0.98, 1.0], // Quần trắng ngà lụa
    roughness: 0.45,
    metalness: 0.0,
    doubleSided: true,
  },
});
const pantsBytes = pantsBuilder.writeToFile(path.join(OUTPUT_DIR, 'pants_silk.glb'));
console.log(`  ✓ pants_silk.glb (${pantsBytes} bytes, ${pantsGeom.positions.length / 3} vertices)`);

// 5. Generate Accessories
const ACCESSORIES_DIR = path.join(OUTPUT_DIR, 'accessories');
fs.mkdirSync(ACCESSORIES_DIR, { recursive: true });

// 5.1 Mấn đội đầu
console.log('Generating: accessories/man_truyen_thong.glb...');
const manGeom = generateManGeometry();
const manBuilder = buildMeshGlb({
  name: 'Accessory_Man',
  geom: manGeom,
  material: {
    name: 'ManMaterial',
    baseColor: [0.95, 0.78, 0.25, 1.0], // Vàng ánh kim gấm
    roughness: 0.50,
    metalness: 0.20,
    doubleSided: true,
  },
});
manBuilder.writeToFile(path.join(ACCESSORIES_DIR, 'man_truyen_thong.glb'));

// 5.2 Nón lá
console.log('Generating: accessories/non_la.glb...');
const nonLaGeom = generateNonLaGeometry();
const nonLaBuilder = buildMeshGlb({
  name: 'Accessory_NonLa',
  geom: nonLaGeom,
  material: {
    name: 'NonLaMaterial',
    baseColor: [0.92, 0.88, 0.76, 1.0], // Màu lá cọ khô tự nhiên
    roughness: 0.80,
    metalness: 0.0,
    doubleSided: true,
  },
});
nonLaBuilder.writeToFile(path.join(ACCESSORIES_DIR, 'non_la.glb'));

// 5.3 Chuỗi ngọc
console.log('Generating: accessories/chuoi_ngoc.glb...');
const ngocGeom = generateChuoiNgocGeometry();
const ngocBuilder = buildMeshGlb({
  name: 'Accessory_ChuoiNgoc',
  geom: ngocGeom,
  material: {
    name: 'NgocMaterial',
    baseColor: [0.98, 0.98, 0.96, 1.0], // Ngọc trai óng ánh
    roughness: 0.15,
    metalness: 0.10,
  },
});
ngocBuilder.writeToFile(path.join(ACCESSORIES_DIR, 'chuoi_ngoc.glb'));

// 5.4 Quạt xếp
console.log('Generating: accessories/quat_xep.glb...');
const quatGeom = generateQuatXepGeometry();
const quatBuilder = buildMeshGlb({
  name: 'Accessory_QuatXep',
  geom: quatGeom,
  material: {
    name: 'QuatMaterial',
    baseColor: [0.85, 0.75, 0.65, 1.0], // Giấy điệp / tre mộc
    roughness: 0.60,
    metalness: 0.0,
    doubleSided: true,
  },
});
quatBuilder.writeToFile(path.join(ACCESSORIES_DIR, 'quat_xep.glb'));

// 6. Write Catalog Manifest JSON
const catalogManifest = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  engine: 'Three.js 0.169.0 / React Three Fiber 8.17.10',
  conventions: {
    unit: 'meters',
    coordinateSystem: 'Y-up, Z-forward, X-right',
    groundPlaneY: 0.0,
    baseHeight: 1.65,
  },
  bodyPresets: [
    {
      id: 'standard',
      name: 'Chuẩn Á Đông',
      description: 'Tỷ lệ hình thể cân đối tự nhiên (1.65m)',
      weights: { morph_petite: 0, morph_tall_slender: 0, morph_broad_shoulders: 0, morph_curvy_hips: 0, morph_plus_size: 0 },
    },
    {
      id: 'petite',
      name: 'Nhỏ nhắn',
      description: 'Dáng vóc thanh mảnh, chiều cao ~1.56m',
      weights: { morph_petite: 1.0, morph_tall_slender: 0, morph_broad_shoulders: 0, morph_curvy_hips: 0, morph_plus_size: 0 },
    },
    {
      id: 'tall_slender',
      name: 'Cao thanh',
      description: 'Dáng người cao ráo dong dỏng, chiều cao ~1.72m',
      weights: { morph_petite: 0, morph_tall_slender: 1.0, morph_broad_shoulders: 0, morph_curvy_hips: 0, morph_plus_size: 0 },
    },
    {
      id: 'broad_shoulders',
      name: 'Khung vai rộng',
      description: 'Bờ vai mở rộng đĩnh đạc, cầu vai ngang tôn nét thanh tao',
      weights: { morph_petite: 0, morph_tall_slender: 0, morph_broad_shoulders: 1.0, morph_curvy_hips: 0, morph_plus_size: 0 },
    },
    {
      id: 'curvy_hips',
      name: 'Hông nở',
      description: 'Vòng hông nở nang, tạo đường cong lượn tà áo chữ S mềm mại',
      weights: { morph_petite: 0, morph_tall_slender: 0, morph_broad_shoulders: 0, morph_curvy_hips: 1.0, morph_plus_size: 0 },
    },
    {
      id: 'plus_size',
      name: 'Đầy đặn',
      description: 'Thân hình đẫy đà, đường nét tròn đầy quý phái',
      weights: { morph_petite: 0, morph_tall_slender: 0, morph_broad_shoulders: 0, morph_curvy_hips: 0, morph_plus_size: 1.0 },
    },
  ],
  models: [
    {
      id: 'aodai_classic_01',
      name: 'Áo Dài Cổ Đứng Truyền Thống',
      category: 'classic',
      meshUrl: '/models/aodai_classic_01.glb',
      pantsUrl: '/models/pants_silk.glb',
      avatarUrl: '/models/avatar_base.glb',
      features: {
        collar: 'Cổ đứng 3.5cm truyền thống',
        sleeve: 'Tay dài suôn',
        flaps: 'Tà dài qua gối xẻ eo',
        pants: 'Quần lụa ống rộng hai ống',
      },
      supportedMorphs: ['morph_petite', 'morph_tall_slender', 'morph_broad_shoulders', 'morph_curvy_hips', 'morph_plus_size'],
    },
    {
      id: 'aodai_remix_raglan',
      name: 'Áo Dài Cổ Thuyền Tay Raglan Cách Tân',
      category: 'modern',
      meshUrl: '/models/aodai_remix_raglan.glb',
      pantsUrl: '/models/pants_silk.glb',
      avatarUrl: '/models/avatar_base.glb',
      features: {
        collar: 'Cổ thuyền thanh thoát',
        sleeve: 'Tay raglan ôm vai',
        flaps: 'Tà lỡ midi hiện đại xẻ eo',
        pants: 'Quần lụa ống rộng hai ống',
      },
      supportedMorphs: ['morph_petite', 'morph_tall_slender', 'morph_broad_shoulders', 'morph_curvy_hips', 'morph_plus_size'],
    },
  ],
  accessories: [
    { id: 'man_truyen_thong', name: 'Mấn Đội Đầu Truyền Thống', modelUrl: '/models/accessories/man_truyen_thong.glb', socket: 'head' },
    { id: 'non_la', name: 'Nón Lá Bài Thơ', modelUrl: '/models/accessories/non_la.glb', socket: 'head' },
    { id: 'chuoi_ngoc', name: 'Chuỗi Ngọc Trai', modelUrl: '/models/accessories/chuoi_ngoc.glb', socket: 'neck' },
    { id: 'quat_xep', name: 'Quạt Xếp Cầm Tay', modelUrl: '/models/accessories/quat_xep.glb', socket: 'hand_right' },
  ],
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'catalog_manifest.json'),
  JSON.stringify(catalogManifest, null, 2)
);
console.log('✓ catalog_manifest.json generated.');
console.log('[3D Builder] Successfully completed all 3D asset generation.');
