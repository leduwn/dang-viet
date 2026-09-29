/**
 * Anatomical 3D Mesh Generator for Vietnamese Female Avatar with 5 Morph Targets
 * Features:
 * - Natural adult female body proportions (~1.66m height, Y=0.00m to 1.67m)
 * - Relaxed A-pose with hands comfortably spaced for garment visibility
 * - Separate geometry primitives for Skin (body/face/limbs) and Hair (crown + bun)
 * - 5 synchronized morph targets with smooth cosine boundary blending
 */

// Helper to compute smooth vertex normals
export function computeVertexNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;

    const ax = positions[i0], ay = positions[i0 + 1], az = positions[i0 + 2];
    const bx = positions[i1], by = positions[i1 + 1], bz = positions[i1 + 2];
    const cx = positions[i2], cy = positions[i2 + 1], cz = positions[i2 + 2];

    const v1x = bx - ax, v1y = by - ay, v1z = bz - az;
    const v2x = cx - ax, v2y = cy - ay, v2z = cz - az;

    const nx = v1y * v2z - v1z * v2y;
    const ny = v1z * v2x - v1x * v2z;
    const nz = v1x * v2y - v1y * v2x;

    normals[i0] += nx; normals[i0 + 1] += ny; normals[i0 + 2] += nz;
    normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
    normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
  }

  // Normalize with zero-vector recovery for degenerate / polar seam vertices
  const posArr = positions;
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (l > 1e-8) {
      normals[i] /= l;
      normals[i + 1] /= l;
      normals[i + 2] /= l;
    } else {
      // Mark degenerate normal for recovery
      normals[i] = NaN;
    }
  }

  // Second pass: resolve degenerate vertices by borrowing normal from co-located vertices or upward fallback
  for (let i = 0; i < normals.length; i += 3) {
    if (!Number.isNaN(normals[i])) continue;
    const px = posArr[i];
    const py = posArr[i + 1];
    const pz = posArr[i + 2];
    let resolved = false;

    for (let j = 0; j < normals.length; j += 3) {
      if (j === i || Number.isNaN(normals[j])) continue;
      const dx = posArr[j] - px;
      const dy = posArr[j + 1] - py;
      const dz = posArr[j + 2] - pz;
      if (dx * dx + dy * dy + dz * dz < 1e-10) {
        normals[i] = normals[j];
        normals[i + 1] = normals[j + 1];
        normals[i + 2] = normals[j + 2];
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      // Absolute fallback: unit normal pointing upward (0, 1, 0)
      normals[i] = 0;
      normals[i + 1] = 1;
      normals[i + 2] = 0;
    }
  }
  return normals;
}

/**
 * Computes 5 synchronized morph target deltas for any set of 3D positions
 */
export function computeMorphDeltas(positions) {
  const vCount = positions.length / 3;
  const morphDeltas = [
    new Float32Array(positions.length), // 0: morph_petite
    new Float32Array(positions.length), // 1: morph_tall_slender
    new Float32Array(positions.length), // 2: morph_broad_shoulders
    new Float32Array(positions.length), // 3: morph_curvy_hips
    new Float32Array(positions.length), // 4: morph_plus_size
  ];

  for (let i = 0; i < vCount; i++) {
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];

    // --- 0. Petite (~1.56m, narrower frame)
    const petiteScaleY = 0.945;
    const petiteScaleXZ = 0.91;
    morphDeltas[0][idx]     = x * (petiteScaleXZ - 1);
    morphDeltas[0][idx + 1] = y * (petiteScaleY - 1);
    morphDeltas[0][idx + 2] = z * (petiteScaleXZ - 1);

    // --- 1. Tall Slender (~1.72m, slender waist)
    const tallScaleY = 1.042;
    const slenderXZ = 0.96;
    morphDeltas[1][idx]     = x * (slenderXZ - 1);
    morphDeltas[1][idx + 1] = y * (tallScaleY - 1);
    morphDeltas[1][idx + 2] = z * (slenderXZ - 1);

    // --- 2. Broad Shoulders (Smooth cosine window between 1.25m and 1.45m)
    if (y >= 1.25 && y <= 1.45) {
      const weight = Math.sin(((y - 1.25) / 0.20) * Math.PI);
      morphDeltas[2][idx] = Math.sign(x) * 0.024 * weight;
    }

    // --- 3. Curvy Hips (Smooth cosine window between 0.72m and 1.02m)
    if (y >= 0.72 && y <= 1.02) {
      const weight = Math.sin(((y - 0.72) / 0.30) * Math.PI);
      morphDeltas[3][idx]     = Math.sign(x) * 0.028 * weight;
      morphDeltas[3][idx + 2] = (z - 0.0) * 0.12 * weight;
    }

    // --- 4. Plus Size (Fuller body volume across torso, hips, thighs)
    if (y >= 0.15 && y <= 1.42) {
      const weight = y >= 0.80 ? 0.16 : 0.12;
      morphDeltas[4][idx]     = x * weight;
      morphDeltas[4][idx + 2] = z * (weight * 1.15);
    }
  }

  return morphDeltas;
}

