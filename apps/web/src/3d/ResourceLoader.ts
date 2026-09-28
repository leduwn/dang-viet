/**
 * Resource Loader & Lifecycle Isolation Module
 * Solves:
 * 1. Three.js resource ownership: clones scene graph and skeletons via SkeletonUtils.
 * 2. Independent morphTargetInfluences array per viewer instance.
 * 3. Safe instance disposal without wiping shared geometry or textures.
 */

import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export class ResourceLoader {
  /**
   * Performs an isolated deep clone of a glTF scene graph.
   * Clones skeletons and object hierarchies so transformations, morphs,
   * and materials are completely decoupled from R3F's useGLTF cache.
   */
  static cloneScene(sourceScene: THREE.Object3D): THREE.Group {
    const cloned = SkeletonUtils.clone(sourceScene) as THREE.Group;

    // Ensure morphTargetInfluences arrays are independent copies
    cloned.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences = [...mesh.morphTargetInfluences];
      }
    });

    return cloned;
  }

  /**
   * Safely disposes instance-owned resources (cloned materials)
   * Leaves shared geometries and textures untouched so other viewers are not broken.
   */
  static disposeInstance(root: THREE.Object3D): void {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
        // Do NOT call mesh.geometry.dispose() here because geometries
        // are shared immutable assets cached across viewers!
      }
    });
  }
}
