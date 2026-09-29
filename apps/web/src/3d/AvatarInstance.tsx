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

  // 2. Create isolated adapted materials per primitive, strictly preserving any pre-baked textures
  const allocatedMaterials = useMemo(() => {
    const materials: THREE.MeshStandardMaterial[] = [];
    instanceScene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        const origMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material | null;
        const matName = ((mesh.material as THREE.Material)?.name || '').toLowerCase();
        const meshName = (mesh.name || '').toLowerCase();

        let slotType: 'skin' | 'hair' | 'eyes' | 'static' = 'skin';
        let spec = skinMaterialSpec;

        if (meshName.includes('hair') || matName.includes('hair') || matName.includes('toc')) {
          slotType = 'hair';
          spec = hairMaterialSpec;
        } else if (meshName.includes('eye') || matName.includes('eye') || matName.includes('mat')) {
          slotType = 'eyes';
          spec = eyesMaterialSpec || { color: '#2B221B', roughness: 0.15, metalness: 0.0 };
        }

        const adaptedMat = MaterialFactory.createAdaptedAvatarMaterial(origMat, spec, slotType);
        materials.push(adaptedMat);
        mesh.material = adaptedMat;
      }
    });
    return materials;
  }, [instanceScene]);

  // Mutate material properties in-place without triggering shader re-compilation
  useEffect(() => {
    allocatedMaterials.forEach((mat) => {
      const lower = mat.name.toLowerCase();
      if (lower.includes('hair')) {
        MaterialFactory.updateMaterial(mat, hairMaterialSpec);
      } else if (lower.includes('eye')) {
        if (eyesMaterialSpec) MaterialFactory.updateMaterial(mat, eyesMaterialSpec);
      } else {
        MaterialFactory.updateMaterial(mat, skinMaterialSpec);
      }
    });
  }, [allocatedMaterials, skinMaterialSpec, hairMaterialSpec, eyesMaterialSpec]);

  // 3. Synchronize morph target weights
  useEffect(() => {
    MorphController.applyMorphWeights(instanceScene, morphWeights);
  }, [instanceScene, morphWeights]);

  // 4. Cleanup instance resources on unmount (prevents double disposal or memory leaks)
  useEffect(() => {
    return () => {
      ResourceLoader.disposeInstance(instanceScene, false);
      allocatedMaterials.forEach((m) => m.dispose());
    };
  }, [instanceScene, allocatedMaterials]);

  return <primitive object={instanceScene} />;
};
