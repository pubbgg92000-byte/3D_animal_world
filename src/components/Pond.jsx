import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ========================================
   Central pond position — exported for AI
   ======================================== */
export const POND_POSITION = new THREE.Vector3(0, -0.15, 5);
export const POND_RADIUS = 5.5;

/* ========================================
   Seeded RNG
   ======================================== */
function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* ========================================
   Pebbly bed — visible through clear water
   ======================================== */
function RockyBed({ radius }) {
  const rng = useMemo(() => seededRng(7), []);
  const pebbles = useMemo(() => {
    const out = [];
    // Dense pebble field on the pond floor
    for (let i = 0; i < 120; i++) {
      const r = rng() * radius * 0.92;
      const a = rng() * Math.PI * 2;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;
      const sz = 0.08 + rng() * 0.22;
      const colorT = rng();
      out.push({ key: i, px, pz, sx: sz * (0.8 + rng() * 0.5), sy: sz * 0.35, sz: sz * (0.8 + rng() * 0.5), rotY: rng() * Math.PI, colorT });
    }
    return out;
  }, [radius, rng]);

  // Color palette: mix of grey, tan, rust, dark
  const bedMats = useMemo(() => [
    new THREE.MeshStandardMaterial({ color: '#8a7e72', roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: '#6b6058', roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: '#a08870', roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ color: '#7a6050', roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: '#5a5248', roughness: 0.97 }),
  ], []);

  return (
    <group>
      {/* Sand/gravel base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]} receiveShadow>
        <circleGeometry args={[radius * 0.98, 48]} />
        <meshStandardMaterial color="#9a8c78" roughness={0.97} />
      </mesh>
      {/* Individual pebbles on the bed */}
      {pebbles.map((p) => (
        <mesh
          key={p.key}
          position={[p.px, -0.22, p.pz]}
          rotation={[0.1, p.rotY, 0.05]}
          scale={[p.sx, p.sy, p.sz]}
          receiveShadow
        >
          <dodecahedronGeometry args={[0.5, 0]} />
          <primitive object={bedMats[Math.floor(p.colorT * bedMats.length)]} />
        </mesh>
      ))}
    </group>
  );
}

/* ========================================
   Underwater rocks — medium stones on bed
   ======================================== */
function UnderwaterRocks({ radius }) {
  const rng = useMemo(() => seededRng(99), []);
  const stones = useMemo(() => {
    const out = [];
    for (let i = 0; i < 18; i++) {
      const r = rng() * radius * 0.78;
      const a = rng() * Math.PI * 2;
      out.push({
        key: i,
        px: Math.cos(a) * r,
        pz: Math.sin(a) * r,
        sx: 0.2 + rng() * 0.45,
        sy: 0.12 + rng() * 0.22,
        sz: 0.2 + rng() * 0.4,
        rotY: rng() * Math.PI,
      });
    }
    return out;
  }, [radius, rng]);

  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#706860', roughness: 0.9, metalness: 0.05 }),
    []
  );

  return (
    <group>
      {stones.map((s) => (
        <mesh
          key={s.key}
          position={[s.px, -0.18, s.pz]}
          rotation={[0.1, s.rotY, 0.06]}
          scale={[s.sx, s.sy, s.sz]}
          receiveShadow
        >
          <dodecahedronGeometry args={[0.9, 0]} />
          <primitive object={mat} />
        </mesh>
      ))}
    </group>
  );
}

/* ========================================
   Crystal-clear water surface
   ======================================== */
function ClearWater({ radius }) {
  const waterRef = useRef();
  const matRef = useRef();

  useFrame((state) => {
    if (!waterRef.current || !matRef.current) return;
    const t = state.clock.elapsedTime;
    // Gentle vertical breathing
    waterRef.current.position.y = 0.01 + Math.sin(t * 0.9) * 0.006;
    // Shimmer
    matRef.current.emissiveIntensity = 0.04 + Math.sin(t * 1.8) * 0.015;
  });

  return (
    <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <circleGeometry args={[radius, 64]} />
      <meshPhysicalMaterial
        ref={matRef}
        color="#a8d8ea"
        emissive="#2a6080"
        emissiveIntensity={0.04}
        roughness={0.02}
        metalness={0.1}
        transmission={0.85}
        thickness={0.4}
        transparent
        opacity={0.45}
        envMapIntensity={1.8}
        ior={1.33}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

/* ========================================
   Ripple rings — subtle expanding rings
   ======================================== */
function RippleRing({ radius, delay, speed, offsetX = 0, offsetZ = 0 }) {
  const meshRef = useRef();
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = ((state.clock.elapsedTime * speed + delay) % 1.0);
    const scale = 0.1 + t * 0.9;
    meshRef.current.scale.setScalar(scale);
    meshRef.current.material.opacity = (1 - t) * 0.2;
  });
  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[offsetX, 0.03, offsetZ]}
    >
      <ringGeometry args={[radius * 0.9, radius * 0.94, 36]} />
      <meshBasicMaterial color="#c8e8f8" transparent opacity={0.18} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ========================================
   Lily pads
   ======================================== */
