/**
 * 3D Mesh Generator for Cultural Accessories
 * - man_truyen_thong (Mấn đội đầu truyền thống)
 * - non_la (Nón lá bài thơ)
 * - chuoi_ngoc (Chuỗi ngọc trai đeo cổ)
 * - quat_xep (Quạt xếp cầm tay)
 * - tui_coi (Túi cói quai xách mộc mạc)
 * - guoc_moc (Guốc mộc quai nhung truyền thống)
 */

import { computeVertexNormals } from './avatar-mesh.mjs';

/**
 * Socket definitions for dynamic attachment and morph-tracking
 */
export const ACCESSORY_SOCKETS = {
  head: {
    basePosition: [0, 1.625, -0.010],
    trackedFeature: 'crown',
  },
  neck: {
    basePosition: [0, 1.390, -0.012],
    trackedFeature: 'clavicle',
  },
  right_hand: {
    basePosition: [0.290, 0.770, 0.000],
    trackedFeature: 'right_wrist',
  },
  left_hand: {
    basePosition: [-0.290, 0.770, 0.000],
    trackedFeature: 'left_wrist',
  },
  feet: {
    basePosition: [0, 0.000, 0.015],
    trackedFeature: 'ground',
  },
};

/**
 * 1. Mấn đội đầu truyền thống (Wrapped silk crown)
 */
export function generateManGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const RINGS = 20;
  const SECTORS = 12;
  const majorR = 0.090;
  const minorR = 0.022;
  const centerY = 1.625;
  const centerZ = -0.012;

  const baseIdx = 0;
  for (let r = 0; r <= RINGS; r++) {
    const phi = (r / RINGS) * Math.PI * 2;
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);

    // Mild backward slant typical of Vietnamese traditional man
    const ringCenterX = majorR * sinP;
    const ringCenterY = centerY - 0.015 * cosP;
    const ringCenterZ = centerZ + majorR * cosP * 0.95;

    for (let s = 0; s <= SECTORS; s++) {
      const theta = (s / SECTORS) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const x = ringCenterX + minorR * sinT * sinP;
      const y = ringCenterY + minorR * cosT;
      const z = ringCenterZ + minorR * sinT * cosP;

      positions.push(x, y, z);
      uvs.push(r / RINGS, s / SECTORS);
    }
  }

  for (let r = 0; r < RINGS; r++) {
    for (let s = 0; s < SECTORS; s++) {
      const row1 = baseIdx + r * (SECTORS + 1);
      const row2 = baseIdx + (r + 1) * (SECTORS + 1);
      indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
      indices.push(row1 + s, row2 + s + 1, row2 + s);
    }
  }

  const normals = computeVertexNormals(positions, indices);
  return { positions, normals, uvs, indices };
}

/**
 * 2. Nón lá bài thơ (Conical palm hat)
 */
export function generateNonLaGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const SECTORS = 28;
  const RINGS = 10;
  const apexY = 1.76;
  const baseY = 1.58;
  const baseR = 0.22;

  const baseIdx = 0;
  for (let r = 0; r <= RINGS; r++) {
    const t = r / RINGS;
    const y = apexY - (apexY - baseY) * t;
    const rad = baseR * t;

    for (let s = 0; s <= SECTORS; s++) {
      const theta = (s / SECTORS) * Math.PI * 2;
      const x = rad * Math.sin(theta);
      const z = rad * Math.cos(theta) - 0.010;

      positions.push(x, y, z);
      uvs.push(s / SECTORS, t);
    }
  }

  for (let r = 0; r < RINGS; r++) {
    for (let s = 0; s < SECTORS; s++) {
      const row1 = baseIdx + r * (SECTORS + 1);
      const row2 = baseIdx + (r + 1) * (SECTORS + 1);
      indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
      indices.push(row1 + s, row2 + s + 1, row2 + s);
    }
  }

  const normals = computeVertexNormals(positions, indices);
  return { positions, normals, uvs, indices };
}

