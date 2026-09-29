/**
 * Avatar Instance Component
 * Renders an isolated avatar mesh with separated Skin and Hair material slots.
 * Manages independent instance lifecycle and morph weights.
 */

import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ResourceLoader } from './ResourceLoader.ts';
import { MaterialFactory } from './MaterialFactory.ts';
import { MorphController } from './MorphController.ts';
import { type MaterialSpec } from './RenderSpec.ts';

interface AvatarInstanceProps {
  url: string;
  morphWeights: Record<string, number>;
  skinMaterialSpec: MaterialSpec;
  hairMaterialSpec: MaterialSpec;
  eyesMaterialSpec?: MaterialSpec;
}

export const AvatarInstance: React.FC<AvatarInstanceProps> = ({
  url,
  morphWeights,
  skinMaterialSpec,
  hairMaterialSpec,
  eyesMaterialSpec,
}) => {
  const gltf = useGLTF(url);

  // 1. Create an isolated cloned scene graph for this viewer instance
  const instanceScene = useMemo(() => {
    return ResourceLoader.cloneScene(gltf.scene);
  }, [gltf.scene]);

  // 2. Create dedicated instance materials
  const skinMaterial = useMemo(() => {
    return MaterialFactory.createSkinMaterial(skinMaterialSpec);
  }, [skinMaterialSpec.color, skinMaterialSpec.roughness, skinMaterialSpec.metalness]);

  const hairMaterial = useMemo(() => {
    return MaterialFactory.createHairMaterial(hairMaterialSpec);
  }, [hairMaterialSpec.color, hairMaterialSpec.roughness, hairMaterialSpec.metalness]);

  const eyesMaterial = useMemo(() => {
    return MaterialFactory.createEyesMaterial(eyesMaterialSpec || {
      color: '#2B221B',
      roughness: 0.15,
      metalness: 0.0,
    });
  }, [eyesMaterialSpec?.color, eyesMaterialSpec?.roughness, eyesMaterialSpec?.metalness]);

  // 3. Assign materials to respective primitives
  useEffect(() => {
    instanceScene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        // Multi-primitive glTF: Match by material name or mesh name
        const matName = ((mesh.material as THREE.Material)?.name || '').toLowerCase();
        const meshName = (mesh.name || '').toLowerCase();

        if (Array.isArray(mesh.material)) {
          mesh.material = [skinMaterial, hairMaterial, eyesMaterial];
        } else if (meshName.includes('hair') || matName.includes('hair')) {
          mesh.material = hairMaterial;
        } else if (meshName.includes('eye') || matName.includes('eye')) {
          mesh.material = eyesMaterial;
        } else {
          mesh.material = skinMaterial;
        }
      }
    });
  }, [instanceScene, skinMaterial, hairMaterial, eyesMaterial]);

  // 4. Synchronize morph target weights
  useEffect(() => {
    MorphController.applyMorphWeights(instanceScene, morphWeights);
  }, [instanceScene, morphWeights]);

  // 5. Cleanup instance resources on unmount
  useEffect(() => {
    return () => {
      ResourceLoader.disposeInstance(instanceScene);
      skinMaterial.dispose();
      hairMaterial.dispose();
      eyesMaterial.dispose();
    };
  }, [instanceScene, skinMaterial, hairMaterial, eyesMaterial]);

  return <primitive object={instanceScene} />;
};
