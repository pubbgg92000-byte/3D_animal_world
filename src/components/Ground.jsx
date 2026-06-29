import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ========================================
   Constants
   ======================================== */

/** Ground dimensions */
const GROUND_SIZE = 80;
const GROUND_SEGMENTS = 64;

/** Terrain noise parameters */
const HILL_AMPLITUDE = 1.2;
const HILL_FREQUENCY = 0.04;

/** Grass blade counts & dimensions */
const GRASS_COUNT = 12000;
const GRASS_HEIGHT_MIN = 0.15;
const GRASS_HEIGHT_MAX = 0.45;

/** Flower / rock scatter counts */
const FLOWER_COUNT = 200;
const ROCK_COUNT = 60;

/* ========================================
   Helpers
   ======================================== */

/** Simple 2D value noise for terrain height */
function terrainHeight(x, z) {
  const h1 = Math.sin(x * HILL_FREQUENCY) * Math.cos(z * HILL_FREQUENCY * 1.3);
  const h2 = Math.sin(x * HILL_FREQUENCY * 2.1 + 1.7) * Math.cos(z * HILL_FREQUENCY * 1.7 + 0.5);
  return (h1 * 0.6 + h2 * 0.4) * HILL_AMPLITUDE;
}

/** Seeded-ish pseudo-random using sin */
function seededRandom(seed) {
  return (Math.sin(seed * 12.9898 + 78.233) * 43758.5453) % 1;
}

/* ========================================
   Ground Component
   ======================================== */

/**
 * Ground — renders a rolling grassy terrain with scattered flowers and rocks.
 * Handles click / double-click to set moose destination.
 *
 * @param {Object}   props
 * @param {Function} props.onClick      — (point: Vector3) single click
 * @param {Function} props.onDoubleClick — (point: Vector3) double click
 */
