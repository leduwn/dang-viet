#!/usr/bin/env node
/**
 * Avatar Ingestion and Compatibility Pipeline CLI Tool
 *
 * Commands:
 *   node scripts/avatar-pipeline.mjs inspect <glbPath> [--json]
 *   node scripts/avatar-pipeline.mjs register <glbPath> --id <avatarId> --version <version> --name <displayName> [--author <author>] [--license <license>] [--force]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import validator from 'gltf-validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');
const MODELS_DIR = path.join(ROOT_DIR, 'apps/web/public/models');
const AVATARS_DIR = path.join(MODELS_DIR, 'avatars');
const MANIFEST_PATH = path.join(MODELS_DIR, 'catalog_manifest.json');

const STANDARD_MORPHS = [
  'morph_petite',
  'morph_tall_slender',
  'morph_broad_shoulders',
  'morph_curvy_hips',
  'morph_plus_size',
];

const STANDARD_BODY_PRESETS = [
  'standard',
  'petite',
  'tall_slender',
  'broad_shoulders',
  'curvy_hips',
  'plus_size',
];

const STANDARD_GARMENT_MODELS = [
  'aodai_traditional_v2',
  'aodai_classic_01',
  'aodai_remix_raglan',
];

/**
 * Low-level binary GLB parser
 */
