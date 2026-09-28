/**
 * Socket Attacher Component
 * Dynamically attaches chosen cultural accessories to avatar anatomical sockets.
 * Uses real-time morph deformation to keep accessories in place when body changes.
 * Crucial optimization: ONLY loads active accessories, avoiding unnecessary network and memory overhead.
 */

import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { ResourceLoader } from './ResourceLoader.ts';
import { MorphController } from './MorphController.ts';
import { type AccessorySpec } from './RenderSpec.ts';

interface SingleAccessoryProps {
  spec: AccessorySpec;
  morphWeights: Record<string, number>;
}

const SingleAccessory: React.FC<SingleAccessoryProps> = ({ spec, morphWeights }) => {
  const gltf = useGLTF(spec.url);

  const instanceScene = useMemo(() => {
    return ResourceLoader.cloneScene(gltf.scene);
  }, [gltf.scene]);

  const transform = useMemo(() => {
    return MorphController.getSocketTransform(spec.socket, morphWeights);
  }, [spec.socket, morphWeights]);

  useEffect(() => {
    return () => {
      ResourceLoader.disposeInstance(instanceScene);
    };
  }, [instanceScene]);

  return (
    <group
      name={`Socket_${spec.socket}_${spec.id}`}
      position={transform.position}
      scale={transform.scale}
    >
      <primitive object={instanceScene} />
    </group>
  );
};

interface SocketAttacherProps {
  accessories: AccessorySpec[];
  morphWeights: Record<string, number>;
}

export const SocketAttacher: React.FC<SocketAttacherProps> = ({ accessories, morphWeights }) => {
  return (
    <group name="AccessoriesSocketGroup">
      {accessories.map((acc) => (
        <SingleAccessory key={acc.id} spec={acc} morphWeights={morphWeights} />
      ))}
    </group>
  );
};
