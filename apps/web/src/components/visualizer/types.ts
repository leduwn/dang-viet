/**
 * Geometric metrics calculated parametrically per body shape and garment model
 */
export interface BodyMetrics {
  // Head & Neck
  headCenter: { x: number; y: number; rx: number; ry: number };
  neck: { topY: number; bottomY: number; halfWidth: number };

  // Torso nodal points
  shoulders: { leftX: number; rightX: number; y: number };
  bust: { leftX: number; rightX: number; y: number };
  waist: { leftX: number; rightX: number; y: number };
  hips: { leftX: number; rightX: number; y: number };

  // Limbs
  elbows: { left: { x: number; y: number }; right: { x: number; y: number } };
  wrists: { left: { x: number; y: number }; right: { x: number; y: number } };
  hands: { left: { x: number; y: number }; right: { x: number; y: number } };
  feet: { left: { x: number; y: number }; right: { x: number; y: number } };

  // Garment dimensions
  hemY: number;
  hemWidth: { leftX: number; rightX: number };
  slitWaistY: number;
  slitHipY: number;
  isRemix: boolean;

  // Pants dimensions
  pantsHemY: number;
  pantsLegWidth: number;
  pantsKneeY: number;
}

/**
 * Anchor coordinates for accessories dynamic placement
 */
export interface AccessoryAnchors {
  headwear: { x: number; y: number; rx: number; ry: number };
  necklace: { cx: number; cy: number; rx: number; ry: number };
  handheldRight: { x: number; y: number };
  handheldLeft: { x: number; y: number };
  shoulderCarry: { x: number; y: number; angle: number };
  feet: {
    left: { x: number; y: number; width: number; height: number };
    right: { x: number; y: number; width: number; height: number };
  };
}
