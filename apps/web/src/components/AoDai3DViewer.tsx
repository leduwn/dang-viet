import React, { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  type GarmentConfig,
  type BodyShape,
  type GarmentModelId,
  VALID_BODY_SHAPES,
  VALID_GARMENT_MODELS,
} from '@dangviet/contracts';
import { AoDaiVisualizer } from './AoDaiVisualizer';
import {
  RotateCcw,
  RefreshCw,
  User,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react';

export interface AoDai3DViewerProps {
  config: GarmentConfig;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  autoRotateDefault?: boolean;
  onBodyShapeChange?: (shape: BodyShape) => void;
  onModelChange?: (modelId: GarmentModelId) => void;
  disabled?: boolean;
}

const BODY_SHAPE_LABELS: Record<BodyShape, { label: string; desc: string }> = {
  standard: { label: 'Chuẩn Á Đông', desc: 'Tỷ lệ cân đối (1.65m)' },
  petite: { label: 'Nhỏ nhắn', desc: 'Thanh mảnh (~1.56m)' },
  tall_slender: { label: 'Cao thanh', desc: 'Dáng dong dỏng (~1.72m)' },
  broad_shoulders: { label: 'Vai rộng', desc: 'Khung vai ngang thanh thoát' },
  curvy_hips: { label: 'Hông nở', desc: 'Đường cong lượn tà chữ S' },
  plus_size: { label: 'Đầy đặn', desc: 'Tròn trịa, quý phái' },
};

const GARMENT_MODEL_LABELS: Record<GarmentModelId, { label: string; desc: string }> = {
  aodai_classic_01: { label: 'Cổ đứng truyền thống', desc: 'Cổ 3.5cm, tà dài qua gối' },
  aodai_remix_raglan: { label: 'Cách tân tay Raglan', desc: 'Cổ thuyền, tà lỡ hiện đại' },
};

// Map fabric to PBR properties
function getFabricPbr(fabric: string) {
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

// 3D Avatar + Clothing Model Hierarchy
interface ModelRigProps {
  config: GarmentConfig;
  bodyShape: BodyShape;
  modelId: GarmentModelId;
}

function ModelRig({ config, bodyShape, modelId }: ModelRigProps) {
  const avatarGltf = useGLTF('/models/avatar_base.glb');
  const garmentUrl = modelId === 'aodai_remix_raglan'
    ? '/models/aodai_remix_raglan.glb'
    : '/models/aodai_classic_01.glb';
  const garmentGltf = useGLTF(garmentUrl);
  const pantsGltf = useGLTF('/models/pants_silk.glb');

  // Accessories
  const hasMan = config.accessories.includes('man_truyen_thong');
  const hasNonLa = config.accessories.includes('non_la');
  const hasChuoiNgoc = config.accessories.includes('chuoi_ngoc');
  const hasQuatXep = config.accessories.includes('quat_xep');

  const manGltf = useGLTF('/models/accessories/man_truyen_thong.glb');
  const nonLaGltf = useGLTF('/models/accessories/non_la.glb');
  const chuoiNgocGltf = useGLTF('/models/accessories/chuoi_ngoc.glb');
  const quatXepGltf = useGLTF('/models/accessories/quat_xep.glb');

  // Compute active morph target weights
  const morphWeights = useMemo(() => {
    const weights: Record<string, number> = {
      morph_petite: 0.0,
      morph_tall_slender: 0.0,
      morph_broad_shoulders: 0.0,
      morph_curvy_hips: 0.0,
      morph_plus_size: 0.0,
    };
    if (bodyShape === 'petite') weights.morph_petite = 1.0;
    else if (bodyShape === 'tall_slender') weights.morph_tall_slender = 1.0;
    else if (bodyShape === 'broad_shoulders') weights.morph_broad_shoulders = 1.0;
    else if (bodyShape === 'curvy_hips') weights.morph_curvy_hips = 1.0;
    else if (bodyShape === 'plus_size') weights.morph_plus_size = 1.0;
    return weights;
  }, [bodyShape]);

  // Apply synchronized morph targets
  const applyMorphs = (scene: THREE.Group) => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
          mesh.morphTargetInfluences[index] = morphWeights[name] || 0.0;
        }
      }
    });
  };

  useEffect(() => {
    applyMorphs(avatarGltf.scene);
    applyMorphs(garmentGltf.scene);
    applyMorphs(pantsGltf.scene);
  }, [morphWeights, avatarGltf, garmentGltf, pantsGltf]);

  // Apply PBR Materials & Dynamic Colors
  useEffect(() => {
    // Garment Material
    const pbr = getFabricPbr(config.fabric);
    const garmentColor = new THREE.Color(config.primaryColor.hex);
    garmentGltf.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color = garmentColor;
        mat.roughness = pbr.roughness;
        mat.metalness = pbr.metalness;
        mat.transparent = pbr.transparent;
        mat.opacity = pbr.opacity;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      }
    });

    // Pants Material
    const pantsColor = new THREE.Color(config.pantsColor.hex);
    pantsGltf.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color = pantsColor;
        mat.roughness = 0.42;
        mat.metalness = 0.02;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      }
    });

    // Avatar Skin Material
    avatarGltf.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color = new THREE.Color('#ECBA9E'); // Natural Vietnamese skin tone
        mat.roughness = 0.65;
        mat.metalness = 0.0;
        mat.needsUpdate = true;
      }
    });
  }, [config.primaryColor.hex, config.pantsColor.hex, config.fabric, garmentGltf, pantsGltf, avatarGltf]);

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Body & Hair Base */}
      <primitive object={avatarGltf.scene} />

      {/* 2. Silk Pants */}
      <primitive object={pantsGltf.scene} />

      {/* 3. Selected Ao Dai Model */}
      <primitive object={garmentGltf.scene} />

      {/* 4. Cultural Accessories */}
      {hasMan && <primitive object={manGltf.scene} />}
      {hasNonLa && <primitive object={nonLaGltf.scene} />}
      {hasChuoiNgoc && <primitive object={chuoiNgocGltf.scene} />}
      {hasQuatXep && <primitive object={quatXepGltf.scene} />}
    </group>
  );
}

