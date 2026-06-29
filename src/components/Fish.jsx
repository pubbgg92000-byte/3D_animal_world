import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { POND_POSITION, POND_RADIUS } from './Pond';

/* ================================================================
   Fish — randomly roaming inside the central pond only
   (small pools removed)
   ================================================================ */

const POND_FISH_COUNT = 10;

// Seeded RNG so fish start positions are stable
function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

const FISH_COLORS = ['#c0392b', '#e67e22', '#95a5a6', '#2c3e50', '#f39c12', '#1abc9c', '#8e44ad'];

function FishInstance({ centerX, centerZ, centerY, pondRadius, index, seed }) {
  const meshRef   = useRef();
  const posRef    = useRef(new THREE.Vector3());
  const velRef    = useRef(new THREE.Vector3());
  const targetRef = useRef(new THREE.Vector3());
  const timerRef  = useRef(0);
  const tailPhase = useRef(0);

  // Per-fish constants
  const swimDepth = useMemo(() => -0.10 - (seed % 5) * 0.05, [seed]);
  const speed     = useMemo(() => 0.8 + (seed % 7) * 0.18,   [seed]);
  const color     = useMemo(() => FISH_COLORS[index % FISH_COLORS.length], [index]);

  // Pick initial random position inside pond
  useMemo(() => {
    const rng = seededRng(seed + 1000);
    const angle = rng() * Math.PI * 2;
    const r     = rng() * pondRadius * 0.7;
    posRef.current.set(centerX + Math.cos(angle) * r, centerY + swimDepth, centerZ + Math.sin(angle) * r);
    velRef.current.set(rng() - 0.5, 0, rng() - 0.5).normalize().multiplyScalar(speed);

    // initial wander target
    const ta = rng() * Math.PI * 2, tr = rng() * pondRadius * 0.75;
    targetRef.current.set(centerX + Math.cos(ta) * tr, centerY + swimDepth, centerZ + Math.sin(ta) * tr);
    timerRef.current = rng() * 3; // stagger targets
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    timerRef.current -= delta;

    // Pick a new random target when close or timer expires
    const distToTarget = posRef.current.distanceTo(targetRef.current);
    if (distToTarget < 0.5 || timerRef.current <= 0) {
      timerRef.current = 2.5 + Math.random() * 4.0;
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.random() * pondRadius * 0.78;
      targetRef.current.set(
        centerX + Math.cos(angle) * r,
        centerY + swimDepth,
        centerZ + Math.sin(angle) * r
      );
    }

    // Steer toward target
    const desired = new THREE.Vector3().subVectors(targetRef.current, posRef.current).normalize().multiplyScalar(speed);
    velRef.current.lerp(desired, Math.min(1, 3.0 * delta));
    velRef.current.y = 0; // keep fish horizontal
    velRef.current.normalize().multiplyScalar(speed);

    // Move
    posRef.current.addScaledVector(velRef.current, delta);

    // Clamp inside pond circle
    const dx = posRef.current.x - centerX;
    const dz = posRef.current.z - centerZ;
    const dist2d = Math.sqrt(dx * dx + dz * dz);
    if (dist2d > pondRadius * 0.82) {
      posRef.current.x = centerX + (dx / dist2d) * pondRadius * 0.82;
      posRef.current.z = centerZ + (dz / dist2d) * pondRadius * 0.82;
    }

    // Gentle vertical bob
    posRef.current.y = centerY + swimDepth + Math.sin(timerRef.current * 1.5 + index) * 0.03;

    // Apply to mesh
    meshRef.current.position.copy(posRef.current);

    // Face movement direction
    if (velRef.current.lengthSq() > 0.0001) {
      meshRef.current.rotation.y = Math.atan2(-velRef.current.z, velRef.current.x) + Math.PI * 0.5;
    }

    // Tail wag — speed up when moving fast
    tailPhase.current += delta * 8.0;
    if (meshRef.current.children[1]) {
      meshRef.current.children[1].rotation.z = Math.sin(tailPhase.current) * 0.35;
    }
  });

  return (
    <group ref={meshRef}>
      {/* Body */}
      <mesh>
        <capsuleGeometry args={[0.055, 0.18, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Tail */}
      <mesh position={[-0.16, 0, 0]}>
        <coneGeometry args={[0.06, 0.14, 3]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}

export default function Fish() {
  const fish = useMemo(() =>
    Array.from({ length: POND_FISH_COUNT }, (_, i) => ({
      key: `pond-fish-${i}`,
      index: i,
      seed: i * 137 + 29,
    })), []);

  return (
    <group>
      {fish.map((f) => (
        <FishInstance
          key={f.key}
          centerX={POND_POSITION.x}
          centerZ={POND_POSITION.z}
          centerY={POND_POSITION.y}
          pondRadius={POND_RADIUS}
          index={f.index}
          seed={f.seed}
        />
      ))}
    </group>
  );
}
