/**
 * Material Factory Module
 * Produces isolated, mutable Three.js PBR materials per viewer instance.
 * Decouples material property changes (color, roughness, opacity) across viewers.
 */

import * as THREE from 'three';
import { type MaterialSpec } from './RenderSpec.ts';

export class MaterialFactory {
  static createGarmentMaterial(spec: MaterialSpec): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      name: 'Instance_AoDaiMaterial',
      color: new THREE.Color(spec.color),
      roughness: spec.roughness,
      metalness: spec.metalness,
      transparent: Boolean(spec.transparent),
      opacity: spec.opacity !== undefined ? spec.opacity : 1.0,
      depthWrite: true, // Crucial for voile/chiffon: prevents depth sorting artifacts with pants/back flaps
      side: THREE.FrontSide, // Clean topology with hemmed borders, DoubleSide not required
    });
  }

  static createPantsMaterial(spec: MaterialSpec): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      name: 'Instance_PantsMaterial',
      color: new THREE.Color(spec.color),
      roughness: spec.roughness,
      metalness: spec.metalness,
      side: THREE.FrontSide,
    });
  }

  static createSkinMaterial(spec: MaterialSpec): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      name: 'Instance_SkinMaterial',
      color: new THREE.Color(spec.color),
      roughness: spec.roughness,
      metalness: spec.metalness,
      side: THREE.FrontSide,
    });
  }

  static createHairMaterial(spec: MaterialSpec): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      name: 'Instance_HairMaterial',
      color: new THREE.Color(spec.color),
      roughness: spec.roughness,
      metalness: spec.metalness,
      side: THREE.FrontSide,
    });
  }

  static createEyesMaterial(spec: MaterialSpec): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      name: 'Instance_EyesMaterial',
      color: new THREE.Color(spec.color),
      roughness: spec.roughness,
      metalness: spec.metalness,
      side: THREE.FrontSide,
    });
  }

  /**
   * Mutates material properties in-place without re-allocating or disposing shader programs.
   * Eliminates 1-frame black flashes during color/fabric switching.
   */
  static updateMaterial(material: THREE.MeshStandardMaterial, spec: MaterialSpec): void {
    if (!material) return;
    material.color.set(spec.color);
    material.roughness = spec.roughness;
    material.metalness = spec.metalness;
    if (spec.transparent !== undefined) {
      material.transparent = Boolean(spec.transparent);
    }
    if (spec.opacity !== undefined) {
      material.opacity = spec.opacity;
    }
    material.depthWrite = true;
    material.needsUpdate = true;
  }
}
