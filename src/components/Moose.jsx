import { useRef, useEffect, useCallback, useState } from 'react';
import { useGLTF, useAnimations, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { crossFadeTo, hasAnimation } from '../utils/animationManager';
import useMooseMovement from '../hooks/useMooseMovement';
import useMooseAI, { AI_STATE } from '../hooks/useMooseAI';

const MODEL_PATH = '/models/moose.glb';
const FUR_TEXTURE_PATH = '/textures/moose_fur.png';

/* ========================================
   Terrain height — must match Ground.jsx
   ======================================== */
const HILL_AMPLITUDE = 1.2;
const HILL_FREQUENCY = 0.04;

function getTerrainHeight(x, z) {
  const h1 = Math.sin(x * HILL_FREQUENCY) * Math.cos(z * HILL_FREQUENCY * 1.3);
  const h2 =
    Math.sin(x * HILL_FREQUENCY * 2.1 + 1.7) *
    Math.cos(z * HILL_FREQUENCY * 1.7 + 0.5);
  return (h1 * 0.6 + h2 * 0.4) * HILL_AMPLITUDE;
}

/* ========================================
   Constants
   ======================================== */
const WALK_SPEED = 2.5;
const RUN_SPEED = 5.0;
const WALK_TIMESCALE = 1.0;
const RUN_TIMESCALE = 1.8;

// Grazing — head must reach the ground
const GRAZE_NECK_ANGLE = 1.4; // ~80° total bend across bones
const GRAZE_JAW_ANGLE = 0.2;
// Drinking — head goes even lower into water
const DRINK_NECK_ANGLE = 1.6; // ~92° total bend
// Sleeping
const SLEEP_BODY_LOWER = 0.6;

/* ========================================
   Material enhancement — apply fur texture + shader
   ======================================== */
function enhanceMooseMaterials(scene, furTexture) {
  scene.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const mat = child.material;
    if (!mat) return;

    if (mat.name === 'M_Moose') {
      // Apply the fur texture as base color
      if (furTexture) {
        furTexture.wrapS = THREE.RepeatWrapping;
        furTexture.wrapT = THREE.RepeatWrapping;
        furTexture.repeat.set(3, 3); // Tile the texture
        furTexture.anisotropy = 8;
        mat.map = furTexture;
        mat.color.set('#d4b896'); // Warm brown base tint
      } else {
        mat.color.set('#6b4c2a'); // Fallback dark brown
      }

      mat.roughness = 0.88;
      mat.metalness = 0.0;
      mat.envMapIntensity = 0.25;

      // Fur shader enhancement
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;`
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `// Warm rim light — simulates fur edge glow
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rim = 1.0 - max(dot(viewDir, vWorldNormal), 0.0);
          rim = pow(rim, 2.0) * 0.6;
          gl_FragColor.rgb += vec3(0.45, 0.30, 0.12) * rim;

          // Hair strand noise — fine grain
          float n1 = fract(sin(dot(vWorldPos.xz * 120.0, vec2(12.9898, 78.233))) * 43758.5453);
          float n2 = fract(sin(dot(vWorldPos.yz * 90.0, vec2(45.164, 93.233))) * 43758.5453);
          gl_FragColor.rgb *= 0.88 + n1 * 0.15;
          gl_FragColor.rgb += vec3(0.03, 0.015, 0.0) * n2;

          // Subtle darkening in crevices
          float ao = pow(max(dot(vWorldNormal, vec3(0.0, 1.0, 0.0)), 0.0), 0.5);
          gl_FragColor.rgb *= 0.7 + ao * 0.3;

          #include <dithering_fragment>`
        );
      };
      mat.needsUpdate = true;
    }

    // Antlers — bone color
    if (mat.name === 'M_Moose_Antler') {
      mat.color.set('#8a7458');
      mat.roughness = 0.82;
      mat.metalness = 0.03;
      mat.needsUpdate = true;
    }
  });
}

/* ========================================
   Bone helpers
   ======================================== */
function findBone(scene, boneName) {
  let bone = null;
  scene.traverse((child) => {
    if (child.isBone && child.name && child.name.includes(boneName)) {
      bone = child;
    }
  });
  return bone;
}

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function applyBoneRotation(bone, axis, angle) {
  const euler = new THREE.Euler();
  euler[axis] = angle;
  const q = new THREE.Quaternion().setFromEuler(euler);
  bone.quaternion.multiply(q);
}