const TARGET_NAMES = [
  'morph_petite',
  'morph_tall_slender',
  'morph_broad_shoulders',
  'morph_curvy_hips',
  'morph_plus_size',
];

/**
 * Builds the avatar body (Skin Primitive)
 */
export function generateSkinGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const SECTORS = 24;

  // 1. Head & Neck rings with refined Vietnamese facial contour
  // Y range: 1.41m (clavicle junction) up to 1.67m (crown)
  const headRings = [
    { y: 1.670, rx: 0.015, rz: 0.018, zOff: -0.010 }, // Top of head
    { y: 1.650, rx: 0.066, rz: 0.076, zOff: -0.012 }, // Upper crown
    { y: 1.615, rx: 0.082, rz: 0.092, zOff: -0.010 }, // Forehead / brow
    { y: 1.575, rx: 0.078, rz: 0.088, zOff: -0.005 }, // Eyes / cheekbone arch
    { y: 1.540, rx: 0.066, rz: 0.078, zOff:  0.006 }, // Nose tip / philtrum
    { y: 1.505, rx: 0.048, rz: 0.058, zOff:  0.003 }, // Chin / jawline taper
    { y: 1.465, rx: 0.042, rz: 0.046, zOff: -0.010 }, // Upper neck
    { y: 1.415, rx: 0.054, rz: 0.056, zOff: -0.012 }, // Base of neck / clavicle junction
  ];

  // 2. Torso (Shoulders, bust, natural waist, hips down to groin)
  const torsoRings = [
    { y: 1.395, rx: 0.170, rz: 0.088, zOff: -0.015 }, // Shoulder girdle
    { y: 1.350, rx: 0.156, rz: 0.098, zOff: -0.010 }, // Upper chest
    { y: 1.280, rx: 0.148, rz: 0.114, zOff:  0.012 }, // Bust apex (natural curve)
    { y: 1.200, rx: 0.136, rz: 0.094, zOff: -0.005 }, // Ribcage
    { y: 1.120, rx: 0.120, rz: 0.082, zOff: -0.008 }, // Upper waist
    { y: 1.050, rx: 0.116, rz: 0.080, zOff: -0.008 }, // Natural waist (thắt lưng)
    { y: 0.980, rx: 0.136, rz: 0.094, zOff: -0.006 }, // Iliac crest / high hip
    { y: 0.890, rx: 0.166, rz: 0.116, zOff: -0.005 }, // Hips apex / buttocks
    { y: 0.810, rx: 0.158, rz: 0.106, zOff: -0.008 }, // Low hip / groin start
  ];

  function addLathedTube(rings, vStart, vEnd) {
    const baseIdx = positions.length / 3;
    const ringCount = rings.length;

    for (let r = 0; r < ringCount; r++) {
      const ring = rings[r];
      const v = vStart + (vEnd - vStart) * (r / (ringCount - 1));

      for (let s = 0; s <= SECTORS; s++) {
        const u = s / SECTORS;
        const theta = u * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        const x = ring.rx * sin;
        const y = ring.y;
        const z = ring.rz * cos + ring.zOff;

        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }

    for (let r = 0; r < ringCount - 1; r++) {
      for (let s = 0; s < SECTORS; s++) {
        const row1 = baseIdx + r * (SECTORS + 1);
        const row2 = baseIdx + (r + 1) * (SECTORS + 1);

        const i0 = row1 + s;
        const i1 = row1 + s + 1;
        const i2 = row2 + s + 1;
        const i3 = row2 + s;

        indices.push(i0, i1, i2);
        indices.push(i0, i2, i3);
      }
    }
  }

  addLathedTube(headRings, 0.80, 1.00);
  addLathedTube(torsoRings, 0.50, 0.80);

  // 3. Limbs (Arms and Legs)
  function addLimb(centerPath, radii, sectors = 14) {
    const baseIdx = positions.length / 3;
    const steps = centerPath.length;

    for (let i = 0; i < steps; i++) {
      const pt = centerPath[i];
      const rad = radii[i];
      const nextPt = centerPath[Math.min(i + 1, steps - 1)];
      const prevPt = centerPath[Math.max(0, i - 1)];

      const dir = [nextPt[0] - prevPt[0], nextPt[1] - prevPt[1], nextPt[2] - prevPt[2]];
      const len = Math.hypot(...dir) || 1;
      dir[0] /= len; dir[1] /= len; dir[2] /= len;

      let up = [0, 1, 0];
      if (Math.abs(dir[1]) > 0.95) up = [0, 0, 1];
      let side = [
        dir[1] * up[2] - dir[2] * up[1],
        dir[2] * up[0] - dir[0] * up[2],
        dir[0] * up[1] - dir[1] * up[0],
      ];
      const slen = Math.hypot(...side) || 1;
      side[0] /= slen; side[1] /= slen; side[2] /= slen;

      let norm = [
        side[1] * dir[2] - side[2] * dir[1],
        side[2] * dir[0] - side[0] * dir[2],
        side[0] * dir[1] - side[1] * dir[0],
      ];

      for (let s = 0; s <= sectors; s++) {
        const u = s / sectors;
        const theta = u * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        const x = pt[0] + (side[0] * cos + norm[0] * sin) * rad;
        const y = pt[1] + (side[1] * cos + norm[1] * sin) * rad;
        const z = pt[2] + (side[2] * cos + norm[2] * sin) * rad;

        positions.push(x, y, z);
        uvs.push(u, i / (steps - 1));
      }
    }

    for (let i = 0; i < steps - 1; i++) {
      for (let s = 0; s < sectors; s++) {
        const row1 = baseIdx + i * (sectors + 1);
        const row2 = baseIdx + (i + 1) * (sectors + 1);

        indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
        indices.push(row1 + s, row2 + s + 1, row2 + s);
      }
    }
  }

  // Left Arm (Relaxed natural A-pose at ~18°, hands open gracefully)
  const armPathLeft = [
    [-0.170, 1.385, -0.015], // Shoulder
    [-0.198, 1.260, -0.015], // Upper bicep
    [-0.230, 1.130, -0.015], // Elbow
    [-0.258, 0.990, -0.010], // Forearm
    [-0.278, 0.870, -0.005], // Wrist
    [-0.290, 0.770,  0.000], // Hand & relaxed fingertips
  ];
  const armRadii = [0.046, 0.040, 0.036, 0.032, 0.024, 0.018];
  addLimb(armPathLeft, armRadii);

  // Right Arm (Mirrored)
  const armPathRight = armPathLeft.map(([x, y, z]) => [-x, y, z]);
  addLimb(armPathRight, armRadii);

  // Left Leg (From pelvic socket Y=0.80m down to ankle and foot Y=0.00m)
  const legPathLeft = [
    [-0.080, 0.800, -0.008], // Upper thigh
    [-0.078, 0.650, -0.006], // Mid thigh
    [-0.076, 0.485, -0.002], // Knee
    [-0.074, 0.335, -0.005], // Upper calf
    [-0.072, 0.180, -0.008], // Lower calf
    [-0.070, 0.075, -0.010], // Ankle
    [-0.070, 0.020,  0.035], // Ball of foot / toes
  ];
  const legRadii = [0.074, 0.065, 0.050, 0.044, 0.034, 0.026, 0.022];
  addLimb(legPathLeft, legRadii);

  // Right Leg (Mirrored)
  const legPathRight = legPathLeft.map(([x, y, z]) => [-x, y, z]);
  addLimb(legPathRight, legRadii);

  const normals = computeVertexNormals(positions, indices);
  const morphDeltas = computeMorphDeltas(positions);

  return {
    positions,
    normals,
    uvs,
    indices,
    morphDeltas,
    targetNames: TARGET_NAMES,
  };
}

