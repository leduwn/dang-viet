import React, { useId, useMemo } from 'react';
import {
  type GarmentConfig,
  type AccessoryId,
  type GarmentModelId,
  type BodyShape,
  type CollarStyle,
  type SleeveStyle,
  getModelCapability,
  FABRIC_LABELS,
  PATTERN_LABELS,
  BODY_SHAPE_LABELS,
} from '@dangviet/contracts';
import { computeBodyMetrics, getFrontBodiceFlapPath, getBackFlapPath, getPantsPath, getSleevePaths } from './visualizer/geometry.ts';
import { VisualizerDefs } from './visualizer/materials.tsx';
import { CharacterSilhouette } from './visualizer/character.tsx';
import {
  HeadwearAccessory,
  JewelryNecklaceAccessory,
  HandheldAccessories,
  FootwearAccessory,
} from './visualizer/accessories.tsx';

export interface AoDaiVisualizerProps {
  config: GarmentConfig;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  mode?: 'thumbnail' | 'detail';
  showDisclaimer?: boolean;
  onModelChange?: (modelId: GarmentModelId) => void;
  onBodyShapeChange?: (shape: BodyShape) => void;
}

export const AoDaiVisualizer: React.FC<AoDaiVisualizerProps> = ({
  config,
  className = '',
  size = 'lg',
  mode,
  showDisclaimer,
  onModelChange,
  onBodyShapeChange,
}) => {
  const isThumbnail = mode === 'thumbnail' || (!mode && size === 'sm');
  const shouldShowDisclaimer = showDisclaimer !== undefined ? showDisclaimer : !isThumbnail;
  const rawId = useId();
  const uid = rawId.replace(/[:]/g, '');

  const modelId: GarmentModelId = config.modelId || 'aodai_traditional_v2';
  const bodyShape: BodyShape = config.bodyShape || 'standard';
  const primaryHex = config.primaryColor?.hex || '#B83A24';
  const pantsHex = config.pantsColor?.hex || '#FFFFFF';
  const rawCollar = config.collarStyle || 'traditional_high';
  const rawSleeve = config.sleeveStyle || 'traditional_long';
  const fabric = config.fabric || 'silk_ha_dong';
  const pattern = config.pattern || 'plain';
  const accessories = useMemo(() => new Set<AccessoryId>(config.accessories || []), [config.accessories]);

  // Model capabilities and compatibility check
  const cap = getModelCapability(modelId);
  const isRemixModel = modelId === 'aodai_remix_raglan';

  // Resolved collar & sleeve taking model compatibility into account
  const effectiveCollar: CollarStyle = useMemo(() => {
    if (isRemixModel) {
      return (rawCollar === 'boat' || rawCollar === 'round' || rawCollar === 'v_neck')
        ? rawCollar
        : 'round';
    }
    return 'traditional_high';
  }, [isRemixModel, rawCollar]);

  const effectiveSleeve: SleeveStyle = useMemo(() => {
    if (isRemixModel) {
      return (rawSleeve === 'raglan' || rawSleeve === 'elbow' || rawSleeve === 'slit')
        ? rawSleeve
        : 'raglan';
    }
    return 'traditional_long';
  }, [isRemixModel, rawSleeve]);

  // Incompatibility messages for user feedback
  const collarIncompatible = !isRemixModel && rawCollar !== 'traditional_high';
  const sleeveIncompatible = !isRemixModel && rawSleeve !== 'traditional_long';
  const remixCollarIncompatible = isRemixModel && rawCollar === 'traditional_high';
  const remixSleeveIncompatible = isRemixModel && rawSleeve === 'traditional_long';

  // Parametric geometry & nodal anchor computation
  const { body, anchors } = useMemo(() => {
    return computeBodyMetrics(bodyShape, modelId);
  }, [bodyShape, modelId]);

  // Path generators
  const frontBodiceFlapPath = useMemo(() => getFrontBodiceFlapPath(body), [body]);
  const backFlapPath = useMemo(() => getBackFlapPath(body), [body]);
  const pantsPaths = useMemo(() => getPantsPath(body), [body]);
  const sleevePaths = useMemo(() => getSleevePaths(body, effectiveSleeve), [body, effectiveSleeve]);

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
      className={`aodai-visualizer ${className || ''}`.trim()}
      data-testid="aodai-visualizer-2d"
    >
      {/* Interactive 2D quick bar in detail mode */}
      {!isThumbnail && (onModelChange || onBodyShapeChange) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginBottom: '0.6rem',
            width: '100%',
            maxWidth: `${dimensions.width}px`,
          }}
        >
          {onModelChange && (
            <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-subtle)', padding: '2px', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
              <button
                type="button"
                onClick={() => onModelChange('aodai_traditional_v2')}
                style={{
                  border: 'none',
                  background: !isRemixModel ? 'var(--accent-red)' : 'transparent',
                  color: !isRemixModel ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                Cổ cao truyền thống
              </button>
              <button
                type="button"
                onClick={() => onModelChange('aodai_remix_raglan')}
                style={{
                  border: 'none',
                  background: isRemixModel ? 'var(--accent-red)' : 'transparent',
                  color: isRemixModel ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                Remix cách tân
              </button>
            </div>
          )}

          {onBodyShapeChange && (
            <select
              value={bodyShape}
              onChange={(e) => onBodyShapeChange(e.target.value as BodyShape)}
              style={{
                fontSize: '0.7rem',
                padding: '3px 6px',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              aria-label="Vóc dáng 2D"
            >
              <option value="standard">Dáng chuẩn (1.66m)</option>
              <option value="petite">Dáng nhỏ nhắn (~1.56m)</option>
              <option value="tall_slender">Dáng cao thanh (~1.72m)</option>
              <option value="broad_shoulders">Khung vai rộng</option>
              <option value="curvy_hips">Đường cong hông nở</option>
              <option value="plus_size">Vóc dáng đầy đặn</option>
            </select>
          )}
        </div>
      )}

      {/* SVG Canvas Main Visualizer */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-10 0 420 700"
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: '100%',
          maxWidth: `${dimensions.width}px`,
          height: 'auto',
          maxHeight: `${dimensions.height}px`,
          filter: 'drop-shadow(0 14px 28px rgba(30, 27, 24, 0.09))',
          display: 'block',
        }}
        aria-label={`Mô hình vector 2D trang phục áo dài: ${isRemixModel ? 'Cách tân Remix' : 'Truyền thống'}, vóc dáng ${BODY_SHAPE_LABELS[bodyShape]}`}
      >
        {/* Shaders, Gradients, and Textures isolated with unique ID */}
        <VisualizerDefs uid={uid} fabric={fabric} pattern={pattern} />

        {/* 1. Floor Ground Reflection Aura */}
        <ellipse cx="200" cy="655" rx="125" ry="16" fill={`url(#${uid}-floorGlow)`} />

        {/* 2. Footwear / Guốc mộc (Rear Layer) */}
        <FootwearAccessory
          accessories={accessories}
          anchors={anchors}
          primaryHex={primaryHex}
          uid={uid}
        />

        {/* 3. Silk Pants / Quần lụa */}
        <g id={`${uid}-layer-pants`}>
          {/* Left leg */}
          <path d={pantsPaths.leftLeg} fill={pantsHex} />
          {/* Right leg */}
          <path d={pantsPaths.rightLeg} fill={pantsHex} />
          {/* Crotch shadow & fold */}
          <path d={pantsPaths.crotchShade} fill={`url(#${uid}-pantsFold)`} opacity={0.7} />
          {/* Overall silk sheen across pants */}
          <path d={pantsPaths.leftLeg} fill={`url(#${uid}-pantsFold)`} />
          <path d={pantsPaths.rightLeg} fill={`url(#${uid}-pantsFold)`} />
          <path d={pantsPaths.leftLeg} fill={`url(#${uid}-silkSheen)`} opacity={0.65} />
          <path d={pantsPaths.rightLeg} fill={`url(#${uid}-silkSheen)`} opacity={0.65} />
        </g>

        {/* 4. Back Flap / Tà sau Áo Dài */}
        <g id={`${uid}-layer-back-flap`}>
          <path
            d={backFlapPath}
            fill={primaryHex}
            style={{
              filter: fabric === 'voile_chiffon' ? 'brightness(0.96) opacity(0.88)' : 'brightness(0.92)',
            }}
          />
          {/* Vertical drape wave on back flap */}
          <path d={backFlapPath} fill={`url(#${uid}-drapeWave)`} opacity={0.4} />
        </g>

        {/* 5. Character Silhouette & Facial Features */}
        <CharacterSilhouette body={body} uid={uid} />

        {/* 6. Sleeves / Tay áo */}
        <g id={`${uid}-layer-sleeves`}>
          {/* Main left and right sleeves */}
          <path d={sleevePaths.leftSleeve} fill={primaryHex} />
          <path d={sleevePaths.rightSleeve} fill={primaryHex} />

          {/* Exposed forearms when elbow 3/4 sleeve is selected */}
          {sleevePaths.exposedSkinLeft && (
            <path d={sleevePaths.exposedSkinLeft} fill="#FDF0EA" />
          )}
          {sleevePaths.exposedSkinRight && (
            <path d={sleevePaths.exposedSkinRight} fill="#FDF0EA" />
          )}

          {/* Iconic diagonal raglan seams */}
          {sleevePaths.raglanSeams && (
            <g opacity={0.65}>
              <line
                x1={sleevePaths.raglanSeams.left.x1}
                y1={sleevePaths.raglanSeams.left.y1}
                x2={sleevePaths.raglanSeams.left.x2}
                y2={sleevePaths.raglanSeams.left.y2}
                stroke="#FFFFFF"
                strokeWidth={1.2}
                strokeDasharray="2.5,2.5"
              />
              <line
                x1={sleevePaths.raglanSeams.right.x1}
                y1={sleevePaths.raglanSeams.right.y1}
                x2={sleevePaths.raglanSeams.right.x2}
                y2={sleevePaths.raglanSeams.right.y2}
                stroke="#FFFFFF"
                strokeWidth={1.2}
                strokeDasharray="2.5,2.5"
              />
            </g>
          )}

          {/* Slit sleeve gap indication */}
          {sleevePaths.slitGapLeft && (
            <line
              x1={sleevePaths.slitGapLeft.x1}
              y1={sleevePaths.slitGapLeft.y1}
              x2={sleevePaths.slitGapLeft.x2}
              y2={sleevePaths.slitGapLeft.y2}
              stroke="#FDF0EA"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          )}
          {sleevePaths.slitGapRight && (
            <line
              x1={sleevePaths.slitGapRight.x1}
              y1={sleevePaths.slitGapRight.y1}
              x2={sleevePaths.slitGapRight.x2}
              y2={sleevePaths.slitGapRight.y2}
              stroke="#FDF0EA"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          )}

          {/* Sleeves lighting */}
          <path d={sleevePaths.leftSleeve} fill={`url(#${uid}-silkSheen)`} opacity={0.8} />
          <path d={sleevePaths.rightSleeve} fill={`url(#${uid}-silkSheen)`} opacity={0.8} />
        </g>

        {/* 7. Front Bodice & Front Flap (Tà trước Áo Dài) */}
        <g id={`${uid}-layer-front-bodice-flap`}>
          {/* Solid base fabric */}
          <path
            d={frontBodiceFlapPath}
            fill={primaryHex}
            opacity={fabric === 'voile_chiffon' ? 0.94 : 1.0}
          />

          {/* Fabric specific weave texture */}
          {fabric === 'brocade_hue' && (
            <path d={frontBodiceFlapPath} fill={`url(#${uid}-fabric-brocade)`} />
          )}
          {fabric === 'linen_modern' && (
            <path d={frontBodiceFlapPath} fill={`url(#${uid}-fabric-linen)`} />
          )}

          {/* Pattern overlay if configured */}
          {pattern === 'lotus' && (
            <path d={frontBodiceFlapPath} fill={`url(#${uid}-pattern-lotus)`} />
          )}
          {pattern === 'cloud' && (
            <path d={frontBodiceFlapPath} fill={`url(#${uid}-pattern-cloud)`} />
          )}
          {pattern === 'crane' && (
            <path d={frontBodiceFlapPath} fill={`url(#${uid}-pattern-crane)`} />
          )}
          {pattern === 'geometric_genz' && (
            <path d={frontBodiceFlapPath} fill={`url(#${uid}-pattern-geometric)`} />
          )}

          {/* Fabric sheen lighting highlight */}
          <path d={frontBodiceFlapPath} fill={`url(#${uid}-silkSheen)`} />

          {/* Vertical drape wave shadow */}
          <path d={frontBodiceFlapPath} fill={`url(#${uid}-drapeWave)`} opacity={0.5} />

          {/* Waist slit indication (Đường xẻ tà eo) */}
          <path
            d={`M ${body.waist.leftX} ${body.slitWaistY} Q ${body.hips.leftX - 2} ${body.slitHipY} ${body.hips.leftX - 6} ${body.slitHipY + 30}`}
            stroke="#1E1B18"
            strokeWidth={1.3}
            strokeOpacity={0.24}
            fill="none"
          />
          <path
            d={`M ${body.waist.rightX} ${body.slitWaistY} Q ${body.hips.rightX + 2} ${body.slitHipY} ${body.hips.rightX + 6} ${body.slitHipY + 30}`}
            stroke="#1E1B18"
            strokeWidth={1.3}
            strokeOpacity={0.24}
            fill="none"
          />

          {/* Delicate waist pinch darts (Chiết eo tôn dáng) */}
          <path
            d={`M ${body.waist.leftX + 11} ${body.bust.y + 15} Q ${body.waist.leftX + 13} ${body.waist.y} ${body.waist.leftX + 15} ${body.waist.y + 20}`}
            stroke="#000000"
            strokeWidth={0.8}
            opacity={0.15}
            fill="none"
          />
          <path
            d={`M ${body.waist.rightX - 11} ${body.bust.y + 15} Q ${body.waist.rightX - 13} ${body.waist.y} ${body.waist.rightX - 15} ${body.waist.y + 20}`}
            stroke="#000000"
            strokeWidth={0.8}
            opacity={0.15}
            fill="none"
          />
        </g>

        {/* 8. Collar Styles (Cổ áo) */}
        <g id={`${uid}-layer-collar`}>
          {effectiveCollar === 'traditional_high' && (
            <g id={`${uid}-collar-traditional-high`}>
              {/* Standup mandarin collar 4.2cm */}
              <path
                d={`
                  M ${200 - body.neck.halfWidth} ${body.neck.bottomY - 14}
                  L ${200 - body.neck.halfWidth} ${body.neck.bottomY}
                  Q 200 ${body.neck.bottomY + 5} ${200 + body.neck.halfWidth} ${body.neck.bottomY}
                  L ${200 + body.neck.halfWidth} ${body.neck.bottomY - 14}
                  Q 200 ${body.neck.bottomY - 10} ${200 - body.neck.halfWidth} ${body.neck.bottomY - 14}
                  Z
                `}
                fill={primaryHex}
                stroke="#D4AF37"
                strokeWidth={0.7}
                strokeOpacity={0.5}
              />
              {/* Gold button closure (Khuy áo cài chéo) */}
              <circle cx={200 + body.neck.halfWidth - 3} cy={body.neck.bottomY - 7} r={1.8} fill="#F4D06F" />
            </g>
          )}

          {effectiveCollar === 'round' && (
            <path
              d={`
                M ${200 - body.neck.halfWidth - 3} ${body.neck.bottomY - 2}
                Q 200 ${body.neck.bottomY + 14} ${200 + body.neck.halfWidth + 3} ${body.neck.bottomY - 2}
                L ${200 + body.neck.halfWidth + 5} ${body.neck.bottomY + 1}
                Q 200 ${body.neck.bottomY + 18} ${200 - body.neck.halfWidth - 5} ${body.neck.bottomY + 1}
                Z
              `}
              fill={primaryHex}
              stroke="#FDF0EA"
              strokeWidth={1.2}
            />
          )}

          {effectiveCollar === 'boat' && (
            <path
              d={`
                M ${body.shoulders.leftX + 12} ${body.shoulders.y - 2}
                Q 200 ${body.neck.bottomY + 9} ${body.shoulders.rightX - 12} ${body.shoulders.y - 2}
                L ${body.shoulders.rightX - 8} ${body.shoulders.y + 1}
                Q 200 ${body.neck.bottomY + 13} ${body.shoulders.leftX + 8} ${body.shoulders.y + 1}
                Z
              `}
              fill={primaryHex}
              stroke="#FDF0EA"
              strokeWidth={1.2}
            />
          )}

          {effectiveCollar === 'v_neck' && (
            <polygon
              points={`
                ${200 - body.neck.halfWidth - 2},${body.neck.bottomY - 1}
                200,${body.neck.bottomY + 20}
                ${200 + body.neck.halfWidth + 2},${body.neck.bottomY - 1}
                ${200 + body.neck.halfWidth + 5},${body.neck.bottomY + 1}
                200,${body.neck.bottomY + 24}
                ${200 - body.neck.halfWidth - 5},${body.neck.bottomY + 1}
              `}
              fill={primaryHex}
              stroke="#FDF0EA"
              strokeWidth={1.0}
            />
          )}
        </g>

        {/* 9. Jewelry Necklace (Chuỗi ngọc trai) */}
        <JewelryNecklaceAccessory
          accessories={accessories}
          anchors={anchors}
          primaryHex={primaryHex}
          uid={uid}
        />

        {/* 10. Headwear (Mấn đội đầu hoặc Nón lá đội đầu) */}
        <HeadwearAccessory
          accessories={accessories}
          anchors={anchors}
          primaryHex={primaryHex}
          uid={uid}
        />

        {/* 11. Handheld & Shoulder Accessories (Quạt xếp, Túi cói, Nón lá khoác vai) */}
        <HandheldAccessories
          accessories={accessories}
          anchors={anchors}
          primaryHex={primaryHex}
          uid={uid}
        />
      </svg>

      {/* Visualizer badge, capability info & incompatibility notices */}
      {shouldShowDisclaimer && (
        <div
          style={{
            marginTop: '0.65rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.35rem',
            width: '100%',
            maxWidth: `${dimensions.width}px`,
            padding: '0 0.5rem',
          }}
        >
          {/* Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-medium)',
                padding: '2px 10px',
                borderRadius: '12px',
                letterSpacing: '0.02em',
              }}
            >
              2D Vector — {cap.name}
            </span>
          </div>

          {/* Compatibility explanation if any option differs */}
          {(collarIncompatible || sleeveIncompatible || remixCollarIncompatible || remixSleeveIncompatible) && (
            <div
              style={{
                fontSize: '0.68rem',
                color: 'var(--accent-red)',
                background: 'rgba(184, 58, 36, 0.08)',
                border: '1px solid rgba(184, 58, 36, 0.25)',
                borderRadius: '8px',
                padding: '4px 8px',
                lineHeight: 1.35,
                textAlign: 'center',
                width: '100%',
              }}
            >
              {collarIncompatible && (
                <div>• {cap.incompatibleOptionMessages[rawCollar] || `${cap.name} mặc định dùng cổ cao 4.2cm.`}</div>
              )}
              {sleeveIncompatible && (
                <div>• {cap.incompatibleOptionMessages[rawSleeve] || `${cap.name} mặc định dùng tay dài truyền thống.`}</div>
              )}
              {remixCollarIncompatible && (
                <div>• {cap.incompatibleOptionMessages.traditional_high || 'Mẫu Remix Raglan dùng cổ thoáng hiện đại (thuyền/tròn/V).'}</div>
              )}
              {remixSleeveIncompatible && (
                <div>• {cap.incompatibleOptionMessages.traditional_long || 'Mẫu Remix dùng tay raglan/lửng/xẻ năng động.'}</div>
              )}
            </div>
          )}

          {/* Summary specs */}
          <span
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              lineHeight: 1.35,
            }}
          >
            {isRemixModel ? 'Phom cách tân tà lửng qua gối' : 'Phom truyền thống tà dài chạm mu bàn chân'} • {BODY_SHAPE_LABELS[bodyShape]} • {FABRIC_LABELS[fabric]} • {PATTERN_LABELS[pattern]}
          </span>
        </div>
      )}
    </div>
  );
};