export function parseGlbHeaderAndChunks(buffer) {
  if (buffer.length < 12) {
    throw new Error('Tệp không đủ kích thước cho phần đầu GLB (tối thiểu 12 bytes)');
  }

  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546c67) {
    // 'glTF' in ASCII LE
    throw new Error(`Magic bytes không hợp lệ: 0x${magic.toString(16)} (yêu cầu 0x46546c67 'glTF')`);
  }

  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Phiên bản glTF không hỗ trợ: ${version} (chỉ hỗ trợ glTF 2.0)`);
  }

  const totalLength = buffer.readUInt32LE(8);
  if (totalLength > buffer.length) {
    throw new Error(`Kích thước khai báo (${totalLength} bytes) lớn hơn kích thước thực tế (${buffer.length} bytes)`);
  }

  let offset = 12;
  let jsonChunk = null;
  let binChunk = null;

  while (offset < totalLength) {
    if (offset + 8 > totalLength) break;
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkData = buffer.subarray(offset + 8, offset + 8 + chunkLength);

    if (chunkType === 0x4e4f534a) {
      // 'JSON'
      const jsonStr = chunkData.toString('utf-8');
      jsonChunk = JSON.parse(jsonStr);
    } else if (chunkType === 0x004e4942) {
      // 'BIN\0'
      binChunk = chunkData;
    }

    offset += 8 + chunkLength;
  }

  if (!jsonChunk) {
    throw new Error('Tệp GLB thiếu chunk dữ liệu JSON');
  }

  return { json: jsonChunk, bin: binChunk, version, totalLength };
}

/**
 * Inspect a GLB avatar asset thoroughly
 */
export async function inspectAvatar(glbPath) {
  const absolutePath = path.resolve(glbPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      errorCode: 'ERR_FILE_NOT_FOUND',
      errors: [`Không tìm thấy tệp tại đường dẫn: ${glbPath}`],
      warnings: [],
      stats: {},
    };
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const fileSize = fileBuffer.length;
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const errors = [];
  const warnings = [];

  // 1. Binary Header Check
  let gltfJson = null;
  try {
    const parsed = parseGlbHeaderAndChunks(fileBuffer);
    gltfJson = parsed.json;
  } catch (err) {
    return {
      ok: false,
      errorCode: 'ERR_INVALID_GLTF',
      errors: [err.message],
      warnings: [],
      stats: { fileSize, sha256 },
    };
  }

  // 2. Khronos glTF-Validator
  let khronosIssues = null;
  let khronosInfo = null;
  try {
    const valResult = await validator.validateBytes(new Uint8Array(fileBuffer), {
      maxIssues: 50,
      ignoredIssues: [],
    });
    khronosIssues = valResult.issues;
    khronosInfo = valResult.info;

    if (khronosIssues.numErrors > 0) {
      for (const msg of khronosIssues.messages) {
        if (msg.severity === 0) {
          // Error
          errors.push(`[Khronos ${msg.code}] ${msg.message}`);
        }
      }
    }
    if (khronosIssues.numWarnings > 0) {
      for (const msg of khronosIssues.messages) {
        if (msg.severity === 1) {
          // Warning
          warnings.push(`[Khronos Warning ${msg.code}] ${msg.message}`);
        }
      }
    }
  } catch (err) {
    warnings.push(`Không thể chạy Khronos Validator: ${err.message}`);
  }

  // 3. Extract Bounding Box & Height from Accessors
  let minBox = [Infinity, Infinity, Infinity];
  let maxBox = [-Infinity, -Infinity, -Infinity];
  let hasPositions = false;

  if (Array.isArray(gltfJson.meshes)) {
    for (const mesh of gltfJson.meshes) {
      for (const prim of mesh.primitives || []) {
        if (prim.attributes && prim.attributes.POSITION !== undefined) {
          const accIdx = prim.attributes.POSITION;
          const accessor = gltfJson.accessors?.[accIdx];
          if (accessor && Array.isArray(accessor.min) && Array.isArray(accessor.max)) {
            hasPositions = true;
            for (let i = 0; i < 3; i++) {
              minBox[i] = Math.min(minBox[i], accessor.min[i]);
              maxBox[i] = Math.max(maxBox[i], accessor.max[i]);
            }
          }
        }
      }
    }
  }

  if (!hasPositions) {
    errors.push('Không tìm thấy thuộc tính POSITION hợp lệ trong mesh primitives');
    minBox = [0, 0, 0];
    maxBox = [0, 0, 0];
  }

  const height = maxBox[1] - minBox[1];
  const width = maxBox[0] - minBox[0];
  const depth = maxBox[2] - minBox[2];

  // Height and anatomy checks (Vietnamese adult female: ~1.55m - 1.75m)
  if (height <= 0 || !Number.isFinite(height)) {
    errors.push(`Chiều cao avatar không hợp lệ: ${height}m`);
  } else if (height < 0.5 || height > 2.5) {
    errors.push(`Chiều cao avatar (${height.toFixed(2)}m) vượt ngoài giới hạn cho phép (0.5m - 2.5m)`);
  } else if (height < 1.45 || height > 1.85) {
    warnings.push(
      `Chiều cao avatar (${height.toFixed(2)}m) nằm ngoài khoảng chuẩn nữ trưởng thành (1.45m - 1.85m)`
    );
  }

  // Ground plane check (minY should be near 0)
  if (Math.abs(minBox[1]) > 0.15) {
    warnings.push(
      `Gốc chân avatar nằm lệch so với mặt đất Y=0 (minY = ${minBox[1].toFixed(3)}m)`
    );
  }

  // 4. Extract Morph Targets
  const detectedMorphs = new Set();
  if (Array.isArray(gltfJson.meshes)) {
    for (const mesh of gltfJson.meshes) {
      const names = mesh.extras?.targetNames || mesh.targetNames || [];
      if (Array.isArray(names)) {
        names.forEach((n) => detectedMorphs.add(n));
      }
      for (const prim of mesh.primitives || []) {
        if (Array.isArray(prim.targets)) {
          // If no names, register indexed placeholders
          if (names.length === 0) {
            prim.targets.forEach((_, idx) => detectedMorphs.add(`target_${idx}`));
          }
        }
      }
    }
  }

  const detectedMorphList = Array.from(detectedMorphs);
  const missingStandardMorphs = STANDARD_MORPHS.filter((m) => !detectedMorphs.has(m));
  if (missingStandardMorphs.length > 0) {
    warnings.push(
      `Avatar thiếu các morph chuẩn của Dáng Việt: ${missingStandardMorphs.join(', ')}`
    );
  }

  // 5. Materials and Textures
  const materialBindings = {};
  const hasTextures = (gltfJson.textures && gltfJson.textures.length > 0) || (gltfJson.images && gltfJson.images.length > 0);

  if (Array.isArray(gltfJson.materials) && gltfJson.materials.length > 0) {
    for (const mat of gltfJson.materials) {
      const slotName = mat.name || `Material_${Object.keys(materialBindings).length}`;
      const lower = slotName.toLowerCase();
      let type = 'static';
      if (lower.includes('skin') || lower.includes('da') || lower.includes('body')) {
        type = 'skin';
      } else if (lower.includes('hair') || lower.includes('toc')) {
        type = 'hair';
      } else if (lower.includes('eye') || lower.includes('mat')) {
        type = 'eyes';
      }

      const pbr = mat.pbrMetallicRoughness || {};
      const hasBaseTexture = pbr.baseColorTexture !== undefined;

      materialBindings[slotName] = {
        slot: slotName,
        type,
        hasTexture: hasBaseTexture,
        preserveTexture: hasBaseTexture,
        defaultColor: pbr.baseColorFactor ? `#${pbr.baseColorFactor.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}` : undefined,
      };
    }
  } else {
    warnings.push('Mesh không định nghĩa vật liệu riêng biệt (sử dụng vật liệu mặc định)');
    materialBindings['DefaultMaterial'] = {
      slot: 'DefaultMaterial',
      type: 'skin',
      hasTexture: false,
      preserveTexture: false,
    };
  }

  // 6. Attachment Sockets (Calculated anatomically from measured proportions)
  const sockets = {
    head: {
      position: [0, Number((minBox[1] + height * 0.975).toFixed(3)), -0.01],
      trackedFeature: 'crown',
    },
    neck: {
      position: [0, Number((minBox[1] + height * 0.835).toFixed(3)), -0.012],
      trackedFeature: 'clavicle',
    },
    right_hand: {
      position: [Number((width * 0.50).toFixed(3)), Number((minBox[1] + height * 0.462).toFixed(3)), 0],
      trackedFeature: 'right_wrist',
    },
    left_hand: {
      position: [Number((-width * 0.50).toFixed(3)), Number((minBox[1] + height * 0.462).toFixed(3)), 0],
      trackedFeature: 'left_wrist',
    },
    feet: {
      position: [0, Number(minBox[1].toFixed(3)), 0.015],
      trackedFeature: 'ground',
    },
  };

  const isRigged = Array.isArray(gltfJson.skins) && gltfJson.skins.length > 0;
  const hasMorphTargets = detectedMorphList.length > 0;

  const result = {
    ok: errors.length === 0,
    errorCode: errors.length === 0 ? null : (errors.some((e) => e.includes('Khronos')) ? 'ERR_KHRONOS_VALIDATION' : 'ERR_INVALID_ASSET'),
    errors,
    warnings,
    stats: {
      fileSize,
      fileSizeFormatted: `${(fileSize / 1024).toFixed(1)} KB`,
      sha256,
      bounds: {
        min: [Number(minBox[0].toFixed(3)), Number(minBox[1].toFixed(3)), Number(minBox[2].toFixed(3))],
        max: [Number(maxBox[0].toFixed(3)), Number(maxBox[1].toFixed(3)), Number(maxBox[2].toFixed(3))],
        height: Number(height.toFixed(3)),
        width: Number(width.toFixed(3)),
        depth: Number(depth.toFixed(3)),
      },
      morphs: {
        count: detectedMorphList.length,
        detected: detectedMorphList,
        missingStandard: missingStandardMorphs,
      },
      materials: {
        count: Object.keys(materialBindings).length,
        hasTextures: Boolean(hasTextures),
        bindings: materialBindings,
      },
      rigStatus: {
        isRigged,
        hasMorphTargets,
        skinCount: gltfJson.skins?.length || 0,
      },
      sockets,
    },
  };

  return result;
}

