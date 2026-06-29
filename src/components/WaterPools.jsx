import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
   Water Pool positions — exported for moose AI
   ======================================== */
export const WATER_POSITIONS = [];

/* ========================================
   Fixed pool placement — close to action
   ======================================== */
const POOL_SPECS = [
  { x: 12, z: 8, radius: 3.0 },
  { x: -15, z: 12, radius: 2.5 },
  { x: 20, z: -10, radius: 3.5 },
  { x: -8, z: -18, radius: 2.8 },
  { x: 25, z: 22, radius: 2.2 },
  { x: -22, z: -8, radius: 3.0 },
];

/* ========================================
   Single Water Pool
   ======================================== */
function WaterPool({ position, radius = 2.5 }) {
  const waterRef = useRef();

  useFrame((state) => {
    if (!waterRef.current) return;
    const t = state.clock.elapsedTime;
    // Ripple via slight position wobble
    waterRef.current.position.y = 0.02 + Math.sin(t * 2.0) * 0.01;
  });

  const y = position[1] - 0.15; // Sit into the terrain slightly

  return (
    <group position={[position[0], y, position[2]]}>
      {/* Pool basin — darker ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[radius * 1.2, 32]} />
        <meshStandardMaterial color="#0e1f0a" roughness={0.95} />
      </mesh>

      {/* Muddy edge ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <ringGeometry args={[radius * 0.95, radius * 1.2, 32]} />
        <meshStandardMaterial color="#2a1f0e" roughness={0.9} />
      </mesh>

      {/* Water surface — reflective blue-green */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[radius, 32]} />
        <meshStandardMaterial
          color="#1a6080"
          roughness={0.05}
          metalness={0.7}
          transparent
          opacity={0.8}
          envMapIntensity={2.0}
        />
      </mesh>

      {/* Bright highlight spot — fake reflection */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[radius * 0.2, 0.04, -radius * 0.15]}
        scale={[1, 0.5, 1]}
      >
        <circleGeometry args={[radius * 0.25, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          roughness={0.0}
        />
      </mesh>

      {/* Reeds / cattails around pool */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2 + i * 0.3;
        const px = Math.cos(angle) * (radius + 0.4);
        const pz = Math.sin(angle) * (radius + 0.4);
        const reedH = 0.5 + (i % 3) * 0.3;
        return (
          <group key={i}>
            {/* Reed stem */}
            <mesh position={[px, reedH * 0.5, pz]} castShadow>
              <cylinderGeometry args={[0.015, 0.03, reedH, 4]} />
              <meshStandardMaterial color="#2a5520" roughness={0.8} />
            </mesh>
            {/* Reed top tuft */}
            <mesh position={[px, reedH + 0.1, pz]}>
              <sphereGeometry args={[0.04, 4, 4]} />
              <meshStandardMaterial color="#5a3e20" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ========================================
   Water Pools Component
   ======================================== */
export default function WaterPools() {
  const pools = useMemo(() => {
    WATER_POSITIONS.length = 0;

    return POOL_SPECS.map((spec, i) => {
      const y = getTerrainHeight(spec.x, spec.z);
      WATER_POSITIONS.push(new THREE.Vector3(spec.x, y, spec.z));
      return {
        x: spec.x,
        y,
        z: spec.z,
        radius: spec.radius,
        key: `pool-${i}`,
      };
    });
  }, []);

  return (
    <group>
      {pools.map((p) => (
        <WaterPool
          key={p.key}
          position={[p.x, p.y, p.z]}
          radius={p.radius}
        />
      ))}
    </group>
  );
}
