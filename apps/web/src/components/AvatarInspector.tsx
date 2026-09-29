/**
 * Avatar Inspector Component
 * Dedicated 3D asset inspection and verification studio for adult female avatars.
 * Features:
 * 1. 4 standard camera angles (Front, Side, Back, 3/4) & Fit Bounds.
 * 2. Real-time Wireframe mode toggle.
 * 3. Interactive sliders for 5 standard morph targets.
 * 4. 3D Socket gizmo visualization deformed in real-time by morphs.
 * 5. Anthropometric proportion validation (height 1.55m - 1.75m).
 * 6. Material slot analysis and texture preservation inspection.
 * 7. Garment compatibility matrix preview.
 */

import React, { Suspense, useState, useMemo, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  VALID_GARMENT_MODELS,
  getCompatibilityStatus,
} from '@dangviet/contracts';
import {
  Maximize2,
  Eye,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { MorphController } from '../3d/MorphController.ts';
import { ResourceLoader } from '../3d/ResourceLoader.ts';
import { WebGLBoundary } from '../3d/ViewerFallback.tsx';

interface InspectedStats {
  height: number;
  min: [number, number, number];
  max: [number, number, number];
  vertices: number;
  triangles: number;
  morphNames: string[];
  materials: Array<{
    name: string;
    hasMap: boolean;
    hasNormal: boolean;
    hasRoughness: boolean;
    color: string;
    slotType: 'skin' | 'hair' | 'eyes' | 'static';
  }>;
}

interface AvatarViewerMeshProps {
  url: string;
  wireframe: boolean;
  showSockets: boolean;
  morphWeights: Record<string, number>;
  onInspected: (stats: InspectedStats) => void;
}

const SOCKET_NAMES: Array<'head' | 'neck' | 'right_hand' | 'left_hand' | 'feet'> = [
  'head',
  'neck',
  'right_hand',
  'left_hand',
  'feet',
];

const SOCKET_LABELS: Record<string, { label: string; color: string }> = {
  head: { label: 'Đỉnh đầu (Mấn / Nón)', color: '#E91E63' },
  neck: { label: 'Cổ (Chuỗi ngọc)', color: '#9C27B0' },
  right_hand: { label: 'Tay phải (Quạt xếp)', color: '#2196F3' },
  left_hand: { label: 'Tay trái (Túi cói)', color: '#4CAF50' },
  feet: { label: 'Chân (Guốc mộc)', color: '#FF9800' },
};

function AvatarViewerMesh({
  url,
  wireframe,
  showSockets,
  morphWeights,
  onInspected,
}: AvatarViewerMeshProps) {
  const gltf = useGLTF(url);

  // Clone scene to avoid mutating global cache
  const clonedScene = useMemo(() => {
    return ResourceLoader.cloneScene(gltf.scene);
  }, [gltf.scene]);

  // Extract structural geometry, materials, and morph stats
  useEffect(() => {
    let vertexCount = 0;
    let triangleCount = 0;
    const morphSet = new Set<string>();
    const matList: InspectedStats['materials'] = [];
    const matNamesSeen = new Set<string>();

    const box = new THREE.Box3().setFromObject(clonedScene);
    const min: [number, number, number] = [box.min.x, box.min.y, box.min.z];
    const max: [number, number, number] = [box.max.x, box.max.y, box.max.z];
    const height = Math.max(0.01, box.max.y - box.min.y);

    clonedScene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        if (mesh.geometry) {
          const pos = mesh.geometry.getAttribute('position');
          if (pos) vertexCount += pos.count;
          if (mesh.geometry.index) {
            triangleCount += mesh.geometry.index.count / 3;
          } else if (pos) {
            triangleCount += pos.count / 3;
          }
        }

        if (mesh.morphTargetDictionary) {
          Object.keys(mesh.morphTargetDictionary).forEach((name) => morphSet.add(name));
        }

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (m && !matNamesSeen.has(m.name || 'unnamed')) {
            matNamesSeen.add(m.name || 'unnamed');
            const std = m as THREE.MeshStandardMaterial;
            const nameLower = (m.name || '').toLowerCase();
            let slotType: 'skin' | 'hair' | 'eyes' | 'static' = 'static';
            if (nameLower.includes('skin') || nameLower.includes('da') || nameLower.includes('body')) slotType = 'skin';
            else if (nameLower.includes('hair') || nameLower.includes('toc')) slotType = 'hair';
            else if (nameLower.includes('eye') || nameLower.includes('mat')) slotType = 'eyes';

            matList.push({
              name: m.name || 'Vật liệu không tên',
              hasMap: Boolean(std.map),
              hasNormal: Boolean(std.normalMap),
              hasRoughness: Boolean(std.roughnessMap),
              color: std.color ? `#${std.color.getHexString()}` : '#ffffff',
              slotType,
            });
          }
        });
      }
    });

    onInspected({
      height,
      min,
      max,
      vertices: vertexCount,
      triangles: Math.round(triangleCount),
      morphNames: Array.from(morphSet),
      materials: matList,
    });
  }, [clonedScene, onInspected]);

  // Apply wireframe toggle across materials
  useEffect(() => {
    clonedScene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          (m as any).wireframe = wireframe;
        });
      }
    });
  }, [clonedScene, wireframe]);

  // Apply morph weights
  useEffect(() => {
    MorphController.applyMorphWeights(clonedScene, morphWeights);
  }, [clonedScene, morphWeights]);

  // Calculate deformed socket positions
  const socketPoints = useMemo(() => {
    return SOCKET_NAMES.map((name) => {
      const transform = MorphController.getSocketTransform(name, morphWeights);
      return {
        name,
        position: transform.position,
        scale: transform.scale,
        meta: SOCKET_LABELS[name],
      };
    });
  }, [morphWeights]);

  return (
    <group>
      <primitive object={clonedScene} />

      {/* Socket Gizmos Visualization */}
      {showSockets && (
        <group>
          {socketPoints.map((s) => (
            <group key={s.name} position={s.position}>
              {/* Outer halo */}
              <mesh>
                <sphereGeometry args={[0.022, 16, 16]} />
                <meshBasicMaterial color={s.meta.color} wireframe transparent opacity={0.8} />
              </mesh>
              {/* Inner core */}
              <mesh>
                <sphereGeometry args={[0.012, 16, 16]} />
                <meshBasicMaterial color={s.meta.color} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

export const AvatarInspector: React.FC = () => {
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('avatar_v2');
  const [avatarUrl, setAvatarUrl] = useState<string>('/models/avatar_v2.glb');
  const [customFileName, setCustomFileName] = useState<string | null>(null);

  const [wireframe, setWireframe] = useState<boolean>(false);
  const [showSockets, setShowSockets] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'morphs' | 'anthropometry' | 'materials' | 'compatibility'>('morphs');

  const [stats, setStats] = useState<InspectedStats | null>(null);
  const controlsRef = useRef<any>(null);

  // 5 Morph weights
  const [morphWeights, setMorphWeights] = useState<Record<string, number>>({
    morph_petite: 0.0,
    morph_tall_slender: 0.0,
    morph_broad_shoulders: 0.0,
    morph_curvy_hips: 0.0,
    morph_plus_size: 0.0,
  });

  const handleMorphChange = (key: string, val: number) => {
    setMorphWeights((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetMorphs = () => {
    setMorphWeights({
      morph_petite: 0.0,
      morph_tall_slender: 0.0,
      morph_broad_shoulders: 0.0,
      morph_curvy_hips: 0.0,
      morph_plus_size: 0.0,
    });
  };

  const handleCameraAngle = (angle: 'front' | 'side' | 'back' | 'three_quarter' | 'fit') => {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    const targetY = stats ? (stats.min[1] + stats.max[1]) / 2 : 0.85;

    switch (angle) {
      case 'front':
        ctrl.object.position.set(0, targetY + 0.1, 2.2);
        ctrl.target.set(0, targetY, 0);
        break;
      case 'side':
        ctrl.object.position.set(-2.2, targetY + 0.1, 0);
        ctrl.target.set(0, targetY, 0);
        break;
      case 'back':
        ctrl.object.position.set(0, targetY + 0.1, -2.2);
        ctrl.target.set(0, targetY, 0);
        break;
      case 'three_quarter':
        ctrl.object.position.set(1.5, targetY + 0.25, 1.6);
        ctrl.target.set(0, targetY, 0);
        break;
      case 'fit':
        if (stats) {
          const h = Math.max(stats.height, 1.0);
          ctrl.object.position.set(0, targetY, h * 1.55);
          ctrl.target.set(0, targetY, 0);
        }
        break;
    }
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    setAvatarUrl(blobUrl);
    setCustomFileName(file.name);
    setSelectedAvatarId('custom');
  };

  // Adult female height anthropometric check (1.55m - 1.75m)
  const isAnthropometricallySound = useMemo(() => {
    if (!stats) return true;
    return stats.height >= 1.52 && stats.height <= 1.78;
  }, [stats]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem', width: '100%' }}>
      {/* Title & Description Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <ShieldCheck size={22} className="text-accent-red" />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Thẩm Định & Xem Thử Avatar (Avatar Inspector)
            </h2>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(31, 78, 91, 0.1)',
                color: 'var(--accent-blue)',
              }}
            >
              Công cụ chuẩn hóa DCC / AI Assets
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
            Kiểm tra tỷ lệ nhân trắc học nữ trưởng thành, khung dây topology, 5 morph targets biến dạng và tọa độ điểm neo phụ kiện trước khi đưa vào phòng phối.
          </p>
        </div>

        {/* Avatar Preset & Upload Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setSelectedAvatarId('avatar_v2');
              setAvatarUrl('/models/avatar_v2.glb');
              setCustomFileName(null);
            }}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${selectedAvatarId === 'avatar_v2' ? 'var(--accent-red)' : 'var(--border-light)'}`,
              background: selectedAvatarId === 'avatar_v2' ? 'var(--accent-red-soft)' : 'var(--bg-surface)',
              color: selectedAvatarId === 'avatar_v2' ? 'var(--accent-red)' : 'var(--text-primary)',
              fontWeight: selectedAvatarId === 'avatar_v2' ? 700 : 500,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Avatar Chuẩn V2 (DCC Master)
          </button>

          <button
            onClick={() => {
              setSelectedAvatarId('avatar_base');
              setAvatarUrl('/models/avatar_base.glb');
              setCustomFileName(null);
            }}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${selectedAvatarId === 'avatar_base' ? 'var(--accent-red)' : 'var(--border-light)'}`,
              background: selectedAvatarId === 'avatar_base' ? 'var(--accent-red-soft)' : 'var(--bg-surface)',
              color: selectedAvatarId === 'avatar_base' ? 'var(--accent-red)' : 'var(--text-primary)',
              fontWeight: selectedAvatarId === 'avatar_base' ? 700 : 500,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Avatar Cơ Bản V1 (Dáng Việt Studio)
          </button>

          {/* Local GLB File Inspector Input */}
          <label
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              border: `1.5px dashed ${selectedAvatarId === 'custom' ? 'var(--accent-blue)' : 'var(--border-medium)'}`,
              background: selectedAvatarId === 'custom' ? 'var(--accent-blue-soft)' : 'var(--bg-subtle)',
              color: selectedAvatarId === 'custom' ? 'var(--accent-blue)' : 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Upload size={14} />
            <span>{customFileName ? `Tệp: ${customFileName.slice(0, 16)}...` : 'Nạp file GLB ngoài...'}</span>
            <input
              type="file"
              accept=".glb,.gltf"
              onChange={handleCustomFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Main Grid: 3D Viewport (Left) + Analysis Inspector (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 380px', gap: '1.25rem', alignItems: 'start' }}>
        {/* 3D VIEWPORT CONTAINER */}
        <div
          style={{
            background: 'linear-gradient(180deg, #FDFBF7 0%, #EFEBE4 100%)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
            height: '680px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Viewport Top Toolbar: Angles, Fit, Wireframe, Sockets */}
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
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            {/* Camera angle presets */}
            <div
              style={{
                display: 'flex',
                gap: '3px',
                background: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(8px)',
                padding: '3px 6px',
                borderRadius: '24px',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                pointerEvents: 'auto',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              }}
            >
              <button
                type="button"
                onClick={() => handleCameraAngle('front')}
                style={{ border: 'none', background: 'transparent', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => handleCameraAngle('side')}
                style={{ border: 'none', background: 'transparent', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Nghiêng
              </button>
              <button
                type="button"
                onClick={() => handleCameraAngle('back')}
                style={{ border: 'none', background: 'transparent', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Sau
              </button>
              <button
                type="button"
                onClick={() => handleCameraAngle('three_quarter')}
                style={{ border: 'none', background: 'transparent', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', color: 'var(--accent-blue)' }}
              >
                Góc 3/4
              </button>
              <button
                type="button"
                onClick={() => handleCameraAngle('fit')}
                title="Căn vừa khung hình theo bounding box"
                style={{ border: 'none', background: 'transparent', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', color: 'var(--accent-red)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              >
                <Maximize2 size={12} />
                Fit Bounds
              </button>
            </div>

            {/* Visualizer toggles: Wireframe & Sockets */}
            <div
              style={{
                display: 'flex',
                gap: '5px',
                pointerEvents: 'auto',
              }}
            >
              <button
                type="button"
                onClick={() => setWireframe(!wireframe)}
                style={{
                  background: wireframe ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.92)',
                  color: wireframe ? '#FFFFFF' : 'var(--text-primary)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Eye size={12} />
                <span>Khung dây (Wireframe)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSockets(!showSockets)}
                style={{
                  background: showSockets ? '#7B1FA2' : 'rgba(255, 255, 255, 0.92)',
                  color: showSockets ? '#FFFFFF' : 'var(--text-primary)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Layers size={12} />
                <span>Điểm neo (Sockets)</span>
              </button>
            </div>
          </div>

          {/* 3D Canvas */}
          <div style={{ flex: 1, width: '100%', height: '100%' }}>
            <WebGLBoundary>
              <Canvas
                shadows
                dpr={[1, 1.75]}
                camera={{ position: [0, 0.95, 2.3], fov: 42 }}
                style={{ width: '100%', height: '100%' }}
                gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
              >
                <ambientLight intensity={0.85} />
                <directionalLight position={[2, 3, 2]} intensity={1.1} castShadow />
                <directionalLight position={[-2, 2, -2]} intensity={0.4} />

                <Suspense fallback={null}>
                  <AvatarViewerMesh
                    url={avatarUrl}
                    wireframe={wireframe}
                    showSockets={showSockets}
                    morphWeights={morphWeights}
                    onInspected={setStats}
                  />
                  <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={2.8} blur={1.5} far={1.2} />
                </Suspense>

                <OrbitControls
                  ref={controlsRef}
                  enablePan={true}
                  enableZoom={true}
                  minDistance={0.5}
                  maxDistance={4.5}
                  target={[0, 0.85, 0]}
                />
              </Canvas>
            </WebGLBoundary>
          </div>

          {/* Viewport Bottom Overlay Status Bar */}
          <div
            style={{
              padding: '6px 14px',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(8px)',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div>
              Đang xem:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {customFileName ? customFileName : selectedAvatarId === 'avatar_v2' ? 'avatar_v2.glb (Chuẩn V2 Master)' : 'avatar_base.glb (Cơ bản V1)'}
              </strong>
            </div>
            {stats && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span>Đỉnh: <strong>{stats.vertices.toLocaleString()}</strong></span>
                <span>Mặt tam giác: <strong>{stats.triangles.toLocaleString()}</strong></span>
                <span>Chiều cao: <strong style={{ color: isAnthropometricallySound ? '#2E7D32' : '#C62828' }}>{stats.height.toFixed(3)}m</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR ANALYSIS DRAWER */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.1rem',
          }}
        >
          {/* Sub-Tabs Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', background: 'var(--bg-subtle)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setActiveTab('morphs')}
              style={{
                border: 'none',
                background: activeTab === 'morphs' ? 'white' : 'transparent',
                color: activeTab === 'morphs' ? 'var(--accent-red)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'morphs' ? 700 : 500,
                fontSize: '0.74rem',
                padding: '6px 2px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                boxShadow: activeTab === 'morphs' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Morphs
            </button>
            <button
              onClick={() => setActiveTab('anthropometry')}
              style={{
                border: 'none',
                background: activeTab === 'anthropometry' ? 'white' : 'transparent',
                color: activeTab === 'anthropometry' ? 'var(--accent-red)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'anthropometry' ? 700 : 500,
                fontSize: '0.74rem',
                padding: '6px 2px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                boxShadow: activeTab === 'anthropometry' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Tỷ lệ
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              style={{
                border: 'none',
                background: activeTab === 'materials' ? 'white' : 'transparent',
                color: activeTab === 'materials' ? 'var(--accent-red)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'materials' ? 700 : 500,
                fontSize: '0.74rem',
                padding: '6px 2px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                boxShadow: activeTab === 'materials' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Vật liệu
            </button>
            <button
              onClick={() => setActiveTab('compatibility')}
              style={{
                border: 'none',
                background: activeTab === 'compatibility' ? 'white' : 'transparent',
                color: activeTab === 'compatibility' ? 'var(--accent-red)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'compatibility' ? 700 : 500,
                fontSize: '0.74rem',
                padding: '6px 2px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                boxShadow: activeTab === 'compatibility' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Tương thích
            </button>
          </div>

          {/* TAB 1: MORPH TARGETS SLIDERS */}
          {activeTab === 'morphs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  5 Biến dạng vóc dáng chuẩn
                </span>
                <button
                  onClick={handleResetMorphs}
                  style={{
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.72rem',
                    padding: '2px 7px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <RotateCcw size={11} /> Reset
                </button>
              </div>

              {/* Slider 1: Petite */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '2px' }}>
                  <span>Nhỏ nhắn (Petite)</span>
                  <strong>{Math.round(morphWeights.morph_petite * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={morphWeights.morph_petite}
                  onChange={(e) => handleMorphChange('morph_petite', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-red)' }}
                />
              </div>

              {/* Slider 2: Tall Slender */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '2px' }}>
                  <span>Cao thanh (Tall Slender)</span>
                  <strong>{Math.round(morphWeights.morph_tall_slender * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={morphWeights.morph_tall_slender}
                  onChange={(e) => handleMorphChange('morph_tall_slender', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-red)' }}
                />
              </div>

              {/* Slider 3: Broad Shoulders */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '2px' }}>
                  <span>Vai rộng (Broad Shoulders)</span>
                  <strong>{Math.round(morphWeights.morph_broad_shoulders * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={morphWeights.morph_broad_shoulders}
                  onChange={(e) => handleMorphChange('morph_broad_shoulders', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-red)' }}
                />
              </div>

              {/* Slider 4: Curvy Hips */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '2px' }}>
                  <span>Hông nở (Curvy Hips)</span>
                  <strong>{Math.round(morphWeights.morph_curvy_hips * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={morphWeights.morph_curvy_hips}
                  onChange={(e) => handleMorphChange('morph_curvy_hips', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-red)' }}
                />
              </div>

              {/* Slider 5: Plus Size */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '2px' }}>
                  <span>Đầy đặn (Plus Size)</span>
                  <strong>{Math.round(morphWeights.morph_plus_size * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={morphWeights.morph_plus_size}
                  onChange={(e) => handleMorphChange('morph_plus_size', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-red)' }}
                />
              </div>

              <div style={{ marginTop: '0.5rem', background: 'var(--bg-subtle)', padding: '0.65rem', borderRadius: 'var(--radius-md)', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                <strong>Morphs phát hiện trong file:</strong>
                {stats?.morphNames && stats.morphNames.length > 0 ? (
                  <ul style={{ margin: '0.35rem 0 0 0', paddingLeft: '1.1rem' }}>
                    {stats.morphNames.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: '0.25rem 0 0 0', color: '#E65100' }}>Không tìm thấy morph target trong mesh.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ANTHROPOMETRY PROPORTIONS */}
          {activeTab === 'anthropometry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div
                style={{
                  background: isAnthropometricallySound ? '#E8F5E9' : '#FFEBEE',
                  border: `1px solid ${isAnthropometricallySound ? '#A5D6A7' : '#FFCDD2'}`,
                  color: isAnthropometricallySound ? '#2E7D32' : '#C62828',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                {isAnthropometricallySound ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span style={{ fontWeight: 600 }}>
                  {isAnthropometricallySound
                    ? 'Tỷ lệ nhân trắc học nữ trưởng thành hợp lệ (~1.55m - 1.75m)'
                    : 'Cảnh báo: Chiều cao lệch chuẩn nhân trắc học nữ trưởng thành'}
                </span>
              </div>

              {stats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span>Chiều cao thực tế</span>
                    <strong>{stats.height.toFixed(3)} m</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span>Chiều rộng vai (AABB X)</span>
                    <strong>{((stats.max[0] - stats.min[0]) * 100).toFixed(1)} cm</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span>Độ dày thân (AABB Z)</span>
                    <strong>{((stats.max[2] - stats.min[2]) * 100).toFixed(1)} cm</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span>Gốc tọa độ chân (Min Y)</span>
                    <strong style={{ color: Math.abs(stats.min[1]) < 0.05 ? '#2E7D32' : '#E65100' }}>
                      {stats.min[1].toFixed(3)} m {Math.abs(stats.min[1]) < 0.05 ? '(Chuẩn mặt đất)' : '(Lệch mặt đất)'}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MATERIALS & TEXTURES */}
          {activeTab === 'materials' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Các slot vật liệu phát hiện ({stats?.materials.length || 0})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '380px', overflowY: 'auto' }}>
                {stats?.materials.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.6rem',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.76rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{m.name}</strong>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.35rem',
                          borderRadius: 'var(--radius-full)',
                          background: m.slotType === 'skin' ? '#FFF3E0' : m.slotType === 'hair' ? '#EDE7F6' : '#ECEFF1',
                          color: m.slotType === 'skin' ? '#E65100' : m.slotType === 'hair' ? '#512DA8' : '#37474F',
                        }}
                      >
                        Slot: {m.slotType}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                      <span>Diffuse Map: {m.hasMap ? '✓ Có (Bảo lưu)' : '✕ Không (Dùng màu nền)'}</span>
                      <span>Normal Map: {m.hasNormal ? '✓ Có' : '✕'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: COMPATIBILITY PREVIEW */}
          {activeTab === 'compatibility' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Tương thích mẫu áo dài hiện có
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {VALID_GARMENT_MODELS.map((modelId) => {
                  const compat = getCompatibilityStatus(selectedAvatarId, modelId, 'standard');
                  return (
                    <div
                      key={modelId}
                      style={{
                        background: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.65rem',
                        border: '1px solid var(--border-light)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600 }}>{modelId}</span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: 'var(--radius-full)',
                            background: compat.status === 'verified' ? '#E8F5E9' : compat.status === 'unsupported' ? '#FFEBEE' : '#FFF3E0',
                            color: compat.status === 'verified' ? '#2E7D32' : compat.status === 'unsupported' ? '#C62828' : '#E65100',
                          }}
                        >
                          {compat.status === 'verified' ? '[Đã kiểm chứng]' : compat.status === 'unsupported' ? '[Không tương thích]' : '[Chưa thử nghiệm]'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {compat.reason}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
