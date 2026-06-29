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

  // ---------- Terrain geometry ----------

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      GROUND_SIZE,
      GROUND_SIZE,
      GROUND_SEGMENTS,
      GROUND_SEGMENTS
    );
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  // ---------- Grass instanced mesh ----------

  const { grassPositions, grassScales, grassRotations } = useMemo(() => {
    const positions = [];
    const scales = [];
    const rotations = [];
    const halfSize = GROUND_SIZE / 2 - 2;

    for (let i = 0; i < GRASS_COUNT; i++) {
      const x = (seededRandom(i * 3 + 0.1) * 2 - 1) * halfSize;
      const z = (seededRandom(i * 3 + 0.2) * 2 - 1) * halfSize;
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
    };
  }, []);

  // Grass sway
  useFrame(({ clock }) => {
    if (!grassRef.current) return;
    const time = clock.getElapsedTime();
    const dummy = new THREE.Object3D();

    for (let i = 0; i < GRASS_COUNT; i++) {
      const x = grassPositions[i * 3];
      const y = grassPositions[i * 3 + 1];
      const z = grassPositions[i * 3 + 2];

      dummy.position.set(x, y, z);
      dummy.scale.set(grassScales[i * 3], grassScales[i * 3 + 1], grassScales[i * 3 + 2]);

      // Gentle wind sway
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
        args={[undefined, undefined, GRASS_COUNT]}
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