function LilyPads({ radius }) {
  const rng = useMemo(() => seededRng(23), []);
  const pads = useMemo(() => {
    const out = [];
    for (let i = 0; i < 11; i++) {
      const r = radius * (0.15 + rng() * 0.72);
      const a = rng() * Math.PI * 2;
      out.push({
        key: i,
        px: Math.cos(a) * r,
        pz: Math.sin(a) * r,
        scale: 0.22 + rng() * 0.28,
        rot: rng() * Math.PI * 2,
        notch: rng() * 0.5,
        hasFlower: rng() > 0.7,
      });
    }
    return out;
  }, [radius, rng]);

  const padMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2a6b2a', roughness: 0.65, metalness: 0.06, side: THREE.DoubleSide }),
    []
  );
  const flowerMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f5e4f0', roughness: 0.6 }),
    []
  );
  const flowerCenterMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f4c542', roughness: 0.5 }),
    []
  );

  return (
    <group>
      {pads.map((p) => (
        <group key={p.key} position={[p.px, 0.04, p.pz]}>
          <mesh rotation={[-Math.PI / 2, 0, p.rot]} scale={p.scale}>
            <circleGeometry args={[1, 20, p.notch, Math.PI * 2 - p.notch * 1.2]} />
            <primitive object={padMat} />
          </mesh>
          {p.hasFlower && (
            <group position={[0, 0.04, 0]} scale={p.scale * 0.35}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.8, 8]} />
                <primitive object={flowerMat} />
              </mesh>
              <mesh position={[0, 0.05, 0]}>
                <sphereGeometry args={[0.22, 6, 6]} />
                <primitive object={flowerCenterMat} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

/* ========================================
   Large rocks around the pond perimeter
   ======================================== */
const PERIMETER_ROCKS = [
  // [angle, r_factor, sx, sy, sz, tiltX, rotY]
  [0.00, 1.02, 1.10, 0.75, 0.90, 0.10, 0.4],
  [0.45, 0.98, 0.80, 0.60, 0.70, 0.07, 1.2],
  [0.85, 1.04, 1.30, 0.90, 1.10, 0.12, 0.8],
  [1.25, 0.97, 0.70, 0.55, 0.65, 0.05, 2.1],
  [1.65, 1.05, 1.00, 0.80, 0.95, 0.09, 1.5],
  [2.05, 0.99, 0.85, 0.65, 0.80, 0.08, 0.3],
  [2.45, 1.06, 1.40, 1.00, 1.20, 0.14, 1.9],
  [2.85, 0.96, 0.75, 0.58, 0.70, 0.06, 0.6],
  [3.25, 1.03, 0.95, 0.72, 0.88, 0.10, 2.4],
  [3.65, 1.00, 1.20, 0.85, 1.05, 0.12, 0.9],
  [4.05, 0.98, 0.65, 0.50, 0.60, 0.05, 1.7],
  [4.45, 1.05, 1.05, 0.78, 0.92, 0.09, 0.2],
  [4.85, 0.97, 0.88, 0.67, 0.82, 0.07, 2.8],
  [5.25, 1.04, 0.72, 0.56, 0.68, 0.06, 1.1],
  [5.65, 1.01, 1.15, 0.82, 1.00, 0.11, 0.7],
  // Extra back-row rocks for depth
  [0.22, 1.22, 0.90, 0.68, 0.85, 0.08, 1.8],
  [1.08, 1.20, 1.10, 0.82, 1.00, 0.13, 0.5],
  [2.30, 1.18, 0.80, 0.60, 0.75, 0.07, 2.2],
  [3.50, 1.21, 0.95, 0.72, 0.88, 0.10, 1.3],
  [4.70, 1.19, 0.70, 0.54, 0.65, 0.06, 0.9],
];

function PerimeterRocks({ radius }) {
  const rng = useMemo(() => seededRng(55), []);

  const mats = useMemo(() => [
    new THREE.MeshStandardMaterial({ color: '#8c8278', roughness: 0.93, metalness: 0.03 }),
    new THREE.MeshStandardMaterial({ color: '#6e6460', roughness: 0.95, metalness: 0.02 }),
    new THREE.MeshStandardMaterial({ color: '#a09082', roughness: 0.90, metalness: 0.04 }),
    new THREE.MeshStandardMaterial({ color: '#b0a090', roughness: 0.92, metalness: 0.03 }),
  ], []);

  return (
    <group>
      {PERIMETER_ROCKS.map(([angle, rFactor, sx, sy, sz, tiltX, rotY], i) => {
        const r = radius * rFactor;
        const px = Math.cos(angle) * r;
        const pz = Math.sin(angle) * r;
        const mat = mats[i % mats.length];
        return (
          <mesh
            key={i}
            position={[px, sy * 0.45 - 0.12, pz]}
            rotation={[tiltX * (rng() > 0.5 ? 1 : -1), rotY, tiltX * 0.6]}
            scale={[sx, sy, sz]}
            castShadow
            receiveShadow
          >
            <dodecahedronGeometry args={[0.85, 0]} />
            <primitive object={mat} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ========================================
   Reeds and waterside grass clusters
   ======================================== */
function Reeds({ radius }) {
  const rng = useMemo(() => seededRng(31), []);
  const clusters = useMemo(() => {
    const out = [];
    for (let c = 0; c < 10; c++) {
      const baseAngle = (c / 10) * Math.PI * 2 + c * 0.55;
      const clusterR = radius * 1.08 + rng() * 0.4;
      const count = 3 + Math.floor(rng() * 4);
      for (let j = 0; j < count; j++) {
        const angle = baseAngle + (j - count / 2) * 0.2 + rng() * 0.1;
        const r = clusterR + (rng() - 0.5) * 0.5;
        out.push({
          key: `r${c}-${j}`,
          px: Math.cos(angle) * r,
          pz: Math.sin(angle) * r,
          h: 0.6 + rng() * 0.6,
          tilt: (rng() - 0.5) * 0.18,
          type: rng() > 0.4 ? 'cattail' : 'grass',
        });
      }
    }
    return out;
  }, [radius, rng]);

  const stemMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3e6e28', roughness: 0.85 }), []);
  const cattailMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a3318', roughness: 0.95 }), []);
  const grassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a7a30', roughness: 0.85, side: THREE.DoubleSide }), []);

  return (
    <group>
      {clusters.map((r) => (
        <group key={r.key} position={[r.px, 0, r.pz]} rotation={[r.tilt, 0, r.tilt * 0.5]}>
          {r.type === 'cattail' ? (
            <>
              <mesh position={[0, r.h * 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.02, 0.03, r.h, 4]} />
                <primitive object={stemMat} />
              </mesh>
              <mesh position={[0, r.h + 0.09, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.22, 6]} />
                <primitive object={cattailMat} />
              </mesh>
            </>
          ) : (
            // Flat grass blade
            <mesh position={[0, r.h * 0.5, 0]} rotation={[0, r.tilt * 5, r.tilt * 0.5]}>
              <planeGeometry args={[0.06, r.h]} />
              <primitive object={grassMat} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/* ========================================
   Sandy shore rings
   ======================================== */
function Shore({ radius }) {
  return (
    <>
      {/* Outer gravel/grass transition */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <ringGeometry args={[radius * 0.94, radius * 1.55, 48]} />
        <meshStandardMaterial color="#9a8e78" roughness={0.95} />
      </mesh>
      {/* Inner sandy band */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <ringGeometry args={[radius * 0.88, radius * 1.05, 48]} />
        <meshStandardMaterial color="#c2b490" roughness={0.92} />
      </mesh>
      {/* Fine wet sand at water edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <ringGeometry args={[radius * 0.94, radius * 1.00, 48]} />
        <meshStandardMaterial color="#a89870" roughness={0.9} />
      </mesh>
    </>
  );
}

/* ========================================
   Underwater caustic shimmer (cheap fake)
   ======================================== */
function CausticFlicker() {
  const refs = useRef([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.material.opacity = 0.04 + Math.sin(t * 1.5 + i * 1.3) * 0.025;
    });
  });
  const spots = useMemo(() => {
    const rng = seededRng(77);
    return Array.from({ length: 20 }, (_, i) => ({
      key: i,
      px: (rng() - 0.5) * 8,
      pz: (rng() - 0.5) * 8,
      scale: 0.3 + rng() * 0.7,
    }));
  }, []);

  return (
    <group>
      {spots.map((s, i) => (
        <mesh
          key={s.key}
          ref={(el) => (refs.current[i] = el)}
          position={[s.px, -0.18, s.pz]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={s.scale}
        >
          <circleGeometry args={[0.35, 8]} />
          <meshBasicMaterial color="#b0e0ff" transparent opacity={0.05} />
        </mesh>
      ))}
    </group>
  );
}

/* ========================================
   Main Pond Component
   ======================================== */
export default function Pond() {
  const r = POND_RADIUS;
  const { x, y, z } = POND_POSITION;

  return (
    <group position={[x, y, z]}>
      {/* Ground layers (bottom to top) */}
      <Shore radius={r} />
      <RockyBed radius={r} />
      <UnderwaterRocks radius={r} />
      <CausticFlicker />

      {/* Water */}
      <ClearWater radius={r} />

      {/* On top of water */}
      <LilyPads radius={r} />

      {/* Ripples at a few spots */}
      <RippleRing radius={r * 0.85} delay={0.00} speed={0.22} />
      <RippleRing radius={r * 0.85} delay={0.40} speed={0.22} />
      <RippleRing radius={r * 0.85} delay={0.70} speed={0.22} />
      <RippleRing radius={r * 0.30} delay={0.10} speed={0.35} offsetX={1.5} offsetZ={-1.0} />
      <RippleRing radius={r * 0.25} delay={0.55} speed={0.35} offsetX={-1.2} offsetZ={1.8} />

      {/* Perimeter rocks + reeds */}
      <PerimeterRocks radius={r} />
      <Reeds radius={r} />
    </group>
  );
}