export default function Ground({ onClick, onDoubleClick }) {
  const meshRef = useRef();
  const grassRef = useRef();

  // ---------- Terrain geometry — depressed in pond area ----------

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      GROUND_SIZE,
      GROUND_SIZE,
      GROUND_SEGMENTS,
      GROUND_SEGMENTS
    );
    geo.rotateX(-Math.PI / 2);

    // Only the main pond depression — extra pools removed
    const DEPRESSIONS = [
      { x: 0,  z: 5,  r: 5.5, depth: 1.6 }, // main pond
    ];

    // Stream channel — shallow trough from pond south edge to world boundary
    // We'll handle it as a series of overlapping circular depressions
    const streamStartZ = 10.5;
    const streamEndZ   = 38.5;
    const streamSegs   = 22;
    for (let i = 0; i <= streamSegs; i++) {
      const t  = i / streamSegs;
      const sz = streamStartZ + t * (streamEndZ - streamStartZ);
      const sx = Math.sin(t * Math.PI * 2.5) * 0.3; // gentle meander
      const r  = 1.6 - t * 0.5;  // taper width
      DEPRESSIONS.push({ x: sx, z: sz, r, depth: 0.18 });
    }

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      let y = terrainHeight(x, z);

      for (const dep of DEPRESSIONS) {
        const dx = x - dep.x;
        const dz = z - dep.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < dep.r) {
          const t = dist / dep.r;
          const blend = t * t * (3 - 2 * t); // smoothstep
          y = y * blend + (-dep.depth) * (1 - blend);
        }
      }

      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  const { grassPositions, grassScales, grassRotations, grassCount } = useMemo(() => {
    const positions = [];
    const scales = [];
    const rotations = [];
    const halfSize = GROUND_SIZE / 2 - 2;

    for (let i = 0; i < GRASS_COUNT; i++) {
      const x = (seededRandom(i * 3 + 0.1) * 2 - 1) * halfSize;
      const z = (seededRandom(i * 3 + 0.2) * 2 - 1) * halfSize;

      // Skip grass inside pond or stream areas
      const GRASS_EXCLUSIONS = [
        { x: 0,  z: 5,  r: 6.5 }, // main pond
      ];
      // Also exclude along the stream corridor
      const streamT = Math.max(0, Math.min(1, (z - 10.5) / 28));
      const streamX = Math.sin(streamT * Math.PI * 2.5) * 0.3;
      const streamDist = Math.sqrt((x - streamX) ** 2);
      const streamW = 2.0 - streamT * 0.5;
      if (z >= 10.5 && z <= 38.5 && streamDist < streamW) {
        continue;
      }
      let inWater = false;
      for (const ex of GRASS_EXCLUSIONS) {
        const dx = x - ex.x, dz = z - ex.z;
        if (dx * dx + dz * dz < ex.r * ex.r) { inWater = true; break; }
      }
      if (inWater) continue;

      const y = terrainHeight(x, z);
      positions.push(x, y, z);

      const h = GRASS_HEIGHT_MIN + seededRandom(i * 7 + 0.3) * (GRASS_HEIGHT_MAX - GRASS_HEIGHT_MIN);
      scales.push(0.02, h, 0.02);

      rotations.push(0, seededRandom(i * 11 + 0.4) * Math.PI * 2, 0);
    }
    return {
      grassPositions: new Float32Array(positions),
      grassScales: new Float32Array(scales),
      grassRotations: new Float32Array(rotations),
      grassCount: positions.length / 3,
    };
  }, []);

  // Grass sway
  useFrame(({ clock }) => {
    if (!grassRef.current) return;
    const time = clock.getElapsedTime();
    const dummy = new THREE.Object3D();

    for (let i = 0; i < grassCount; i++) {
      const x = grassPositions[i * 3];
      const y = grassPositions[i * 3 + 1];
      const z = grassPositions[i * 3 + 2];

      dummy.position.set(x, y, z);
      dummy.scale.set(grassScales[i * 3], grassScales[i * 3 + 1], grassScales[i * 3 + 2]);

      const sway = Math.sin(time * 1.5 + x * 0.5 + z * 0.3) * 0.15;
      dummy.rotation.set(sway, grassRotations[i * 3 + 1], sway * 0.5);

      dummy.updateMatrix();
      grassRef.current.setMatrixAt(i, dummy.matrix);
    }
    grassRef.current.instanceMatrix.needsUpdate = true;
  });

  // ---------- Flowers ----------

  const flowerData = useMemo(() => {
    const data = [];
    const halfSize = GROUND_SIZE / 2 - 3;
    const colors = [0xff6b9d, 0xffd93d, 0xff8c42, 0xc44dff, 0x6bcbff, 0xffffff];

    for (let i = 0; i < FLOWER_COUNT; i++) {
      const x = (seededRandom(i * 5 + 100) * 2 - 1) * halfSize;
      const z = (seededRandom(i * 5 + 101) * 2 - 1) * halfSize;
      const y = terrainHeight(x, z);
      const color = colors[Math.floor(seededRandom(i * 13 + 200) * colors.length)];
      const scale = 0.04 + seededRandom(i * 17 + 300) * 0.06;
      data.push({ x, y, z, color, scale });
    }
    return data;
  }, []);

  // ---------- Rocks ----------

  const rockData = useMemo(() => {
    const data = [];
    const halfSize = GROUND_SIZE / 2 - 5;

    for (let i = 0; i < ROCK_COUNT; i++) {
      const x = (seededRandom(i * 7 + 500) * 2 - 1) * halfSize;
      const z = (seededRandom(i * 7 + 501) * 2 - 1) * halfSize;
      const y = terrainHeight(x, z);
      const scale = 0.1 + seededRandom(i * 19 + 600) * 0.25;
      const rotY = seededRandom(i * 23 + 700) * Math.PI * 2;
      data.push({ x, y, z, scale, rotY });
    }
    return data;
  }, []);

  // ---------- Event handlers ----------

  const handleClick = (e) => {
    e.stopPropagation();
    onClick?.(e.point.clone());
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    onDoubleClick?.(e.point.clone());
  };

  // ---------- Render ----------

  return (
    <group>
      {/* Main terrain */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        receiveShadow
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <meshStandardMaterial
          color="#3a7d3a"
          roughness={0.9}
          metalness={0.0}
          flatShading={false}
        />
      </mesh>

      {/* Grass blades (instanced boxes) */}
      <instancedMesh
        ref={grassRef}
        args={[undefined, undefined, grassCount]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#4a9a4a"
          roughness={0.85}
          metalness={0}
        />
      </instancedMesh>

      {/* Flowers */}
      {flowerData.map((f, i) => (
        <mesh key={`flower-${i}`} position={[f.x, f.y + f.scale, f.z]}>
          <sphereGeometry args={[f.scale, 6, 6]} />
          <meshStandardMaterial color={f.color} roughness={0.6} />
        </mesh>
      ))}

      {/* Rocks */}
      {rockData.map((r, i) => (
        <mesh
          key={`rock-${i}`}
          position={[r.x, r.y + r.scale * 0.3, r.z]}
          rotation={[0, r.rotY, 0]}
          scale={[r.scale, r.scale * 0.6, r.scale * 0.8]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#7a7a72"
            roughness={0.95}
            metalness={0.05}
          />
        </mesh>
      ))}
    </group>
  );
}
