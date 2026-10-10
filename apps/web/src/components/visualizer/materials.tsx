import React from 'react';
import { type Fabric, type Pattern } from '@dangviet/contracts';

interface VisualizerDefsProps {
  uid: string;
  fabric: Fabric;
  pattern?: Pattern;
}

export const VisualizerDefs: React.FC<VisualizerDefsProps> = ({ uid, fabric }) => {
  // Fabric-specific sheen lighting adjustments
  const fabricSheenOpacity =
    fabric === 'silk_ha_dong'
      ? 0.38
      : fabric === 'voile_chiffon'
      ? 0.16
      : fabric === 'brocade_hue'
      ? 0.28
      : 0.06;

  return (
    <defs>
      {/* 1. Silk & Bodice Lighting Gradient */}
      <linearGradient id={`${uid}-silkSheen`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={fabricSheenOpacity} />
        <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.0" />
        <stop offset="68%" stopColor="#000000" stopOpacity="0.04" />
        <stop
          offset="100%"
          stopColor="#000000"
          stopOpacity={fabric === 'brocade_hue' ? 0.28 : fabric === 'linen_modern' ? 0.08 : 0.16}
        />
      </linearGradient>

      {/* 2. Soft Pleat Vertical Wave Gradient */}
      <linearGradient id={`${uid}-drapeWave`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.08" />
        <stop offset="25%" stopColor="#000000" stopOpacity="0.07" />
        <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.12" />
        <stop offset="75%" stopColor="#000000" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.04" />
      </linearGradient>

      {/* 3. Pants Fold Shading */}
      <linearGradient id={`${uid}-pantsFold`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#000000" stopOpacity="0.0" />
        <stop offset="48%" stopColor="#000000" stopOpacity="0.08" />
        <stop offset="52%" stopColor="#000000" stopOpacity="0.09" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
      </linearGradient>

      {/* 4. Floor Ground Glow */}
      <radialGradient id={`${uid}-floorGlow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#1E1B18" stopOpacity="0.14" />
        <stop offset="45%" stopColor="#1E1B18" stopOpacity="0.06" />
        <stop offset="100%" stopColor="#1E1B18" stopOpacity="0.0" />
      </radialGradient>

      {/* 5. Pearl Highlight Shading */}
      <radialGradient id={`${uid}-pearlShine`} cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="60%" stopColor="#F5EFE6" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#C8BCAB" stopOpacity="0.85" />
      </radialGradient>

      {/* 6. FABRIC WEAVE: Brocade Hue (Gấm hoa triều đình Huế) */}
      <pattern id={`${uid}-fabric-brocade`} width="28" height="28" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#D4AF37" strokeWidth="0.65" opacity="0.42">
          {/* Imperial geometric lozenge */}
          <path d="M 0 14 L 14 0 L 28 14 L 14 28 Z" />
          <path d="M 4 14 L 14 4 L 24 14 L 14 24 Z" strokeWidth="0.4" opacity="0.5" />
          {/* Center lotus blossom rosette */}
          <circle cx="14" cy="14" r="3" fill="#D4AF37" fillOpacity="0.32" />
          <circle cx="14" cy="14" r="1.2" fill="#FFFFFF" fillOpacity="0.6" />
          {/* Sub-weave diagonal threads */}
          <line x1="0" y1="0" x2="6" y2="6" stroke="#E5C158" strokeWidth="0.35" opacity="0.3" />
          <line x1="28" y1="0" x2="22" y2="6" stroke="#E5C158" strokeWidth="0.35" opacity="0.3" />
          <line x1="0" y1="28" x2="6" y2="22" stroke="#E5C158" strokeWidth="0.35" opacity="0.3" />
          <line x1="28" y1="28" x2="22" y2="22" stroke="#E5C158" strokeWidth="0.35" opacity="0.3" />
        </g>
      </pattern>

      {/* 7. FABRIC WEAVE: Linen Modern (Đũi tơ tự nhiên) */}
      <pattern id={`${uid}-fabric-linen`} width="10" height="10" patternUnits="userSpaceOnUse">
        <g stroke="#FFFFFF" strokeWidth="0.45" opacity="0.22">
          <line x1="0" y1="2.5" x2="10" y2="2.5" />
          <line x1="0" y1="7.5" x2="10" y2="7.5" />
          <line x1="2.5" y1="0" x2="2.5" y2="10" strokeDasharray="3,2" />
          <line x1="7.5" y1="0" x2="7.5" y2="10" strokeDasharray="2,3" />
        </g>
      </pattern>

      {/* 8. PATTERN: Lotus (Hoa sen thanh khiết) */}
      <pattern id={`${uid}-pattern-lotus`} width="80" height="80" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.35">
          {/* Lotus central petal */}
          <path d="M 40 18 C 32 30, 24 42, 40 58 C 56 42, 48 30, 40 18 Z" fill="#FFFFFF" fillOpacity="0.08" />
          {/* Left lateral petal */}
          <path d="M 40 34 C 22 36, 16 48, 30 58" />
          {/* Right lateral petal */}
          <path d="M 40 34 C 58 36, 64 48, 50 58" />
          {/* Calyx & dew drop */}
          <circle cx="40" cy="60" r="3.2" fill="#FFFFFF" fillOpacity="0.45" />
          {/* Soft ripples */}
          <path d="M 28 66 Q 40 70 52 66" strokeWidth="0.8" opacity="0.5" />
        </g>
      </pattern>

      {/* 9. PATTERN: Cloud (Vân mây ngũ sắc triều Nguyễn) */}
      <pattern id={`${uid}-pattern-cloud`} width="96" height="64" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#FFFFFF" strokeWidth="1.25" opacity="0.32">
          {/* Classical stylized cloud ribbon */}
          <path d="M 16 38 Q 28 16 50 26 Q 72 16 82 36 Q 92 48 70 54 L 28 54 Q 6 48 16 38 Z" fill="#FFFFFF" fillOpacity="0.06" />
          {/* Inner swirling curve */}
          <path d="M 38 34 Q 48 28 60 36 Q 66 42 54 46" strokeWidth="0.9" />
          {/* Tail scroll */}
          <path d="M 72 44 Q 82 46 86 52" strokeWidth="0.8" />
        </g>
      </pattern>

      {/* 10. PATTERN: Crane (Chim hạc phi thiên) */}
      <pattern id={`${uid}-pattern-crane`} width="110" height="110" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.34">
          {/* Wings in flight */}
          <path d="M 32 72 L 55 50 L 90 56 L 62 65 Z" fill="#FFFFFF" fillOpacity="0.08" />
          {/* Slender neck and crested head */}
          <path d="M 55 50 L 44 26 L 38 30 L 50 50" strokeWidth="1.3" />
          <circle cx="37" cy="29" r="1.8" fill="#FFFFFF" fillOpacity="0.65" />
          {/* Tail feathers & trailing legs */}
          <path d="M 62 65 L 82 85 M 60 67 L 78 88" strokeWidth="0.9" />
        </g>
      </pattern>

      {/* 11. PATTERN: Geometric Gen Z (Kỷ hà đương đại Remix) */}
      <pattern id={`${uid}-pattern-geometric`} width="54" height="54" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#FFFFFF" strokeWidth="1.1" opacity="0.32">
          {/* Dynamic nested diamond with star cross */}
          <polygon points="27,6 48,27 27,48 6,27" fill="#FFFFFF" fillOpacity="0.05" />
          <polygon points="27,14 40,27 27,40 14,27" strokeWidth="0.75" />
          <circle cx="27" cy="27" r="4.5" fill="#FFFFFF" fillOpacity="0.35" />
          <line x1="27" y1="0" x2="27" y2="6" strokeWidth="0.9" />
          <line x1="27" y1="48" x2="27" y2="54" strokeWidth="0.9" />
          <line x1="0" y1="27" x2="6" y2="27" strokeWidth="0.9" />
          <line x1="48" y1="27" x2="54" y2="27" strokeWidth="0.9" />
        </g>
      </pattern>
    </defs>
  );
};
