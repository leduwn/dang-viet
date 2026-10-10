import {
  type BodyShape,
  type GarmentModelId,
  type SleeveStyle,
} from '@dangviet/contracts';
import { type BodyMetrics, type AccessoryAnchors } from './types.ts';

/**
 * Computes body metrics and nodal Bezier points dynamically based on body shape and garment model.
 */
export function computeBodyMetrics(
  bodyShape: BodyShape = 'standard',
  modelId: GarmentModelId = 'aodai_traditional_v2'
): { body: BodyMetrics; anchors: AccessoryAnchors } {
  const isRemix = modelId === 'aodai_remix_raglan';

  // Base metrics by body shape
  let headY = 98;
  let headRx = 20;
  let headRy = 26;
  let neckTopY = 118;
  let neckBottomY = 148;
  let neckHalfWidth = 12;

  let shoulderLeft = 168;
  let shoulderRight = 232;
  let shoulderY = 150;

  let bustLeft = 166;
  let bustRight = 234;
  let bustY = 190;

  let waistLeft = 173;
  let waistRight = 227;
  let waistY = 265;

  let hipsLeft = 166;
  let hipsRight = 234;
  let hipsY = 315;

  let elbowLeft = { x: 140, y: 215 };
  let elbowRight = { x: 260, y: 215 };

  let wristLeft = { x: 150, y: 315 };
  let wristRight = { x: 250, y: 315 };

  let handLeft = { x: 152, y: 326 };
  let handRight = { x: 248, y: 326 };

  let feetLeft = { x: 165, y: 635 };
  let feetRight = { x: 235, y: 635 };

  let hemY = isRemix ? 505 : 605;
  let hemLeft = isRemix ? 140 : 146;
  let hemRight = isRemix ? 260 : 254;

  let pantsHemY = isRemix ? 620 : 632;
  let pantsLegWidth = isRemix ? 50 : 46;
  let pantsKneeY = 430;

  switch (bodyShape) {
    case 'petite':
      headY = 104;
      headRx = 19;
      headRy = 24;
      neckTopY = 122;
      neckBottomY = 150;
      neckHalfWidth = 11;
      shoulderLeft = 172;
      shoulderRight = 228;
      shoulderY = 152;
      bustLeft = 170;
      bustRight = 230;
      bustY = 192;
      waistLeft = 176;
      waistRight = 224;
      waistY = 262;
      hipsLeft = 170;
      hipsRight = 230;
      hipsY = 310;
      elbowLeft = { x: 144, y: 212 };
      elbowRight = { x: 256, y: 212 };
      wristLeft = { x: 154, y: 308 };
      wristRight = { x: 246, y: 308 };
      handLeft = { x: 156, y: 318 };
      handRight = { x: 244, y: 318 };
      feetLeft = { x: 168, y: 618 };
      feetRight = { x: 232, y: 618 };
      hemY = isRemix ? 490 : 585;
      hemLeft = isRemix ? 144 : 150;
      hemRight = isRemix ? 256 : 250;
      pantsHemY = isRemix ? 605 : 615;
      pantsLegWidth = isRemix ? 45 : 42;
      pantsKneeY = 415;
      break;

    case 'tall_slender':
      headY = 92;
      headRx = 19;
      headRy = 26;
      neckTopY = 112;
      neckBottomY = 144;
      neckHalfWidth = 11.5;
      shoulderLeft = 167;
      shoulderRight = 233;
      shoulderY = 146;
      bustLeft = 166;
      bustRight = 234;
      bustY = 186;
      waistLeft = 174;
      waistRight = 226;
      waistY = 262;
      hipsLeft = 167;
      hipsRight = 233;
      hipsY = 312;
      elbowLeft = { x: 138, y: 215 };
      elbowRight = { x: 262, y: 215 };
      wristLeft = { x: 148, y: 320 };
      wristRight = { x: 252, y: 320 };
      handLeft = { x: 150, y: 332 };
      handRight = { x: 250, y: 332 };
      feetLeft = { x: 165, y: 650 };
      feetRight = { x: 235, y: 650 };
      hemY = isRemix ? 520 : 622;
      hemLeft = isRemix ? 138 : 144;
      hemRight = isRemix ? 262 : 256;
      pantsHemY = isRemix ? 635 : 648;
      pantsLegWidth = isRemix ? 48 : 46;
      pantsKneeY = 445;
      break;

    case 'broad_shoulders':
      shoulderLeft = 158;
      shoulderRight = 242;
      shoulderY = 148;
      bustLeft = 164;
      bustRight = 236;
      bustY = 190;
      waistLeft = 172;
      waistRight = 228;
      waistY = 266;
      hipsLeft = 166;
      hipsRight = 234;
      hipsY = 316;
      elbowLeft = { x: 132, y: 215 };
      elbowRight = { x: 268, y: 215 };
      wristLeft = { x: 146, y: 316 };
      wristRight = { x: 254, y: 316 };
      handLeft = { x: 148, y: 328 };
      handRight = { x: 252, y: 328 };
      hemLeft = isRemix ? 138 : 144;
      hemRight = isRemix ? 262 : 256;
      break;

    case 'curvy_hips':
      bustLeft = 164;
      bustRight = 236;
      bustY = 192;
      waistLeft = 176;
      waistRight = 224;
      waistY = 265;
      hipsLeft = 158;
      hipsRight = 242;
      hipsY = 320;
      elbowLeft = { x: 136, y: 215 };
      elbowRight = { x: 264, y: 215 };
      wristLeft = { x: 146, y: 315 };
      wristRight = { x: 254, y: 315 };
      handLeft = { x: 148, y: 326 };
      handRight = { x: 252, y: 326 };
      hemLeft = isRemix ? 136 : 142;
      hemRight = isRemix ? 264 : 258;
      pantsLegWidth = isRemix ? 52 : 48;
      break;

    case 'plus_size':
      headRx = 22;
      headRy = 27;
      neckHalfWidth = 14;
      shoulderLeft = 162;
      shoulderRight = 238;
      shoulderY = 152;
      bustLeft = 158;
      bustRight = 242;
      bustY = 194;
      waistLeft = 168;
      waistRight = 232;
      waistY = 270;
      hipsLeft = 158;
      hipsRight = 242;
      hipsY = 324;
      elbowLeft = { x: 132, y: 218 };
      elbowRight = { x: 268, y: 218 };
      wristLeft = { x: 144, y: 318 };
      wristRight = { x: 256, y: 318 };
      handLeft = { x: 146, y: 328 };
      handRight = { x: 254, y: 328 };
      hemLeft = isRemix ? 134 : 140;
      hemRight = isRemix ? 266 : 260;
      pantsLegWidth = isRemix ? 55 : 52;
      break;

    default:
      // standard default already applied
      break;
  }

  const body: BodyMetrics = {
    headCenter: { x: 200, y: headY, rx: headRx, ry: headRy },
    neck: { topY: neckTopY, bottomY: neckBottomY, halfWidth: neckHalfWidth },
    shoulders: { leftX: shoulderLeft, rightX: shoulderRight, y: shoulderY },
    bust: { leftX: bustLeft, rightX: bustRight, y: bustY },
    waist: { leftX: waistLeft, rightX: waistRight, y: waistY },
    hips: { leftX: hipsLeft, rightX: hipsRight, y: hipsY },
    elbows: { left: elbowLeft, right: elbowRight },
    wrists: { left: wristLeft, right: wristRight },
    hands: { left: handLeft, right: handRight },
    feet: { left: feetLeft, right: feetRight },
    hemY,
    hemWidth: { leftX: hemLeft, rightX: hemRight },
    slitWaistY: waistY + 10,
    slitHipY: hipsY + 30,
    isRemix,
    pantsHemY,
    pantsLegWidth,
    pantsKneeY,
  };

  const anchors: AccessoryAnchors = {
    headwear: {
      x: 200,
      y: headY - headRy + 4,
      rx: headRx + 4,
      ry: 12,
    },
    necklace: {
      cx: 200,
      cy: neckBottomY + 8,
      rx: neckHalfWidth + 6,
      ry: 18,
    },
    handheldRight: {
      x: handRight.x + 8,
      y: handRight.y - 10,
    },
    handheldLeft: {
      x: handLeft.x - 22,
      y: handLeft.y - 5,
    },
    shoulderCarry: {
      x: shoulderRight + 45,
      y: shoulderY + 85,
      angle: 15,
    },
    feet: {
      left: {
        x: feetLeft.x - 14,
        y: pantsHemY - 2,
        width: 28,
        height: 12,
      },
      right: {
        x: feetRight.x - 14,
        y: pantsHemY - 2,
        width: 28,
        height: 12,
      },
    },
  };

  return { body, anchors };
}

