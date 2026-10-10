import React from 'react';
import { type AccessoryId } from '@dangviet/contracts';
import { type AccessoryAnchors } from './types.ts';

interface AccessoryLayersProps {
  accessories: Set<AccessoryId>;
  anchors: AccessoryAnchors;
  primaryHex: string;
  uid: string;
}

export const HeadwearAccessory: React.FC<AccessoryLayersProps> = ({
  accessories,
  anchors,
  primaryHex,
  uid,
}) => {
  const hasMan = accessories.has('man_truyen_thong');
  const hasNonLa = accessories.has('non_la');

  return (
    <g id={`${uid}-accessories-headwear`}>
      {/* 1. Mấn lụa đội đầu (Headwear Mấn) */}
      {hasMan && (
        <g id={`${uid}-accessory-man`}>
          {/* Main coiled silk circlet with multi-layer depth */}
          <ellipse
            cx={anchors.headwear.x}
            cy={anchors.headwear.y}
            rx={anchors.headwear.rx}
            ry={anchors.headwear.ry}
            fill={primaryHex}
            stroke="#D4AF37"
            strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.22))' }}
          />
          {/* Inner ring creating wrapped fabric depth */}
          <ellipse
            cx={anchors.headwear.x}
            cy={anchors.headwear.y}
            rx={anchors.headwear.rx - 5}
            ry={anchors.headwear.ry - 3}
            fill="none"
            stroke="#D4AF37"
            strokeWidth={0.7}
            strokeDasharray="4,2"
            opacity={0.75}
          />
          {/* Top opening showing hair */}
          <ellipse
            cx={anchors.headwear.x}
            cy={anchors.headwear.y}
            rx={anchors.headwear.rx * 0.65}
            ry={anchors.headwear.ry * 0.55}
            fill="#1A1817"
          />
        </g>
      )}

      {/* 2. Nón lá đội đầu (khi KHÔNG chọn mấn) */}
      {hasNonLa && !hasMan && (
        <g
          id={`${uid}-accessory-non-la-head`}
          transform={`translate(${anchors.headwear.x - 70}, ${anchors.headwear.y - 75}) rotate(-5 ${anchors.headwear.x} ${anchors.headwear.y})`}
        >
          {/* Conical hat shadow */}
          <polygon
            points="70,10 145,78 0,80"
            fill="#F4E8C1"
            stroke="#D2B97A"
            strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 5px 10px rgba(30,27,24,0.18))' }}
          />
          {/* Latitudinal rings of woven bamboo */}
          <path d="M 12 70 Q 70 78 132 68" stroke="#D2B97A" strokeWidth={1} fill="none" />
          <path d="M 28 54 Q 70 60 114 52" stroke="#D2B97A" strokeWidth={1} fill="none" />
          <path d="M 44 38 Q 70 42 96 36" stroke="#D2B97A" strokeWidth={1} fill="none" />
          <path d="M 58 24 Q 70 26 82 22" stroke="#D2B97A" strokeWidth={0.8} fill="none" />
          {/* Soft silk chin strap (quai lụa đào) */}
          <path d="M 35 78 Q 70 120 105 76" stroke="#E8A598" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
};

export const JewelryNecklaceAccessory: React.FC<AccessoryLayersProps> = ({
  accessories,
  anchors,
  uid,
}) => {
  if (!accessories.has('chuoi_ngoc')) return null;

  const { cx, cy, rx, ry } = anchors.necklace;
  // Generate coordinates for 15 individual pearls along elliptical arc
  const pearlsCount = 15;
  const pearls = [];
  for (let i = 0; i <= pearlsCount; i++) {
    const t = (Math.PI * 0.15) + (Math.PI * 0.7 * (i / pearlsCount));
    const px = cx + rx * Math.cos(t);
    const py = cy + ry * Math.sin(t);
    pearls.push({ x: px, y: py });
  }

  return (
    <g id={`${uid}-accessory-chuoi-ngoc`}>
      {/* Thread */}
      <path
        d={`M ${pearls[0].x} ${pearls[0].y} Q ${cx} ${cy + ry + 4} ${pearls[pearlsCount].x} ${pearls[pearlsCount].y}`}
        stroke="#E2DCD2"
        strokeWidth={0.7}
        fill="none"
      />
      {/* Individual pearl beads with 3D gradient */}
      {pearls.map((p, idx) => (
        <g key={idx}>
          <circle
            cx={p.x}
            cy={p.y}
            r={2.8}
            fill={`url(#${uid}-pearlShine)`}
            stroke="#DCD2C4"
            strokeWidth={0.35}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.22))' }}
          />
        </g>
      ))}
    </g>
  );
};

