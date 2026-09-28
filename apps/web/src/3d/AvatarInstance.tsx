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
}

export const AvatarInstance: React.FC<AvatarInstanceProps> = ({
  url,
  morphWeights,
  skinMaterialSpec,
  hairMaterialSpec,
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

  // 3. Assign materials to respective primitives
  useEffect(() => {
    instanceScene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        // Multi-primitive glTF: Primitive 0 is Skin, Primitive 1 is Hair
        if (Array.isArray(mesh.material)) {
          mesh.material = [skinMaterial, hairMaterial];
        } else if (mesh.name.toLowerCase().includes('hair')) {
          mesh.material = hairMaterial;
        } else {
          mesh.material = skinMaterial;
        }
      }
    });
  }, [instanceScene, skinMaterial, hairMaterial]);

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
    };
  }, [instanceScene, skinMaterial, hairMaterial]);

  return <primitive object={instanceScene} />;
};
