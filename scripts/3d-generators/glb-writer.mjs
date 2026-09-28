import fs from 'node:fs';
import path from 'node:path';

/**
 * Clean GLB binary builder compliant with Khronos glTF 2.0 specification
 */
export class GlbBuilder {
  constructor() {
    this.bufferParts = [];
    this.currentOffset = 0;
    this.bufferViews = [];
    this.accessors = [];
    this.materials = [];
    this.meshes = [];
    this.nodes = [];
    this.scenes = [{ nodes: [] }];
  }

  // Align to 4-byte boundary
  align4(buffer) {
    const pad = (4 - (buffer.byteLength % 4)) % 4;
    if (pad === 0) return buffer;
    const aligned = Buffer.alloc(buffer.byteLength + pad);
    buffer.copy(aligned, 0);
    return aligned;
  }

  addBufferView(data, target = undefined) {
    const rawBuf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const alignedBuf = this.align4(rawBuf);
    const byteOffset = this.currentOffset;
    const byteLength = rawBuf.byteLength;

    this.bufferParts.push(alignedBuf);
    this.currentOffset += alignedBuf.byteLength;

    const viewIndex = this.bufferViews.length;
    const view = {
      buffer: 0,
      byteOffset,
      byteLength,
    };
    if (target) view.target = target;
    this.bufferViews.push(view);
    return viewIndex;
  }

  addAccessor({ bufferView, byteOffset = 0, componentType, count, type, min, max }) {
    const accIndex = this.accessors.length;
    const acc = {
      bufferView,
      byteOffset,
      componentType,
      count,
      type,
    };
    if (min !== undefined) acc.min = min;
    if (max !== undefined) acc.max = max;
    this.accessors.push(acc);
    return accIndex;
  }

  addIndices(indicesArray) {
    // Determine whether uint16 or uint32
    const maxIdx = Math.max(...indicesArray);
    const is32 = maxIdx > 65535;
    const typed = is32 ? new Uint32Array(indicesArray) : new Uint16Array(indicesArray);
    const componentType = is32 ? 5125 : 5123; // UNSIGNED_INT or UNSIGNED_SHORT
    const bufferView = this.addBufferView(typed, 34963); // ELEMENT_ARRAY_BUFFER
    return this.addAccessor({
      bufferView,
      componentType,
      count: indicesArray.length,
      type: 'SCALAR',
    });
  }

  addFloatAttributes(floatArray, itemSize, target = 34962) {
    const typed = new Float32Array(floatArray);
    const bufferView = this.addBufferView(typed, target); // ARRAY_BUFFER
    const type = itemSize === 3 ? 'VEC3' : itemSize === 2 ? 'VEC2' : 'VEC4';

    let min, max;
    if (itemSize === 3) {
      min = [Infinity, Infinity, Infinity];
      max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < typed.length; i += 3) {
        min[0] = Math.min(min[0], typed[i]);
        min[1] = Math.min(min[1], typed[i + 1]);
        min[2] = Math.min(min[2], typed[i + 2]);
        max[0] = Math.max(max[0], typed[i]);
        max[1] = Math.max(max[1], typed[i + 1]);
        max[2] = Math.max(max[2], typed[i + 2]);
      }
    } else if (itemSize === 2) {
      min = [Infinity, Infinity];
      max = [-Infinity, -Infinity];
      for (let i = 0; i < typed.length; i += 2) {
        min[0] = Math.min(min[0], typed[i]);
        min[1] = Math.min(min[1], typed[i + 1]);
        max[0] = Math.max(max[0], typed[i]);
        max[1] = Math.max(max[1], typed[i + 1]);
      }
    }

    return this.addAccessor({
      bufferView,
      componentType: 5126, // FLOAT
      count: typed.length / itemSize,
      type,
      min,
      max,
    });
  }

  addMaterial({ name, baseColor = [1, 1, 1, 1], roughness = 0.5, metalness = 0.0, doubleSided = false }) {
    const matIndex = this.materials.length;
    this.materials.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: baseColor,
        roughnessFactor: roughness,
        metallicFactor: metalness,
      },
      doubleSided,
    });
    return matIndex;
  }

  addMesh({ name, primitives, weights, targetNames }) {
    const meshIndex = this.meshes.length;
    const meshObj = {
      name,
      primitives,
    };
    if (weights) meshObj.weights = weights;
    if (targetNames) {
      meshObj.extras = { targetNames };
    }
    this.meshes.push(meshObj);
    return meshIndex;
  }

  addNode({ name, mesh, translation, rotation, scale, children }) {
    const nodeIndex = this.nodes.length;
    const nodeObj = { name };
    if (mesh !== undefined) nodeObj.mesh = mesh;
    if (translation) nodeObj.translation = translation;
    if (rotation) nodeObj.rotation = rotation;
    if (scale) nodeObj.scale = scale;
    if (children) nodeObj.children = children;
    this.nodes.push(nodeObj);
    return nodeIndex;
  }

  buildGlbBuffer() {
    const binBuffer = Buffer.concat(this.bufferParts);
    const gltfJson = {
      asset: { version: '2.0', generator: 'DangViet 3D Engine Generator' },
      scene: 0,
      scenes: this.scenes,
      nodes: this.nodes,
      meshes: this.meshes,
      materials: this.materials,
      accessors: this.accessors,
      bufferViews: this.bufferViews,
      buffers: [{ byteLength: binBuffer.byteLength }],
    };

    let jsonString = JSON.stringify(gltfJson);
    // Pad JSON string with spaces to 4-byte boundary
    const jsonPad = (4 - (Buffer.byteLength(jsonString, 'utf8') % 4)) % 4;
    jsonString += ' '.repeat(jsonPad);

    const jsonBuffer = Buffer.from(jsonString, 'utf8');
    const totalLength = 12 + (8 + jsonBuffer.byteLength) + (8 + binBuffer.byteLength);

    const glb = Buffer.alloc(totalLength);
    let offset = 0;

    // 1. Header (12 bytes)
    glb.writeUInt32LE(0x46546c67, offset); // 'glTF'
    offset += 4;
    glb.writeUInt32LE(2, offset); // version 2
    offset += 4;
    glb.writeUInt32LE(totalLength, offset);
    offset += 4;

    // 2. JSON Chunk (8 bytes + payload)
    glb.writeUInt32LE(jsonBuffer.byteLength, offset);
    offset += 4;
    glb.writeUInt32LE(0x4e4f534a, offset); // 'JSON'
    offset += 4;
    jsonBuffer.copy(glb, offset);
    offset += jsonBuffer.byteLength;

    // 3. BIN Chunk (8 bytes + payload)
    glb.writeUInt32LE(binBuffer.byteLength, offset);
    offset += 4;
    glb.writeUInt32LE(0x004e4942, offset); // 'BIN\0'
    offset += 4;
    binBuffer.copy(glb, offset);

    return glb;
  }

  writeToFile(filePath) {
    const glb = this.buildGlbBuffer();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, glb);
    return glb.byteLength;
  }
}
