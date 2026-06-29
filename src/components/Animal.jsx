import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import useAnimalMovement from '../hooks/useAnimalMovement';
import useAnimalAI from '../hooks/useAnimalAI';
import useAnimalStats from '../hooks/useAnimalStats';

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
const GRAZE_NECK_ANGLE = 1.4;
const GRAZE_JAW_ANGLE = 0.2;
const DRINK_NECK_ANGLE = 1.6;
const SLEEP_BODY_LOWER = 0.5;

/* ========================================
   Bone helpers
   ======================================== */
function findBone(root, pattern) {
  let bone = null;
  root.traverse((child) => {
    if (child.isBone && child.name && child.name.includes(pattern)) {
      bone = child;
    }
  });
  return bone;
}

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function applyBoneRot(bone, axis, angle) {
  if (!bone) return;
  const euler = new THREE.Euler();
  euler[axis] = angle;
  bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(euler));
}

function applyNeckBend(bones, angle) {
  const count = bones.length;
  if (count === 0) return;
  const share = 1.0 / count;
  for (const b of bones) {
    if (b) applyBoneRot(b, 'x', angle * share);
  }
}

/* ========================================
   Material enhancement — fur tint + shader
   ======================================== */
function enhanceMaterials(root, config) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const mat = child.material;
    if (!mat) return;

    if (config.bodyMaterials.includes(mat.name)) {
      mat.color.set(config.furTint);
      mat.roughness = 0.88;
      mat.metalness = 0.0;
      mat.envMapIntensity = 0.25;

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
          `vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rim = 1.0 - max(dot(viewDir, vWorldNormal), 0.0);
          rim = pow(rim, 2.0) * 0.5;
          gl_FragColor.rgb += vec3(0.4, 0.28, 0.12) * rim;
          float n1 = fract(sin(dot(vWorldPos.xz * 120.0, vec2(12.9898, 78.233))) * 43758.5453);
          gl_FragColor.rgb *= 0.88 + n1 * 0.15;
          float ao = pow(max(dot(vWorldNormal, vec3(0.0, 1.0, 0.0)), 0.0), 0.5);
          gl_FragColor.rgb *= 0.7 + ao * 0.3;
          #include <dithering_fragment>`
        );
      };
      mat.needsUpdate = true;
    }

    if (config.antlerMaterials.includes(mat.name)) {
      mat.color.set('#8a7458');
      mat.roughness = 0.82;
      mat.metalness = 0.03;
      mat.needsUpdate = true;
    }
  });
}

/* ========================================
   Animation resolver — fuzzy match clip names
   ======================================== */
function resolveAnimKey(actions, key) {
  if (actions[key]) return key;
  const keys = Object.keys(actions);
  for (const k of keys) {
    if (k.toLowerCase().includes(key.toLowerCase())) return k;
  }
  return null;
}

function crossFadeToAnim(actions, currentAction, targetKey, fadeDuration = 0.3, timeScale = 1.0) {
  const resolved = resolveAnimKey(actions, targetKey);
  if (!resolved) return currentAction;

  const action = actions[resolved];
  if (!action) return currentAction;

  action.reset();
  action.setLoop(THREE.LoopRepeat);
  action.timeScale = timeScale;

  if (currentAction && currentAction !== action) {
    action.crossFadeFrom(currentAction, fadeDuration, true);
  }

  action.play();
  return action;
}

/* ========================================
   Generic Animal Component
   ======================================== */
