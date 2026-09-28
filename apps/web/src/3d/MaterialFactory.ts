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
      transparent: spec.transparent || false,
      opacity: spec.opacity !== undefined ? spec.opacity : 1.0,
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
}