/**
 * 3. Chuỗi ngọc trai đeo cổ (Pearl necklace)
 */
export function generateChuoiNgocGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const PEARLS = 24;
  const SECTORS = 8;
  const pearlRad = 0.007;

  // Arc draping gracefully across upper chest
  for (let i = 0; i <= PEARLS; i++) {
    const t = (i / PEARLS) * Math.PI;
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);

    const px = 0.075 * cosT;
    const py = 1.390 - 0.090 * sinT;
    const pz = 0.088 * sinT - 0.012;

    const baseIdx = positions.length / 3;
    for (let s = 0; s <= SECTORS; s++) {
      const theta = (s / SECTORS) * Math.PI * 2;
      positions.push(
        px + pearlRad * Math.sin(theta),
        py + pearlRad * Math.cos(theta),
        pz
      );
      uvs.push(s / SECTORS, i / PEARLS);
    }

    if (i < PEARLS) {
      for (let s = 0; s < SECTORS; s++) {
        const nextBase = baseIdx + (SECTORS + 1);
        indices.push(baseIdx + s, baseIdx + s + 1, nextBase + s + 1);
        indices.push(baseIdx + s, nextBase + s + 1, nextBase + s);
      }
    }
  }

  const normals = computeVertexNormals(positions, indices);
  return { positions, normals, uvs, indices };
}

/**
 * 4. Quạt xếp cầm tay (Folding fan held in right hand)
 */
export function generateQuatXepGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const BLADES = 14;
  const pivot = [0.290, 0.770, 0.010]; // Positioned at right hand
  const fanRadius = 0.16;

  const baseIdx = 0;
  positions.push(...pivot);
  uvs.push(0.5, 0);

  for (let b = 0; b <= BLADES; b++) {
    const angle = 0.2 + (b / BLADES) * (Math.PI * 0.65);
    const x = pivot[0] + fanRadius * Math.cos(angle);
    const y = pivot[1] + fanRadius * Math.sin(angle);
    const z = pivot[2] + (b % 2 === 0 ? 0.003 : -0.003); // Pleated folds

    positions.push(x, y, z);
    uvs.push(b / BLADES, 1.0);
  }

  for (let b = 1; b <= BLADES; b++) {
    indices.push(0, b, b + 1);
    indices.push(0, b + 1, b);
  }

  const normals = computeVertexNormals(positions, indices);
  return { positions, normals, uvs, indices };
}

/**
 * 5. Túi cói quai xách mộc mạc (Woven straw bag held in left hand)
 */
export function generateTuiCoiGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const bagCenter = [-0.290, 0.650, 0.010];
  const bagW = 0.090; // half-width
  const bagH = 0.120; // height
  const bagD = 0.045; // half-depth

  // Rounded box for woven straw body
  const STEPS_Y = 6;
  const SECTORS = 16;
  const baseIdx = positions.length / 3;

  for (let yStep = 0; yStep <= STEPS_Y; yStep++) {
    const t = yStep / STEPS_Y;
    const y = bagCenter[1] - bagH * 0.5 + bagH * t;
    const flare = 0.90 + 0.10 * t;

    for (let s = 0; s <= SECTORS; s++) {
      const u = s / SECTORS;
      const theta = u * Math.PI * 2;
      const x = bagCenter[0] + bagW * flare * Math.sin(theta);
      const z = bagCenter[2] + bagD * flare * Math.cos(theta);

      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }

  for (let yStep = 0; yStep < STEPS_Y; yStep++) {
    for (let s = 0; s < SECTORS; s++) {
      const row1 = baseIdx + yStep * (SECTORS + 1);
      const row2 = baseIdx + (yStep + 1) * (SECTORS + 1);
      indices.push(row1 + s, row1 + s + 1, row2 + s + 1);
      indices.push(row1 + s, row2 + s + 1, row2 + s);
    }
  }

  // Woven Strap (Quai túi) connecting from bag rim up to hand at Y=0.77m
  const strapSteps = 8;
  const strapBaseIdx = positions.length / 3;
  for (let i = 0; i <= strapSteps; i++) {
    const t = i / strapSteps;
    const phi = t * Math.PI;
    const sx = bagCenter[0] + 0.04 * Math.cos(phi);
    const sy = bagCenter[1] + bagH * 0.5 + 0.09 * Math.sin(phi);
    const sz = bagCenter[2];

    positions.push(sx, sy, sz);
    uvs.push(t, 0.5);
    positions.push(sx, sy, sz + 0.005);
    uvs.push(t, 0.6);
  }

  for (let i = 0; i < strapSteps; i++) {
    const r1 = strapBaseIdx + i * 2;
    const r2 = strapBaseIdx + (i + 1) * 2;
    indices.push(r1, r1 + 1, r2 + 1);
    indices.push(r1, r2 + 1, r2);
  }

  const normals = computeVertexNormals(positions, indices);
  return { positions, normals, uvs, indices };
}