export default function Animal({
  config,
  destination: userDestination,
  isRunning,
  isSelected,
  onSelect,
  onPositionUpdate,
  onStatsUpdate,
  onBehaviorUpdate,
}) {
  const groupRef = useRef();
  const { scene, animations } = useGLTF(config.model);

  // Use SkeletonUtils.clone for proper skinned mesh cloning
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { actions } = useAnimations(animations, groupRef);

  const [idle, setIdle] = useState(true);
  const [activeDest, setActiveDest] = useState(null);
  const currentAnim = useRef(null);
  const actionsReady = useRef(false);
  const terrainY = useRef(0);
  const behaviorPhase = useRef(0);

  // Bones
  const neckBones = useRef([]);
  const headBone = useRef(null);
  const jawBone = useRef(null);
  const tailBone = useRef(null);
  const spineBone = useRef(null);

  // AI + Stats
  const animalAI = useAnimalAI(config.diet);
  const animalStats = useAnimalStats(config.decayRates);
  const aiWalking = useRef(false);
  const lastAIDest = useRef(null);

  // Set initial position
  useEffect(() => {
    if (groupRef.current && config.spawnPos) {
      const [x, , z] = config.spawnPos;
      const y = getTerrainHeight(x, z);
      groupRef.current.position.set(x, y, z);
      terrainY.current = y;
    }
  }, [config.spawnPos]);

  // Enhance materials
  useEffect(() => {
    enhanceMaterials(clonedScene, config);
  }, [clonedScene, config]);

  // Find bones
  useEffect(() => {
    const bc = config.bones;
    neckBones.current = (bc.neck || [])
      .map((p) => findBone(clonedScene, p))
      .filter(Boolean);
    headBone.current = findBone(clonedScene, bc.head);
    jawBone.current = findBone(clonedScene, bc.jaw);
    const tailPatterns = Array.isArray(bc.tail) ? bc.tail : [bc.tail];
    tailBone.current = null;
    for (const tp of tailPatterns) {
      const b = findBone(clonedScene, tp);
      if (b) { tailBone.current = b; break; }
    }
    spineBone.current = findBone(clonedScene, bc.spine);
  }, [clonedScene, config.bones]);

  // Wait for actions + start idle
  useEffect(() => {
    const check = setInterval(() => {
      const idleKey = resolveAnimKey(actions, config.anims.idle);
      if (idleKey) {
        clearInterval(check);
        actionsReady.current = true;
        currentAnim.current = crossFadeToAnim(actions, null, config.anims.idle);
        setIdle(true);
      }
    }, 100);
    return () => clearInterval(check);
  }, [actions, config.anims.idle]);

  // Animation helpers
  const playIdle = useCallback(() => {
    if (!actionsReady.current) return;
    currentAnim.current = crossFadeToAnim(actions, currentAnim.current, config.anims.idle);
    setIdle(true);
  }, [actions, config.anims.idle]);

  const playWalk = useCallback(
    (running = false) => {
      if (!actionsReady.current) return;
      const ts = running ? config.runTimescale : config.walkTimescale;
      currentAnim.current = crossFadeToAnim(
        actions, currentAnim.current, config.anims.walk, 0.3, ts
      );
      setIdle(false);
    },
    [actions, config.anims.walk, config.walkTimescale, config.runTimescale]
  );

  // Arrival
  const handleArrive = useCallback(() => {
    playIdle();
    aiWalking.current = false;
    setActiveDest(null);
  }, [playIdle]);

  const speed = isRunning ? config.runSpeed : config.walkSpeed;

  useAnimalMovement(groupRef, activeDest, {
    moveSpeed: speed,
    onArrive: handleArrive,
  });

  // User click → override AI
  const prevUserDest = useRef(null);
  useEffect(() => {
    if (userDestination && userDestination !== prevUserDest.current) {
      prevUserDest.current = userDestination;
      animalAI.override();
      behaviorPhase.current = 0;
      setActiveDest(userDestination);
      playWalk(isRunning);
    }
  }, [userDestination, isRunning, playWalk, animalAI]);

  // Click handler for selection
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      onSelect?.(config.id);
    },
    [config.id, onSelect]
  );

  // ---------- EVERY FRAME ----------
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const pos = groupRef.current.position;

    // Terrain tracking
    const targetY = getTerrainHeight(pos.x, pos.z);
    terrainY.current += (targetY - terrainY.current) * Math.min(1, 8 * delta);
    pos.y = terrainY.current;

    onPositionUpdate?.(config.id, pos);

    // AI + Stats
    const ai = animalAI.update(delta, pos, null);
    const statsResult = animalStats.update(delta, ai.aiState);

    onStatsUpdate?.(config.id, statsResult);
    onBehaviorUpdate?.(config.id, ai.aiState);

    // AI destination
    if (ai.destination && !userDestination && !aiWalking.current) {
      if (ai.destination !== lastAIDest.current) {
        lastAIDest.current = ai.destination;
        aiWalking.current = true;
        setActiveDest(ai.destination);
        playWalk(false);
      }
    }

    // Procedural behaviors
    const doGraze = (ai.shouldGraze || ai.shouldHunt) && !userDestination;
    const doDrink = ai.shouldDrink && !userDestination;
    const doSleep = ai.shouldSleep && !userDestination;
    const doIdle = !doGraze && !doDrink && !doSleep && idle;

    if (doGraze || doDrink || doSleep || doIdle) {
      behaviorPhase.current += delta;
    } else {
      behaviorPhase.current = 0;
    }

    const phase = behaviorPhase.current;

    // GRAZING — head all the way down
    if (doGraze) {
      const cycle = 5.0;
      const t = (phase % cycle) / cycle;
      let neckAngle = 0;
      let jawAngle = 0;

      if (t < 0.2) {
        neckAngle = GRAZE_NECK_ANGLE * smoothstep(t / 0.2);
      } else if (t < 0.75) {
        neckAngle = GRAZE_NECK_ANGLE;
        const chewT = (t - 0.2) / 0.55;
        neckAngle += Math.sin(chewT * Math.PI * 8) * 0.06;
        jawAngle = GRAZE_JAW_ANGLE * (0.5 + 0.5 * Math.sin(chewT * Math.PI * 10));
      } else {
        neckAngle = GRAZE_NECK_ANGLE * (1.0 - smoothstep((t - 0.75) / 0.25));
      }

      applyNeckBend(neckBones.current, neckAngle);
      applyBoneRot(headBone.current, 'x', neckAngle * 0.2);
      applyBoneRot(jawBone.current, 'x', jawAngle);
      applyBoneRot(tailBone.current, 'z', Math.sin(phase * 2.5) * 0.15);
    }

    // DRINKING
    if (doDrink) {
      const cycle = 4.0;
      const t = (phase % cycle) / cycle;
      let neckAngle = 0;
      let jawAngle = 0;

      if (t < 0.15) {
        neckAngle = DRINK_NECK_ANGLE * smoothstep(t / 0.15);
      } else if (t < 0.8) {
        neckAngle = DRINK_NECK_ANGLE;
        const drinkT = (t - 0.15) / 0.65;
        jawAngle = 0.1 * Math.sin(drinkT * Math.PI * 12);
        neckAngle += Math.sin(drinkT * Math.PI * 6) * 0.04;
      } else {
        neckAngle = DRINK_NECK_ANGLE * (1.0 - smoothstep((t - 0.8) / 0.2));
      }

      applyNeckBend(neckBones.current, neckAngle);
      applyBoneRot(headBone.current, 'x', neckAngle * 0.2);
      applyBoneRot(jawBone.current, 'x', jawAngle);
    }

    // SLEEPING
    if (doSleep) {
      const settleT = Math.min(1, phase / 2.5);
      pos.y = terrainY.current - SLEEP_BODY_LOWER * smoothstep(settleT);
      applyNeckBend(neckBones.current, 0.3 * smoothstep(settleT));
      applyBoneRot(spineBone.current, 'x', Math.sin(phase * 0.8) * 0.025);
      applyBoneRot(tailBone.current, 'z', Math.sin(phase * 0.5) * 0.1 * smoothstep(settleT));
    }

    // IDLE look-around
    if (doIdle && phase > 2.0) {
      const lt = (phase % 6.0) / 6.0;
      applyBoneRot(headBone.current, 'y', Math.sin(lt * Math.PI * 2) * 0.15);
      applyBoneRot(tailBone.current, 'z', Math.sin(phase * 1.8) * 0.12);
    }
  });

  return (
    <group
      ref={groupRef}
      dispose={null}
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      <primitive object={clonedScene} scale={config.scale} />
    </group>
  );
}
