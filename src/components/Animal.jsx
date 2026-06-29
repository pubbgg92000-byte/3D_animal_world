import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import useAnimalMovement from '../hooks/useAnimalMovement';
import useAnimalAI from '../hooks/useAnimalAI';
import useAnimalStats from '../hooks/useAnimalStats';
import { registerAnimal, unregisterAnimal, resolveCollisions } from '../utils/collisionRegistry';

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
  destinationSerial,     // incremented each click so same-point clicks still fire
  isRunning,
  isSelected,
  forcedBehavior,        // 'Walk'|'Run'|'Graze'|'Drink'|'Sleep'|'Hunt Fish'|null
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
  const lastPosition = useRef(new THREE.Vector3());
  const stillTimer = useRef(0);
  const wasMoving = useRef(false);

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

  // User command tracking — use a serial number so every new click fires
  const userDestSerial = useRef(0);
  const prevSerial = useRef(0);
  const prevForcedBehavior = useRef(null);

  // Register / unregister in collision system
  useEffect(() => {
    // We'll update the position ref live in useFrame; just register with a dummy for now
    const posRef = { x: 0, y: 0, z: 0 };
    registerAnimal(config.id, posRef);
    return () => unregisterAnimal(config.id);
  }, [config.id]);

  // Set initial position
  useEffect(() => {
    if (groupRef.current && config.spawnPos) {
      const [x, , z] = config.spawnPos;
      const y = getTerrainHeight(x, z);
      groupRef.current.position.set(x, y, z);
      terrainY.current = y;
      lastPosition.current.set(x, y, z); // seed so frame-0 delta is zero
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
      wasMoving.current = true;
      stillTimer.current = 0;
      setIdle(false);
    },
    [actions, config.anims.walk, config.walkTimescale, config.runTimescale]
  );

  // Arrival
  const handleArrive = useCallback(() => {
    playIdle();
    aiWalking.current = false;
    lastAIDest.current = null;
    setActiveDest(null);
    // Immediately resume autonomous AI after arriving at user destination
    animalAI.clearOverride();
  }, [playIdle, animalAI]);

  const speed = isRunning ? config.runSpeed : config.walkSpeed;

  useAnimalMovement(groupRef, activeDest, {
    moveSpeed: speed,
    onArrive: handleArrive,
  });

  // User click → override AI and go to destination
  // We detect newness via destinationSerial (incremented on every click in App)
  useEffect(() => {
    if (!userDestination || !destinationSerial) return;
    if (destinationSerial === prevSerial.current) return;
    prevSerial.current = destinationSerial;

    // Cancel any forced behavior
    prevForcedBehavior.current = null;
    aiWalking.current = false;
    lastAIDest.current = null;
    animalAI.override();
    behaviorPhase.current = 0;

    // Clone destination so we own the reference
    const dest = userDestination.clone();
    setActiveDest(dest);
    playWalk(isRunning);
  }, [destinationSerial, userDestination, isRunning, playWalk, animalAI]);

  // Forced behavior from UI buttons
  useEffect(() => {
    if (!forcedBehavior || forcedBehavior === prevForcedBehavior.current) return;
    prevForcedBehavior.current = forcedBehavior;
    // Reset AI so it picks up the forced state immediately
    aiWalking.current = false;
    lastAIDest.current = null;
    setActiveDest(null);
  }, [forcedBehavior]);

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

    // Collision resolution — push out of trees and other animals
    resolveCollisions(pos, config.id, 0.8);

    // Update live position in collision registry
    registerAnimal(config.id, pos);

    onPositionUpdate?.(config.id, pos);

    // ── Detect real-world movement to stop legs when truly stationary ──
    // Only check for stillness when there's no active destination (animal is
    // truly supposed to be idle). When moving to a destination, trust the
    // walk animation and only return to idle on actual arrival.
    const movedDist = pos.distanceTo(lastPosition.current);
    lastPosition.current.copy(pos);

    if (activeDest === null) {
      // No destination — if we were moving before, check if we've stopped
      if (wasMoving.current) {
        if (movedDist < 0.005) {
          stillTimer.current += delta;
        } else {
          stillTimer.current = 0;
        }
        // Switch to idle anim after 0.3s of no movement while supposedly idle
        if (stillTimer.current > 0.3 && actionsReady.current) {
          wasMoving.current = false;
          stillTimer.current = 0;
          currentAnim.current = crossFadeToAnim(actions, currentAnim.current, config.anims.idle, 0.25);
          setIdle(true);
        }
      }
    } else {
      // Has a destination — reset still tracking; animation is managed by
      // playWalk/playIdle/handleArrive
      stillTimer.current = 0;
      if (movedDist > 0.005) wasMoving.current = true;
    }

    // AI + Stats — forcedBehavior only if no user destination active
    const hasUserDest = activeDest !== null;
    const ai = animalAI.update(delta, pos, null, hasUserDest ? null : forcedBehavior);
    const statsResult = animalStats.update(delta, ai.aiState);

    onStatsUpdate?.(config.id, statsResult);
    onBehaviorUpdate?.(config.id, ai.aiState);

    // AI autonomous movement — only when not under user/forced control
    if (!hasUserDest && ai.destination && !aiWalking.current) {
      if (ai.destination !== lastAIDest.current) {
        lastAIDest.current = ai.destination;
        aiWalking.current = true;
        setActiveDest(ai.destination.clone());
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

    // SLEEPING — sit on terrain, no floating
    if (doSleep) {
      const settleT = Math.min(1, phase / 2.5);
      const easeT = smoothstep(settleT);
      // Keep body ON the ground — never go below terrain
      pos.y = terrainY.current;
      applyNeckBend(neckBones.current, 0.4 * easeT);
      applyBoneRot(spineBone.current, 'x', Math.sin(phase * 0.8) * 0.025);
      applyBoneRot(tailBone.current, 'z', Math.sin(phase * 0.5) * 0.1 * easeT);
    }

    // IDLE look-around — use setBoneRot (absolute) not additive to avoid drift
    if (doIdle && phase > 2.0) {
      const lt = (phase % 6.0) / 6.0;
      // Set head rotation absolutely so it doesn't accumulate frame-over-frame
      if (headBone.current) {
        headBone.current.rotation.y = Math.sin(lt * Math.PI * 2) * 0.15;
      }
      if (tailBone.current) {
        tailBone.current.rotation.z = Math.sin(phase * 1.8) * 0.12;
      }
    } else if (doIdle) {
      // Reset head/tail when phase just started
      if (headBone.current) headBone.current.rotation.y = 0;
      if (tailBone.current) tailBone.current.rotation.z = 0;
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