/**
 * 6. Guốc mộc quai nhung truyền thống (Traditional wooden clogs)
 */
export function generateGuocMocGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  function addClog(isRight = false) {
    const signX = isRight ? 1 : -1;
    const clogX = signX * 0.070;
    const clogZ = 0.025;
    const clogBaseIdx = positions.length / 3;

    // Wooden sole profile (Đế gỗ mộc)
    // Sole thickness ~0.025m, heel elevation ~0.035m
    const solePoints = [
      // Bottom contour
      [clogX - 0.028, 0.000, clogZ - 0.080],
      [clogX + 0.028, 0.000, clogZ - 0.080],
      [clogX + 0.032, 0.000, clogZ + 0.050],
      [clogX - 0.032, 0.000, clogZ + 0.050],
      // Top sole surface
      [clogX - 0.026, 0.032, clogZ - 0.080],
      [clogX + 0.026, 0.032, clogZ - 0.080],
      [clogX + 0.030, 0.024, clogZ + 0.050],
      [clogX - 0.030, 0.024, clogZ + 0.050],
    ];

    for (let p of solePoints) {
      positions.push(...p);
      uvs.push(0.5, 0.5);
    }

    // Box faces
    const f = [
      [0, 1, 2, 3], // Bottom
      [4, 7, 6, 5], // Top
      [0, 4, 5, 1], // Back / heel
      [2, 6, 7, 3], // Front / toe
      [0, 3, 7, 4], // Left
      [1, 5, 6, 2], // Right
    ];

    for (let [a, b, c, d] of f) {
      indices.push(clogBaseIdx + a, clogBaseIdx + b, clogBaseIdx + c);
      indices.push(clogBaseIdx + a, clogBaseIdx + c, clogBaseIdx + d);
    }

    // Velvet strap (Quai nhung) curving over instep
    const strapBase = positions.length / 3;
    const STRAP_STEPS = 6;
    for (let s = 0; s <= STRAP_STEPS; s++) {
      const t = s / STRAP_STEPS;
      const angle = t * Math.PI;
      const sx = clogX + 0.030 * Math.cos(angle);
      const sy = 0.025 + 0.026 * Math.sin(angle);
      const sz = clogZ + 0.010;

      positions.push(sx, sy, sz);
      uvs.push(t, 0.2);
      positions.push(sx, sy, sz + 0.015);
      uvs.push(t, 0.4);
    }

    for (let s = 0; s < STRAP_STEPS; s++) {
      const r1 = strapBase + s * 2;
      const r2 = strapBase + (s + 1) * 2;
      indices.push(r1, r1 + 1, r2 + 1);
      indices.push(r1, r2 + 1, r2);
    }
  }

  addClog(false); // Left clog
  addClog(true);  // Right clog

  const normals = computeVertexNormals(positions, indices);
  return { positions, normals, uvs, indices };
}
