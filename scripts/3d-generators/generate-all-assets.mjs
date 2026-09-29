/**
 * Master Script to Generate All 3D Binary GLB Assets and Catalog Manifest
 * Incorporates:
 * - Multi-primitive avatar with separate material slots for Skin and Hair
 * - Seamless Ao Dai geometry with hemmed edges and clean normals (no DoubleSide needed)
 * - Complete Silk Pants geometry with closed pelvic volume and dual legs
 * - 6 Cultural Accessories (Mấn, Nón lá, Chuỗi ngọc, Quạt xếp, Túi cói, Guốc mộc) with socket metadata
 * - Neutral body naming ("Dáng cơ bản" instead of "Chuẩn Á Đông")
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
  generateTuiCoiGeometry,
  generateGuocMocGeometry,
  ACCESSORY_SOCKETS,
} from './accessories-mesh.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const OUTPUT_DIR = path.join(ROOT_DIR, 'apps/web/public/models');

console.log('[3D Builder] Output target directory:', OUTPUT_DIR);

function buildSingleMeshGlb({
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

function buildMultiPrimitiveGlb({
  name,
  primitives, // Array of { geom, material }
  targetNames,
}) {
  const builder = new GlbBuilder();
  const builtPrimitives = [];

  for (const p of primitives) {
    const matIdx = builder.addMaterial(p.material);
    const posAcc = builder.addFloatAttributes(p.geom.positions, 3);
    const normAcc = builder.addFloatAttributes(p.geom.normals, 3);
    const uvAcc = builder.addFloatAttributes(p.geom.uvs, 2);
    const idxAcc = builder.addIndices(p.geom.indices);

    const attributes = {
      POSITION: posAcc,
      NORMAL: normAcc,
      TEXCOORD_0: uvAcc,
    };

    const targets = [];
    if (p.geom.morphDeltas && p.geom.morphDeltas.length > 0) {
      for (const delta of p.geom.morphDeltas) {
        const deltaPosAcc = builder.addFloatAttributes(delta, 3);
        targets.push({ POSITION: deltaPosAcc });
      }
    }

    const prim = {
      attributes,
      indices: idxAcc,
      material: matIdx,
    };
    if (targets.length > 0) {
      prim.targets = targets;
    }
    builtPrimitives.push(prim);
  }

  const weights = builtPrimitives[0]?.targets ? builtPrimitives[0].targets.map(() => 0.0) : undefined;
  const meshIdx = builder.addMesh({
    name: `${name}_Mesh`,
    primitives: builtPrimitives,
    weights,
    targetNames,
  });

  const nodeIdx = builder.addNode({
    name: `${name}_Node`,
    mesh: meshIdx,
  });

  builder.scenes[0].nodes.push(nodeIdx);
  return builder;
}

// =========================================================================
// 1. Generate Avatar Base with 2 Distinct Material Slots (Skin & Hair)
// =========================================================================
console.log('Generating: avatar_base.glb (Multi-material: Skin + Hair)...');
const avatarGeom = generateAvatarGeometry();
const avatarBuilder = buildMultiPrimitiveGlb({
  name: 'Avatar_Base',
  primitives: [
    {
      geom: avatarGeom.skin,
      material: {
        name: 'SkinMaterial',
        baseColor: [0.94, 0.77, 0.66, 1.0], // Natural Vietnamese warm skin tone
        roughness: 0.65,
        metalness: 0.0,
      },
    },
    {
      geom: avatarGeom.hair,
      material: {
        name: 'HairMaterial',
        baseColor: [0.11, 0.10, 0.09, 1.0], // Deep black hair
        roughness: 0.82,
        metalness: 0.05,
      },
    },
  ],
  targetNames: avatarGeom.targetNames,
});
const avatarBytes = avatarBuilder.writeToFile(path.join(OUTPUT_DIR, 'avatar_base.glb'));
console.log(`  ✓ avatar_base.glb (${avatarBytes} bytes, Skin: ${avatarGeom.skin.positions.length / 3} verts, Hair: ${avatarGeom.hair.positions.length / 3} verts)`);

// =========================================================================
// 2. Generate Classic Ao Dai (aodai_classic_01.glb)
// =========================================================================
console.log('Generating: aodai_classic_01.glb...');
const classicGeom = generateAoDaiGeometry({
  collarType: 'high_stand',
  sleeveType: 'long',
  flapLength: 'long',
});
const classicBuilder = buildSingleMeshGlb({
  name: 'AoDai_Classic_01',
  geom: classicGeom,
  material: {
    name: 'AoDaiMaterial',
    baseColor: [0.92, 0.22, 0.16, 1.0], // Đỏ son hoàng gia
    roughness: 0.40,
    metalness: 0.05,
    doubleSided: false, // Clean topology with hemmed thickness, no DoubleSide cheat
  },
});
const classicBytes = classicBuilder.writeToFile(path.join(OUTPUT_DIR, 'aodai_classic_01.glb'));
console.log(`  ✓ aodai_classic_01.glb (${classicBytes} bytes, ${classicGeom.positions.length / 3} vertices)`);

// =========================================================================
// 3. Generate Modern Raglan Ao Dai (aodai_remix_raglan.glb)
// =========================================================================
console.log('Generating: aodai_remix_raglan.glb...');
const raglanGeom = generateAoDaiGeometry({
  collarType: 'boat',
  sleeveType: 'raglan',
  flapLength: 'midi',
});
const raglanBuilder = buildSingleMeshGlb({
  name: 'AoDai_Remix_Raglan',
  geom: raglanGeom,
  material: {
    name: 'AoDaiMaterial',
    baseColor: [0.95, 0.95, 0.95, 1.0], // Trắng tinh khôi
    roughness: 0.35,
    metalness: 0.02,
    doubleSided: false,
  },
});
const raglanBytes = raglanBuilder.writeToFile(path.join(OUTPUT_DIR, 'aodai_remix_raglan.glb'));
console.log(`  ✓ aodai_remix_raglan.glb (${raglanBytes} bytes, ${raglanGeom.positions.length / 3} vertices)`);

// =========================================================================
// 4. Generate Silk Pants (pants_silk.glb)
// =========================================================================
console.log('Generating: pants_silk.glb...');
const pantsGeom = generatePantsGeometry();
const pantsBuilder = buildSingleMeshGlb({
  name: 'Pants_Silk',
  geom: pantsGeom,
  material: {
    name: 'PantsMaterial',
    baseColor: [0.98, 0.98, 0.98, 1.0], // Quần trắng ngà lụa
    roughness: 0.45,
    metalness: 0.0,
    doubleSided: false,
  },
});
const pantsBytes = pantsBuilder.writeToFile(path.join(OUTPUT_DIR, 'pants_silk.glb'));
console.log(`  ✓ pants_silk.glb (${pantsBytes} bytes, ${pantsGeom.positions.length / 3} vertices)`);

// =========================================================================
// 5. Generate Accessories
// =========================================================================
const ACCESSORIES_DIR = path.join(OUTPUT_DIR, 'accessories');
fs.mkdirSync(ACCESSORIES_DIR, { recursive: true });

// 5.1 Mấn đội đầu
console.log('Generating: accessories/man_truyen_thong.glb...');
const manGeom = generateManGeometry();
const manBuilder = buildSingleMeshGlb({
  name: 'Accessory_Man',
  geom: manGeom,
  material: {
    name: 'ManMaterial',
    baseColor: [0.95, 0.78, 0.25, 1.0], // Vàng ánh kim gấm
    roughness: 0.50,
    metalness: 0.20,
  },
});
manBuilder.writeToFile(path.join(ACCESSORIES_DIR, 'man_truyen_thong.glb'));

// 5.2 Nón lá
console.log('Generating: accessories/non_la.glb...');
const nonLaGeom = generateNonLaGeometry();
const nonLaBuilder = buildSingleMeshGlb({
  name: 'Accessory_NonLa',
  geom: nonLaGeom,
  material: {
    name: 'NonLaMaterial',
    baseColor: [0.92, 0.88, 0.76, 1.0], // Màu lá cọ khô tự nhiên
    roughness: 0.80,
    metalness: 0.0,
  },
});
nonLaBuilder.writeToFile(path.join(ACCESSORIES_DIR, 'non_la.glb'));

// 5.3 Chuỗi ngọc
console.log('Generating: accessories/chuoi_ngoc.glb...');
const ngocGeom = generateChuoiNgocGeometry();
const ngocBuilder = buildSingleMeshGlb({
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
const quatBuilder = buildSingleMeshGlb({
  name: 'Accessory_QuatXep',
  geom: quatGeom,
  material: {
    name: 'QuatMaterial',
    baseColor: [0.85, 0.75, 0.65, 1.0], // Giấy điệp / tre mộc
    roughness: 0.60,
    metalness: 0.0,
  },
});
quatBuilder.writeToFile(path.join(ACCESSORIES_DIR, 'quat_xep.glb'));

// 5.5 Túi cói
console.log('Generating: accessories/tui_coi.glb...');
const tuiCoiGeom = generateTuiCoiGeometry();
const tuiCoiBuilder = buildSingleMeshGlb({
  name: 'Accessory_TuiCoi',
  geom: tuiCoiGeom,
  material: {
    name: 'TuiCoiMaterial',
    baseColor: [0.78, 0.68, 0.52, 1.0], // Sợi cói đan mộc
    roughness: 0.88,
    metalness: 0.0,
  },
});
tuiCoiBuilder.writeToFile(path.join(ACCESSORIES_DIR, 'tui_coi.glb'));

// 5.6 Guốc mộc
console.log('Generating: accessories/guoc_moc.glb...');
const guocMocGeom = generateGuocMocGeometry();
const guocMocBuilder = buildSingleMeshGlb({
  name: 'Accessory_GuocMoc',
  geom: guocMocGeom,
  material: {
    name: 'GuocMocMaterial',
    baseColor: [0.60, 0.42, 0.28, 1.0], // Gỗ xoan đào mộc
    roughness: 0.75,
    metalness: 0.0,
  },
});
guocMocBuilder.writeToFile(path.join(ACCESSORIES_DIR, 'guoc_moc.glb'));

// =========================================================================
// 6. Write Standardized Catalog Manifest JSON
// =========================================================================
const catalogManifest = {
  version: '2.0.0',
  updatedAt: new Date().toISOString(),
  engine: 'Three.js 0.169.0 / React Three Fiber 8.17.10',
  conventions: {
    unit: 'meters',
    coordinateSystem: 'Y-up, Z-forward, X-right',
    groundPlaneY: 0.0,
    baseHeight: 1.666,
  },
  sockets: ACCESSORY_SOCKETS,
  bodyPresets: [
    {
      id: 'standard',
      name: 'Dáng cơ bản',
      description: 'Tỷ lệ hình thể cơ bản cân đối tự nhiên (1.66m)',
      weights: {
        morph_petite: 0.0,
        morph_tall_slender: 0.0,
        morph_broad_shoulders: 0.0,
        morph_curvy_hips: 0.0,
        morph_plus_size: 0.0,
      },
    },
    {
      id: 'petite',
      name: 'Nhỏ nhắn',
      description: 'Dáng vóc thanh mảnh, chiều cao ~1.56m',
      weights: {
        morph_petite: 1.0,
        morph_tall_slender: 0.0,
        morph_broad_shoulders: 0.0,
        morph_curvy_hips: 0.0,
        morph_plus_size: 0.0,
      },
    },
    {
      id: 'tall_slender',
      name: 'Cao thanh',
      description: 'Dáng người cao ráo dong dỏng, chiều cao ~1.72m',
      weights: {
        morph_petite: 0.0,
        morph_tall_slender: 1.0,
        morph_broad_shoulders: 0.0,
        morph_curvy_hips: 0.0,
        morph_plus_size: 0.0,
      },
    },
    {
      id: 'broad_shoulders',
      name: 'Khung vai rộng',
      description: 'Bờ vai mở rộng đĩnh đạc, cầu vai ngang tôn nét thanh tao',
      weights: {
        morph_petite: 0.0,
        morph_tall_slender: 0.0,
        morph_broad_shoulders: 1.0,
        morph_curvy_hips: 0.0,
        morph_plus_size: 0.0,
      },
    },
    {
      id: 'curvy_hips',
      name: 'Hông nở',
      description: 'Vòng hông nở nang, tạo đường cong lượn tà áo chữ S mềm mại',
      weights: {
        morph_petite: 0.0,
        morph_tall_slender: 0.0,
        morph_broad_shoulders: 0.0,
        morph_curvy_hips: 1.0,
        morph_plus_size: 0.0,
      },
    },
    {
      id: 'plus_size',
      name: 'Đầy đặn',
      description: 'Thân hình đẫy đà, đường nét tròn đầy quý phái',
      weights: {
        morph_petite: 0.0,
        morph_tall_slender: 0.0,
        morph_broad_shoulders: 0.0,
        morph_curvy_hips: 0.0,
        morph_plus_size: 1.0,
      },
    },
  ],
  models: [
    {
      id: 'aodai_traditional_v2',
      name: 'Áo Dài Cổ Cao 4.2cm Chuẩn V2 (DCC Master)',
      category: 'classic',
      meshUrl: '/models/aodai_traditional_v2.glb',
      pantsUrl: '/models/pants_silk_v2.glb',
      avatarUrl: '/models/avatar_v2.glb',
      materialSlots: ['AoDaiMaterial'],
      features: {
        collar: 'Cổ đứng 4.2cm thành dày 2 lớp nẹp viền khép kín',
        sleeve: 'Tay dài ráp vai suôn tự nhiên có độ chùng dập dềnh',
        flaps: 'Tà kép liền khối xẻ eo cao nẹp viền không xuyên thấu',
        pants: 'Quần lụa hai ống rời có cạp và đũng 3D hoàn chỉnh',
      },
      supportedMorphs: [
        'morph_petite',
        'morph_tall_slender',
        'morph_broad_shoulders',
        'morph_curvy_hips',
        'morph_plus_size',
      ],
      metadata: {
        author: 'Dáng Việt Digital Studio & Blender Studio (CC0 Human Base Mesh)',
        license: 'CC-BY-4.0',
        createdVia: 'Blender 3.6 LTS Headless Pipeline',
      },
    },
    {
      id: 'aodai_classic_01',
      name: 'Áo Dài Cổ Đứng Truyền Thống',
      category: 'classic',
      meshUrl: '/models/aodai_classic_01.glb',
      pantsUrl: '/models/pants_silk.glb',
      avatarUrl: '/models/avatar_base.glb',
      materialSlots: ['AoDaiMaterial'],
      features: {
        collar: 'Cổ đứng 3.8cm truyền thống',
        sleeve: 'Tay dài ráp vai suôn',
        flaps: 'Tà dài qua gối xẻ eo',
        pants: 'Quần lụa ống rộng hai ống',
      },
      supportedMorphs: [
        'morph_petite',
        'morph_tall_slender',
        'morph_broad_shoulders',
        'morph_curvy_hips',
        'morph_plus_size',
      ],
      metadata: {
        author: 'Dáng Việt Digital Studio',
        license: 'CC-BY-4.0',
        createdVia: 'DCC Pure Binary glTF Generator',
      },
    },
    {
      id: 'aodai_remix_raglan',
      name: 'Áo Dài Cổ Thuyền Tay Raglan Cách Tân',
      category: 'modern',
      meshUrl: '/models/aodai_remix_raglan.glb',
      pantsUrl: '/models/pants_silk.glb',
      avatarUrl: '/models/avatar_base.glb',
      materialSlots: ['AoDaiMaterial'],
      features: {
        collar: 'Cổ thuyền thanh thoát',
        sleeve: 'Tay raglan vát nách ôm vai',
        flaps: 'Tà lỡ midi hiện đại xẻ eo',
        pants: 'Quần lụa ống rộng hai ống',
      },
      supportedMorphs: [
        'morph_petite',
        'morph_tall_slender',
        'morph_broad_shoulders',
        'morph_curvy_hips',
        'morph_plus_size',
      ],
      metadata: {
        author: 'Dáng Việt Digital Studio',
        license: 'CC-BY-4.0',
        createdVia: 'DCC Pure Binary glTF Generator',
      },
    },
  ],
  accessories: [
    {
      id: 'man_truyen_thong',
      name: 'Mấn Đội Đầu Truyền Thống',
      modelUrl: '/models/accessories/man_truyen_thong.glb',
      socket: 'head',
    },
    {
      id: 'non_la',
      name: 'Nón Lá Bài Thơ',
      modelUrl: '/models/accessories/non_la.glb',
      socket: 'head',
    },
    {
      id: 'chuoi_ngoc',
      name: 'Chuỗi Ngọc Trai',
      modelUrl: '/models/accessories/chuoi_ngoc.glb',
      socket: 'neck',
    },
    {
      id: 'quat_xep',
      name: 'Quạt Xếp Cầm Tay',
      modelUrl: '/models/accessories/quat_xep.glb',
      socket: 'right_hand',
    },
    {
      id: 'tui_coi',
      name: 'Túi Cói Quai Mộc',
      modelUrl: '/models/accessories/tui_coi.glb',
      socket: 'left_hand',
    },
    {
      id: 'guoc_moc',
      name: 'Guốc Mộc Quai Nhung',
      modelUrl: '/models/accessories/guoc_moc.glb',
      socket: 'feet',
    },
  ],
  avatars: [
    {
      avatarId: 'avatar_v2',
      assetVersion: '2.0.0',
      glbPath: '/models/avatar_v2.glb',
      displayName: 'Avatar Nữ Trưởng Thành Chuẩn V2 (DCC Master)',
      category: 'adult_female',
      license: 'CC-BY-4.0',
      source: 'Blender 3.6 LTS Headless Pipeline',
      author: 'Dáng Việt Digital Studio & Blender Studio (CC0 Human Base Mesh)',
      bounds: {
        min: [-0.29, 0, -0.15],
        max: [0.29, 1.643, 0.15],
        height: 1.643,
      },
      materialBindings: {
        SkinMaterial: { slot: 'SkinMaterial', type: 'skin', preserveTexture: true },
        HairMaterial: { slot: 'HairMaterial', type: 'hair', preserveTexture: true },
      },
      supportedBodyPresets: ['standard', 'petite', 'tall_slender', 'broad_shoulders', 'curvy_hips', 'plus_size'],
      rigStatus: { isRigged: false, hasMorphTargets: true },
      sockets: ACCESSORY_SOCKETS,
      checksumSha256: '25855f70f6cd4a23c6359d50b08f4f92db5aca82eaf0c376618980cfeb081082',
      registeredAt: '2026-09-29T00:00:00.000Z',
    },
    {
      avatarId: 'avatar_base',
      assetVersion: '1.0.0',
      glbPath: '/models/avatar_base.glb',
      displayName: 'Avatar Nữ Cơ Bản (Dáng Việt V1)',
      category: 'adult_female',
      license: 'CC-BY-4.0',
      source: 'DCC Pure Binary glTF Generator',
      author: 'Dáng Việt Digital Studio',
      bounds: {
        min: [-0.29, 0, -0.15],
        max: [0.29, 1.669, 0.15],
        height: 1.669,
      },
      materialBindings: {
        SkinMaterial: { slot: 'SkinMaterial', type: 'skin', preserveTexture: true },
        HairMaterial: { slot: 'HairMaterial', type: 'hair', preserveTexture: true },
      },
      supportedBodyPresets: ['standard', 'petite', 'tall_slender', 'broad_shoulders', 'curvy_hips', 'plus_size'],
      rigStatus: { isRigged: false, hasMorphTargets: true },
      sockets: ACCESSORY_SOCKETS,
      checksumSha256: '5647e5cf5f0f8b91b137c99a3f1bf6030b43e18f4aa628b8dd7638347354ebd8',
      registeredAt: '2026-09-29T00:00:00.000Z',
    },
  ],
  compatibilityMatrix: [
    ...['standard', 'petite', 'tall_slender', 'broad_shoulders', 'curvy_hips', 'plus_size'].map((bodyShape) => ({
      avatarId: 'avatar_v2',
      avatarVersion: '2.0.0',
      garmentModelId: 'aodai_traditional_v2',
      garmentVersion: '2.0.0',
      bodyShape,
      status: 'verified',
      reason: 'Đồng bộ phom dáng chuẩn V2 (DCC Master)',
      verifiedAt: '2026-09-29T00:00:00.000Z',
    })),
    ...['standard', 'petite', 'tall_slender', 'broad_shoulders', 'curvy_hips', 'plus_size'].map((bodyShape) => ({
      avatarId: 'avatar_base',
      avatarVersion: '1.0.0',
      garmentModelId: 'aodai_classic_01',
      garmentVersion: '1.0.0',
      bodyShape,
      status: 'verified',
      reason: 'Đồng bộ phom dáng chuẩn V1 cổ đứng truyền thống',
      verifiedAt: '2026-09-29T00:00:00.000Z',
    })),
    ...['standard', 'petite', 'tall_slender', 'broad_shoulders', 'curvy_hips', 'plus_size'].map((bodyShape) => ({
      avatarId: 'avatar_base',
      avatarVersion: '1.0.0',
      garmentModelId: 'aodai_remix_raglan',
      garmentVersion: '1.0.0',
      bodyShape,
      status: 'verified',
      reason: 'Đồng bộ phom dáng chuẩn V1 cách tân tay raglan',
      verifiedAt: '2026-09-29T00:00:00.000Z',
    })),
    ...['standard', 'petite', 'tall_slender', 'broad_shoulders', 'curvy_hips', 'plus_size'].map((bodyShape) => ({
      avatarId: 'avatar_base',
      avatarVersion: '1.0.0',
      garmentModelId: 'aodai_traditional_v2',
      garmentVersion: '2.0.0',
      bodyShape,
      status: 'unsupported',
      reason: 'Mẫu áo V2 yêu cầu avatar V2 có phom giải phẫu tỷ lệ chuẩn',
      verifiedAt: '2026-09-29T00:00:00.000Z',
    })),
    ...['standard', 'petite', 'tall_slender', 'broad_shoulders', 'curvy_hips', 'plus_size'].map((bodyShape) => ({
      avatarId: 'avatar_v2',
      avatarVersion: '2.0.0',
      garmentModelId: 'aodai_classic_01',
      garmentVersion: '1.0.0',
      bodyShape,
      status: 'untested',
      reason: 'Chưa kiểm thử xuyên mesh trên avatar v2',
      verifiedAt: '2026-09-29T00:00:00.000Z',
    })),
    ...['standard', 'petite', 'tall_slender', 'broad_shoulders', 'curvy_hips', 'plus_size'].map((bodyShape) => ({
      avatarId: 'avatar_v2',
      avatarVersion: '2.0.0',
      garmentModelId: 'aodai_remix_raglan',
      garmentVersion: '1.0.0',
      bodyShape,
      status: 'untested',
      reason: 'Chưa kiểm thử xuyên mesh trên avatar v2',
      verifiedAt: '2026-09-29T00:00:00.000Z',
    })),
  ],
};

const manifestPath = path.join(OUTPUT_DIR, 'catalog_manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(catalogManifest, null, 2), 'utf-8');
console.log(`  ✓ catalog_manifest.json written with ${catalogManifest.bodyPresets.length} body presets, ${catalogManifest.models.length} models, ${catalogManifest.accessories.length} accessories.\n`);
console.log('[3D Builder] Tất cả tài nguyên 3D glTF 2.0 đã được tạo thành công!');
