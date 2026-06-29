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
   Small Prey — mice/bugs that scurry on ground
   ======================================== */

const PREY_COUNT = 12;
const SPREAD = 45;

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function PreyInstance({ startX, startZ, speed, seed }) {
  const meshRef = useRef();
  const rng = useMemo(() => seededRandom(seed), [seed]);
  const targetX = useRef(startX);
  const targetZ = useRef(startZ);
  const posX = useRef(startX);
  const posZ = useRef(startZ);
  const pauseTimer = useRef(0);
  const isPaused = useRef(false);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    if (isPaused.current) {
      pauseTimer.current -= delta;
      if (pauseTimer.current <= 0) {
        isPaused.current = false;
        // Pick new target
        targetX.current = posX.current + (rng() - 0.5) * 8;
        targetZ.current = posZ.current + (rng() - 0.5) * 8;
        targetX.current = Math.max(-SPREAD, Math.min(SPREAD, targetX.current));
        targetZ.current = Math.max(-SPREAD, Math.min(SPREAD, targetZ.current));
      }
      return;
    }

    const dx = targetX.current - posX.current;
    const dz = targetZ.current - posZ.current;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.3) {
      isPaused.current = true;
      pauseTimer.current = 1 + rng() * 3;
      return;
    }

    const step = Math.min(speed * delta, dist);
    posX.current += (dx / dist) * step;
    posZ.current += (dz / dist) * step;

    const y = getTerrainHeight(posX.current, posZ.current) + 0.05;
    meshRef.current.position.set(posX.current, y, posZ.current);

    // Face direction
    meshRef.current.rotation.y = Math.atan2(dx, dz);

    // Little hop
    meshRef.current.position.y += Math.abs(Math.sin(posX.current * 5)) * 0.03;
  });

  const y = getTerrainHeight(startX, startZ) + 0.05;

  return (
    <group ref={meshRef} position={[startX, y, startZ]}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[0.06, 6, 4]} />
        <meshStandardMaterial color="#6b5040" roughness={0.9} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.02, 0.06]}>
        <sphereGeometry args={[0.035, 6, 4]} />
        <meshStandardMaterial color="#7a5f4e" roughness={0.9} />
      </mesh>
      {/* Tail */}
      <mesh position={[0, 0.02, -0.1]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.003, 0.08, 4]} />
        <meshStandardMaterial color="#8a7060" roughness={0.9} />
      </mesh>
    </group>
  );
}

export default function SmallPrey() {
  const preyData = useMemo(() => {
    const rng = seededRandom(42);
    const data = [];
    for (let i = 0; i < PREY_COUNT; i++) {
      data.push({
        key: `prey-${i}`,
        startX: (rng() - 0.5) * SPREAD * 2,
        startZ: (rng() - 0.5) * SPREAD * 2,
        speed: 1.5 + rng() * 2.0,
        seed: 100 + i * 37,
      });
    }
    return data;
  }, []);

  return (
    <group>
      {preyData.map((p) => (
        <PreyInstance
          key={p.key}
          startX={p.startX}
          startZ={p.startZ}
          speed={p.speed}
          seed={p.seed}
        />
      ))}
    </group>
  );
}