/**
 * Returns SVG path for the front bodice and front flap (tà trước)
 */
export function getFrontBodiceFlapPath(b: BodyMetrics): string {
  // Symmetrical curve from shoulders -> bust -> waist -> hips -> hem
  return `
    M ${b.shoulders.leftX + 4} ${b.shoulders.y}
    Q ${b.bust.leftX} ${b.bust.y} ${b.waist.leftX} ${b.waist.y}
    Q ${b.hips.leftX} ${b.hips.y} ${b.hemWidth.leftX} ${b.hemY}
    L ${b.hemWidth.rightX} ${b.hemY}
    Q ${b.hips.rightX} ${b.hips.y} ${b.waist.rightX} ${b.waist.y}
    Q ${b.bust.rightX} ${b.bust.y} ${b.shoulders.rightX - 4} ${b.shoulders.y}
    Q 200 ${b.neck.bottomY + 4} ${b.shoulders.leftX + 4} ${b.shoulders.y}
    Z
  `.trim();
}

/**
 * Returns SVG path for the back flap (tà sau)
 */
export function getBackFlapPath(b: BodyMetrics): string {
  // Back flap extends slightly wider and longer for natural visual layering
  const backHemY = b.hemY + 8;
  const backLeft = b.hemWidth.leftX - 8;
  const backRight = b.hemWidth.rightX + 8;

  return `
    M ${b.waist.leftX - 4} ${b.waist.y + 12}
    Q ${b.hips.leftX - 6} ${b.hips.y} ${backLeft} ${backHemY}
    L ${backRight} ${backHemY}
    Q ${b.hips.rightX + 6} ${b.hips.y} ${b.waist.rightX + 4} ${b.waist.y + 12}
    Z
  `.trim();
}

