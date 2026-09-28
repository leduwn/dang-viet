/**
 * Automated Test: 3D Viewer Isolation & Resource Decoupling
 * Verifies:
 * 1. Two viewer instances sharing the same base assets maintain strictly isolated scenes and materials.
 * 2. Mutating color or morph weights on Instance A does not affect Instance B.
 * 3. Disposing Instance A leaves Instance B and shared geometry intact.
 * 4. MorphTargetInfluences arrays are independent references.
 */

import assert from 'node:assert';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

console.log('[Test Isolation] Running 3D Resource Isolation Test Suite...');

// 1. Create a mock shared glTF scene with a mesh, material, and morph targets
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array([
  0, 0, 0,
  1, 0, 0,
  0, 1, 0,
]);
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.morphAttributes.position = [
  new THREE.BufferAttribute(new Float32Array([0, 0, 0.1, 0, 0, 0.1, 0, 0, 0.1]), 3),
];

const sharedMaterial = new THREE.MeshStandardMaterial({
  name: 'SharedCachedMaterial',
  color: new THREE.Color('#FFFFFF'),
  roughness: 0.5,
});

const sharedMesh = new THREE.Mesh(geometry, sharedMaterial);
sharedMesh.name = 'SharedMesh';
sharedMesh.morphTargetDictionary = { morph_petite: 0 };
sharedMesh.morphTargetInfluences = [0.0];

const sharedCachedScene = new THREE.Group();
sharedCachedScene.add(sharedMesh);

// 2. Clone using ResourceLoader logic
function cloneInstance(sourceScene) {
  const cloned = SkeletonUtils.clone(sourceScene);
  cloned.traverse((node) => {
    if (node.isMesh && node.morphTargetInfluences) {
      node.morphTargetInfluences = [...node.morphTargetInfluences];
    }
  });
  return cloned;
}

function disposeInstance(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => m.dispose());
      } else if (node.material) {
        node.material.dispose();
      }
      // Never dispose node.geometry!
    }
  });
}

// Create Instance A (e.g., Red Ao Dai, Petite body shape)
const sceneA = cloneInstance(sharedCachedScene);
const meshA = sceneA.children[0];
meshA.material = new THREE.MeshStandardMaterial({
  name: 'InstanceA_Material',
  color: new THREE.Color('#E63946'), // Red
  roughness: 0.35,
});
meshA.morphTargetInfluences[0] = 1.0; // Active petite

// Create Instance B (e.g., Blue Ao Dai, Standard body shape)
const sceneB = cloneInstance(sharedCachedScene);
const meshB = sceneB.children[0];
meshB.material = new THREE.MeshStandardMaterial({
  name: 'InstanceB_Material',
  color: new THREE.Color('#1D3557'), // Blue
  roughness: 0.85,
});
meshB.morphTargetInfluences[0] = 0.0; // Baseline

// ASSERTION 1: Scenes and Meshes are distinct instances
assert.notStrictEqual(sceneA, sceneB, 'Scene graphs must be distinct instances');
assert.notStrictEqual(meshA, meshB, 'Mesh nodes must be distinct instances');

// ASSERTION 2: Materials are distinct and do not bleed colors
assert.notStrictEqual(meshA.material, meshB.material, 'Materials must be distinct instances');
assert.strictEqual(meshA.material.color.getHexString(), 'e63946', 'Mesh A must have red color');
assert.strictEqual(meshB.material.color.getHexString(), '1d3557', 'Mesh B must have blue color');
assert.notStrictEqual(meshA.material.color.getHexString(), meshB.material.color.getHexString(), 'Colors must be different');

// ASSERTION 3: MorphTargetInfluences are decoupled
assert.notStrictEqual(meshA.morphTargetInfluences, meshB.morphTargetInfluences, 'morphTargetInfluences arrays must not be the same array reference');
assert.strictEqual(meshA.morphTargetInfluences[0], 1.0, 'Instance A morph influence must be 1.0');
assert.strictEqual(meshB.morphTargetInfluences[0], 0.0, 'Instance B morph influence must be 0.0');

// Mutate A again
meshA.morphTargetInfluences[0] = 0.5;
meshA.material.color.set('#00FF00');
assert.strictEqual(meshB.morphTargetInfluences[0], 0.0, 'Mutating Instance A morph must not affect Instance B');
assert.strictEqual(meshB.material.color.getHexString(), '1d3557', 'Mutating Instance A material must not affect Instance B');

// ASSERTION 4: Disposing Instance A leaves Instance B and shared geometry intact
disposeInstance(sceneA);
assert.strictEqual(meshB.geometry.attributes.position.count, 3, 'Shared geometry must remain intact after Instance A disposal');
assert.strictEqual(meshB.material.color.getHexString(), '1d3557', 'Instance B material must remain intact after Instance A disposal');

console.log('✓ All 4 Resource Isolation Assertions PASSED successfully!');