function applyNeckBend(n1, n2, n3, head, angle) {
  // Distribute bend across 4 bones for natural S-curve
  if (n1.current) applyBoneRotation(n1.current, 'x', angle * 0.25);
  if (n2.current) applyBoneRotation(n2.current, 'x', angle * 0.30);
  if (n3.current) applyBoneRotation(n3.current, 'x', angle * 0.25);
  if (head.current) applyBoneRotation(head.current, 'x', angle * 0.20);
}

/* ========================================
   Moose Component
   ======================================== */
export default function Moose({
  destination: userDestination,
  isRunning,
  onAnimChange,
  onArrive,
  onPositionUpdate,
  onAIStateChange,
}) {
  const groupRef = useRef();
  const { scene, animations } = useGLTF(MODEL_PATH);
  const { actions } = useAnimations(animations, groupRef);
  const furTexture = useTexture(FUR_TEXTURE_PATH);

  const [idle, setIdle] = useState(true);
  const [activeDest, setActiveDest] = useState(null);
  const currentAnim = useRef(null);
  const actionsReady = useRef(false);
  const terrainY = useRef(0);

  // Bones
  const neckBone1 = useRef(null);
  const neckBone2 = useRef(null);
  const neckBone3 = useRef(null);
  const headBone = useRef(null);
  const jawBone = useRef(null);
  const tailBone = useRef(null);
  const spineBone = useRef(null);

  // Procedural animation
  const behaviorPhase = useRef(0);

  // AI
  const mooseAI = useMooseAI();
  const aiWalking = useRef(false);
  const lastAIDest = useRef(null);

  // Apply fur texture + materials
  useEffect(() => {
    enhanceMooseMaterials(scene, furTexture);
  }, [scene, furTexture]);

  // Find bones
  useEffect(() => {
    neckBone1.current = findBone(scene, 'Neck1');
    neckBone2.current = findBone(scene, 'Neck2');
    neckBone3.current = findBone(scene, 'Neck3');
    headBone.current = findBone(scene, 'Head');
    jawBone.current = findBone(scene, 'Jaw');
    tailBone.current = findBone(scene, 'Tail1');
    spineBone.current = findBone(scene, 'Spine1');
  }, [scene]);

  // Wait for actions
  useEffect(() => {
    const check = setInterval(() => {
      if (hasAnimation(actions, 'Idle')) {
        clearInterval(check);
        actionsReady.current = true;
        currentAnim.current = crossFadeTo(actions, null, 'Idle');
        setIdle(true);
        onAnimChange?.('Idle');
      }
    }, 100);
    return () => clearInterval(check);
  }, [actions, onAnimChange]);

  // Animation helpers
  const playIdle = useCallback(() => {
    if (!actionsReady.current) return;
    currentAnim.current = crossFadeTo(actions, currentAnim.current, 'Idle');
    setIdle(true);
    onAnimChange?.('Idle');
  }, [actions, onAnimChange]);

  const playWalk = useCallback(
    (running = false) => {
      if (!actionsReady.current) return;
      const ts = running ? RUN_TIMESCALE : WALK_TIMESCALE;
      currentAnim.current = crossFadeTo(
        actions, currentAnim.current, 'WalkFast_F', 0.3, ts
      );
      setIdle(false);
      onAnimChange?.(running ? 'Running' : 'Walking');
    },
    [actions, onAnimChange]
  );

  // Arrival
  const handleArrive = useCallback(() => {
    playIdle();
    aiWalking.current = false;
    setActiveDest(null);
    onArrive?.();
  }, [playIdle, onArrive]);

  const speed = isRunning ? RUN_SPEED : WALK_SPEED;

  useMooseMovement(groupRef, activeDest, {
    moveSpeed: speed,
    onArrive: handleArrive,
  });

  // User click → override AI
  const prevUserDest = useRef(null);
  useEffect(() => {
    if (userDestination && userDestination !== prevUserDest.current) {
      prevUserDest.current = userDestination;
      mooseAI.override();
      behaviorPhase.current = 0;
      setActiveDest(userDestination);
      playWalk(isRunning);
    }
  }, [userDestination, isRunning, playWalk, mooseAI]);

  // ---------- EVERY FRAME ----------
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const pos = groupRef.current.position;

    // Terrain tracking
    const targetY = getTerrainHeight(pos.x, pos.z);
    terrainY.current += (targetY - terrainY.current) * Math.min(1, 8 * delta);
    pos.y = terrainY.current;

    onPositionUpdate?.(pos);

    // AI update
    const ai = mooseAI.update(delta, pos);
    onAIStateChange?.(ai.aiState);

    // AI destination changes
    if (ai.destination && !userDestination && !aiWalking.current) {
      if (ai.destination !== lastAIDest.current) {
        lastAIDest.current = ai.destination;
        aiWalking.current = true;
        setActiveDest(ai.destination);
        playWalk(false);
      }
    }

    // ---------- Procedural behaviors ----------
    const doGraze = ai.shouldGraze && !userDestination;
    const doDrink = ai.shouldDrink && !userDestination;
    const doSleep = ai.shouldSleep && !userDestination;
    const doIdle = !doGraze && !doDrink && !doSleep && idle;

    if (doGraze || doDrink || doSleep || doIdle) {
      behaviorPhase.current += delta;
    } else {
      behaviorPhase.current = 0;
    }

    const phase = behaviorPhase.current;

    // --- GRAZING — head reaches all the way to ground ---
    if (doGraze) {
      const cycle = 5.0;
      const t = (phase % cycle) / cycle;
      let neckAngle = 0;
      let jawAngle = 0;

      if (t < 0.2) {
        // Lower head to ground
        neckAngle = GRAZE_NECK_ANGLE * smoothstep(t / 0.2);
      } else if (t < 0.75) {
        // Eating — head stays at ground level with chewing bobs
        neckAngle = GRAZE_NECK_ANGLE;
        const chewT = (t - 0.2) / 0.55;
        // Small biting/pulling motions
        neckAngle += Math.sin(chewT * Math.PI * 8) * 0.06;
        jawAngle = GRAZE_JAW_ANGLE * (0.5 + 0.5 * Math.sin(chewT * Math.PI * 10));
      } else {
        // Raise head back up
        neckAngle = GRAZE_NECK_ANGLE * (1.0 - smoothstep((t - 0.75) / 0.25));
        // Continue chewing while raising
        jawAngle = GRAZE_JAW_ANGLE * 0.5 * Math.sin(phase * 6);
      }

      applyNeckBend(neckBone1, neckBone2, neckBone3, headBone, neckAngle);
      if (jawBone.current) applyBoneRotation(jawBone.current, 'x', jawAngle);
      if (tailBone.current) applyBoneRotation(tailBone.current, 'z', Math.sin(phase * 2.5) * 0.15);
    }

    // --- DRINKING — head reaches into water ---
    if (doDrink) {
      const cycle = 4.0;
      const t = (phase % cycle) / cycle;
      let neckAngle = 0;
      let jawAngle = 0;

      if (t < 0.15) {
        // Lower head to water
        neckAngle = DRINK_NECK_ANGLE * smoothstep(t / 0.15);
      } else if (t < 0.8) {
        // Drinking — lapping motions
        neckAngle = DRINK_NECK_ANGLE;
        const drinkT = (t - 0.15) / 0.65;
        jawAngle = 0.1 * Math.sin(drinkT * Math.PI * 12);
        // Slight head bob while drinking
        neckAngle += Math.sin(drinkT * Math.PI * 6) * 0.04;
      } else {
        // Raise head — water drips
        neckAngle = DRINK_NECK_ANGLE * (1.0 - smoothstep((t - 0.8) / 0.2));
      }

      applyNeckBend(neckBone1, neckBone2, neckBone3, headBone, neckAngle);
      if (jawBone.current) applyBoneRotation(jawBone.current, 'x', jawAngle);
    }

    // --- SLEEPING ---
    if (doSleep) {
      const settleT = Math.min(1, phase / 2.5);
      const lowerAmount = SLEEP_BODY_LOWER * smoothstep(settleT);
      pos.y = terrainY.current - lowerAmount;

      const neckAngle = 0.3 * smoothstep(settleT);
      applyNeckBend(neckBone1, neckBone2, neckBone3, headBone, neckAngle);

      if (spineBone.current) {
        const breath = Math.sin(phase * 0.8) * 0.025;
        applyBoneRotation(spineBone.current, 'x', breath);
      }
      if (tailBone.current) {
        const flick = Math.sin(phase * 0.5) * 0.1 * smoothstep(settleT);
        applyBoneRotation(tailBone.current, 'z', flick);
      }
    }

    // --- IDLE look-around ---
    if (doIdle && phase > 2.0) {
      const lookCycle = 6.0;
      const lt = (phase % lookCycle) / lookCycle;
      if (headBone.current) {
        applyBoneRotation(headBone.current, 'y', Math.sin(lt * Math.PI * 2) * 0.15);
      }
      if (tailBone.current) {
        applyBoneRotation(tailBone.current, 'z', Math.sin(phase * 1.8) * 0.12);
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} dispose={null}>
      <primitive object={scene} scale={1} />
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
