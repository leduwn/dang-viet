/**
 * AoDai 3D Viewer Component
 * Modular, resource-isolated 3D viewer for Vietnamese Ao Dai.
 * Implements:
 * 1. Modular architecture (RenderSpec, SceneManager, AvatarInstance, GarmentInstance, SocketAttacher).
 * 2. Complete resource isolation between viewer instances (deep clones without mutating useGLTF cache).
 * 3. Domain-driven state without local state drift.
 * 4. Neutral body shape naming ("Dáng cơ bản" instead of "Chuẩn Á Đông").
 * 5. Respects attribute locks (locks?.bodyShape, locks?.modelId).
 * 6. Viewpoint presets including closeups (Cổ, Eo, Tà).
 * 7. Single point of control for 2D/3D toggle (no duplicate toggles).
 */

import React, { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  type GarmentConfig,
  type BodyShape,
  type GarmentModelId,
  type LockState,
  VALID_BODY_SHAPES,
  VALID_GARMENT_MODELS,
} from '@dangviet/contracts';
import {
  RotateCcw,
  RefreshCw,
  User,
  Sliders,
  Lock,
} from 'lucide-react';

import { createRenderSpec } from '../3d/RenderSpec.ts';
import { SceneManager, type ViewAngle } from '../3d/SceneManager.tsx';
import { AvatarInstance } from '../3d/AvatarInstance.tsx';
import { GarmentInstance } from '../3d/GarmentInstance.tsx';
import { SocketAttacher } from '../3d/SocketAttacher.tsx';
import { WebGLBoundary } from '../3d/ViewerFallback.tsx';

export interface AoDai3DViewerProps {
  config: GarmentConfig;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  autoRotateDefault?: boolean;
  onBodyShapeChange?: (shape: BodyShape) => void;
  onModelChange?: (modelId: GarmentModelId) => void;
  disabled?: boolean;
  locks?: LockState;
  showToolbar?: boolean;
}

const BODY_SHAPE_LABELS: Record<BodyShape, { label: string; desc: string }> = {
  standard: { label: 'Dáng cơ bản', desc: 'Tỷ lệ cân đối tự nhiên (1.66m)' },
  petite: { label: 'Nhỏ nhắn', desc: 'Thanh mảnh (~1.56m)' },
  tall_slender: { label: 'Cao thanh', desc: 'Dáng dong dỏng (~1.72m)' },
  broad_shoulders: { label: 'Vai rộng', desc: 'Khung vai ngang thanh thoát' },
  curvy_hips: { label: 'Hông nở', desc: 'Đường cong lượn tà chữ S' },
  plus_size: { label: 'Đầy đặn', desc: 'Tròn trịa, quý phái' },
};

const GARMENT_MODEL_LABELS: Record<GarmentModelId, { label: string; desc: string }> = {
  aodai_classic_01: { label: 'Cổ đứng truyền thống', desc: 'Cổ 3.8cm, tà dài qua gối xẻ eo' },
  aodai_remix_raglan: { label: 'Cách tân tay Raglan', desc: 'Cổ thuyền, tà lỡ midi hiện đại' },
};