/**
 * Builds the hair mesh (Hair Primitive: traditional bun + sculpted scalp volume)
 */
export function generateHairGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  // 1. Hair Bun (Búi tóc truyền thống sau gáy)
  const BUN_RINGS = 10;
  const BUN_SECTORS = 18;
  const bunCenterY = 1.610;
  const bunCenterZ = -0.098;
  const bunRadius = 0.048;

  const baseBunIdx = positions.length / 3;
  for (let r = 0; r <= BUN_RINGS; r++) {
    const phi = (r / BUN_RINGS) * Math.PI;
    const y = bunCenterY + bunRadius * Math.cos(phi);
    const ringR = bunRadius * Math.sin(phi);

    for (let s = 0; s <= BUN_SECTORS; s++) {
      const theta = (s / BUN_SECTORS) * Math.PI * 2;
      const x = ringR * Math.sin(theta);
      const z = bunCenterZ - ringR * Math.cos(theta);

      positions.push(x, y, z);
      uvs.push(s / BUN_SECTORS, r / BUN_RINGS);
    }
  }

  for (let r = 0; r < BUN_RINGS; r++) {
    for (let s = 0; s < BUN_SECTORS; s++) {
      const row1 = baseBunIdx + r * (BUN_SECTORS + 1);
      const row2 = baseBunIdx + (r + 1) * (BUN_SECTORS + 1);

      indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
      indices.push(row1 + s, row2 + s + 1, row2 + s);
    }
  }

  // 2. Scalp hair cap (Lớp tóc mượt ôm sát đỉnh đầu)
  const CAP_RINGS = [
    { y: 1.675, rx: 0.020, rz: 0.022, zOff: -0.010 }, // Hair part / crown
    { y: 1.658, rx: 0.070, rz: 0.080, zOff: -0.014 },
    { y: 1.625, rx: 0.086, rz: 0.096, zOff: -0.012 },
    { y: 1.595, rx: 0.082, rz: 0.092, zOff: -0.015 }, // Hairline boundary
  ];
  const CAP_SECTORS = 20;
  const baseCapIdx = positions.length / 3;

  for (let r = 0; r < CAP_RINGS.length; r++) {
    const ring = CAP_RINGS[r];
    const v = r / (CAP_RINGS.length - 1);
    for (let s = 0; s <= CAP_SECTORS; s++) {
      const u = s / CAP_SECTORS;
      const theta = u * Math.PI * 2;
      const x = ring.rx * Math.sin(theta);
      const y = ring.y;
      const z = ring.rz * Math.cos(theta) + ring.zOff;

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < CAP_RINGS.length - 1; r++) {
    for (let s = 0; s < CAP_SECTORS; s++) {
      const row1 = baseCapIdx + r * (CAP_SECTORS + 1);
      const row2 = baseCapIdx + (r + 1) * (CAP_SECTORS + 1);

      indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
      indices.push(row1 + s, row2 + s + 1, row2 + s);
    }
  }

  const normals = computeVertexNormals(positions, indices);
  const morphDeltas = computeMorphDeltas(positions);

  return {
    positions,
    normals,
    uvs,
    indices,
    morphDeltas,
    targetNames: TARGET_NAMES,
  };
}

/**
 * Returns combined avatar primitives for multi-material GLB generation
 */
export function generateAvatarGeometry() {
  const skin = generateSkinGeometry();
  const hair = generateHairGeometry();

  return {
    skin,
    hair,
    // Provide flat fallback properties for any code expecting direct positions
    positions: skin.positions,
    normals: skin.normals,
    uvs: skin.uvs,
    indices: skin.indices,
    morphDeltas: skin.morphDeltas,
    targetNames: TARGET_NAMES,
  };
}
