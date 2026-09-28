/**
 * Scene Manager Component
 * Manages Three.js scene environment: lighting, camera director, orbit controls, contact shadows,
 * and WebGL context loss listeners.
 */

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';

export type ViewAngle = 'front' | 'back' | 'left' | 'right' | 'collar' | 'waist' | 'flaps' | 'reset';

interface CameraDirectorProps {
  viewAngle: ViewAngle | null;
  onAngleApplied: () => void;
  controlsRef: React.RefObject<any>;
}

function CameraDirector({ viewAngle, onAngleApplied, controlsRef }: CameraDirectorProps) {
  useEffect(() => {
    if (!viewAngle || !controlsRef.current) return;
    const ctrl = controlsRef.current;

    switch (viewAngle) {
      case 'front':
      case 'reset':
        ctrl.object.position.set(0, 1.15, 2.3);
        ctrl.target.set(0, 0.95, 0);
        break;
      case 'back':
        ctrl.object.position.set(0, 1.15, -2.3);
        ctrl.target.set(0, 0.95, 0);
        break;
      case 'left':
        ctrl.object.position.set(-2.3, 1.15, 0);
        ctrl.target.set(0, 0.95, 0);
        break;
      case 'right':
        ctrl.object.position.set(2.3, 1.15, 0);
        ctrl.target.set(0, 0.95, 0);
        break;
      case 'collar':
        // Close-up on collar and neckline
        ctrl.object.position.set(0, 1.48, 0.85);
        ctrl.target.set(0, 1.45, 0);
        break;
      case 'waist':
        // Close-up on waist & side slit origin
        ctrl.object.position.set(0.65, 1.05, 0.85);
        ctrl.target.set(0, 1.05, 0);
        break;
      case 'flaps':
        // Close-up on flowing flaps & pants hem
        ctrl.object.position.set(0, 0.55, 1.25);
        ctrl.target.set(0, 0.50, 0);
        break;
    }
    ctrl.update();
    onAngleApplied();
  }, [viewAngle, onAngleApplied, controlsRef]);

  return null;
}

interface SceneManagerProps {
  autoRotate: boolean;
  viewAngle: ViewAngle | null;
  onAngleApplied: () => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

export const SceneManager: React.FC<SceneManagerProps> = ({
  autoRotate,
  viewAngle,
  onAngleApplied,
  onContextLost,
  onContextRestored,
}) => {
  const { gl } = useThree();
  const controlsRef = useRef<any>(null);

  // WebGL context loss listener
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('[SceneManager] WebGL Context Lost!');
      if (onContextLost) onContextLost();
    };

    const handleContextRestored = () => {
      console.info('[SceneManager] WebGL Context Restored.');
      if (onContextRestored) onContextRestored();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl, onContextLost, onContextRestored]);

  return (
    <>
      {/* 1. Ambient warm daylight */}
      <ambientLight intensity={0.75} color="#FFFBF5" />

      {/* 2. Key daylight with soft shadows */}
      <directionalLight
        position={[2.5, 3.5, 2.5]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0001}
      />

      {/* 3. Fill light */}
      <directionalLight position={[-2.2, 2.0, 1.5]} intensity={0.55} color="#F3E9DD" />

      {/* 4. Back rim light to accentuate silhouette */}
      <directionalLight position={[0, 2.5, -2.5]} intensity={0.65} color="#FFFFFF" />

      {/* 5. Contact ground shadow */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.45}
        scale={2.5}
        blur={1.6}
        far={1.5}
        color="#3D322A"
      />

      {/* 6. Orbit Controls */}
      <OrbitControls
        ref={controlsRef}
        autoRotate={autoRotate}
        autoRotateSpeed={1.5}
        enablePan={false}
        minDistance={0.7}
        maxDistance={4.0}
        maxPolarAngle={Math.PI / 2 + 0.05}
        target={[0, 0.95, 0]}
      />

      {/* 7. Camera Director */}
      <CameraDirector
        viewAngle={viewAngle}
        onAngleApplied={onAngleApplied}
        controlsRef={controlsRef}
      />
    </>
  );
};
