import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ========================================
   Constants
   ======================================== */

/** Dust motes — defaults, can be overridden via props */
const DEFAULT_DUST_COUNT = 300;
const DUST_AREA = 40;
const DUST_HEIGHT = 8;
const DUST_SIZE = 0.06;

/** Fireflies — defaults, can be overridden via props */
const DEFAULT_FIREFLY_COUNT = 50;
const FIREFLY_AREA = 25;
const FIREFLY_HEIGHT = 3;
const FIREFLY_SIZE = 0.08;
const LEAF_COUNT = 34;
const BUTTERFLY_COUNT = 18;
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _rotation = new THREE.Euler();
const _scale = new THREE.Vector3();
const LEAF_COLORS = ['#f6b24b', '#f28f45', '#ffd36d', '#d96d3b', '#9fcf5a'];
const BUTTERFLY_COLORS = ['#ff65c7', '#7bdcff', '#ffd34e', '#a78bfa', '#ff9f6e'];

/* ========================================
   FloatingParticles Component
   ======================================== */

/**
 * FloatingParticles — renders gentle dust motes and glowing fireflies.
 * Uses Three.js Points for GPU-efficient rendering.
 */
export default function FloatingParticles({
  dustCount = DEFAULT_DUST_COUNT,
  fireflyCount = DEFAULT_FIREFLY_COUNT,
}) {
  const dustRef = useRef();
  const fireflyRef = useRef();
  const leavesRef = useRef();
  const butterfliesRef = useRef();

  // ---------- Dust motes ----------

  const dustPositions = useMemo(() => {
    const positions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * DUST_AREA;
      positions[i * 3 + 1] = Math.random() * DUST_HEIGHT + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * DUST_AREA;
    }
    return positions;
  }, [dustCount]);

  const _dustSizes = useMemo(() => {
    const sizes = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      sizes[i] = DUST_SIZE * (0.5 + Math.random() * 0.5);
    }
    return sizes;
  }, [dustCount]);

  // ---------- Fireflies ----------

  const fireflyPositions = useMemo(() => {
    const positions = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * FIREFLY_AREA;
      positions[i * 3 + 1] = 0.5 + Math.random() * FIREFLY_HEIGHT;
      positions[i * 3 + 2] = (Math.random() - 0.5) * FIREFLY_AREA;
    }
    return positions;
  }, [fireflyCount]);

  const leaves = useMemo(() => (
    Array.from({ length: LEAF_COUNT }, (_, i) => ({
      x: (Math.random() - 0.5) * 52,
      y: 1.2 + Math.random() * 5.2,
      z: (Math.random() - 0.5) * 52,
      speed: 0.28 + Math.random() * 0.42,
      sway: 0.7 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      scale: 0.18 + Math.random() * 0.16,
      color: new THREE.Color(LEAF_COLORS[i % LEAF_COLORS.length]),
    }))
  ), []);

  const butterflies = useMemo(() => (
    Array.from({ length: BUTTERFLY_COUNT }, (_, i) => ({
      x: (Math.random() - 0.5) * 36,
      y: 1.0 + Math.random() * 3.5,
      z: (Math.random() - 0.5) * 36,
      speed: 0.45 + Math.random() * 0.55,
      radius: 0.8 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      scale: 0.12 + Math.random() * 0.1,
      color: new THREE.Color(BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length]),
    }))
  ), []);

  const leafGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.18);
    shape.quadraticCurveTo(0.14, 0.07, 0, -0.2);
    shape.quadraticCurveTo(-0.14, 0.07, 0, 0.18);
    return new THREE.ShapeGeometry(shape, 6);
  }, []);

  const butterflyGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.04, 0);
    shape.ellipse(-0.11, 0.04, 0.09, 0.12, 0, Math.PI * 2);
    shape.moveTo(0.04, 0);
    shape.ellipse(0.11, 0.04, 0.09, 0.12, 0, Math.PI * 2);
    return new THREE.ShapeGeometry(shape, 8);
  }, []);

  // ---------- Animation ----------

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Dust: gentle floating drift
    if (dustRef.current) {
      const pos = dustRef.current.geometry.attributes.position;
      for (let i = 0; i < dustCount; i++) {
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
      for (let i = 0; i < fireflyCount; i++) {
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

    if (leavesRef.current) {
      leaves.forEach((leaf, i) => {
        const driftZ = ((leaf.z + t * leaf.speed * 2.0 + 26) % 52) - 26;
        _position.set(
          leaf.x + Math.sin(t * leaf.sway + leaf.phase) * 1.1,
          leaf.y + Math.sin(t * 0.7 + leaf.phase) * 0.42,
          driftZ
        );
        _rotation.set(
          Math.sin(t * 1.7 + leaf.phase) * 0.9,
          t * 0.8 + leaf.phase,
          Math.cos(t * 1.2 + leaf.phase) * 0.7
        );
        _scale.setScalar(leaf.scale);
        _matrix.compose(_position, new THREE.Quaternion().setFromEuler(_rotation), _scale);
        leavesRef.current.setMatrixAt(i, _matrix);
      });
      leavesRef.current.instanceMatrix.needsUpdate = true;
    }

    if (butterfliesRef.current) {
      butterflies.forEach((butterfly, i) => {
        _position.set(
          butterfly.x + Math.sin(t * butterfly.speed + butterfly.phase) * butterfly.radius,
          butterfly.y + Math.sin(t * 2.2 + butterfly.phase) * 0.28,
          butterfly.z + Math.cos(t * butterfly.speed * 0.8 + butterfly.phase) * butterfly.radius
        );
        const flap = 1 + Math.sin(t * 18 + butterfly.phase) * 0.22;
        _rotation.set(0, t * 0.35 + butterfly.phase, Math.sin(t * 1.4 + butterfly.phase) * 0.2);
        _scale.set(butterfly.scale * flap, butterfly.scale, butterfly.scale);
        _matrix.compose(_position, new THREE.Quaternion().setFromEuler(_rotation), _scale);
        butterfliesRef.current.setMatrixAt(i, _matrix);
      });
      butterfliesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  // ---------- Render ----------

  return (
    <group>
      <instancedMesh
        ref={leavesRef}
        args={[leafGeometry, null, leaves.length]}
        onUpdate={(mesh) => {
          leaves.forEach((leaf, i) => mesh.setColorAt(i, leaf.color));
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }}
      >
        <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0.72} depthWrite={false} />
      </instancedMesh>

      <instancedMesh
        ref={butterfliesRef}
        args={[butterflyGeometry, null, butterflies.length]}
        onUpdate={(mesh) => {
          butterflies.forEach((butterfly, i) => mesh.setColorAt(i, butterfly.color));
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }}
      >
        <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0.88} depthWrite={false} />
      </instancedMesh>

      {/* Dust motes */}
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={dustCount}
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
            count={fireflyCount}
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