/**
 * Returns SVG path for the silk pants (quần lụa)
 */
export function getPantsPath(b: BodyMetrics): { leftLeg: string; rightLeg: string; crotchShade: string } {
  const crotchY = b.hips.y + 25;
  const pantsTopY = b.waist.y + 5;
  const halfLeg = b.pantsLegWidth / 2;

  const leftLeg = `
    M ${b.waist.leftX + 3} ${pantsTopY}
    Q ${b.hips.leftX} ${b.pantsKneeY - 50} ${b.feet.left.x - halfLeg} ${b.pantsHemY}
    L ${b.feet.left.x + halfLeg} ${b.pantsHemY + 2}
    Q 196 ${b.pantsKneeY} 200 ${crotchY}
    L 200 ${pantsTopY}
    Z
  `.trim();

  const rightLeg = `
    M 200 ${pantsTopY}
    L 200 ${crotchY}
    Q 204 ${b.pantsKneeY} ${b.feet.right.x - halfLeg} ${b.pantsHemY + 2}
    L ${b.feet.right.x + halfLeg} ${b.pantsHemY}
    Q ${b.hips.rightX} ${b.pantsKneeY - 50} ${b.waist.rightX - 3} ${pantsTopY}
    Z
  `.trim();

  const crotchShade = `
    M 194 ${crotchY - 10}
    Q 200 ${crotchY + 30} 185 ${b.pantsKneeY + 20}
    L 215 ${b.pantsKneeY + 20}
    Q 200 ${crotchY + 30} 206 ${crotchY - 10}
    Z
  `.trim();

  return { leftLeg, rightLeg, crotchShade };
}

/**
 * Returns SVG path for sleeves based on sleeveStyle and modelId
 */
