/**
 * Morph Controller & Socket Tracking Module
 * Handles:
 * 1. Synchronized morph target application across avatar, garment, and pants.
 * 2. Dynamic socket position tracking according to active body deformation.
 *    (Solves: Mấn, Nón lá, Chuỗi ngọc, Quạt, Guốc không bị trôi khi đổi vóc dáng).
 */

import * as THREE from 'three';

export const MORPH_ALIASES: Record<string, string> = {
  // Petite aliases
  petite: 'morph_petite',
  slender_short: 'morph_petite',
  short: 'morph_petite',
  body_petite: 'morph_petite',
  morphpetite: 'morph_petite',
  // Tall slender aliases
  tall: 'morph_tall_slender',
  slender_tall: 'morph_tall_slender',
  tall_slender: 'morph_tall_slender',
  body_tall: 'morph_tall_slender',
  morphtallslender: 'morph_tall_slender',
  // Broad shoulders aliases
  broad_shoulders: 'morph_broad_shoulders',
  shoulders_wide: 'morph_broad_shoulders',
  wide_shoulders: 'morph_broad_shoulders',
  shoulder_broad: 'morph_broad_shoulders',
  morphbroadshoulders: 'morph_broad_shoulders',
  // Curvy hips aliases
  curvy_hips: 'morph_curvy_hips',
  hips_wide: 'morph_curvy_hips',
  wide_hips: 'morph_curvy_hips',
  curvy: 'morph_curvy_hips',
  morphcurvyhips: 'morph_curvy_hips',
  // Plus size aliases
  plus_size: 'morph_plus_size',
  full_body: 'morph_plus_size',
  chubby: 'morph_plus_size',
  heavy: 'morph_plus_size',
  morphplussize: 'morph_plus_size',
};

export class MorphController {
  /**
   * Applies morph target weights to all meshes in the scene hierarchy.
   * Resolves aliases for imported avatars with non-standard morph target names.
   */
  static applyMorphWeights(
    root: THREE.Object3D,
    weights: Record<string, number>,
    customAliases?: Record<string, string>
  ): void {
    const aliases = { ...MORPH_ALIASES, ...(customAliases || {}) };

    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
          let targetWeight = weights[name];
          if (targetWeight === undefined) {
            const standardKey = aliases[name.toLowerCase()];
            if (standardKey && weights[standardKey] !== undefined) {
              targetWeight = weights[standardKey];
            }
          }
          if (targetWeight !== undefined) {
            mesh.morphTargetInfluences[index] = targetWeight;
          }
        }
      }
    });
  }

  /**
   * Calculates the real-time deformed 3D position for a given socket
   * based on active morph target weights and optional custom base anchor.
   */
  static getSocketTransform(
    socketName: 'head' | 'neck' | 'right_hand' | 'left_hand' | 'feet',
    weights: Record<string, number>,
    baseAnchor?: [number, number, number]
  ): { position: [number, number, number]; scale: [number, number, number] } {
    const petiteW = weights.morph_petite || 0.0;
    const tallW = weights.morph_tall_slender || 0.0;
    const broadW = weights.morph_broad_shoulders || 0.0;
    const plusW = weights.morph_plus_size || 0.0;
    const curvyW = weights.morph_curvy_hips || 0.0;

    const baseX = baseAnchor ? baseAnchor[0] : 0;
    const baseY = baseAnchor ? baseAnchor[1] : 0;
    const baseZ = baseAnchor ? baseAnchor[2] : 0;

    switch (socketName) {
      case 'head': {
        // Base crown Y=1.625m
        // Petite lowers by ~0.089m, Tall raises by ~0.068m
        const yOffset = -0.089 * petiteW + 0.068 * tallW;
        const scaleFactor = 1.0 - 0.05 * petiteW + 0.04 * tallW;
        return {
          position: [baseX, baseY + yOffset, baseZ],
          scale: [scaleFactor, scaleFactor, scaleFactor],
        };
      }

      case 'neck': {
        // Base clavicle Y=1.390m
        const yOffset = -0.076 * petiteW + 0.058 * tallW;
        const scaleFactor = 1.0 - 0.04 * petiteW + 0.03 * tallW + 0.08 * plusW;
        return {
          position: [baseX, baseY + yOffset, baseZ],
          scale: [scaleFactor, scaleFactor, scaleFactor],
        };
      }

      case 'right_hand': {
        // Right hand base [0.290, 0.770, 0.000]
        // Offset laterally (X) for broad shoulders, plus size, and curvy hips to avoid clipping through thighs/hips
        const xOffset = -0.026 * petiteW + 0.012 * tallW + 0.024 * broadW + 0.035 * plusW + 0.032 * curvyW;
        const yOffset = -0.042 * petiteW + 0.032 * tallW;
        return {
          position: [baseX + xOffset, baseY + yOffset, baseZ],
          scale: [1.0, 1.0, 1.0],
        };
      }

      case 'left_hand': {
        // Left hand base [-0.290, 0.770, 0.000]
        const xOffset = 0.026 * petiteW - 0.012 * tallW - 0.024 * broadW - 0.035 * plusW - 0.032 * curvyW;
        const yOffset = -0.042 * petiteW + 0.032 * tallW;
        return {
          position: [baseX + xOffset, baseY + yOffset, baseZ],
          scale: [1.0, 1.0, 1.0],
        };
      }

      case 'feet': {
        // Ground plane remains Y=0.0m
        return {
          position: [baseX, baseY, baseZ],
          scale: [1.0, 1.0, 1.0],
        };
      }

      default:
        return {
          position: [baseX, baseY, baseZ],
          scale: [1.0, 1.0, 1.0],
        };
    }
  }
}
