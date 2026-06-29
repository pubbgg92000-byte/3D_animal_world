import { useMemo } from 'react';
import * as THREE from 'three';
import { WORLD_SIZE, getTerrainHeight } from '../../../utils/world';

const SEGMENTS = 96;

export default function Terrain({ onClick, onDoubleClick }) {
  const geometry = useMemo(() => {
    const result = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
    result.rotateX(-Math.PI / 2);
    const positions = result.attributes.position;
    const colors = [];

    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const y = getTerrainHeight(x, z);
      positions.setY(index, y);

      const meadow = Math.max(0, 1 - Math.hypot(x, z) / 46);
      const fineGrass = Math.sin(x * 1.7) * Math.cos(z * 1.35) * 0.015;
      const broadGrass = Math.sin(x * 0.19 + z * 0.13) * 0.035;
      const variation = broadGrass + fineGrass;
      const color = new THREE.Color().setHSL(
        0.305 + variation,
        0.58 + meadow * 0.12,
        0.31 + meadow * 0.075
      );
      colors.push(color.r, color.g, color.b);
    }

    result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    result.computeVertexNormals();
    return result;
  }, []);

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event.point.clone());
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDoubleClick?.(event.point.clone());
      }}
    >
      <meshStandardMaterial vertexColors roughness={0.94} metalness={0} />
    </mesh>
  );
}