// Camera Director for Preset Views
interface CameraDirectorProps {
  viewAngle: 'front' | 'back' | 'left' | 'right' | 'reset' | null;
  onAngleApplied: () => void;
  controlsRef: React.RefObject<any>;
}

function CameraDirector({ viewAngle, onAngleApplied, controlsRef }: CameraDirectorProps) {
  useEffect(() => {
    if (!viewAngle || !controlsRef.current) return;
    const ctrl = controlsRef.current;
    const targetY = 0.95;

    switch (viewAngle) {
      case 'front':
      case 'reset':
        ctrl.object.position.set(0, 1.15, 2.3);
        ctrl.target.set(0, targetY, 0);
        break;
      case 'back':
        ctrl.object.position.set(0, 1.15, -2.3);
        ctrl.target.set(0, targetY, 0);
        break;
      case 'left':
        ctrl.object.position.set(-2.3, 1.15, 0);
        ctrl.target.set(0, targetY, 0);
        break;
      case 'right':
        ctrl.object.position.set(2.3, 1.15, 0);
        ctrl.target.set(0, targetY, 0);
        break;
    }
    ctrl.update();
    onAngleApplied();
  }, [viewAngle, onAngleApplied, controlsRef]);

  return null;
}

// Error Boundary for WebGL fallback
class WebGLBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn('[AoDai3DViewer] WebGL initialization or render fallback triggered:', error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const AoDai3DViewer: React.FC<AoDai3DViewerProps> = ({
  config,
  className = '',
  size = 'lg',
  autoRotateDefault = false,
  onBodyShapeChange,
  onModelChange,
  disabled = false,
}) => {
  const [renderMode, setRenderMode] = useState<'3d' | '2d'>('3d');
  const [autoRotate, setAutoRotate] = useState<boolean>(autoRotateDefault);
  const [viewAngle, setViewAngle] = useState<'front' | 'back' | 'left' | 'right' | 'reset' | null>(null);
  const [activeShape, setActiveShape] = useState<BodyShape>(config.bodyShape || 'standard');
  const [activeModel, setActiveModel] = useState<GarmentModelId>(config.modelId || 'aodai_classic_01');
  const controlsRef = useRef<any>(null);

  // Sync with prop updates
  useEffect(() => {
    if (config.bodyShape && config.bodyShape !== activeShape) {
      setActiveShape(config.bodyShape);
    }
  }, [config.bodyShape]);

  useEffect(() => {
    if (config.modelId && config.modelId !== activeModel) {
      setActiveModel(config.modelId);
    }
  }, [config.modelId]);

  const handleShapeSelect = (shape: BodyShape) => {
    if (disabled) return;
    setActiveShape(shape);
    if (onBodyShapeChange) onBodyShapeChange(shape);
  };

  const handleModelSelect = (modelId: GarmentModelId) => {
    if (disabled) return;
    setActiveModel(modelId);
    if (onModelChange) onModelChange(modelId);
  };

  const heightStyle = {
    sm: '340px',
    md: '520px',
    lg: '680px',
  }[size];

  // 2D SVG fallback view
  if (renderMode === '2d') {
    return (
      <div style={{ position: 'relative', width: '100%', height: heightStyle }} className={className}>
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: 'rgba(255,255,255,0.9)' }}
            onClick={() => setRenderMode('3d')}
          >
            <Sparkles size={14} style={{ marginRight: '4px' }} />
            Chuyển sang 3D
          </button>
        </div>
        <AoDaiVisualizer config={config} size={size} />
      </div>
    );
  }

  return (
    <WebGLBoundary
      fallback={
        <div style={{ position: 'relative', width: '100%', height: heightStyle }}>
          <AoDaiVisualizer config={config} size={size} />
        </div>
      }
    >
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
        {/* Top Control Bar: Mode Toggle & View Presets */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
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
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(8px)',
              padding: '4px 6px',
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
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '16px',
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
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '16px',
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
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '16px',
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
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '16px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              Phải
            </button>
            <button
              type="button"
              className="btn-view"
              title="Đặt lại camera ban đầu"
              onClick={() => setViewAngle('reset')}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 6px',
                borderRadius: '16px',
                cursor: 'pointer',
                color: 'var(--accent-red)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <RefreshCw size={12} />
              Reset
            </button>
          </div>

          {/* Right Actions: Auto-Rotate & Switch to 2D */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              pointerEvents: 'auto',
            }}
          >
            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              title={autoRotate ? 'Dừng tự động xoay 360°' : 'Bật tự động xoay 360°'}
              style={{
                background: autoRotate ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.88)',
                color: autoRotate ? '#FFF' : 'var(--text-primary)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '20px',
                padding: '5px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s ease',
              }}
            >
              <RotateCcw size={13} className={autoRotate ? 'spin-slow' : ''} />
              360°
            </button>

            <button
              type="button"
              onClick={() => setRenderMode('2d')}
              title="Chuyển về góc nhìn phẳng 2D SVG"
              style={{
                background: 'rgba(255, 255, 255, 0.88)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '20px',
                padding: '5px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              }}
            >
              <Layers size={13} />
              2D SVG
            </button>
          </div>
        </div>

        {/* 3D Canvas */}
        <div style={{ flex: 1, width: '100%', position: 'relative' }}>
          <Canvas
            shadows
            camera={{ position: [0, 1.15, 2.3], fov: 42 }}
            style={{ width: '100%', height: '100%' }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          >
            <ambientLight intensity={0.7} color="#FFFBF5" />
            <directionalLight
              position={[2.5, 3.5, 2.5]}
              intensity={1.2}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <directionalLight position={[-2.0, 2.0, 1.5]} intensity={0.5} color="#F3E9DD" />
            <directionalLight position={[0, 2.5, -2.5]} intensity={0.6} color="#FFFFFF" />

            <Suspense fallback={null}>
              <ModelRig config={config} bodyShape={activeShape} modelId={activeModel} />
              <ContactShadows
                position={[0, 0, 0]}
                opacity={0.45}
                scale={2.5}
                blur={1.6}
                far={1.5}
                color="#3D322A"
              />
            </Suspense>

            <OrbitControls
              ref={controlsRef}
              autoRotate={autoRotate}
              autoRotateSpeed={1.5}
              enablePan={false}
              minDistance={1.2}
              maxDistance={3.8}
              maxPolarAngle={Math.PI / 2 + 0.05}
              target={[0, 0.95, 0]}
            />

            <CameraDirector
              viewAngle={viewAngle}
              onAngleApplied={() => setViewAngle(null)}
              controlsRef={controlsRef}
            />
          </Canvas>
        </div>

        {/* Bottom Interactive Toolbar: 5 Body Shapes & Garment Model Selector */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid var(--border-light)',
            padding: '8px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            zIndex: 10,
          }}
        >
          {/* Body Shape Selector (5 Presets) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <User size={13} />
              Vóc dáng:
            </span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {VALID_BODY_SHAPES.map((shape) => {
                const isSelected = activeShape === shape;
                const meta = BODY_SHAPE_LABELS[shape];
                return (
                  <button
                    key={shape}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleShapeSelect(shape)}
                    title={meta.desc}
                    style={{
                      border: isSelected ? '1px solid var(--accent-red)' : '1px solid var(--border-light)',
                      background: isSelected ? 'rgba(184, 58, 36, 0.08)' : '#FFFFFF',
                      color: isSelected ? 'var(--accent-red)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Sliders size={13} />
              Mẫu áo:
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {VALID_GARMENT_MODELS.map((mId) => {
                const isSelected = activeModel === mId;
                const meta = GARMENT_MODEL_LABELS[mId];
                return (
                  <button
                    key={mId}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleModelSelect(mId)}
                    title={meta.desc}
                    style={{
                      border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-light)',
                      background: isSelected ? 'rgba(31, 78, 91, 0.08)' : '#FFFFFF',
                      color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
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
      </div>
    </WebGLBoundary>
  );
};
