/**
 * Anatomical 3D Mesh Generator for Vietnamese Female Avatar with 5 Morph Targets
 */

// Helper to compute normals
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

  // Normalize
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l;
    normals[i + 1] /= l;
    normals[i + 2] /= l;
  }
  return normals;
}

/**
 * Builds the complete avatar body mesh
 */
export function generateAvatarGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  // 1. Head & Facial Anatomy (Loft / Lathed rings with feature profile)
  // Height range: 1.48m (chin/neck junction) to 1.67m (crown of head)
  const headRings = [
    { y: 1.67, rx: 0.010, rz: 0.012, zOff: -0.010 }, // Top of head
    { y: 1.65, rx: 0.065, rz: 0.075, zOff: -0.012 }, // Crown
    { y: 1.61, rx: 0.082, rz: 0.092, zOff: -0.010 }, // Forehead / brow
    { y: 1.57, rx: 0.078, rz: 0.088, zOff: -0.005 }, // Eyes / Cheekbones
    { y: 1.54, rx: 0.068, rz: 0.080, zOff:  0.005 }, // Nose tip / mouth
    { y: 1.50, rx: 0.045, rz: 0.055, zOff:  0.002 }, // Chin / Jawline
    { y: 1.46, rx: 0.042, rz: 0.046, zOff: -0.010 }, // Upper neck
    { y: 1.41, rx: 0.052, rz: 0.054, zOff: -0.012 }, // Base of neck / clavicle junction
  ];

  // 2. Torso (Shoulders to Groin)
  // Height range: 1.41m down to 0.78m
  const torsoRings = [
    { y: 1.39, rx: 0.170, rz: 0.088, zOff: -0.015 }, // Shoulder girdle
    { y: 1.35, rx: 0.155, rz: 0.098, zOff: -0.010 }, // Upper chest
    { y: 1.28, rx: 0.148, rz: 0.112, zOff:  0.012 }, // Bust apex
    { y: 1.20, rx: 0.136, rz: 0.092, zOff: -0.005 }, // Ribcage
    { y: 1.12, rx: 0.120, rz: 0.082, zOff: -0.008 }, // Upper waist
    { y: 1.05, rx: 0.115, rz: 0.080, zOff: -0.008 }, // Natural waist (thắt lưng)
    { y: 0.98, rx: 0.135, rz: 0.094, zOff: -0.006 }, // Iliac crest / high hip
    { y: 0.90, rx: 0.168, rz: 0.115, zOff: -0.005 }, // Hips apex / buttocks
    { y: 0.82, rx: 0.160, rz: 0.108, zOff: -0.008 }, // Low hip / groin start
  ];

  const SECTORS = 20;

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

    // Build quad indices
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

  // Add Head and Torso
  addLathedTube(headRings, 0.8, 1.0);
  addLathedTube(torsoRings, 0.5, 0.8);

  // 3. Hair Bun (Búi tóc truyền thống) at the back of the head
  function addHairBun() {
    const baseIdx = positions.length / 3;
    const BUN_RINGS = 8;
    const BUN_SECTORS = 16;
    const bunCenterY = 1.61;
    const bunCenterZ = -0.10;
    const bunRadius = 0.048;

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
        const row1 = baseIdx + r * (BUN_SECTORS + 1);
        const row2 = baseIdx + (r + 1) * (BUN_SECTORS + 1);

        const i0 = row1 + s;
        const i1 = row1 + s + 1;
        const i2 = row2 + s + 1;
        const i3 = row2 + s;

        indices.push(i0, i1, i2);
        indices.push(i0, i2, i3);
      }
    }
  }
  addHairBun();

  // 4. Arms in natural A-pose (Left and Right)
  // Arms angle downwards at ~20° from vertical
  function addLimb(centerPath, radii, sectors = 12) {
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

      // Normal and binormal vectors for ring extrusion
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

        const i0 = row1 + s;
        const i1 = row1 + s + 1;
        const i2 = row2 + s + 1;
        const i3 = row2 + s;

        indices.push(i0, i1, i2);
        indices.push(i0, i2, i3);
      }
    }
  }

  // Left Arm (from shoulder X=-0.17 to hand X=-0.30)
  const armPathLeft = [
    [-0.170, 1.38, -0.015], // Shoulder
    [-0.200, 1.25, -0.015], // Upper bicep
    [-0.235, 1.12, -0.015], // Elbow
    [-0.265, 0.98, -0.010], // Forearm
    [-0.285, 0.86, -0.005], // Wrist
    [-0.295, 0.78,  0.000], // Hand / fingertips
  ];
  const armRadii = [0.048, 0.042, 0.038, 0.034, 0.026, 0.020];
  addLimb(armPathLeft, armRadii);

  // Right Arm (Mirrored)
  const armPathRight = armPathLeft.map(([x, y, z]) => [-x, y, z]);
  addLimb(armPathRight, armRadii);

  // 5. Legs (Left and Right)
  // From groin (Y=0.80) to floor (Y=0.00)
  const legPathLeft = [
    [-0.082, 0.80, -0.008], // Upper thigh
    [-0.080, 0.65, -0.006], // Mid thigh
    [-0.078, 0.49, -0.002], // Knee
    [-0.076, 0.34, -0.005], // Upper calf
    [-0.074, 0.18, -0.008], // Lower calf
    [-0.072, 0.07, -0.010], // Ankle
    [-0.072, 0.02,  0.035], // Foot toe
  ];
  const legRadii = [0.076, 0.068, 0.052, 0.046, 0.036, 0.028, 0.024];
  addLimb(legPathLeft, legRadii);

  // Right Leg (Mirrored)
  const legPathRight = legPathLeft.map(([x, y, z]) => [-x, y, z]);
  addLimb(legPathRight, legRadii);

  // Normals
  const normals = computeVertexNormals(positions, indices);

  // -------------------------------------------------------------
  // 6. GENERATE 5 MORPH TARGETS FOR BODY SHAPES
  // Target 0: morph_petite
  // Target 1: morph_tall_slender
  // Target 2: morph_broad_shoulders
  // Target 3: morph_curvy_hips
  // Target 4: morph_plus_size
  // -------------------------------------------------------------
  const vCount = positions.length / 3;
  const morphDeltas = [
    new Float32Array(positions.length), // petite
    new Float32Array(positions.length), // tall_slender
    new Float32Array(positions.length), // broad_shoulders
    new Float32Array(positions.length), // curvy_hips
    new Float32Array(positions.length), // plus_size
  ];

  for (let i = 0; i < vCount; i++) {
    const idx = i * 3;
    const x = positions[idx];
    const y = positions[idx + 1];
    const z = positions[idx + 2];

    // --- 0. Petite (Scale height to ~1.56m, narrower shoulders & hips)
    const petiteScaleY = 0.945;
    const petiteScaleXZ = 0.90;
    morphDeltas[0][idx]     = x * (petiteScaleXZ - 1);
    morphDeltas[0][idx + 1] = y * (petiteScaleY - 1);
    morphDeltas[0][idx + 2] = z * (petiteScaleXZ - 1);

    // --- 1. Tall Slender (Scale height to ~1.72m, slender waist)
    const tallScaleY = 1.042;
    const slenderXZ = 0.96;
    morphDeltas[1][idx]     = x * (slenderXZ - 1);
    morphDeltas[1][idx + 1] = y * (tallScaleY - 1);
    morphDeltas[1][idx + 2] = z * (slenderXZ - 1);

    // --- 2. Broad Shoulders (Widen shoulder & chest region y in [1.25, 1.45])
    if (y >= 1.25 && y <= 1.45) {
      const weight = Math.sin(((y - 1.25) / 0.20) * Math.PI);
      morphDeltas[2][idx] = Math.sign(x) * 0.024 * weight;
    }

    // --- 3. Curvy Hips (Widen hips region y in [0.75, 1.00])
    if (y >= 0.75 && y <= 1.02) {
      const weight = Math.sin(((y - 0.75) / 0.27) * Math.PI);
      morphDeltas[3][idx]     = Math.sign(x) * 0.028 * weight;
      morphDeltas[3][idx + 2] = z * 0.12 * weight;
    }

    // --- 4. Plus Size (Fuller body contour: torso, waist, thighs)
    if (y >= 0.15 && y <= 1.42) {
      morphDeltas[4][idx]     = x * 0.18;
      morphDeltas[4][idx + 2] = z * 0.20;
    }
  }

  return {
    positions,
    normals,
    uvs,
    indices,
    morphDeltas,
    targetNames: ['morph_petite', 'morph_tall_slender', 'morph_broad_shoulders', 'morph_curvy_hips', 'morph_plus_size'],
  };
}
