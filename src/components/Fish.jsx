import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { POND_POSITION, POND_RADIUS } from './Pond';
import { WATER_POSITIONS } from './WaterPools';

/* ========================================
   Fish — swim inside the central pond
   ======================================== */

// Fish in the big central pond
const POND_FISH = 8;
// Fish in smaller pools
const POOL_FISH = 2;

function FishInstance({ centerX, centerZ, centerY, swimRadius, index }) {
  const meshRef = useRef();
  const offset = useMemo(() => (index / 8) * Math.PI * 2, [index]);
  const speed = useMemo(() => 0.35 + (index % 3) * 0.18, [index]);
  const r = useMemo(() => swimRadius * (0.3 + (index % 5) * 0.12), [swimRadius, index]);
  const depth = useMemo(() => -0.12 - (index % 4) * 0.04, [index]);

  // Fish color variants — red, orange, silver, dark
  const color = useMemo(() => {
    const colors = ['#c0392b', '#e67e22', '#95a5a6', '#2c3e50', '#f39c12'];
    return colors[index % colors.length];
  }, [index]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * speed + offset;
    const x = centerX + Math.cos(t) * r;
    const z = centerZ + Math.sin(t) * r;
    meshRef.current.position.set(x, centerY + depth, z);
    // Face direction of movement
    meshRef.current.rotation.y = Math.atan2(-Math.sin(t), Math.cos(t)) + Math.PI * 0.5;
    // Tail wag
    meshRef.current.children[1].rotation.z = Math.sin(t * 10) * 0.3;
  });

  return (
    <group ref={meshRef}>
      {/* Body */}
      <mesh>
        <capsuleGeometry args={[0.055, 0.18, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Tail */}
      <mesh position={[-0.16, 0, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.06, 0.14, 3]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}

export default function Fish() {
  const pondFish = useMemo(() =>
    Array.from({ length: POND_FISH }, (_, i) => ({
      key: `pond-fish-${i}`,
      cx: POND_POSITION.x,
      cz: POND_POSITION.z,
      cy: POND_POSITION.y,
      r: POND_RADIUS * 0.65,
      index: i,
    })), []);

  const poolFish = useMemo(() => {
    const out = [];
    WATER_POSITIONS.forEach((pos, pi) => {
      for (let fi = 0; fi < POOL_FISH; fi++) {
        out.push({
          key: `pool-${pi}-fish-${fi}`,
          cx: pos.x,
          cz: pos.z,
          cy: pos.y,
          r: 1.5,
          index: fi,
        });
      }
    });
    return out;
  }, []);

  return (
    <group>
      {pondFish.map((f) => (
        <FishInstance
          key={f.key}
          centerX={f.cx}
          centerZ={f.cz}
          centerY={f.cy}
          swimRadius={f.r}
          index={f.index}
        />
      ))}
      {poolFish.map((f) => (
        <FishInstance
          key={f.key}
          centerX={f.cx}
          centerZ={f.cz}
          centerY={f.cy}
          swimRadius={f.r}
          index={f.index}
        />
      ))}
    </group>
  );
}
