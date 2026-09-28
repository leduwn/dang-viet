/**
 * 3D Garment Mesh Generator for Vietnamese Ao Dai and Pants with 5 Morph Targets
 * Supports:
 * 1. aodai_classic_01 (Cổ đứng truyền thống 3.5cm, tay dài, tà dài qua gối, quần suông lụa)
 * 2. aodai_remix_raglan (Cổ thuyền cách tân, tay raglan ôm nhẹ, tà lỡ hiện đại, quần suông)
 */

import { computeVertexNormals } from './avatar-mesh.mjs';

/**
 * Creates an Ao Dai mesh with specified style parameters
 */
export function generateAoDaiGeometry(options = {}) {
  const {
    collarType = 'high_stand', // 'high_stand' | 'boat' | 'round'
    sleeveType = 'long',       // 'long' | 'raglan' | 'elbow'
    flapLength = 'long',       // 'long' (knee/calf ~0.42m) | 'midi' (~0.52m)
  } = options;

  const positions = [];
  const uvs = [];
  const indices = [];

  const SECTORS = 20;

  // 1. COLLAR
  const collarBaseY = collarType === 'boat' ? 1.43 : 1.46;
  const collarTopY  = collarType === 'boat' ? 1.44 : (collarType === 'round' ? 1.47 : 1.495); // 3.5cm standing collar
  const collarRad   = collarType === 'boat' ? 0.065 : 0.046;

  function addCylinder(yBottom, yTop, rBottom, rTop, vStart, vEnd, sectors = 16) {
    const baseIdx = positions.length / 3;
    const rings = 4;
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      const y = yBottom + (yTop - yBottom) * t;
      const rad = rBottom + (rTop - rBottom) * t;
      const v = vStart + (vEnd - vStart) * t;

      for (let s = 0; s <= sectors; s++) {
        const u = s / sectors;
        const theta = u * Math.PI * 2;
        const x = rad * Math.sin(theta);
        const z = rad * Math.cos(theta) - 0.010;

        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < sectors; s++) {
        const row1 = baseIdx + r * (sectors + 1);
        const row2 = baseIdx + (r + 1) * (sectors + 1);
        indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
        indices.push(row1 + s, row2 + s + 1, row2 + s);
      }
    }
  }

  addCylinder(collarBaseY, collarTopY, collarRad, collarRad * 0.98, 0.90, 1.0, 16);

  // 2. BODICE (Upper Torso from collar down to waist Y=1.05m where slits start)
  const bodiceRings = [
    { y: collarBaseY, rx: collarRad + 0.015, rz: collarRad + 0.015, zOff: -0.012 },
    { y: 1.39, rx: 0.174, rz: 0.092, zOff: -0.015 },
    { y: 1.35, rx: 0.160, rz: 0.103, zOff: -0.010 },
    { y: 1.28, rx: 0.154, rz: 0.118, zOff:  0.014 }, // Bust contour (clears skin by ~5mm)
    { y: 1.20, rx: 0.141, rz: 0.096, zOff: -0.005 },
    { y: 1.12, rx: 0.125, rz: 0.086, zOff: -0.008 },
    { y: 1.05, rx: 0.120, rz: 0.084, zOff: -0.008 }, // Waistline / slit apex (eo xẻ tà)
  ];

  function addBodice(rings) {
    const baseIdx = positions.length / 3;
    const ringCount = rings.length;

    for (let r = 0; r < ringCount; r++) {
      const ring = rings[r];
      const v = 0.55 + 0.35 * (r / (ringCount - 1));

      for (let s = 0; s <= SECTORS; s++) {
        const u = s / SECTORS;
        const theta = u * Math.PI * 2;
        const x = ring.rx * Math.sin(theta);
        const y = ring.y;
        const z = ring.rz * Math.cos(theta) + ring.zOff;

        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }

    for (let r = 0; r < ringCount - 1; r++) {
      for (let s = 0; s < SECTORS; s++) {
        const row1 = baseIdx + r * (SECTORS + 1);
        const row2 = baseIdx + (r + 1) * (SECTORS + 1);
        indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
        indices.push(row1 + s, row2 + s + 1, row2 + s);
      }
    }
  }
  addBodice(bodiceRings);

  // 3. FRONT & BACK FLAPS (Tà Trước & Tà Sau)
  // Split at sides: X in [-rx, +rx].
  // Front flap: Z > zOff; Back flap: Z < zOff.
  const flapBottomY = flapLength === 'midi' ? 0.52 : 0.42; // Below knee for traditional
  const flapSteps = 8;
  const flapWidths = [
    { y: 1.05, w: 0.24, zCurve: 0.090 },
    { y: 0.98, w: 0.27, zCurve: 0.100 },
    { y: 0.90, w: 0.33, zCurve: 0.120 }, // High hip
    { y: 0.80, w: 0.34, zCurve: 0.122 },
    { y: 0.70, w: 0.35, zCurve: 0.120 },
    { y: 0.60, w: 0.36, zCurve: 0.115 },
    { y: 0.50, w: 0.37, zCurve: 0.110 },
    { y: flapBottomY, w: 0.38, zCurve: 0.108 }, // Hemline
  ];

  function addFlap(isFront = true) {
    const baseIdx = positions.length / 3;
    const COLS = 10;
    const signZ = isFront ? 1 : -1;
    const zOffset = isFront ? 0.005 : -0.015;

    for (let r = 0; r < flapSteps; r++) {
      const row = flapWidths[r];
      const v = 0.55 * (1 - r / (flapSteps - 1));

      for (let c = 0; c <= COLS; c++) {
        const u = c / COLS;
        const x = (u - 0.5) * row.w;
        const y = row.y;
        // Mild cylindrical curvature across the flap width
        const arch = Math.cos((u - 0.5) * Math.PI);
        const z = zOffset + signZ * (row.zCurve + arch * 0.015);

        positions.push(x, y, z);
        uvs.push(isFront ? u : (1 - u), v);
      }
    }

    for (let r = 0; r < flapSteps - 1; r++) {
      for (let c = 0; c < COLS; c++) {
        const row1 = baseIdx + r * (COLS + 1);
        const row2 = baseIdx + (r + 1) * (COLS + 1);

        const i0 = row1 + c;
        const i1 = row1 + c + 1;
        const i2 = row2 + c + 1;
        const i3 = row2 + c;

        if (isFront) {
          indices.push(i0, i1, i2);
          indices.push(i0, i2, i3);
        } else {
          indices.push(i0, i2, i1);
          indices.push(i0, i3, i2);
        }
      }
    }
  }

  addFlap(true);  // Tà trước
  addFlap(false); // Tà sau

  // 4. SLEEVES (Tay áo dài / lỡ)
  function addSleeve(isRight = false) {
    const baseIdx = positions.length / 3;
    const signX = isRight ? 1 : -1;
    const sleeveSectors = 12;

    const armPath = [
      [signX * 0.174, 1.38, -0.015], // Shoulder
      [signX * 0.205, 1.25, -0.015], // Bicep
      [signX * 0.240, 1.12, -0.015], // Elbow
      [signX * 0.270, 0.98, -0.010], // Forearm
      [signX * 0.290, 0.86, -0.005], // Wrist
    ];

    const sleeveRadii = sleeveType === 'raglan'
      ? [0.054, 0.046, 0.041, 0.037, 0.030]
      : [0.052, 0.045, 0.040, 0.036, 0.029];

    const count = sleeveType === 'elbow' ? 3 : armPath.length;

    for (let i = 0; i < count; i++) {
      const pt = armPath[i];
      const rad = sleeveRadii[i];
      const nextPt = armPath[Math.min(i + 1, count - 1)];
      const prevPt = armPath[Math.max(0, i - 1)];

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

      for (let s = 0; s <= sleeveSectors; s++) {
        const u = s / sleeveSectors;
        const theta = u * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        const x = pt[0] + (side[0] * cos + norm[0] * sin) * rad;
        const y = pt[1] + (side[1] * cos + norm[1] * sin) * rad;
        const z = pt[2] + (side[2] * cos + norm[2] * sin) * rad;

        positions.push(x, y, z);
        uvs.push(u, i / (count - 1));
      }
    }

    for (let i = 0; i < count - 1; i++) {
      for (let s = 0; s < sleeveSectors; s++) {
        const row1 = baseIdx + i * (sleeveSectors + 1);
        const row2 = baseIdx + (i + 1) * (sleeveSectors + 1);

        const i0 = row1 + s;
        const i1 = row1 + s + 1;
        const i2 = row2 + s + 1;
        const i3 = row2 + s;

        if (isRight) {
          indices.push(i0, i2, i1);
          indices.push(i0, i3, i2);
        } else {
          indices.push(i0, i1, i2);
          indices.push(i0, i2, i3);
        }
      }
    }
  }

  addSleeve(false); // Left sleeve
  addSleeve(true);  // Right sleeve

  const normals = computeVertexNormals(positions, indices);

  // 5. MORPH TARGETS (Identical to avatar deformation vector space)
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

    // --- 0. Petite
    const petiteScaleY = 0.945;
    const petiteScaleXZ = 0.90;
    morphDeltas[0][idx]     = x * (petiteScaleXZ - 1);
    morphDeltas[0][idx + 1] = y * (petiteScaleY - 1);
    morphDeltas[0][idx + 2] = z * (petiteScaleXZ - 1);

    // --- 1. Tall Slender
    const tallScaleY = 1.042;
    const slenderXZ = 0.96;
    morphDeltas[1][idx]     = x * (slenderXZ - 1);
    morphDeltas[1][idx + 1] = y * (tallScaleY - 1);
    morphDeltas[1][idx + 2] = z * (slenderXZ - 1);

    // --- 2. Broad Shoulders (y in [1.25, 1.45])
    if (y >= 1.25 && y <= 1.45) {
      const weight = Math.sin(((y - 1.25) / 0.20) * Math.PI);
      morphDeltas[2][idx] = Math.sign(x) * 0.024 * weight;
    }

    // --- 3. Curvy Hips (y in [0.75, 1.02])
    if (y >= 0.75 && y <= 1.02) {
      const weight = Math.sin(((y - 0.75) / 0.27) * Math.PI);
      morphDeltas[3][idx]     = Math.sign(x) * 0.028 * weight;
      morphDeltas[3][idx + 2] = z * 0.12 * weight;
    }

    // --- 4. Plus Size
    if (y >= 0.40 && y <= 1.45) {
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

/**
 * Creates wide-leg silk pants (Quần lụa hai ống rộng truyền thống)
 */
export function generatePantsGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const SECTORS = 16;
  const legSteps = [
    { y: 1.05, rad: 0.095, zOff: -0.008 }, // Waist junction
    { y: 0.90, rad: 0.105, zOff: -0.006 }, // Upper thigh
    { y: 0.70, rad: 0.115, zOff: -0.004 }, // Mid thigh
    { y: 0.48, rad: 0.125, zOff: -0.002 }, // Knee (flowing silk flare)
    { y: 0.25, rad: 0.135, zOff:  0.000 }, // Mid calf
    { y: 0.04, rad: 0.145, zOff:  0.005 }, // Hem at ankle/floor
  ];

  function addPantsLeg(isRight = false) {
    const baseIdx = positions.length / 3;
    const signX = isRight ? 1 : -1;
    const legCenterX = signX * 0.082;
    const stepCount = legSteps.length;

    for (let r = 0; r < stepCount; r++) {
      const step = legSteps[r];
      const v = 1 - r / (stepCount - 1);

      for (let s = 0; s <= SECTORS; s++) {
        const u = s / SECTORS;
        const theta = u * Math.PI * 2;
        const x = legCenterX + step.rad * Math.sin(theta);
        const y = step.y;
        const z = step.rad * Math.cos(theta) + step.zOff;

        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }

    for (let r = 0; r < stepCount - 1; r++) {
      for (let s = 0; s < SECTORS; s++) {
        const row1 = baseIdx + r * (SECTORS + 1);
        const row2 = baseIdx + (r + 1) * (SECTORS + 1);

        const i0 = row1 + s;
        const i1 = row1 + s + 1;
        const i2 = row2 + s + 1;
        const i3 = row2 + s;

        if (isRight) {
          indices.push(i0, i2, i1);
          indices.push(i0, i3, i2);
        } else {
          indices.push(i0, i1, i2);
          indices.push(i0, i2, i3);
        }
      }
    }
  }

  addPantsLeg(false); // Left leg
  addPantsLeg(true);  // Right leg

  const normals = computeVertexNormals(positions, indices);

  // 5 Morph targets matching body and ao dai
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

    // Petite
    morphDeltas[0][idx]     = x * (0.90 - 1);
    morphDeltas[0][idx + 1] = y * (0.945 - 1);
    morphDeltas[0][idx + 2] = z * (0.90 - 1);

    // Tall Slender
    morphDeltas[1][idx]     = x * (0.96 - 1);
    morphDeltas[1][idx + 1] = y * (1.042 - 1);
    morphDeltas[1][idx + 2] = z * (0.96 - 1);

    // Broad Shoulders (No significant delta on pants)
    morphDeltas[2][idx] = 0;

    // Curvy Hips
    if (y >= 0.70 && y <= 1.05) {
      const weight = Math.sin(((y - 0.70) / 0.35) * Math.PI);
      morphDeltas[3][idx]     = Math.sign(x) * 0.028 * weight;
      morphDeltas[3][idx + 2] = z * 0.12 * weight;
    }

    // Plus Size
    morphDeltas[4][idx]     = x * 0.18;
    morphDeltas[4][idx + 2] = z * 0.20;
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
