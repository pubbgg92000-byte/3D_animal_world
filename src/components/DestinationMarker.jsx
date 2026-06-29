import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * DestinationMarker — Nature-themed click-to-move feedback.
 *
 * When player clicks ground:
 *  - A glowing forest rune appears at the click point
 *  - Leaf particles spiral outward
 *  - Marker gently pulses while animal walks
 *  - Dotted path line from animal to destination
 *  - On arrival: dissolves upward into leaf burst
 */

const LEAF_COUNT = 10;
const RUNE_SEGMENTS = 32;

/* ── Leaf Particle System ── */
function LeafParticles({ position, arrived }) {
  const meshRef = useRef();
  const particlesRef = useRef([]);
  const timeRef = useRef(0);

  const geometry = useMemo(() => {
    // Small diamond shape for leaves
    const shape = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0.06, 0,   -0.03, 0, 0,   0, -0.06, 0,
      0, 0.06, 0,   0, -0.06, 0,   0.03, 0, 0,
    ]);
    shape.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    shape.computeVertexNormals();
    return shape;
  }, []);

  // Initialize particles
  useEffect(() => {
    particlesRef.current = Array.from({ length: LEAF_COUNT }, (_, i) => {
      const angle = (i / LEAF_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 2;
      const rotSpeed = (Math.random() - 0.5) * 8;
      const size = 0.6 + Math.random() * 0.4;
      return {
        angle,
        radius: 0,
        y: 0,
        speed,
        rotSpeed,
        size,
        opacity: 1,
        rotation: Math.random() * Math.PI * 2,
        phase: arrived ? 'burst' : 'spawn',
      };
    });
    timeRef.current = 0;
  }, [arrived]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;

    const matrices = [];
    const dummy = new THREE.Object3D();

    particlesRef.current.forEach((p, i) => {
      if (arrived) {
        // Burst upward on arrival
        p.radius += p.speed * delta * 0.5;
        p.y += p.speed * delta * 2;
        p.opacity = Math.max(0, p.opacity - delta * 1.5);
      } else if (timeRef.current < 1.2) {
        // Spawn: spiral outward
        p.radius = Math.min(p.radius + p.speed * delta, 1.5 + Math.random() * 0.5);
        p.y = Math.sin(timeRef.current * 3 + i) * 0.3;
        p.opacity = Math.max(0, 1 - timeRef.current / 1.2);
      } else {
        p.opacity = 0;
      }

      p.rotation += p.rotSpeed * delta;
      p.angle += delta * 0.5;

      dummy.position.set(
        position.x + Math.cos(p.angle) * p.radius,
        position.y + 0.15 + p.y,
        position.z + Math.sin(p.angle) * p.radius
      );
      dummy.rotation.set(p.rotation, p.rotation * 0.5, 0);
      dummy.scale.setScalar(p.size * Math.max(0, p.opacity));
      dummy.updateMatrix();
    });

    // Update instanced mesh
    particlesRef.current.forEach((p, i) => {
      const dummy = new THREE.Object3D();
      dummy.position.set(
        position.x + Math.cos(p.angle) * p.radius,
        position.y + 0.15 + p.y,
        position.z + Math.sin(p.angle) * p.radius
      );
      dummy.rotation.set(p.rotation, p.rotation * 0.5, 0);
      dummy.scale.setScalar(p.size * Math.max(0, p.opacity));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#4ade80'),
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, LEAF_COUNT]} />
  );
}

/* ── Glowing Rune Ring ── */
function RuneRing({ position, arrived }) {
  const ringRef = useRef();
  const innerRef = useRef();
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (ringRef.current) {
      // Gentle pulse
      const pulse = 1 + Math.sin(timeRef.current * 2.5) * 0.08;
      const arrivalFade = arrived
        ? Math.max(0, 1 - timeRef.current * 0.8)
        : Math.min(1, timeRef.current * 2);
      const scale = pulse * (arrived ? 1 + timeRef.current * 0.5 : 1);

      ringRef.current.scale.set(scale, scale, scale);
      ringRef.current.material.opacity = arrivalFade * 0.5;
      ringRef.current.rotation.y += delta * 0.3;
    }

    if (innerRef.current) {
      const arrivalFade = arrived
        ? Math.max(0, 1 - timeRef.current * 0.8)
        : Math.min(1, timeRef.current * 2);
      innerRef.current.material.opacity = arrivalFade * 0.25;
      innerRef.current.rotation.y -= delta * 0.15;
    }
  });

  // Reset time on arrival change
  useEffect(() => {
    timeRef.current = 0;
  }, [arrived]);

  return (
    <group position={[position.x, position.y + 0.08, position.z]}>
      {/* Outer ring */}
      <mesh ref={ringRef} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.6, 0.72, RUNE_SEGMENTS]} />
        <meshBasicMaterial
          color="#4ade80"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner glow disc */}
      <mesh ref={innerRef} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.55, RUNE_SEGMENTS]} />
        <meshBasicMaterial
          color="#2dd4bf"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ── Dotted Path Line ── */
function PathLine({ from, to }) {
  const lineRef = useRef();

  useFrame(() => {
    if (!lineRef.current || !from || !to) return;

    const points = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push(new THREE.Vector3(
        THREE.MathUtils.lerp(from.x, to.x, t),
        THREE.MathUtils.lerp(from.y, to.y, t) + 0.12,
        THREE.MathUtils.lerp(from.z, to.z, t),
      ));
    }

    lineRef.current.geometry.setFromPoints(points);
  });

  return (
    <line ref={lineRef}>
      <bufferGeometry />
      <lineDashedMaterial
        color="#4ade80"
        transparent
        opacity={0.35}
        dashSize={0.3}
        gapSize={0.2}
        depthWrite={false}
      />
    </line>
  );
}

/* ── Main Destination Marker Component ── */
export default function DestinationMarker({ position, arrived = false, animalPosition }) {
  if (!position) return null;

  return (
    <group>
      <RuneRing position={position} arrived={arrived} />
      <LeafParticles position={position} arrived={arrived} />
      {animalPosition && !arrived && (
        <PathLine from={animalPosition} to={position} />
      )}
    </group>
  );
}
