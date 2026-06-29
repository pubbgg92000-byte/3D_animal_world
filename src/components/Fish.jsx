import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { POND_POSITION, POND_RADIUS } from './Pond';
import { POND_WATER_Y } from '../utils/world';

/* ================================================================
   Fish — animated GLB fish roaming inside the central pond only
   ================================================================ */

const FISH_MODEL_URL = '/tropical_alien_fish_animated.glb';
const POND_FISH_COUNT = 14;
const FISH_MODEL_SCALE = 0.22;

// Seeded RNG so fish start positions are stable
function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function FishInstance({ centerX, centerZ, centerY, pondRadius, index, seed }) {
  const groupRef  = useRef();
  const mixerRef  = useRef(null);
  const posRef    = useRef(new THREE.Vector3());
  const velRef    = useRef(new THREE.Vector3());
  const targetRef = useRef(new THREE.Vector3());
  const timerRef  = useRef(0);
  const { scene, animations } = useGLTF(FISH_MODEL_URL);
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = false;
      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
      const materials = sourceMaterials.map((source) => {
        if (!source) return source;
        if (source.isMeshBasicMaterial) {
          return new THREE.MeshStandardMaterial({
            map: source.map || null,
            color: source.color?.clone?.() || new THREE.Color('#75d9d0'),
            roughness: 0.72,
            metalness: 0.02,
            transparent: source.transparent,
            opacity: source.opacity,
            alphaMap: source.alphaMap || null,
            side: THREE.DoubleSide,
          });
        }
        return source.clone();
      });
      child.material = Array.isArray(child.material) ? materials : materials[0];
      for (const material of materials) {
        if (!material) continue;
        material.side = THREE.DoubleSide;
        material.roughness = Math.min(0.82, material.roughness ?? 0.58);
        material.metalness = Math.min(0.2, material.metalness ?? 0.05);
        material.envMapIntensity = Math.max(material.envMapIntensity ?? 0, 0.22);
        material.needsUpdate = true;
      }
    });
    return clone;
  }, [scene]);

  // Per-fish constants
  const swimDepth = useMemo(() => POND_WATER_Y - 0.34 - (seed % 4) * 0.045, [seed]);
  const speed     = useMemo(() => 0.72 + (seed % 7) * 0.12, [seed]);
  const modelScale = useMemo(() => FISH_MODEL_SCALE * (0.72 + (seed % 5) * 0.08), [seed]);
  const modelTilt = useMemo(() => (index % 2 === 0 ? -0.05 : 0.04), [index]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;
    const actionList = animations.map((clip) => mixer.clipAction(clip, clonedScene));
    for (const action of actionList) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.enabled = true;
      action.timeScale = 0.9 + (seed % 6) * 0.1;
      action.play();
      action.time = ((seed % 23) / 23) * Math.max(0.1, action.getClip().duration);
    }
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
    };
  }, [animations, clonedScene, seed]);

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
    if (!groupRef.current) return;
    mixerRef.current?.update(delta);

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
      posRef.current.y = centerY + swimDepth + Math.sin(timerRef.current * 1.5 + index) * 0.035;

    // Apply to model
    groupRef.current.position.copy(posRef.current);

    // Face movement direction
    if (velRef.current.lengthSq() > 0.0001) {
      groupRef.current.rotation.y = Math.atan2(velRef.current.x, velRef.current.z);
    }
    groupRef.current.rotation.x = modelTilt + Math.sin(timerRef.current * 2.1 + index) * 0.035;
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={clonedScene}
        scale={modelScale}
        rotation={[0, Math.PI, 0]}
        position={[0, -0.05, 0]}
      />
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

useGLTF.preload(FISH_MODEL_URL);
