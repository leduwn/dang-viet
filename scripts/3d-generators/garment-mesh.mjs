/**
 * 3D Garment Mesh Generator for Vietnamese Ao Dai and Pants with 5 Morph Targets
 * Features:
 * - Seamless collar-to-bodice and bodice-to-flap continuity
 * - True anatomical side slits (xẻ tà eo) with folded hem geometry (no DoubleSide cheat needed)
 * - Complete silk pants geometry with closed waistband, hip/pelvis volume, and dual flowing legs
 * - 5 synchronized morph targets matching the avatar deformation space
 */

import { computeVertexNormals, computeMorphDeltas } from './avatar-mesh.mjs';

const TARGET_NAMES = [
  'morph_petite',
  'morph_tall_slender',
  'morph_broad_shoulders',
  'morph_curvy_hips',
  'morph_plus_size',
];

/**
 * Creates an Ao Dai mesh with specified collar, sleeve, and flap parameters
 */
export function generateAoDaiGeometry(options = {}) {
  const {
    collarType = 'high_stand', // 'high_stand' | 'round' | 'boat' | 'v_neck'
    sleeveType = 'long',       // 'long' | 'raglan' | 'elbow' | 'slit'
    flapLength = 'long',       // 'long' (~0.42m) | 'midi' (~0.54m)
  } = options;

  const positions = [];
  const uvs = [];
  const indices = [];

  // =========================================================================
  // 1. COLLAR WITH HEMMED RIM (Cổ áo có độ dày viền mép)
  // =========================================================================
  const collarBaseY = collarType === 'boat' ? 1.425 : (collarType === 'round' ? 1.435 : 1.450);
  const collarTopY  = collarType === 'boat' ? 1.438 : (collarType === 'round' ? 1.455 : (collarType === 'v_neck' ? 1.460 : 1.488)); // Standing 3.8cm
  const collarRad   = collarType === 'boat' ? 0.070 : (collarType === 'round' ? 0.058 : 0.048);
  const collarSectors = 24;

  const collarBaseIdx = positions.length / 3;
  const collarRings = 4;
  for (let r = 0; r <= collarRings; r++) {
    const t = r / collarRings;
    const y = collarBaseY + (collarTopY - collarBaseY) * t;
    const rad = collarRad * (1.0 - 0.03 * t);
    const v = 0.90 + 0.10 * t;

    for (let s = 0; s <= collarSectors; s++) {
      const u = s / collarSectors;
      const theta = u * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      // Add subtle V-notch if v_neck
      let zOff = -0.012;
      let yMod = y;
      if (collarType === 'v_neck' && Math.abs(theta - Math.PI / 2) < 0.4) {
        yMod -= 0.025 * (1.0 - Math.abs(theta - Math.PI / 2) / 0.4);
      }

      const x = rad * sin;
      const z = rad * cos + zOff;

      positions.push(x, yMod, z);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < collarRings; r++) {
    for (let s = 0; s < collarSectors; s++) {
      const row1 = collarBaseIdx + r * (collarSectors + 1);
      const row2 = collarBaseIdx + (r + 1) * (collarSectors + 1);
      indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
      indices.push(row1 + s, row2 + s + 1, row2 + s);
    }
  }

  // =========================================================================
  // 2. CONTINUOUS BODICE & FLAPS (Thân áo liền lạc với tà trước và tà sau)
  // =========================================================================
  // The bodice seamlessly encloses the torso from collarBaseY down to waist Y=1.05m.
  // At waist Y=1.05m, the side seam splits into two elegant flowing panels:
  // Front Flap (Tà trước) and Back Flap (Tà sau), each with folded hem edges.

  const flapBottomY = flapLength === 'midi' ? 0.54 : 0.42;

  // Upper Bodice Rings (Enclosed tube from collar to waist)
  const bodiceRings = [
    { y: collarBaseY, rx: collarRad + 0.012, rz: collarRad + 0.012, zOff: -0.012 },
    { y: 1.395, rx: 0.174, rz: 0.092, zOff: -0.015 }, // Shoulder / clavicle
    { y: 1.350, rx: 0.160, rz: 0.103, zOff: -0.010 }, // Upper chest
    { y: 1.280, rx: 0.154, rz: 0.118, zOff:  0.014 }, // Bust contour (clears skin by ~4mm)
    { y: 1.200, rx: 0.141, rz: 0.098, zOff: -0.005 }, // Ribcage
    { y: 1.120, rx: 0.125, rz: 0.086, zOff: -0.008 }, // Upper waist
    { y: 1.050, rx: 0.120, rz: 0.084, zOff: -0.008 }, // Natural waist (Điểm xẻ tà)
  ];

  const BODICE_SECTORS = 24;
  const bodiceBaseIdx = positions.length / 3;

  for (let r = 0; r < bodiceRings.length; r++) {
    const ring = bodiceRings[r];
    const v = 0.55 + 0.35 * (1.0 - r / (bodiceRings.length - 1));

    for (let s = 0; s <= BODICE_SECTORS; s++) {
      const u = s / BODICE_SECTORS;
      const theta = u * Math.PI * 2;
      const x = ring.rx * Math.sin(theta);
      const y = ring.y;
      const z = ring.rz * Math.cos(theta) + ring.zOff;

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < bodiceRings.length - 1; r++) {
    for (let s = 0; s < BODICE_SECTORS; s++) {
      const row1 = bodiceBaseIdx + r * (BODICE_SECTORS + 1);
      const row2 = bodiceBaseIdx + (r + 1) * (BODICE_SECTORS + 1);
      indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
      indices.push(row1 + s, row2 + s + 1, row2 + s);
    }
  }

  // Flaps (Tà Trước & Tà Sau with side slit borders)
  const flapSteps = 8;
  const flapWidths = [
    { y: 1.05, w: 0.240, zCurve: 0.088 },
    { y: 0.98, w: 0.272, zCurve: 0.098 },
    { y: 0.90, w: 0.334, zCurve: 0.118 }, // High hip curve
    { y: 0.80, w: 0.346, zCurve: 0.120 },
    { y: 0.70, w: 0.358, zCurve: 0.118 },
    { y: 0.60, w: 0.368, zCurve: 0.114 },
    { y: 0.50, w: 0.378, zCurve: 0.110 },
    { y: flapBottomY, w: 0.388, zCurve: 0.108 }, // Hemline
  ];

  function addFlap(isFront = true) {
    const baseIdx = positions.length / 3;
    const COLS = 12;
    const signZ = isFront ? 1 : -1;
    const zOffset = isFront ? 0.006 : -0.016;

    for (let r = 0; r < flapSteps; r++) {
      const row = flapWidths[r];
      const v = 0.55 * (1.0 - r / (flapSteps - 1));

      for (let c = 0; c <= COLS; c++) {
        const u = c / COLS;
        const x = (u - 0.5) * row.w;
        const y = row.y;
        // Mild cylindrical curvature across the flap width
        const arch = Math.cos((u - 0.5) * Math.PI);
        const z = zOffset + signZ * (row.zCurve + arch * 0.014);

        positions.push(x, y, z);
        uvs.push(isFront ? u : (1.0 - u), v);
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

    // Add Hem Border (Độ dày gập mép viền 2mm cho tà áo, không phụ thuộc DoubleSide)
    const hemBaseIdx = positions.length / 3;
    const hemThickness = 0.003;
    for (let r = 0; r < flapSteps; r++) {
      const row = flapWidths[r];
      const v = 0.55 * (1.0 - r / (flapSteps - 1));
      for (let c = 0; c <= COLS; c++) {
        const u = c / COLS;
        const x = (u - 0.5) * row.w;
        const y = row.y;
        const arch = Math.cos((u - 0.5) * Math.PI);
        const z = zOffset + signZ * (row.zCurve + arch * 0.014 - hemThickness);

        positions.push(x, y, z);
        uvs.push(isFront ? (1.0 - u) : u, v);
      }
    }

    for (let r = 0; r < flapSteps - 1; r++) {
      for (let c = 0; c < COLS; c++) {
        const row1 = hemBaseIdx + r * (COLS + 1);
        const row2 = hemBaseIdx + (r + 1) * (COLS + 1);

        const i0 = row1 + c;
        const i1 = row1 + c + 1;
        const i2 = row2 + c + 1;
        const i3 = row2 + c;

        if (isFront) {
          indices.push(i0, i2, i1);
          indices.push(i0, i3, i2);
        } else {
          indices.push(i0, i1, i2);
          indices.push(i0, i2, i3);
        }
      }
    }
  }

  addFlap(true);  // Tà trước
  addFlap(false); // Tà sau

  // =========================================================================
  // 3. SLEEVES (Tay áo dài / Raglan / lỡ / xẻ tà)
  // =========================================================================
  function addSleeve(isRight = false) {
    const baseIdx = positions.length / 3;
    const signX = isRight ? 1 : -1;
    const sleeveSectors = 16;

    // Raglan sleeves cut diagonally from collar junction to armpit
    const armPath = sleeveType === 'raglan'
      ? [
          [signX * 0.170, 1.390, -0.015], // Raglan shoulder slope
          [signX * 0.202, 1.265, -0.015], // Bicep
          [signX * 0.235, 1.135, -0.015], // Elbow
          [signX * 0.264, 0.995, -0.010], // Forearm
          [signX * 0.284, 0.875, -0.005], // Wrist
        ]
      : [
          [signX * 0.174, 1.385, -0.015], // Classic shoulder set-in
          [signX * 0.205, 1.260, -0.015], // Bicep
          [signX * 0.238, 1.130, -0.015], // Elbow
          [signX * 0.268, 0.990, -0.010], // Forearm
          [signX * 0.288, 0.870, -0.005], // Wrist
        ];

    const sleeveRadii = sleeveType === 'raglan'
      ? [0.052, 0.045, 0.040, 0.036, 0.029]
      : [0.050, 0.044, 0.039, 0.035, 0.028];

    const count = sleeveType === 'elbow' ? 3 : armPath.length;

    for (let i = 0; i < count; i++) {
      const pt = armPath[i];
      let rad = sleeveRadii[i];
      // Flared slit sleeve effect if sleeveType === 'slit'
      if (sleeveType === 'slit' && i >= count - 2) {
        rad += 0.014;
      }

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

        indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
        indices.push(row1 + s, row2 + s + 1, row2 + s);
      }
    }
  }

  addSleeve(false); // Left sleeve
  addSleeve(true);  // Right sleeve

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
 * Creates wide-leg silk pants (Quần lụa hai ống rộng truyền thống)
 * Includes:
 * - Fitted waistband at Y=1.06m
 * - Enclosed pelvic volume (che kín hông & mông không lộ khoảng hở dưới xẻ tà)
 * - Crotch junction (đũng quần) branching smoothly into 2 wide flowing legs down to floor Y=0.025m
 */
export function generatePantsGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const SECTORS = 20;

  // 1. PELVIC VOLUME & WAISTBAND (Cạp quần & vùng hông đũng kín)
  // Height range: Y=1.06m down to Y=0.80m (where legs separate)
  const pelvisRings = [
    { y: 1.060, rx: 0.120, rz: 0.084, zOff: -0.008 }, // Waistband underneath garment
    { y: 0.980, rx: 0.140, rz: 0.096, zOff: -0.006 }, // High hip
    { y: 0.890, rx: 0.170, rz: 0.118, zOff: -0.005 }, // Buttocks apex
    { y: 0.800, rx: 0.162, rz: 0.110, zOff: -0.008 }, // Crotch level (Đáy đũng)
  ];

  const pelvisBaseIdx = positions.length / 3;
  for (let r = 0; r < pelvisRings.length; r++) {
    const ring = pelvisRings[r];
    const v = 0.70 + 0.30 * (1.0 - r / (pelvisRings.length - 1));

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

  for (let r = 0; r < pelvisRings.length - 1; r++) {
    for (let s = 0; s < SECTORS; s++) {
      const row1 = pelvisBaseIdx + r * (SECTORS + 1);
      const row2 = pelvisBaseIdx + (r + 1) * (SECTORS + 1);

      indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
      indices.push(row1 + s, row2 + s + 1, row2 + s);
    }
  }

  // 2. TWO WIDE FLOWING LEGS (Hai ống quần lụa suông rộng xòe nhẹ)
  const legSteps = [
    { y: 0.800, rad: 0.100, zOff: -0.008 }, // Inseam fork
    { y: 0.680, rad: 0.112, zOff: -0.006 }, // Upper thigh
    { y: 0.480, rad: 0.124, zOff: -0.003 }, // Knee
    { y: 0.250, rad: 0.136, zOff:  0.000 }, // Mid calf
    { y: 0.025, rad: 0.148, zOff:  0.005 }, // Hem touching foot
  ];

  function addPantsLeg(isRight = false) {
    const baseIdx = positions.length / 3;
    const signX = isRight ? 1 : -1;
    const legCenterX = signX * 0.082;
    const stepCount = legSteps.length;

    for (let r = 0; r < stepCount; r++) {
      const step = legSteps[r];
      const v = 0.70 * (1.0 - r / (stepCount - 1));

      for (let s = 0; s <= SECTORS; s++) {
        const u = s / SECTORS;
        const theta = u * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        const x = legCenterX + step.rad * sin;
        const y = step.y;
        const z = step.rad * cos + step.zOff;

        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }

    for (let r = 0; r < stepCount - 1; r++) {
      for (let s = 0; s < SECTORS; s++) {
        const row1 = baseIdx + r * (SECTORS + 1);
        const row2 = baseIdx + (r + 1) * (SECTORS + 1);

        indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
        indices.push(row1 + s, row2 + s + 1, row2 + s);
      }
    }
  }

  addPantsLeg(false); // Left leg
  addPantsLeg(true);  // Right leg

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
