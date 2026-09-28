/**
 * 3D Mesh Generator for Cultural Accessories
 * - man_truyen_thong (Mấn đội đầu truyền thống)
 * - non_la (Nón lá bài thơ)
 * - chuoi_ngoc (Chuỗi ngọc trai đeo cổ)
 * - quat_xep (Quạt xếp cầm tay)
 * - guoc_moc (Guốc mộc quai nhung)
 */

import { computeVertexNormals } from './avatar-mesh.mjs';

/**
 * 1. Mấn đội đầu truyền thống (Wrapped silk crown)
 */
export function generateManGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const RINGS = 16;
  const SECTORS = 8;
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

  const SECTORS = 24;
  const RINGS = 8;
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

  const PEARLS = 22;
  const SECTORS = 8;
  const pearlRad = 0.007;

  // Arc draping from left shoulder, down center chest, up to right shoulder
  for (let i = 0; i <= PEARLS; i++) {
    const t = (i / PEARLS) * Math.PI; // 0 to PI
    const sinT = Math.sin(t);
    const cosT = Math.cos(t);

    const px = 0.075 * cosT;
    const py = 1.39 - 0.09 * sinT;
    const pz = 0.085 * sinT - 0.012;

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
 * 4. Quạt xếp cầm tay (Folding fan held in hand)
 */
export function generateQuatXepGeometry() {
  const positions = [];
  const uvs = [];
  const indices = [];

  const BLADES = 12;
  const pivot = [0.295, 0.78, 0.01]; // Held in hand
  const fanRadius = 0.16;

  const baseIdx = 0;
  // Pivot vertex
  positions.push(...pivot);
  uvs.push(0.5, 0);

  for (let b = 0; b <= BLADES; b++) {
    const angle = 0.2 + (b / BLADES) * (Math.PI * 0.65);
    const x = pivot[0] + fanRadius * Math.cos(angle);
    const y = pivot[1] + fanRadius * Math.sin(angle);
    const z = pivot[2] + (b % 2 === 0 ? 0.003 : -0.003); // Pleated fan folds

    positions.push(x, y, z);
    uvs.push(b / BLADES, 1.0);
  }

  for (let b = 1; b <= BLADES; b++) {
    indices.push(0, b, b + 1);
    indices.push(0, b + 1, b); // Double-sided
  }

  const normals = computeVertexNormals(positions, indices);
  return { positions, normals, uvs, indices };
}