/**
 * Register a validated avatar into catalog_manifest.json and assets directory
 */
export async function registerAvatar(glbPath, options = {}) {
  const { id, version = '1.0.0', name, author, license = 'CC-BY-4.0', force = false } = options;

  if (!id || typeof id !== 'string' || id.trim() === '') {
    return { ok: false, error: 'Thiếu hoặc mã avatar không hợp lệ (--id <avatarId>)' };
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return { ok: false, error: 'Thiếu tên hiển thị của avatar (--name <displayName>)' };
  }

  // 1. Run full inspection
  console.log(`[Avatar Pipeline] Đang kiểm tra toàn diện: ${glbPath}...`);
  const inspection = await inspectAvatar(glbPath);
  if (!inspection.ok) {
    return {
      ok: false,
      error: `Kiểm định thất bại (${inspection.errorCode}): ${inspection.errors.join('; ')}`,
      inspection,
    };
  }

  if (inspection.warnings.length > 0) {
    console.log(`[Avatar Pipeline] Cảnh báo (${inspection.warnings.length}):`);
    inspection.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }

  // 2. Prepare target directories
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }

  const targetFilename = `${id}_${version}.glb`;
  const targetGlbPath = path.join(AVATARS_DIR, targetFilename);
  const publicGlbPath = `/models/avatars/${targetFilename}`;

  // Check collision
  if (fs.existsSync(targetGlbPath) && !force) {
    return {
      ok: false,
      error: `Tệp avatar ${targetFilename} đã tồn tại trong hệ thống. Dùng --force nếu muốn ghi đè.`,
    };
  }

  // 3. Copy GLB asset atomically
  const tempGlbPath = `${targetGlbPath}.tmp`;
  fs.copyFileSync(path.resolve(glbPath), tempGlbPath);
  fs.renameSync(tempGlbPath, targetGlbPath);
  console.log(`  ✓ Đã lưu asset nhị phân: ${targetGlbPath}`);

  // 4. Read & Update catalog_manifest.json atomically
  let manifest = { version: '2.0.0', updatedAt: new Date().toISOString(), avatars: [], compatibilityMatrix: [] };
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    } catch (err) {
      return { ok: false, error: `Không thể đọc catalog_manifest.json: ${err.message}` };
    }
  }

  if (!Array.isArray(manifest.avatars)) {
    manifest.avatars = [];
  }
  if (!Array.isArray(manifest.compatibilityMatrix)) {
    manifest.compatibilityMatrix = [];
  }

  // Check existing avatar spec
  const existingIdx = manifest.avatars.findIndex((a) => a.avatarId === id && a.assetVersion === version);
  if (existingIdx >= 0 && !force) {
    return {
      ok: false,
      error: `Avatar ${id}@${version} đã được đăng ký trong manifest. Dùng --force nếu muốn cập nhật.`,
    };
  }

  const avatarSpec = {
    avatarId: id,
    assetVersion: version,
    glbPath: publicGlbPath,
    displayName: name,
    category: 'adult_female',
    license,
    source: 'external_ai_import',
    author: author || 'External AI Generator',
    bounds: {
      min: inspection.stats.bounds.min,
      max: inspection.stats.bounds.max,
      height: inspection.stats.bounds.height,
    },
    materialBindings: inspection.stats.materials.bindings,
    supportedBodyPresets: STANDARD_BODY_PRESETS,
    rigStatus: inspection.stats.rigStatus,
    sockets: inspection.stats.sockets,
    checksumSha256: inspection.stats.sha256,
    registeredAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    manifest.avatars[existingIdx] = avatarSpec;
  } else {
    manifest.avatars.push(avatarSpec);
  }

  // Seed default compatibility matrix records (marked as 'untested' for imported avatars)
  for (const garmentModelId of STANDARD_GARMENT_MODELS) {
    for (const bodyShape of STANDARD_BODY_PRESETS) {
      const exists = manifest.compatibilityMatrix.some(
        (c) => c.avatarId === id && c.garmentModelId === garmentModelId && c.bodyShape === bodyShape
      );
      if (!exists) {
        manifest.compatibilityMatrix.push({
          avatarId: id,
          avatarVersion: version,
          garmentModelId,
          garmentVersion: '1.0.0',
          bodyShape,
          status: 'untested',
          reason: 'Avatar nhập ngoài chưa qua thử nghiệm xuyên mesh trong phòng phối',
          verifiedAt: new Date().toISOString(),
        });
      }
    }
  }

  manifest.updatedAt = new Date().toISOString();

  // Atomic write via temp file
  const tempManifestPath = `${MANIFEST_PATH}.tmp`;
  fs.writeFileSync(tempManifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  fs.renameSync(tempManifestPath, MANIFEST_PATH);
  console.log(`  ✓ Đã cập nhật nguyên tử catalog_manifest.json với ${manifest.avatars.length} avatars và ${manifest.compatibilityMatrix.length} ma trận tương thích.`);

  return {
    ok: true,
    avatarSpec,
    manifestPath: MANIFEST_PATH,
    glbPath: targetGlbPath,
  };
}

