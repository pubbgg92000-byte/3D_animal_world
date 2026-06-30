import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * DestinationMarker — Nature-themed click-to-move feedback.
 *
 * When player clicks ground:
 *  - A typed forest marker appears at the click point
 *  - Leaf particles spiral outward
 *  - Marker gently pulses while animal walks
 *  - On arrival: dissolves upward into leaf burst
 */

const LEAF_COUNT = 6;
const RUNE_SEGMENTS = 32;

const MARKER_TYPES = {
  walk: {
    icon: '🍃',
    label: 'Explore',
    detail: 'Walk here',
    primary: '#79b66b',
    glow: '#b8d88a',
    particle: '#7fbf5f',
  },
  drink: {
    icon: '💧',
    label: 'Water',
    detail: 'Drink',
    primary: '#5fb7d6',
    glow: '#9ed8e7',
    particle: '#7ec9df',
  },
  food: {
    icon: '🍓',
    label: 'Berry Patch',
    detail: 'Fresh food',
    primary: '#b85a4b',
    glow: '#e5a56e',
    particle: '#8dbd5f',
  },
  rest: {
    icon: '🌲',
    label: 'Shade Rest',
    detail: 'Rest here',
    primary: '#8c6a3f',
    glow: '#c7a66b',
    particle: '#9d8653',
  },
  shelter: {
    icon: '🪵',
    label: 'Shelter',
    detail: 'Hide here',
    primary: '#7d6546',
    glow: '#b49a70',
    particle: '#8b7657',
  },
  hunt: {
    icon: '🐾',
    label: 'Hunting Ground',
    detail: 'Search prey',
    primary: '#9b6b4b',
    glow: '#d0a06b',
    particle: '#a37a55',
  },
  fish: {
    icon: '🐟',
    label: 'Fish Pool',
    detail: 'Catch fish',
    primary: '#4c9fc2',
    glow: '#87d0dd',
    particle: '#74b7c9',
  },
};

function getMarkerMeta(type) {
  return MARKER_TYPES[type] || MARKER_TYPES.walk;
}

/* ── Leaf Particle System ── */
function LeafParticles({ arrived, color = '#7fbf5f' }) {
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

      const dummy = new THREE.Object3D();
      dummy.position.set(
        Math.cos(p.angle) * p.radius,
        0.15 + p.y,
        Math.sin(p.angle) * p.radius
      );
      dummy.rotation.set(p.rotation, p.rotation * 0.5, 0);
      dummy.scale.setScalar(p.size * Math.max(0, p.opacity));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), [color]);

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, LEAF_COUNT]} />
  );
}

/* ── Glowing Rune Ring ── */
function NatureGlyph({ type = 'walk', minimal = false, arrived }) {
  const meta = getMarkerMeta(type);
  const groupRef = useRef();
  const ringRef = useRef();
  const innerRef = useRef();
  const iconRef = useRef();
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const fade = arrived
      ? Math.max(0, 1 - timeRef.current * 1.1)
      : Math.max(0.25, 1 - timeRef.current * 0.018);
    const pulse = 1 + Math.sin(timeRef.current * 2.35) * 0.08;
    const bounce = Math.sin(timeRef.current * 3.1) * 0.045;

    if (groupRef.current) {
      const arrivalScale = arrived ? Math.max(0.05, 1 - timeRef.current * 0.95) : 1;
      groupRef.current.position.y = 0.08 + bounce;
      groupRef.current.scale.setScalar(pulse * arrivalScale);
    }

    if (ringRef.current) {
      ringRef.current.material.opacity = fade * (minimal ? 0.45 : 0.55);
      ringRef.current.rotation.z += delta * 0.18;
    }

    if (innerRef.current) {
      innerRef.current.material.opacity = fade * (minimal ? 0.08 : 0.22);
      innerRef.current.rotation.z -= delta * 0.1;
    }

    if (iconRef.current) {
      iconRef.current.material.opacity = fade * (minimal ? 0 : 0.9);
      iconRef.current.rotation.z = Math.sin(timeRef.current * 2.1) * 0.06;
    }
  });

  // Reset time on arrival change
  useEffect(() => {
    timeRef.current = 0;
  }, [arrived]);

  return (
    <group ref={groupRef}>
      <mesh ref={ringRef} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.55, 0.74, RUNE_SEGMENTS]} />
        <meshBasicMaterial
          color={meta.primary}
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={innerRef} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.55, RUNE_SEGMENTS]} />
        <meshBasicMaterial
          color={meta.glow}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {!minimal && (
        <mesh ref={iconRef} rotation-x={-Math.PI / 2} position={[0, 0.025, 0]}>
          {type === 'drink' || type === 'fish' ? (
            <circleGeometry args={[0.22, 24]} />
          ) : type === 'food' ? (
            <circleGeometry args={[0.2, 5]} />
          ) : type === 'rest' || type === 'shelter' ? (
            <boxGeometry args={[0.42, 0.08, 0.28]} />
          ) : type === 'hunt' ? (
            <circleGeometry args={[0.16, 18]} />
          ) : (
            <circleGeometry args={[0.16, 3]} />
          )}
          <meshBasicMaterial
            color={meta.glow}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/* ── Main Destination Marker Component ── */
export default function DestinationMarker({
  position,
  arrived = false,
  type = 'walk',
  minimal = false,
  _feedback = null,
}) {
  if (!position) return null;
  const meta = getMarkerMeta(type);

  return (
    <group position={[position.x, position.y + 0.08, position.z]}>
      <NatureGlyph type={type} minimal={minimal} arrived={arrived} />
      <LeafParticles arrived={arrived} color={meta.particle} />
    </group>
  );
}
