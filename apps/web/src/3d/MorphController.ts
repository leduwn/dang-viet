/**
 * Morph Controller & Socket Tracking Module
 * Handles:
 * 1. Synchronized morph target application across avatar, garment, and pants.
 * 2. Dynamic socket position tracking according to active body deformation.
 *    (Solves: Mấn, Nón lá, Chuỗi ngọc, Quạt, Guốc không bị trôi khi đổi vóc dáng).
 */

import * as THREE from 'three';

export class MorphController {
  /**
   * Applies morph target weights to all meshes in the scene hierarchy.
   */
  static applyMorphWeights(root: THREE.Object3D, weights: Record<string, number>): void {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
          mesh.morphTargetInfluences[index] = weights[name] || 0.0;
        }
      }
    });
  }

  /**
   * Calculates the real-time deformed 3D position for a given socket
   * based on active morph target weights.
   */
  static getSocketTransform(
    socketName: 'head' | 'neck' | 'right_hand' | 'left_hand' | 'feet',
    weights: Record<string, number>
  ): { position: [number, number, number]; scale: [number, number, number] } {
    const petiteW = weights.morph_petite || 0.0;
    const tallW = weights.morph_tall_slender || 0.0;
    const broadW = weights.morph_broad_shoulders || 0.0;
    const plusW = weights.morph_plus_size || 0.0;

    switch (socketName) {
      case 'head': {
        // Base crown Y=1.625m
        // Petite lowers by ~0.089m, Tall raises by ~0.068m
        const yOffset = -0.089 * petiteW + 0.068 * tallW;
        const scaleFactor = 1.0 - 0.05 * petiteW + 0.04 * tallW;
        return {
          position: [0, 0 + yOffset, 0],
          scale: [scaleFactor, scaleFactor, scaleFactor],
        };
      }

      case 'neck': {
        // Base clavicle Y=1.390m
        const yOffset = -0.076 * petiteW + 0.058 * tallW;
        const scaleFactor = 1.0 - 0.04 * petiteW + 0.03 * tallW + 0.08 * plusW;
        return {
          position: [0, 0 + yOffset, 0],
          scale: [scaleFactor, scaleFactor, scaleFactor],
        };
      }

      case 'right_hand': {
        // Right hand base [0.290, 0.770, 0.000]
        const xOffset = -0.026 * petiteW + 0.012 * tallW + 0.024 * broadW + 0.035 * plusW;
        const yOffset = -0.042 * petiteW + 0.032 * tallW;
        return {
          position: [xOffset, yOffset, 0],
          scale: [1.0, 1.0, 1.0],
        };
      }

      case 'left_hand': {
        // Left hand base [-0.290, 0.770, 0.000]
        const xOffset = 0.026 * petiteW - 0.012 * tallW - 0.024 * broadW - 0.035 * plusW;
        const yOffset = -0.042 * petiteW + 0.032 * tallW;
        return {
          position: [xOffset, yOffset, 0],
          scale: [1.0, 1.0, 1.0],
        };
      }

      case 'feet': {
        // Ground plane remains Y=0.0m
        return {
          position: [0, 0, 0],
          scale: [1.0, 1.0, 1.0],
        };
      }

      default:
        return {
          position: [0, 0, 0],
          scale: [1.0, 1.0, 1.0],
        };
    }
  }
}