export const HandheldAccessories: React.FC<AccessoryLayersProps> = ({
  accessories,
  anchors,
  primaryHex,
  uid,
}) => {
  const hasNonLa = accessories.has('non_la');
  const hasMan = accessories.has('man_truyen_thong');
  const hasQuatXep = accessories.has('quat_xep');
  const hasTuiCoi = accessories.has('tui_coi');

  return (
    <g id={`${uid}-accessories-handheld`}>
      {/* Nón lá cầm tay / khoác vai khi CẢ MẤN VÀ NÓN LÁ ĐƯỢC CHỌN (giải quyết triệt để va chạm) */}
      {hasNonLa && hasMan && (
        <g
          id={`${uid}-accessory-non-la-carry`}
          transform={`translate(${anchors.shoulderCarry.x}, ${anchors.shoulderCarry.y}) rotate(${anchors.shoulderCarry.angle} 50 50)`}
        >
          {/* Conical hat held sideways */}
          <polygon
            points="50,0 110,65 0,65"
            fill="#F4E8C1"
            stroke="#D2B97A"
            strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 6px 14px rgba(30,27,24,0.2))' }}
          />
          {/* Bamboo rings */}
          <path d="M 10 56 Q 50 62 100 56" stroke="#D2B97A" strokeWidth={1} fill="none" />
          <path d="M 22 42 Q 50 47 88 42" stroke="#D2B97A" strokeWidth={1} fill="none" />
          <path d="M 35 28 Q 50 32 72 28" stroke="#D2B97A" strokeWidth={0.8} fill="none" />
          {/* Silk strap draping down */}
          <path d="M 28 65 Q 45 105 55 125" stroke="#E8A598" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* Quạt xếp lụa tre (Bên tay phải) */}
      {hasQuatXep && (
        <g
          id={`${uid}-accessory-quat-xep`}
          transform={`translate(${anchors.handheldRight.x}, ${anchors.handheldRight.y})`}
        >
          {/* Fan body (Lụa xếp rẻ quạt) */}
          <path
            d="M 35 45 L 0 8 Q 35 -14 78 8 Z"
            fill="#FFF6F3"
            stroke={primaryHex}
            strokeWidth={1.4}
            style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))' }}
          />
          {/* Bamboo ribs */}
          <line x1={35} y1={45} x2={10} y2={12} stroke="#8C533E" strokeWidth={1.1} />
          <line x1={35} y1={45} x2={26} y2={4} stroke="#8C533E" strokeWidth={1.1} />
          <line x1={35} y1={45} x2={44} y2={3} stroke="#8C533E" strokeWidth={1.1} />
          <line x1={35} y1={45} x2={62} y2={6} stroke="#8C533E" strokeWidth={1.1} />
          <line x1={35} y1={45} x2={72} y2={15} stroke="#8C533E" strokeWidth={1.1} />
          {/* Fan pivot ring */}
          <circle cx={35} cy={45} r={3} fill="#D4AF37" />
          {/* Silk tassel (Tua rua hạt ngọc) */}
          <path d="M 35 48 Q 37 65 40 76" stroke={primaryHex} strokeWidth={2.2} fill="none" />
          <circle cx={36} cy={55} r={1.5} fill="#D4AF37" />
        </g>
      )}

      {/* Túi cói đan mộc (Bên tay trái) */}
      {hasTuiCoi && (
        <g
          id={`${uid}-accessory-tui-coi`}
          transform={`translate(${anchors.handheldLeft.x}, ${anchors.handheldLeft.y})`}
        >
          {/* Leather/braided shoulder strap */}
          <path d="M 12 -25 Q 18 2 24 10" stroke="#8C6D53" strokeWidth={2.2} fill="none" />
          {/* Round woven straw bag body */}
          <circle
            cx={24}
            cy={32}
            r={24}
            fill="#E5C79E"
            stroke="#B89467"
            strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.16))' }}
          />
          {/* Concentric spiral woven texture */}
          <circle cx={24} cy={32} r={16} stroke="#B89467" strokeWidth={1} strokeDasharray="3,3" fill="none" />
          <circle cx={24} cy={32} r={8} stroke="#B89467" strokeWidth={1} strokeDasharray="2,2" fill="none" />
          <circle cx={24} cy={32} r={2.5} fill="#B89467" />
        </g>
      )}
    </g>
  );
};

export const FootwearAccessory: React.FC<AccessoryLayersProps> = ({
  accessories,
  anchors,
  uid,
}) => {
  if (!accessories.has('guoc_moc')) return null;

  const leftFoot = anchors.feet.left;
  const rightFoot = anchors.feet.right;

  return (
    <g id={`${uid}-accessory-guoc-moc`}>
      {/* Left shoe (Guốc mộc chân trái) */}
      <g transform={`translate(${leftFoot.x}, ${leftFoot.y})`}>
        {/* Wooden sole */}
        <path
          d="M 2 2 L 26 2 L 24 12 Q 14 14 4 12 Z"
          fill="#8C533E"
          stroke="#5C3426"
          strokeWidth={0.8}
        />
        {/* Wood heel block */}
        <rect x={18} y={10} width={6} height={4} fill="#5C3426" rx={1} />
        {/* Velvet strap (Quai nhung) */}
        <path d="M 5 2 Q 14 -4 23 2" stroke="#9E2A2B" strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>

      {/* Right shoe (Guốc mộc chân phải) */}
      <g transform={`translate(${rightFoot.x}, ${rightFoot.y})`}>
        {/* Wooden sole */}
        <path
          d="M 2 2 L 26 2 L 24 12 Q 14 14 4 12 Z"
          fill="#8C533E"
          stroke="#5C3426"
          strokeWidth={0.8}
        />
        {/* Wood heel block */}
        <rect x={4} y={10} width={6} height={4} fill="#5C3426" rx={1} />
        {/* Velvet strap (Quai nhung) */}
        <path d="M 5 2 Q 14 -4 23 2" stroke="#9E2A2B" strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
};
