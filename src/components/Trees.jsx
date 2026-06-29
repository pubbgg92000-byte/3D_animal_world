import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { registerTreeObstacles } from '../utils/collisionRegistry';
import { WORLD_HALF, getTerrainHeight, isWaterAt } from '../utils/world';

/* ========================================
   Seeded random for deterministic placement
   ======================================== */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* ========================================
   Tree Types
   ======================================== */

/** Pine tree — cone + cylinder trunk */
function PineTree({ position, scale = 1 }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 1.2 * scale, 0]} castShadow>
        <cylinderGeometry args={[0.08 * scale, 0.15 * scale, 2.4 * scale, 6]} />
        <meshStandardMaterial color="#5a3a1e" roughness={0.9} />
      </mesh>
      {/* Lower canopy */}
      <mesh position={[0, 2.8 * scale, 0]} castShadow receiveShadow>
        <coneGeometry args={[1.5 * scale, 2.2 * scale, 7]} />
        <meshStandardMaterial color="#1a5c1a" roughness={0.85} />
      </mesh>
      {/* Upper canopy */}
      <mesh position={[0, 4.2 * scale, 0]} castShadow receiveShadow>
        <coneGeometry args={[1.0 * scale, 1.8 * scale, 7]} />
        <meshStandardMaterial color="#237a23" roughness={0.8} />
      </mesh>
      {/* Top */}
      <mesh position={[0, 5.3 * scale, 0]} castShadow>
        <coneGeometry args={[0.5 * scale, 1.2 * scale, 6]} />
        <meshStandardMaterial color="#2d8e2d" roughness={0.75} />
      </mesh>
    </group>
  );
}

/** Oak/broad tree — sphere canopy + thick trunk */
function BroadTree({ position, scale = 1 }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, 1.5 * scale, 0]} castShadow>
        <cylinderGeometry args={[0.15 * scale, 0.25 * scale, 3.0 * scale, 6]} />
        <meshStandardMaterial color="#4a2e10" roughness={0.92} />
      </mesh>
      {/* Main canopy */}
      <mesh position={[0, 4.0 * scale, 0]} castShadow receiveShadow>
        <sphereGeometry args={[2.2 * scale, 8, 6]} />
        <meshStandardMaterial color="#1e6b1e" roughness={0.82} />
      </mesh>
      {/* Secondary canopy */}
      <mesh position={[0.8 * scale, 3.5 * scale, 0.5 * scale]} castShadow>
        <sphereGeometry args={[1.2 * scale, 7, 5]} />
        <meshStandardMaterial color="#24802e" roughness={0.78} />
      </mesh>
    </group>
  );
}

/** Orchard apple tree — low spreading crown with a visible branching shape. */
function AppleTree({ position, scale = 1 }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.35 * scale, 0]} castShadow>
        <cylinderGeometry args={[0.14 * scale, 0.25 * scale, 2.7 * scale, 7]} />
        <meshStandardMaterial color="#5b351b" roughness={0.94} />
      </mesh>
      <mesh position={[0, 3.0 * scale, 0]} scale={[1.35, 0.92, 1.18]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1.18 * scale, 1]} />
        <meshStandardMaterial color="#3f8b36" roughness={0.86} />
      </mesh>
      <mesh position={[-0.9 * scale, 2.85 * scale, 0.2 * scale]} scale={[0.9, 0.8, 0.9]} castShadow>
        <dodecahedronGeometry args={[0.95 * scale, 1]} />
        <meshStandardMaterial color="#4d9a3d" roughness={0.84} />
      </mesh>
      <mesh position={[0.85 * scale, 2.95 * scale, -0.18 * scale]} scale={[0.9, 0.82, 0.92]} castShadow>
        <dodecahedronGeometry args={[0.92 * scale, 1]} />
        <meshStandardMaterial color="#347c31" roughness={0.88} />
      </mesh>
    </group>
  );
}

const APPLE_OFFSETS = [
  [-1.05, 3.0, 0.52], [-0.72, 2.52, -0.72], [-0.38, 3.55, 0.88],
  [0.05, 2.4, 1.08], [0.36, 3.48, -0.9], [0.72, 2.55, 0.72],
  [1.05, 3.05, 0.35], [0.92, 3.45, -0.42], [-0.96, 3.42, -0.35],
  [0.15, 3.68, 0.25], [-0.25, 2.62, -1.02], [0.62, 2.82, -0.98],
];

