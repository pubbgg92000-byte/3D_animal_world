import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import perfConfig from '../../../config/performanceConfig';

export default function Rock({ asset, instances }) {
  const meshRefs = useRef([]);
  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    return instances.map((instance) => {
      dummy.position.set(instance.x, instance.y, instance.z);
      dummy.rotation.set(instance.tilt, instance.rotation, -instance.tilt * 0.5);
      dummy.scale.setScalar(instance.scale);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [instances]);

  useEffect(() => {
    meshRefs.current.forEach((mesh) => {
      if (!mesh) return;
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    });
  }, [matrices]);

  return asset.parts.map((part, index) => (
    <instancedMesh
      key={`${asset.id}-${index}`}
      ref={(mesh) => { meshRefs.current[index] = mesh; }}
      args={[part.geometry, part.material, instances.length]}
      castShadow={perfConfig.enableShadows}
      receiveShadow={perfConfig.enableShadows}
    />
  ));
}
