/**
 * Garment Instance Component
 * Renders the chosen Ao Dai garment and silk pants with isolated materials and synchronized morphs.
 */

import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ResourceLoader } from './ResourceLoader.ts';
import { MaterialFactory } from './MaterialFactory.ts';
import { MorphController } from './MorphController.ts';
import { type MaterialSpec } from './RenderSpec.ts';

interface GarmentInstanceProps {
  garmentUrl: string;
  pantsUrl: string;
  morphWeights: Record<string, number>;
  garmentMaterialSpec: MaterialSpec;
  pantsMaterialSpec: MaterialSpec;
}

export const GarmentInstance: React.FC<GarmentInstanceProps> = ({
  garmentUrl,
  pantsUrl,
  morphWeights,
  garmentMaterialSpec,
  pantsMaterialSpec,
}) => {
  const garmentGltf = useGLTF(garmentUrl);
  const pantsGltf = useGLTF(pantsUrl);

  // 1. Isolated cloned scenes
  const clonedGarmentScene = useMemo(() => {
    return ResourceLoader.cloneScene(garmentGltf.scene);
  }, [garmentGltf.scene]);

  const clonedPantsScene = useMemo(() => {
    return ResourceLoader.cloneScene(pantsGltf.scene);
  }, [pantsGltf.scene]);

  // 2. Dedicated instance materials created once per model URL
  const garmentMaterial = useMemo(() => {
    return MaterialFactory.createGarmentMaterial(garmentMaterialSpec);
  }, [garmentUrl]);

  const pantsMaterial = useMemo(() => {
    return MaterialFactory.createPantsMaterial(pantsMaterialSpec);
  }, [pantsUrl]);

  // Mutate material properties in-place without triggering shader re-compilation or 1-frame black flash
  useEffect(() => {
    MaterialFactory.updateMaterial(garmentMaterial, garmentMaterialSpec);
  }, [garmentMaterial, garmentMaterialSpec]);

  useEffect(() => {
    MaterialFactory.updateMaterial(pantsMaterial, pantsMaterialSpec);
  }, [pantsMaterial, pantsMaterialSpec]);

  // 3. Assign materials
  useEffect(() => {
    clonedGarmentScene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = garmentMaterial;
      }
    });
  }, [clonedGarmentScene, garmentMaterial]);

  useEffect(() => {
    clonedPantsScene.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = pantsMaterial;
      }
    });
  }, [clonedPantsScene, pantsMaterial]);

  // 4. Synchronize morph weights
  useEffect(() => {
    MorphController.applyMorphWeights(clonedGarmentScene, morphWeights);
    MorphController.applyMorphWeights(clonedPantsScene, morphWeights);
  }, [clonedGarmentScene, clonedPantsScene, morphWeights]);

  // 5. Cleanup on unmount or URL switch only (prevents double disposal and scene invalidation)
  useEffect(() => {
    return () => {
      ResourceLoader.disposeInstance(clonedGarmentScene, false);
      ResourceLoader.disposeInstance(clonedPantsScene, false);
      garmentMaterial.dispose();
      pantsMaterial.dispose();
    };
  }, [clonedGarmentScene, clonedPantsScene, garmentMaterial, pantsMaterial]);

  return (
    <group name="GarmentAndPantsGroup">
      <primitive object={clonedGarmentScene} />
      <primitive object={clonedPantsScene} />
    </group>
  );
};