function OrchardApples({ trees }) {
  const meshRef = useRef();
  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    const result = [];
    for (const tree of trees) {
      for (const [ox, oy, oz] of APPLE_OFFSETS) {
        dummy.position.set(
          tree.x + ox * tree.scale,
          tree.y + oy * tree.scale,
          tree.z + oz * tree.scale
        );
        dummy.rotation.set(0, (ox + oz) * 1.7, 0);
        dummy.scale.setScalar(0.22 * tree.scale);
        dummy.updateMatrix();
        result.push(dummy.matrix.clone());
      }
    }
    return result;
  }, [trees]);

  useEffect(() => {
    if (!meshRef.current) return;
    matrices.forEach((matrix, index) => meshRef.current.setMatrixAt(index, matrix));
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  return (
    <instancedMesh ref={meshRef} args={[null, null, matrices.length]} castShadow>
      <sphereGeometry args={[0.5, 8, 6]} />
      <meshStandardMaterial color="#d92f27" roughness={0.62} />
    </instancedMesh>
  );
}

/* ========================================
   Trees Component — dense forest
   ======================================== */

/** Exported tree positions for moose AI to use */
export const TREE_POSITIONS = [];

export default function Trees() {
  const treeData = useMemo(() => {
    const trees = [];
    const rng = seededRandom(42);
    const FIELD_RADIUS = WORLD_HALF - 3;

    // Clear exported positions
    TREE_POSITIONS.length = 0;

    for (let i = 0; i < 170; i++) {
      const x = (rng() * 2 - 1) * FIELD_RADIUS;
      const z = (rng() * 2 - 1) * FIELD_RADIUS;

      const dist = Math.sqrt(x * x + z * z);
      if (dist < 12 || isWaterAt(x, z, 2.2)) continue;
      const orchardX = (x + 42) / 23;
      const orchardZ = (z + 29) / 22;
      if (orchardX * orchardX + orchardZ * orchardZ < 1.25) continue;

      const y = getTerrainHeight(x, z);
      const scale = 0.5 + rng() * 0.8;
      const type = rng() > 0.35 ? 'pine' : 'broad';

      trees.push({ x, y, z, scale, type, key: `tree-${i}` });
      TREE_POSITIONS.push(new THREE.Vector3(x, y, z));
    }

    // Ordered rows turn the northwest hill into a readable apple orchard.
    let orchardIndex = 0;
    for (let row = 0; row < 7; row++) {
      for (let column = 0; column < 8; column++) {
        const x = -55 + column * 4.45 + (rng() - 0.5) * 0.55;
        const z = -44 + row * 4.75 + (rng() - 0.5) * 0.55;
        if (Math.abs(x) > FIELD_RADIUS || Math.abs(z) > FIELD_RADIUS) continue;
        if (Math.hypot(x, z) < 14 || isWaterAt(x, z, 2.2)) continue;

        const y = getTerrainHeight(x, z);
        const scale = 0.72 + rng() * 0.28;
        const type = 'apple';
        const key = `orchard-tree-${orchardIndex}`;
        trees.push({ x, y, z, scale, type, key });
        TREE_POSITIONS.push(new THREE.Vector3(x, y, z));
        orchardIndex++;
      }
    }

    // Register static trunk collision circles
    registerTreeObstacles(trees);

    return trees;
  }, []);
  const orchardTrees = useMemo(
    () => treeData.filter((tree) => tree.type === 'apple'),
    [treeData]
  );

  return (
    <group>
      {treeData.map((t) => {
        if (t.type === 'pine') return (
          <PineTree key={t.key} position={[t.x, t.y, t.z]} scale={t.scale} />
        );
        if (t.type === 'apple') return (
          <AppleTree key={t.key} position={[t.x, t.y, t.z]} scale={t.scale} />
        );
        return (
          <BroadTree key={t.key} position={[t.x, t.y, t.z]} scale={t.scale} />
        );
      })}
      <OrchardApples trees={orchardTrees} />
    </group>
  );
}
