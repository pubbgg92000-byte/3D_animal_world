import { useMemo } from 'react';
import * as THREE from 'three';
import { registerTreeObstacles } from '../utils/collisionRegistry';

/* ========================================
   Terrain height — must match Ground.jsx
   ======================================== */
const HILL_AMPLITUDE = 1.2;
const HILL_FREQUENCY = 0.04;

function getTerrainHeight(x, z) {
  const h1 = Math.sin(x * HILL_FREQUENCY) * Math.cos(z * HILL_FREQUENCY * 1.3);
  const h2 =
    Math.sin(x * HILL_FREQUENCY * 2.1 + 1.7) *
    Math.cos(z * HILL_FREQUENCY * 1.7 + 0.5);
  return (h1 * 0.6 + h2 * 0.4) * HILL_AMPLITUDE;
}

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

/* ========================================
   Trees Component — dense forest
   ======================================== */

/** Exported tree positions for moose AI to use */
export const TREE_POSITIONS = [];

export default function Trees() {
  const treeData = useMemo(() => {
    const trees = [];
    const rng = seededRandom(42);
    const FIELD_SIZE = 70;

    // Clear exported positions
    TREE_POSITIONS.length = 0;

    for (let i = 0; i < 120; i++) {
      const x = (rng() - 0.5) * FIELD_SIZE * 2;
      const z = (rng() - 0.5) * FIELD_SIZE * 2;

      const dist = Math.sqrt(x * x + z * z);
      if (dist < 8) continue;

      const y = getTerrainHeight(x, z);
      const scale = 0.5 + rng() * 0.8;
      const type = rng() > 0.35 ? 'pine' : 'broad';

      trees.push({ x, y, z, scale, type, key: `tree-${i}` });
      TREE_POSITIONS.push(new THREE.Vector3(x, y, z));
    }

    // Register static trunk collision circles
    registerTreeObstacles(trees);

    return trees;
  }, []);

  return (
    <group>
      {treeData.map((t) =>
        t.type === 'pine' ? (
          <PineTree key={t.key} position={[t.x, t.y, t.z]} scale={t.scale} />
        ) : (
          <BroadTree key={t.key} position={[t.x, t.y, t.z]} scale={t.scale} />
        )
      )}
    </group>
  );
}