export function getSleevePaths(b: BodyMetrics, sleeveStyle: SleeveStyle): {
  leftSleeve: string;
  rightSleeve: string;
  exposedSkinLeft?: string;
  exposedSkinRight?: string;
  raglanSeams?: { left: { x1: number; y1: number; x2: number; y2: number }; right: { x1: number; y1: number; x2: number; y2: number } };
  slitGapLeft?: { x1: number; y1: number; x2: number; y2: number };
  slitGapRight?: { x1: number; y1: number; x2: number; y2: number };
} {
  const sL = b.shoulders.leftX;
  const sR = b.shoulders.rightX;
  const sY = b.shoulders.y;
  const eL = b.elbows.left;
  const eR = b.elbows.right;
  const wL = b.wrists.left;
  const wR = b.wrists.right;

  if (sleeveStyle === 'elbow') {
    // 3/4 elbow sleeve
    const leftSleeve = `
      M ${sL + 2} ${sY}
      L ${eL.x} ${eL.y}
      L ${eL.x + 10} ${eL.y + 40}
      L ${eL.x + 24} ${eL.y + 36}
      L ${sL + 8} ${sY + 45}
      Z
    `.trim();

    const rightSleeve = `
      M ${sR - 2} ${sY}
      L ${eR.x} ${eR.y}
      L ${eR.x - 10} ${eR.y + 40}
      L ${eR.x - 24} ${eR.y + 36}
      L ${sR - 8} ${sY + 45}
      Z
    `.trim();

    const exposedSkinLeft = `
      M ${eL.x + 10} ${eL.y + 40}
      L ${wL.x} ${wL.y}
      L ${wL.x + 8} ${wL.y - 2}
      L ${eL.x + 24} ${eL.y + 36}
      Z
    `.trim();

    const exposedSkinRight = `
      M ${eR.x - 10} ${eR.y + 40}
      L ${wR.x} ${wR.y}
      L ${wR.x - 8} ${wR.y - 2}
      L ${eR.x - 24} ${eR.y + 36}
      Z
    `.trim();

    return { leftSleeve, rightSleeve, exposedSkinLeft, exposedSkinRight };
  }

  if (sleeveStyle === 'slit') {
    // Slit sleeve with subtle wrist gap
    const leftSleeve = `
      M ${sL + 2} ${sY}
      L ${eL.x - 2} ${eL.y}
      L ${wL.x - 4} ${wL.y}
      L ${wL.x + 8} ${wL.y - 2}
      L ${eL.x + 18} ${eL.y}
      L ${sL + 8} ${sY + 45}
      Z
    `.trim();

    const rightSleeve = `
      M ${sR - 2} ${sY}
      L ${eR.x + 2} ${eR.y}
      L ${wR.x + 4} ${wR.y}
      L ${wR.x - 8} ${wR.y - 2}
      L ${eR.x - 18} ${eR.y}
      L ${sR - 8} ${sY + 45}
      Z
    `.trim();

    return {
      leftSleeve,
      rightSleeve,
      slitGapLeft: { x1: wL.x + 2, y1: eL.y + 25, x2: wL.x + 2, y2: wL.y },
      slitGapRight: { x1: wR.x - 2, y1: eR.y + 25, x2: wR.x - 2, y2: wR.y },
    };
  }

  // Full length sleeves (traditional_long & raglan)
  const leftSleeve = `
    M ${sL + 2} ${sY}
    L ${eL.x} ${eL.y}
    L ${wL.x - 2} ${wL.y}
    L ${wL.x + 10} ${wL.y - 4}
    L ${eL.x + 18} ${eL.y}
    L ${sL + 8} ${sY + 45}
    Z
  `.trim();

  const rightSleeve = `
    M ${sR - 2} ${sY}
    L ${eR.x} ${eR.y}
    L ${wR.x + 2} ${wR.y}
    L ${wR.x - 10} ${wR.y - 4}
    L ${eR.x - 18} ${eR.y}
    L ${sR - 8} ${sY + 45}
    Z
  `.trim();

  const raglanSeams = sleeveStyle === 'raglan' ? {
    left: { x1: 200 - b.neck.halfWidth, y1: b.neck.bottomY, x2: sL + 6, y2: sY + 40 },
    right: { x1: 200 + b.neck.halfWidth, y1: b.neck.bottomY, x2: sR - 6, y2: sY + 40 },
  } : undefined;

  return { leftSleeve, rightSleeve, raglanSeams };
}
