import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ========================================
   Constants
   ======================================== */

/** Dust motes */
const DUST_COUNT = 300;
const DUST_AREA = 40;
const DUST_HEIGHT = 8;
const DUST_SIZE = 0.06;

/** Fireflies */
const FIREFLY_COUNT = 50;
const FIREFLY_AREA = 25;
const FIREFLY_HEIGHT = 3;
const FIREFLY_SIZE = 0.08;

/* ========================================
   FloatingParticles Component
   ======================================== */

/**
 * FloatingParticles — renders gentle dust motes and glowing fireflies.
 * Uses Three.js Points for GPU-efficient rendering.
 */
export default function FloatingParticles() {
  const dustRef = useRef();
  const fireflyRef = useRef();

  // ---------- Dust motes ----------

  const dustPositions = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * DUST_AREA;
      positions[i * 3 + 1] = Math.random() * DUST_HEIGHT + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * DUST_AREA;
    }
    return positions;
  }, []);

  const dustSizes = useMemo(() => {
    const sizes = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      sizes[i] = DUST_SIZE * (0.5 + Math.random() * 0.5);
    }
    return sizes;
  }, []);

  // ---------- Fireflies ----------

  const fireflyPositions = useMemo(() => {
    const positions = new Float32Array(FIREFLY_COUNT * 3);
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * FIREFLY_AREA;
      positions[i * 3 + 1] = 0.5 + Math.random() * FIREFLY_HEIGHT;
      positions[i * 3 + 2] = (Math.random() - 0.5) * FIREFLY_AREA;
    }
    return positions;
  }, []);

  // ---------- Animation ----------

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Dust: gentle floating drift
    if (dustRef.current) {
      const pos = dustRef.current.geometry.attributes.position;
      for (let i = 0; i < DUST_COUNT; i++) {
        const ix = i * 3;
        const baseX = dustPositions[ix];
        const baseY = dustPositions[ix + 1];
        const baseZ = dustPositions[ix + 2];

        pos.array[ix] = baseX + Math.sin(t * 0.3 + i * 0.7) * 0.5;
        pos.array[ix + 1] = baseY + Math.sin(t * 0.15 + i * 1.3) * 0.4;
        pos.array[ix + 2] = baseZ + Math.cos(t * 0.25 + i * 0.9) * 0.5;
      }
      pos.needsUpdate = true;
    }

    // Fireflies: bobbing + pulsing
    if (fireflyRef.current) {
      const pos = fireflyRef.current.geometry.attributes.position;
      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const ix = i * 3;
        const baseX = fireflyPositions[ix];
        const baseY = fireflyPositions[ix + 1];
        const baseZ = fireflyPositions[ix + 2];

        pos.array[ix] = baseX + Math.sin(t * 0.5 + i * 2.1) * 1.0;
        pos.array[ix + 1] = baseY + Math.sin(t * 0.8 + i * 3.7) * 0.6;
        pos.array[ix + 2] = baseZ + Math.cos(t * 0.4 + i * 1.9) * 1.0;
      }
      pos.needsUpdate = true;

      // Pulse opacity
      const opacity = 0.4 + Math.sin(t * 2.0) * 0.3;
      fireflyRef.current.material.opacity = opacity;
    }
  });

  // ---------- Render ----------

  return (
    <group>
      {/* Dust motes */}
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={DUST_COUNT}
            array={dustPositions.slice()}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={DUST_SIZE}
          color="#f4d9a0"
          transparent
          opacity={0.35}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Fireflies */}
      <points ref={fireflyRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={FIREFLY_COUNT}
            array={fireflyPositions.slice()}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={FIREFLY_SIZE}
          color="#aaff44"
          transparent
          opacity={0.6}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
