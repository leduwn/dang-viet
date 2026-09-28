import React from 'react';
import { type GarmentConfig, type AccessoryId } from '@dangviet/contracts';

interface AoDaiVisualizerProps {
  config: GarmentConfig;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AoDaiVisualizer: React.FC<AoDaiVisualizerProps> = ({
  config,
  className = '',
  size = 'lg',
}) => {
  const primaryHex = config.primaryColor?.hex || '#B83A24';
  const pantsHex = config.pantsColor?.hex || '#FFFFFF';
  const collar = config.collarStyle || 'traditional_high';
  const sleeve = config.sleeveStyle || 'traditional_long';
  const pattern = config.pattern || 'plain';
  const accessories = new Set<AccessoryId>(config.accessories || []);

  const hasAccessory = (id: string) => accessories.has(id as AccessoryId);

  // Height and aspect ratio styling
  const dimensions = {
    sm: { width: 180, height: 320 },
    md: { width: 280, height: 500 },
    lg: { width: 380, height: 660 },
  }[size];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        userSelect: 'none',
      }}
      className={className}
    >
      <svg
        viewBox="0 0 400 700"
        style={{
          width: '100%',
          maxWidth: `${dimensions.width}px`,
          height: 'auto',
          maxHeight: `${dimensions.height}px`,
          filter: 'drop-shadow(0 12px 24px rgba(30, 27, 24, 0.08))',
        }}
        aria-label="Mô hình vector trang phục áo dài"
      >
        <defs>
          {/* Subtle lighting gradient on silk */}
          <linearGradient id="silkSheen" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.0" />
            <stop offset="70%" stopColor="#000000" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.14" />
          </linearGradient>

          {/* Pants shadow between legs */}
          <linearGradient id="pantsFold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.0" />
            <stop offset="50%" stopColor="#000000" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
          </linearGradient>

          {/* Pattern Def: Lotus */}
          <pattern id="pattern-lotus" width="70" height="70" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.32">
              <path d="M 35 15 C 28 25, 20 35, 35 50 C 50 35, 42 25, 35 15 Z" />
              <path d="M 35 30 C 20 32, 15 42, 28 50" />
              <path d="M 35 30 C 50 32, 55 42, 42 50" />
              <circle cx="35" cy="52" r="3" fill="#FFFFFF" fillOpacity="0.4" />
            </g>
          </pattern>

          {/* Pattern Def: Cloud */}
          <pattern id="pattern-cloud" width="90" height="60" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.3">
              <path d="M 15 35 Q 25 15 45 25 Q 65 15 75 35 Q 85 45 65 50 L 25 50 Q 5 45 15 35 Z" />
              <path d="M 35 32 Q 45 28 55 35" />
            </g>
          </pattern>

          {/* Pattern Def: Crane */}
          <pattern id="pattern-crane" width="100" height="100" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.32">
              <path d="M 30 65 L 50 45 L 80 50 L 55 58 Z" />
              <path d="M 50 45 L 40 25 L 35 28 L 45 45" />
              <circle cx="34" cy="27" r="1.5" fill="#FFFFFF" fillOpacity="0.5" />
            </g>
          </pattern>

          {/* Pattern Def: Geometric Gen Z */}
          <pattern id="pattern-geometric" width="50" height="50" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.3">
              <polygon points="25,5 45,25 25,45 5,25" />
              <circle cx="25" cy="25" r="5" />
            </g>
          </pattern>

          {/* Floor ground reflection */}
          <radialGradient id="floorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1E1B18" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#1E1B18" stopOpacity="0.0" />
          </radialGradient>
        </defs>

        {/* 1. Floor shadow / aura */}
        <ellipse cx="200" cy="655" rx="120" ry="14" fill="url(#floorGlow)" />

        {/* 2. LAYER QUẦN (SILK PANTS) */}
        <g id="layer-pants">
          {/* Left leg */}
          <path
            d="M 175 330
               L 165 430
               L 142 630
               L 188 632
               L 198 420
               L 200 340 Z"
            fill={pantsHex}
          />
          {/* Right leg */}
          <path
            d="M 200 340
               L 202 420
               L 212 632
               L 258 630
               L 235 430
               L 225 330 Z"
            fill={pantsHex}
          />
          {/* Pants sheen and fold shading */}
          <path
            d="M 142 630 L 188 632 L 212 632 L 258 630 L 235 430 L 200 340 L 165 430 Z"
            fill="url(#pantsFold)"
          />
          <path
            d="M 142 630 L 188 632 L 212 632 L 258 630 L 235 430 L 200 340 L 165 430 Z"
            fill="url(#silkSheen)"
          />
        </g>

        {/* Footwear: Guốc mộc */}
        {hasAccessory('guoc_moc') && (
          <g id="accessory-guoc-moc">
            {/* Left wooden shoe */}
            <path d="M 152 630 L 178 631 L 175 640 L 150 639 Z" fill="#8C533E" />
            <path d="M 154 628 Q 165 624 176 629" stroke="#1E1B18" strokeWidth="3" fill="none" />
            {/* Right wooden shoe */}
            <path d="M 222 631 L 248 630 L 250 639 L 225 640 Z" fill="#8C533E" />
            <path d="M 224 629 Q 235 624 246 628" stroke="#1E1B18" strokeWidth="3" fill="none" />
          </g>
        )}

        {/* 3. LAYER TÀ SAU ÁO DÀI (BACK FLAP) */}
        <g id="layer-back-flap">
          <path
            d="M 168 280
               Q 148 420 140 605
               L 260 605
               Q 252 420 232 280 Z"
            fill={primaryHex}
            style={{ filter: 'brightness(0.92)' }}
          />
        </g>

        {/* 4. SILHOUETTE NHÂN VẬT (BODY & FACE) */}
        <g id="layer-character">
          {/* Neck */}
          <path d="M 188 120 L 188 150 L 212 150 L 212 120 Z" fill="#FCECE6" />

          {/* Head & Face */}
          <ellipse cx="200" cy="98" rx="20" ry="26" fill="#FCECE6" />

          {/* Elegant Vietnamese Bun / Hair */}
          <path
            d="M 178 95
               C 176 65, 224 65, 222 95
               C 222 108, 218 116, 212 116
               C 208 105, 204 88, 200 88
               C 196 88, 192 105, 188 116
               C 182 116, 178 108, 178 95 Z"
            fill="#1E1B18"
          />
          {/* Hair bun at back */}
          <ellipse cx="200" cy="74" rx="14" ry="12" fill="#1E1B18" />

          {/* Gentle facial profile */}
          <circle cx="193" cy="98" r="1.5" fill="#52443C" />
          <circle cx="207" cy="98" r="1.5" fill="#52443C" />
          <path d="M 197 110 Q 200 113 203 110" stroke="#C96B60" strokeWidth="1.5" fill="none" strokeLinecap="round" />

          {/* Hands */}
          {/* Left hand */}
          <path d="M 148 318 C 145 324, 150 334, 154 330 L 157 322 Z" fill="#FCECE6" />
          {/* Right hand */}
          <path d="M 252 318 C 255 324, 250 334, 246 330 L 243 322 Z" fill="#FCECE6" />
        </g>

        {/* 5. LAYER TAY ÁO (SLEEVES) */}
        <g id="layer-sleeves">
          {sleeve === 'traditional_long' && (
            <>
              {/* Left long sleeve */}
              <path
                d="M 170 148 L 138 210 L 148 322 L 160 318 L 166 220 L 174 185 Z"
                fill={primaryHex}
              />
              {/* Right long sleeve */}
              <path
                d="M 230 148 L 262 210 L 252 322 L 240 318 L 234 220 L 226 185 Z"
                fill={primaryHex}
              />
            </>
          )}

          {sleeve === 'raglan' && (
            <>
              {/* Raglan seam lines with full sleeve */}
              <path
                d="M 170 148 L 138 210 L 148 322 L 160 318 L 166 220 L 174 185 Z"
                fill={primaryHex}
              />
              <path
                d="M 230 148 L 262 210 L 252 322 L 240 318 L 234 220 L 226 185 Z"
                fill={primaryHex}
              />
              {/* Visible iconic diagonal raglan stitch */}
              <line x1="188" y1="150" x2="168" y2="185" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
              <line x1="212" y1="150" x2="232" y2="185" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
            </>
          )}

          {sleeve === 'elbow' && (
            <>
              {/* Elbow sleeve (3/4) */}
              <path
                d="M 170 148 L 144 200 L 152 255 L 164 252 L 166 210 L 174 185 Z"
                fill={primaryHex}
              />
              <path
                d="M 230 148 L 256 200 L 248 255 L 236 252 L 234 210 L 226 185 Z"
                fill={primaryHex}
              />
              {/* Forearms exposed */}
              <path d="M 152 255 L 149 320 L 157 320 L 164 252 Z" fill="#FCECE6" />
              <path d="M 248 255 L 251 320 L 243 320 L 236 252 Z" fill="#FCECE6" />
            </>
          )}

          {sleeve === 'slit' && (
            <>
              {/* Slit sleeve with subtle gap opening */}
              <path
                d="M 170 148 L 140 210 L 144 315 L 154 315 L 158 240 L 166 220 L 174 185 Z"
                fill={primaryHex}
              />
              <path
                d="M 230 148 L 260 210 L 256 315 L 246 315 L 242 240 L 234 220 L 226 185 Z"
                fill={primaryHex}
              />
              <path d="M 148 245 L 152 315" stroke="#FCECE6" strokeWidth="2.5" />
              <path d="M 252 245 L 248 315" stroke="#FCECE6" strokeWidth="2.5" />
            </>
          )}
        </g>

        {/* 6. LAYER THÂN VÀ TÀ TRƯỚC ÁO DÀI (FRONT BODICE & FLAP) */}
        <g id="layer-front-bodice-flap">
          {/* Main front bodice and front flap with feminine contour */}
          <path
            d="M 172 150
               L 168 185
               Q 166 225 174 275
               Q 162 420 152 595
               L 248 595
               Q 238 420 226 275
               Q 234 225 232 185
               L 228 150 Z"
            fill={primaryHex}
          />

          {/* Pattern overlay if configured */}
          {pattern === 'lotus' && (
            <path
              d="M 172 150 L 168 185 Q 166 225 174 275 Q 162 420 152 595 L 248 595 Q 238 420 226 275 Q 234 225 232 185 L 228 150 Z"
              fill="url(#pattern-lotus)"
            />
          )}
          {pattern === 'cloud' && (
            <path
              d="M 172 150 L 168 185 Q 166 225 174 275 Q 162 420 152 595 L 248 595 Q 238 420 226 275 Q 234 225 232 185 L 228 150 Z"
              fill="url(#pattern-cloud)"
            />
          )}
          {pattern === 'crane' && (
            <path
              d="M 172 150 L 168 185 Q 166 225 174 275 Q 162 420 152 595 L 248 595 Q 238 420 226 275 Q 234 225 232 185 L 228 150 Z"
              fill="url(#pattern-crane)"
            />
          )}
          {pattern === 'geometric_genz' && (
            <path
              d="M 172 150 L 168 185 Q 166 225 174 275 Q 162 420 152 595 L 248 595 Q 238 420 226 275 Q 234 225 232 185 L 228 150 Z"
              fill="url(#pattern-geometric)"
            />
          )}

          {/* Fabric sheen lighting */}
          <path
            d="M 172 150 L 168 185 Q 166 225 174 275 Q 162 420 152 595 L 248 595 Q 238 420 226 275 Q 234 225 232 185 L 228 150 Z"
            fill="url(#silkSheen)"
          />

          {/* Waist slit indication (đường xẻ tà eo) */}
          <path d="M 174 275 Q 170 310 166 345" stroke="#1E1B18" strokeWidth="1.2" strokeOpacity="0.25" />
          <path d="M 226 275 Q 230 310 234 345" stroke="#1E1B18" strokeWidth="1.2" strokeOpacity="0.25" />

          {/* Waist pinch line (chiết eo) */}
          <path d="M 184 220 Q 186 265 188 280" stroke="#000000" strokeWidth="0.8" opacity="0.15" />
          <path d="M 216 220 Q 214 265 212 280" stroke="#000000" strokeWidth="0.8" opacity="0.15" />
        </g>

        {/* 7. LAYER CỔ ÁO (COLLAR STYLES) */}
        <g id="layer-collar">
          {collar === 'traditional_high' && (
            <g>
              {/* Standup mandarin collar 3cm */}
              <path
                d="M 186 135
                   L 186 150
                   Q 200 154 214 150
                   L 214 135
                   Q 200 139 186 135 Z"
                fill={primaryHex}
                stroke="#FFFFFF"
                strokeWidth="0.8"
                strokeOpacity="0.4"
              />
              {/* Collar button */}
              <circle cx="208" cy="142" r="1.8" fill="#F4D06F" />
            </g>
          )}

          {collar === 'round' && (
            <path
              d="M 184 148 Q 200 162 216 148 L 220 151 Q 200 166 180 151 Z"
              fill={primaryHex}
              stroke="#FCECE6"
              strokeWidth="1.5"
            />
          )}

          {collar === 'boat' && (
            <path
              d="M 172 148 Q 200 158 228 148 L 232 152 Q 200 162 168 152 Z"
              fill={primaryHex}
              stroke="#FCECE6"
              strokeWidth="1.5"
            />
          )}

          {collar === 'v_neck' && (
            <polygon
              points="185,148 200,168 215,148 220,150 200,172 180,150"
              fill={primaryHex}
              stroke="#FCECE6"
              strokeWidth="1"
            />
          )}
        </g>

        {/* 8. LAYER PHỤ KIỆN (ACCESSORIES) */}
        {/* Chuỗi ngọc trai (Necklace) */}
        {hasAccessory('chuoi_ngoc') && (
          <g id="accessory-chuoi-ngoc">
            <path
              d="M 188 156 Q 200 180 212 156"
              stroke="#FFFDF5"
              strokeWidth="3.5"
              strokeDasharray="3,4"
              fill="none"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
            />
          </g>
        )}

        {/* Mấn đội đầu (Headwear Mấn) */}
        {hasAccessory('man_truyen_thong') && (
          <g id="accessory-man">
            {/* Silk coiled circlet over hair */}
            <ellipse
              cx="200"
              cy="76"
              rx="24"
              ry="12"
              fill={primaryHex}
              stroke="#D49A3D"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))' }}
            />
            <ellipse cx="200" cy="76" rx="16" ry="7" fill="#1E1B18" />
          </g>
        )}

        {/* Nón lá Bài thơ */}
        {hasAccessory('non_la') && (
          <g id="accessory-non-la" transform="translate(45, 10) rotate(10 200 200)">
            {/* Conical hat held elegantly near shoulder */}
            <polygon
              points="285,210 355,275 225,275"
              fill="#F4E8C1"
              stroke="#D2B97A"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 6px 12px rgba(30,27,24,0.2))' }}
            />
            {/* Latitudinal woven rings */}
            <path d="M 245 255 Q 290 262 335 255" stroke="#D2B97A" strokeWidth="1" fill="none" />
            <path d="M 260 235 Q 290 240 320 235" stroke="#D2B97A" strokeWidth="1" fill="none" />
            {/* Silk chin strap (quai nón) */}
            <path d="M 265 275 Q 285 305 305 275" stroke="#E8A598" strokeWidth="2.5" fill="none" />
          </g>
        )}

        {/* Quạt xếp lụa thêu tay (Silk Fan) */}
        {hasAccessory('quat_xep') && (
          <g id="accessory-quat-xep" transform="translate(110, 275)">
            {/* Semi-open traditional silk fan in hand */}
            <path
              d="M 40 40 L 0 5 Q 35 -15 80 5 Z"
              fill="#FCECE9"
              stroke="#B83A24"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))' }}
            />
            {/* Fan ribs */}
            <line x1="40" y1="40" x2="10" y2="10" stroke="#8C533E" strokeWidth="1" />
            <line x1="40" y1="40" x2="28" y2="3" stroke="#8C533E" strokeWidth="1" />
            <line x1="40" y1="40" x2="52" y2="3" stroke="#8C533E" strokeWidth="1" />
            <line x1="40" y1="40" x2="70" y2="10" stroke="#8C533E" strokeWidth="1" />
            {/* Tassel */}
            <path d="M 40 40 Q 42 55 45 65" stroke="#B83A24" strokeWidth="2" fill="none" />
          </g>
        )}

        {/* Túi cói đan mộc (Woven Bag) */}
        {hasAccessory('tui_coi') && (
          <g id="accessory-tui-coi" transform="translate(115, 320)">
            {/* Straps */}
            <path d="M 15 0 Q 25 -25 35 0" stroke="#8C6D53" strokeWidth="2" fill="none" />
            {/* Round straw bag */}
            <circle
              cx="25"
              cy="25"
              r="22"
              fill="#E5C79E"
              stroke="#B89467"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
            />
            {/* Weave texture */}
            <circle cx="25" cy="25" r="14" stroke="#B89467" strokeWidth="1" strokeDasharray="3,3" fill="none" />
            <circle cx="25" cy="25" r="7" stroke="#B89467" strokeWidth="1" strokeDasharray="2,2" fill="none" />
          </g>
        )}
      </svg>

      {/* Mandatory disclaimer note */}
      <span
        style={{
          marginTop: '0.5rem',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        Hình ảnh minh họa phối đồ — không mô phỏng độ vừa vặn thực tế
      </span>
    </div>
  );
};