// ==========================================
// CLI Entry Point
// ==========================================
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
Dáng Việt - Avatar Ingestion & Compatibility Pipeline CLI

Sử dụng:
  node scripts/avatar-pipeline.mjs inspect <glb_path> [--json]
  node scripts/avatar-pipeline.mjs register <glb_path> --id <id> --version <ver> --name <name> [--author <author>] [--license <license>] [--force]

Ví dụ:
  node scripts/avatar-pipeline.mjs inspect apps/web/public/models/avatar_v2.glb
  node scripts/avatar-pipeline.mjs register models/raw/meshy_avatar.glb --id meshy_female_01 --version 1.0.0 --name "Nữ Dáng Thon AI"
`);
    process.exit(0);
  }

  if (command === 'inspect') {
    const glbPath = args[1];
    if (!glbPath) {
      console.error('Lỗi: Cần cung cấp đường dẫn tệp GLB cần kiểm tra.');
      process.exit(1);
    }

    const isJson = args.includes('--json');
    const result = await inspectAvatar(glbPath);

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('======================================================================');
      console.log('  KẾT QUẢ KIỂM TRA AVATAR GLB (INSPECTION REPORT)');
      console.log('======================================================================');
      console.log(`Tệp: ${glbPath}`);
      console.log(`Trạng thái: ${result.ok ? '✓ HỢP LỆ (PASS)' : '✗ KHÔNG HỢP LỆ (FAIL)'}`);
      if (result.errorCode) console.log(`Mã lỗi: ${result.errorCode}`);
      console.log(`Kích thước: ${result.stats.fileSizeFormatted}`);
      console.log(`Mã băm SHA-256: ${result.stats.sha256}`);
      console.log(`Kích thước hình học (Bounds): Cao ${result.stats.bounds?.height}m, Rộng ${result.stats.bounds?.width}m, Sâu ${result.stats.bounds?.depth}m`);
      console.log(`Morph targets: ${result.stats.morphs?.count} (${result.stats.morphs?.detected?.join(', ') || 'Không có'})`);
      console.log(`Vật liệu: ${result.stats.materials?.count} slots (Có texture: ${result.stats.materials?.hasTextures ? 'Có' : 'Không'})`);
      console.log(`Rigging: ${result.stats.rigStatus?.isRigged ? 'Có skeleton' : 'Chưa có skeleton'}`);

      if (result.errors.length > 0) {
        console.log('\nDANH SÁCH LỖI:');
        result.errors.forEach((e) => console.log(`  ✗ ${e}`));
      }
      if (result.warnings.length > 0) {
        console.log('\nDANH SÁCH CẢNH BÁO:');
        result.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
      }
    }

    process.exit(result.ok ? 0 : 1);
  }

  if (command === 'register') {
    const glbPath = args[1];
    if (!glbPath) {
      console.error('Lỗi: Cần cung cấp đường dẫn tệp GLB cần đăng ký.');
      process.exit(1);
    }

    function getArg(flag) {
      const idx = args.indexOf(flag);
      return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
    }

    const id = getArg('--id');
    const version = getArg('--version') || '1.0.0';
    const name = getArg('--name');
    const author = getArg('--author');
    const license = getArg('--license') || 'CC-BY-4.0';
    const force = args.includes('--force');

    const regResult = await registerAvatar(glbPath, { id, version, name, author, license, force });
    if (!regResult.ok) {
      console.error(`\n[ĐĂNG KÝ THẤT BÀI] ${regResult.error}`);
      process.exit(1);
    }

    console.log('\n[ĐĂNG KÝ THÀNH CÔNG] Đã ghi nhận Avatar mới vào hệ thống Dáng Việt:');
    console.log(JSON.stringify(regResult.avatarSpec, null, 2));
    process.exit(0);
  }

  console.error(`Lệnh không hỗ trợ: ${command}. Dùng --help để xem hướng dẫn.`);
  process.exit(1);
}

// Execute main if run directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => {
    console.error('[Avatar Pipeline Fatal Error]:', err);
    process.exit(1);
  });
}
