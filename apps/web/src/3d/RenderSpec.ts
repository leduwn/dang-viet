/**
 * Render Specification Module
 * Translates domain GarmentConfig into an immutable, purely functional RenderSpec.
 * Strict boundary between business domain state and Three.js runtime properties.
 */

import {
  type GarmentConfig,
  type BodyShape,
  type AccessoryId,
} from '@dangviet/contracts';

export interface MaterialSpec {
  color: string;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
}

export interface AccessorySpec {
  id: AccessoryId;
  url: string;
  socket: 'head' | 'neck' | 'right_hand' | 'left_hand' | 'feet';
}

export interface RenderSpec {
  avatarUrl: string;
  garmentUrl: string;
  pantsUrl: string;
  morphWeights: Record<string, number>;
  garmentMaterial: MaterialSpec;
  pantsMaterial: MaterialSpec;
  skinMaterial: MaterialSpec;
  hairMaterial: MaterialSpec;
  eyesMaterial: MaterialSpec;
  accessories: AccessorySpec[];
  cameraTarget: [number, number, number];
  cameraInitialPos: [number, number, number];
}

export const GARMENT_MODEL_CATALOG: Record<string, { garmentUrl: string; pantsUrl: string; avatarUrl: string }> = {
  aodai_traditional_v2: {
    garmentUrl: '/models/aodai_traditional_v2.glb',
    pantsUrl: '/models/pants_silk_v2.glb',
    avatarUrl: '/models/avatar_v2.glb',
  },
  aodai_classic_01: {
    garmentUrl: '/models/aodai_classic_01.glb',
    pantsUrl: '/models/pants_silk.glb',
    avatarUrl: '/models/avatar_base.glb',
  },
  aodai_remix_raglan: {
    garmentUrl: '/models/aodai_remix_raglan.glb',
    pantsUrl: '/models/pants_silk.glb',
    avatarUrl: '/models/avatar_base.glb',
  },
};

const ACCESSORY_CATALOG: Record<AccessoryId, { url: string; socket: AccessorySpec['socket'] }> = {
  man_truyen_thong: { url: '/models/accessories/man_truyen_thong.glb', socket: 'head' },
  non_la: { url: '/models/accessories/non_la.glb', socket: 'head' },
  chuoi_ngoc: { url: '/models/accessories/chuoi_ngoc.glb', socket: 'neck' },
  quat_xep: { url: '/models/accessories/quat_xep.glb', socket: 'right_hand' },
  tui_coi: { url: '/models/accessories/tui_coi.glb', socket: 'left_hand' },
  guoc_moc: { url: '/models/accessories/guoc_moc.glb', socket: 'feet' },
};

function getFabricPbr(fabric: string): { roughness: number; metalness: number; transparent: boolean; opacity: number } {
  switch (fabric) {
    case 'silk_ha_dong':
      return { roughness: 0.35, metalness: 0.05, opacity: 1.0, transparent: false };
    case 'brocade_hue':
      return { roughness: 0.52, metalness: 0.18, opacity: 1.0, transparent: false };
    case 'linen_modern':
      return { roughness: 0.85, metalness: 0.00, opacity: 1.0, transparent: false };
    case 'voile_chiffon':
      return { roughness: 0.28, metalness: 0.02, opacity: 0.88, transparent: true };
    default:
      return { roughness: 0.40, metalness: 0.04, opacity: 1.0, transparent: false };
  }
}

export function computeMorphWeights(bodyShape: BodyShape = 'standard'): Record<string, number> {
  const weights: Record<string, number> = {
    morph_petite: 0.0,
    morph_tall_slender: 0.0,
    morph_broad_shoulders: 0.0,
    morph_curvy_hips: 0.0,
    morph_plus_size: 0.0,
  };

  switch (bodyShape) {
    case 'petite':
      weights.morph_petite = 1.0;
      break;
    case 'tall_slender':
      weights.morph_tall_slender = 1.0;
      break;
    case 'broad_shoulders':
      weights.morph_broad_shoulders = 1.0;
      break;
    case 'curvy_hips':
      weights.morph_curvy_hips = 1.0;
      break;
    case 'plus_size':
      weights.morph_plus_size = 1.0;
      break;
    case 'standard':
    default:
      // Neutral baseline (all zeros)
      break;
  }
  return weights;
}

export function createRenderSpec(config: GarmentConfig): RenderSpec {
  const morphWeights = computeMorphWeights(config.bodyShape);
  const modelEntry = GARMENT_MODEL_CATALOG[config.modelId] || GARMENT_MODEL_CATALOG['aodai_traditional_v2'];
  const garmentUrl = modelEntry.garmentUrl;
  const pantsUrl = modelEntry.pantsUrl;
  const avatarUrl = modelEntry.avatarUrl;

  const fabricPbr = getFabricPbr(config.fabric);

  // Filter only actively chosen accessories from catalog
  const accessories: AccessorySpec[] = (config.accessories || [])
    .filter((id): id is AccessoryId => id in ACCESSORY_CATALOG)
    .map((id) => ({
      id,
      url: ACCESSORY_CATALOG[id].url,
      socket: ACCESSORY_CATALOG[id].socket,
    }));

  return {
    avatarUrl,
    garmentUrl,
    pantsUrl,
    morphWeights,
    garmentMaterial: {
      color: config.primaryColor.hex,
      roughness: fabricPbr.roughness,
      metalness: fabricPbr.metalness,
      transparent: fabricPbr.transparent,
      opacity: fabricPbr.opacity,
    },
    pantsMaterial: {
      color: config.pantsColor.hex,
      roughness: 0.42,
      metalness: 0.02,
    },
    skinMaterial: {
      color: '#ECBA9E', // Natural Vietnamese warm skin tone
      roughness: 0.65,
      metalness: 0.0,
    },
    hairMaterial: {
      color: '#1C1A18', // Traditional deep black hair
      roughness: 0.82,
      metalness: 0.05,
    },
    eyesMaterial: {
      color: '#2B221B', // Deep dark brown eyes
      roughness: 0.15,
      metalness: 0.0,
    },
    accessories,
    cameraTarget: [0, 0.95, 0],
    cameraInitialPos: [0, 1.15, 2.3],
  };
}
