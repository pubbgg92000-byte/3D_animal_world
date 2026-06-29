import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_HALF, getTerrainHeight, isWaterAt } from '../utils/world';

/* ========================================
   Seeded random
   ======================================== */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* ========================================
   Tall Grass — instanced with shader wind
   ======================================== */

const BLADE_COUNT = 3200;
const GRASS_SPREAD = WORLD_HALF - 2;

/** Exported grass patch positions for moose AI */
export const GRASS_POSITIONS = [];

export default function TallGrass() {
  const meshRef = useRef();
  const materialRef = useRef();

  const matrices = useMemo(() => {
    const rng = seededRandom(777);
    const dummy = new THREE.Object3D();
    const mats = [];

    GRASS_POSITIONS.length = 0;
    const patchCenters = new Map();

    for (let i = 0; i < BLADE_COUNT; i++) {
      const x = (rng() - 0.5) * GRASS_SPREAD * 2;
      const z = (rng() - 0.5) * GRASS_SPREAD * 2;
      if (isWaterAt(x, z, 1.4)) continue;
      const y = getTerrainHeight(x, z);

      const height = 0.3 + rng() * 0.7;
      const width = 0.02 + rng() * 0.04;

      dummy.position.set(x, y + height * 0.5, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.2);
      dummy.scale.set(width, height, width);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());

      // Track patch centers for AI
      const gx = Math.floor(x / 10) * 10;
      const gz = Math.floor(z / 10) * 10;
      const key = `${gx},${gz}`;
      if (!patchCenters.has(key)) {
        patchCenters.set(key, { x: gx + 5, z: gz + 5, count: 0 });
      }
      patchCenters.get(key).count++;
    }

    for (const [_, patch] of patchCenters) {
      if (patch.count > 5) {
        const py = getTerrainHeight(patch.x, patch.z);
        GRASS_POSITIONS.push(new THREE.Vector3(patch.x, py, patch.z));
      }
    }

    return mats;
  }, []);

  // Set matrices on mount
  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < matrices.length; i++) {
      meshRef.current.setMatrixAt(i, matrices[i]);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  // Wind sway via shader time uniform (cheap!)
  useFrame((state) => {
    if (materialRef.current?.userData?.shader) {
      materialRef.current.userData.shader.uniforms.uTime.value =
        state.clock.elapsedTime;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, matrices.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#3a7a2a"
        roughness={0.85}
        side={THREE.DoubleSide}
        onBeforeCompile={(shader) => {
          shader.uniforms.uTime = { value: 0 };

          // Add wind sway to vertex shader
          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
            uniform float uTime;`
          );
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            // Wind sway — only affects top of blade (y > 0)
            float windStrength = max(0.0, transformed.y) * 0.15;
            float windX = sin(uTime * 1.5 + instanceMatrix[3][0] * 0.3) * windStrength;
            float windZ = cos(uTime * 1.2 + instanceMatrix[3][2] * 0.4) * windStrength;
            transformed.x += windX;
            transformed.z += windZ;`
          );

          // Store ref for uniform update
          materialRef.current.userData.shader = shader;
        }}
      />
    </instancedMesh>
  );
}