export const AoDai3DViewer: React.FC<AoDai3DViewerProps> = ({
  config,
  className = '',
  size = 'lg',
  autoRotateDefault = false,
  onBodyShapeChange,
  onModelChange,
  disabled = false,
  locks,
  showToolbar = true,
}) => {
  const [autoRotate, setAutoRotate] = useState<boolean>(autoRotateDefault);
  const [viewAngle, setViewAngle] = useState<ViewAngle | null>(null);

  // Purely computed render spec from domain config
  const renderSpec = useMemo(() => {
    return createRenderSpec(config);
  }, [config]);

  const activeShape = config.bodyShape || 'standard';
  const activeModel = config.modelId || 'aodai_classic_01';

  const isShapeLocked = !!locks?.bodyShape;
  const isModelLocked = !!locks?.modelId;

  const handleShapeSelect = (shape: BodyShape) => {
    if (disabled || isShapeLocked) return;
    if (onBodyShapeChange) {
      onBodyShapeChange(shape);
    }
  };

  const handleModelSelect = (modelId: GarmentModelId) => {
    if (disabled || isModelLocked) return;
    if (onModelChange) {
      onModelChange(modelId);
    }
  };

  const heightStyle = {
    sm: '340px',
    md: '520px',
    lg: '680px',
  }[size];

  return (
    <WebGLBoundary>
      <div
        className={`aodai-3d-container ${className}`}
        style={{
          position: 'relative',
          width: '100%',
          height: heightStyle,
          background: 'linear-gradient(180deg, #FBF9F5 0%, #EDE7DD 100%)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Control Bar: View Angle Presets & 360 Rotation */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            right: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {/* View angle buttons */}
          <div
            style={{
              display: 'flex',
              gap: '3px',
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(8px)',
              padding: '3px 5px',
              borderRadius: '24px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              pointerEvents: 'auto',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            <button
              type="button"
              className="btn-view"
              title="Góc nhìn chính diện"
              onClick={() => setViewAngle('front')}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 7px',
                borderRadius: '14px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              Trước
            </button>
            <button
              type="button"
              className="btn-view"
              title="Góc nhìn sau lưng"
              onClick={() => setViewAngle('back')}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 7px',
                borderRadius: '14px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              Sau
            </button>
            <button
              type="button"
              className="btn-view"
              title="Góc nhìn bên trái"
              onClick={() => setViewAngle('left')}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 7px',
                borderRadius: '14px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              Trái
            </button>
            <button
              type="button"
              className="btn-view"
              title="Góc nhìn bên phải"
              onClick={() => setViewAngle('right')}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 7px',
                borderRadius: '14px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              Phải
            </button>

            {/* Close-up Angles for Inspection */}
            <button
              type="button"
              className="btn-view"
              title="Cận cảnh cổ áo"
              onClick={() => setViewAngle('collar')}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 7px',
                borderRadius: '14px',
                cursor: 'pointer',
                color: 'var(--accent-blue)',
              }}
            >
              Cổ
            </button>
            <button
              type="button"
              className="btn-view"
              title="Cận cảnh eo và xẻ tà"
              onClick={() => setViewAngle('waist')}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 7px',
                borderRadius: '14px',
                cursor: 'pointer',
                color: 'var(--accent-blue)',
              }}
            >
              Eo/Tà
            </button>

            <button
              type="button"
              className="btn-view"
              title="Đặt lại camera ban đầu"
              onClick={() => setViewAngle('reset')}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 6px',
                borderRadius: '14px',
                cursor: 'pointer',
                color: 'var(--accent-red)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <RefreshCw size={11} />
              Reset
            </button>
          </div>

          {/* Right: 360 Rotate Toggle */}
          <div style={{ pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              title={autoRotate ? 'Dừng tự động xoay 360°' : 'Bật tự động xoay 360°'}
              style={{
                background: autoRotate ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.88)',
                color: autoRotate ? '#FFF' : 'var(--text-primary)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '20px',
                padding: '4px 9px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s ease',
              }}
            >
              <RotateCcw size={12} className={autoRotate ? 'spin-slow' : ''} />
              360°
            </button>
          </div>
        </div>

        {/* 3D Canvas */}
        <div style={{ flex: 1, width: '100%', position: 'relative' }}>
          <Canvas
            shadows
            dpr={[1, 1.75]} // Bound DPR for mobile performance & battery preservation
            camera={{ position: renderSpec.cameraInitialPos, fov: 42 }}
            style={{ width: '100%', height: '100%' }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          >
            <SceneManager
              autoRotate={autoRotate}
              viewAngle={viewAngle}
              onAngleApplied={() => setViewAngle(null)}
            />

            <Suspense fallback={null}>
              {/* 1. Avatar Model with separate skin and hair material slots */}
              <AvatarInstance
                url={renderSpec.avatarUrl}
                morphWeights={renderSpec.morphWeights}
                skinMaterialSpec={renderSpec.skinMaterial}
                hairMaterialSpec={renderSpec.hairMaterial}
              />

              {/* 2. Silk Pants and Selected Ao Dai Model */}
              <GarmentInstance
                garmentUrl={renderSpec.garmentUrl}
                pantsUrl={renderSpec.pantsUrl}
                morphWeights={renderSpec.morphWeights}
                garmentMaterialSpec={renderSpec.garmentMaterial}
                pantsMaterialSpec={renderSpec.pantsMaterial}
              />

              {/* 3. Actively Chosen Cultural Accessories attached to sockets */}
              <SocketAttacher
                accessories={renderSpec.accessories}
                morphWeights={renderSpec.morphWeights}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* Bottom Interactive Toolbar: 5 Body Shapes & Garment Model Selector */}
        {showToolbar && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(10px)',
              borderTop: '1px solid var(--border-light)',
              padding: '6px 10px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              zIndex: 10,
            }}
          >
            {/* Body Shape Selector (5 Presets) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <User size={12} />
                Vóc dáng:
                {isShapeLocked && (
                  <span title="Vóc dáng đang bị khóa">
                    <Lock size={11} color="var(--accent-red)" />
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                {VALID_BODY_SHAPES.map((shape) => {
                  const isSelected = activeShape === shape;
                  const meta = BODY_SHAPE_LABELS[shape];
                  const isDisabledOption = disabled || isShapeLocked;

                  return (
                    <button
                      key={shape}
                      type="button"
                      disabled={isDisabledOption}
                      onClick={() => handleShapeSelect(shape)}
                      title={isShapeLocked ? 'Vóc dáng đang bị khóa trong Look' : meta.desc}
                      style={{
                        border: isSelected ? '1px solid var(--accent-red)' : '1px solid var(--border-light)',
                        background: isSelected ? 'rgba(184, 58, 36, 0.08)' : '#FFFFFF',
                        color: isSelected ? 'var(--accent-red)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.70rem',
                        padding: '2px 7px',
                        borderRadius: '12px',
                        cursor: isDisabledOption ? 'not-allowed' : 'pointer',
                        opacity: isShapeLocked ? 0.75 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Garment Model Catalog Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <Sliders size={12} />
                Mẫu áo:
                {isModelLocked && (
                  <span title="Mẫu áo đang bị khóa">
                    <Lock size={11} color="var(--accent-red)" />
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '3px' }}>
                {VALID_GARMENT_MODELS.map((mId) => {
                  const isSelected = activeModel === mId;
                  const meta = GARMENT_MODEL_LABELS[mId];
                  const isDisabledOption = disabled || isModelLocked;

                  return (
                    <button
                      key={mId}
                      type="button"
                      disabled={isDisabledOption}
                      onClick={() => handleModelSelect(mId)}
                      title={isModelLocked ? 'Mẫu áo đang bị khóa trong Look' : meta.desc}
                      style={{
                        border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-light)',
                        background: isSelected ? 'rgba(31, 78, 91, 0.08)' : '#FFFFFF',
                        color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.70rem',
                        padding: '2px 7px',
                        borderRadius: '12px',
                        cursor: isDisabledOption ? 'not-allowed' : 'pointer',
                        opacity: isModelLocked ? 0.75 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </WebGLBoundary>
  );
};
