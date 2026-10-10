import React from 'react';
import { type BodyMetrics } from './types.ts';

interface CharacterSilhouetteProps {
  body: BodyMetrics;
  uid: string;
}

export const CharacterSilhouette: React.FC<CharacterSilhouetteProps> = ({ body, uid }) => {
  const { headCenter, neck, hands } = body;
  const cx = headCenter.x;
  const cy = headCenter.y;
  const rx = headCenter.rx;
  const ry = headCenter.ry;

  const skinFill = '#FDF0EA';
  const skinShadow = '#F4DDD2';
  const hairColor = '#1A1817';
  const hairHighlight = '#2F2B28';

  return (
    <g id={`${uid}-character-figure`}>
      {/* 1. Neck (Cổ ba ngấn) */}
      <path
        d={`
          M ${cx - neck.halfWidth} ${neck.topY}
          L ${cx - neck.halfWidth - 1} ${neck.bottomY}
          Q ${cx} ${neck.bottomY + 3} ${cx + neck.halfWidth + 1} ${neck.bottomY}
          L ${cx + neck.halfWidth} ${neck.topY}
          Z
        `}
        fill={skinFill}
      />
      {/* Subtle neck shadow under chin */}
      <ellipse cx={cx} cy={neck.topY + 6} rx={neck.halfWidth - 2} ry={4} fill={skinShadow} opacity={0.65} />

      {/* 2. Head Silhouette & Jawline */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={skinFill} />

      {/* Soft facial blush */}
      <ellipse cx={cx - 10} cy={cy + 6} rx={4.5} ry={3} fill="#F4B8B0" opacity={0.35} />
      <ellipse cx={cx + 10} cy={cy + 6} rx={4.5} ry={3} fill="#F4B8B0" opacity={0.35} />

      {/* 3. Hair Base & Bun (Búi tóc sau gáy & Trâm cài) */}
      {/* Hair bun at back */}
      <ellipse cx={cx} cy={cy - ry + 2} rx={rx * 0.72} ry={13} fill={hairColor} />
      <ellipse cx={cx} cy={cy - ry + 4} rx={rx * 0.55} ry={9} fill={hairHighlight} />

      {/* Gold hair pin (Trâm cài tóc hoàng cung) */}
      <line
        x1={cx - 14}
        y1={cy - ry + 2}
        x2={cx + 18}
        y2={cy - ry - 4}
        stroke="#D4AF37"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <circle cx={cx + 18} cy={cy - ry - 4} r={2} fill="#D4AF37" />
      <circle cx={cx + 18} cy={cy - ry - 4} r={1} fill="#FFF9E6" />

      {/* Front Hairline & Elegant Side Strands (Tóc mai ôm mặt) */}
      <path
        d={`
          M ${cx - rx + 1} ${cy - 2}
          C ${cx - rx} ${cy - ry * 0.7}, ${cx - rx * 0.4} ${cy - ry}, ${cx} ${cy - ry}
          C ${cx + rx * 0.4} ${cy - ry}, ${cx + rx} ${cy - ry * 0.7}, ${cx + rx - 1} ${cy - 2}
          C ${cx + rx - 3} ${cy + 8}, ${cx + rx - 7} ${cy + 13}, ${cx + rx - 9} ${cy + 13}
          C ${cx + rx - 10} ${cy + 4}, ${cx + 7} ${cy - ry * 0.2}, ${cx} ${cy - ry * 0.25}
          C ${cx - 7} ${cy - ry * 0.2}, ${cx - rx + 10} ${cy + 4}, ${cx - rx + 9} ${cy + 13}
          C ${cx - rx + 7} ${cy + 13}, ${cx - rx + 3} ${cy + 8}, ${cx - rx + 1} ${cy - 2}
          Z
        `}
        fill={hairColor}
      />

      {/* 4. Facial Features (Nét mặt thanh tú) */}
      {/* Eyebrows (Lông mày lá liễu cong mềm) */}
      <path
        d={`M ${cx - 12} ${cy - 3} Q ${cx - 7} ${cy - 6} ${cx - 2} ${cy - 3}`}
        stroke="#4A4038"
        strokeWidth={1.1}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + 2} ${cy - 3} Q ${cx + 7} ${cy - 6} ${cx + 12} ${cy - 3}`}
        stroke="#4A4038"
        strokeWidth={1.1}
        fill="none"
        strokeLinecap="round"
      />

      {/* Eyes (Mắt phượng dịu dàng khép nhẹ) */}
      <path
        d={`M ${cx - 11} ${cy + 2} Q ${cx - 7} ${cy} ${cx - 3} ${cy + 2}`}
        stroke="#2E2620"
        strokeWidth={1.2}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={cx - 7} cy={cy + 3} r={1.2} fill="#2E2620" />
      <circle cx={cx - 6.5} cy={cy + 2.5} r={0.4} fill="#FFFFFF" />

      <path
        d={`M ${cx + 3} ${cy + 2} Q ${cx + 7} ${cy} ${cx + 11} ${cy + 2}`}
        stroke="#2E2620"
        strokeWidth={1.2}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={cx + 7} cy={cy + 3} r={1.2} fill="#2E2620" />
      <circle cx={cx + 7.5} cy={cy + 2.5} r={0.4} fill="#FFFFFF" />

      {/* Subtle nose hint */}
      <path
        d={`M ${cx} ${cy + 4} L ${cx} ${cy + 8} Q ${cx + 1.5} ${cy + 9} ${cx + 0.5} ${cy + 10}`}
        stroke="#E2C5B8"
        strokeWidth={0.8}
        fill="none"
        strokeLinecap="round"
      />

      {/* Lips (Môi son mỉm cười nhẹ) */}
      <path
        d={`M ${cx - 4.5} ${cy + 14} Q ${cx} ${cy + 12.5} ${cx + 4.5} ${cy + 14}`}
        stroke="#C85A52"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - 3.5} ${cy + 14.5} Q ${cx} ${cy + 17} ${cx + 3.5} ${cy + 14.5}`}
        stroke="#D46A62"
        strokeWidth={1.2}
        fill="#D46A62"
        fillOpacity={0.65}
      />

      {/* 5. Graceful Hands (Bàn tay búp măng) */}
      {/* Left Hand */}
      <g transform={`translate(${hands.left.x}, ${hands.left.y})`}>
        <path
          d="M -3 -8 C -4 0, -2 8, 2 10 C 5 11, 7 8, 5 3 C 4 -2, 2 -8, 0 -10 Z"
          fill={skinFill}
        />
        {/* Thumb */}
        <path d="M 0 -2 Q 4 1 2 4" stroke={skinShadow} strokeWidth={0.8} fill="none" />
      </g>

      {/* Right Hand */}
      <g transform={`translate(${hands.right.x}, ${hands.right.y})`}>
        <path
          d="M 3 -8 C 4 0, 2 8, -2 10 C -5 11, -7 8, -5 3 C -4 -2, -2 -8, 0 -10 Z"
          fill={skinFill}
        />
        {/* Thumb */}
        <path d="M 0 -2 Q -4 1 -2 4" stroke={skinShadow} strokeWidth={0.8} fill="none" />
      </g>
    </g>
  );
};
