import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import useAnimalMovement from '../hooks/useAnimalMovement';
import useAnimalAI from '../hooks/useAnimalAI';
import useAnimalStats from '../hooks/useAnimalStats';
import { registerAnimal, unregisterAnimal, resolveCollisions } from '../utils/collisionRegistry';
import { WORLD_HALF, getTerrainHeight, isPondAt } from '../utils/world';

/* ========================================
   Constants
   ======================================== */
const GRAZE_NECK_ANGLE = 1.4;
const GRAZE_JAW_ANGLE = 0.2;
const DRINK_NECK_ANGLE = 1.6;
const SLEEP_BODY_LOWER = 0.32;
const FUR_TEXTURES = new Map();

function getFurDetailTexture(species) {
  if (FUR_TEXTURES.has(species)) return FUR_TEXTURES.get(species);
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#a8a8a8';
  context.fillRect(0, 0, 128, 128);

  let seed = [...species].reduce((sum, char) => sum + char.charCodeAt(0), 17);
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < 950; i++) {
    const shade = 80 + Math.floor(random() * 150);
    context.strokeStyle = `rgb(${shade}, ${shade}, ${shade})`;
    context.globalAlpha = 0.18 + random() * 0.34;
    context.lineWidth = 0.35 + random() * 0.75;
    const x = random() * 128;
    const y = random() * 128;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (random() - 0.5) * 2.5, y + 2 + random() * 6);
    context.stroke();
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 7);
  texture.anisotropy = 4;
  FUR_TEXTURES.set(species, texture);
  return texture;
}

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
  const furDetail = getFurDetailTexture(config.species || config.id);
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
      if (mat.normalScale) mat.normalScale.set(1.35, 1.35);
      if (furDetail) {
        if (!mat.bumpMap) mat.bumpMap = furDetail;
        mat.bumpScale = 0.022;
        if (!mat.roughnessMap) mat.roughnessMap = furDetail;
      }

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
          float n1 = fract(sin(dot(vWorldPos.xz * 160.0, vec2(12.9898, 78.233))) * 43758.5453);
          float fibers = pow(abs(sin(vWorldPos.y * 210.0 + n1 * 8.0)), 9.0);
          gl_FragColor.rgb *= 0.86 + n1 * 0.16 + fibers * 0.08;
          float ao = pow(max(dot(vWorldNormal, vec3(0.0, 1.0, 0.0)), 0.0), 0.5);
          gl_FragColor.rgb *= 0.7 + ao * 0.3;
          float backLight = pow(1.0 - abs(dot(viewDir, vWorldNormal)), 3.0);
          gl_FragColor.rgb += vec3(0.18, 0.11, 0.05) * backLight;
          #include <dithering_fragment>`
        );
      };
      mat.customProgramCacheKey = () => `wildlife-fur-${config.species || config.id}`;
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
  const presentationRef = useRef();
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
  const lastSafePosition = useRef(new THREE.Vector3());
  const verticalVelocity = useRef(0);
  const stillTimer = useRef(0);
  const wasMoving = useRef(false);

  // Bones
  const neckBones = useRef([]);
  const headBone = useRef(null);
  const jawBone = useRef(null);
  const tailBone = useRef(null);
  const spineBone = useRef(null);

  // AI + Stats
  const animalAI = useAnimalAI(config.diet, config.species || config.id, config.id);
  const animalStats = useAnimalStats(config.decayRates);
  const aiWalking = useRef(false);
  const lastAIDest = useRef(null);
  const movementSource = useRef(null);
  const movementSpeed = useRef(config.walkSpeed);
  const urgentNeed = useRef(null);
  const collisionRadius = config.collisionRadius || 0.8;
  const footSink = (config.species || config.id) === 'rabbit' ? 0.018 : 0.04;

  // User command tracking — use a serial number so every new click fires
  const prevSerial = useRef(0);
  const prevForcedBehavior = useRef(null);

  // Register / unregister in collision system
  useEffect(() => {
    // We'll update the position ref live in useFrame; just register with a dummy for now
    const posRef = { x: 0, y: 0, z: 0 };
    registerAnimal(config.id, posRef, collisionRadius);
    return () => unregisterAnimal(config.id);
  }, [collisionRadius, config.id]);

  // Set initial position
  useEffect(() => {
    if (groupRef.current && config.spawnPos) {
      const [x, , z] = config.spawnPos;
      const y = getTerrainHeight(x, z) - footSink;
      groupRef.current.position.set(x, y, z);
      terrainY.current = y;
      lastPosition.current.set(x, y, z); // seed so frame-0 delta is zero
      lastSafePosition.current.set(x, y, z);
    }
  }, [config.spawnPos, footSink]);

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
    if (movementSource.current === 'user') animalAI.clearOverride();
    else animalAI.arrive();
    movementSource.current = null;
  }, [playIdle, animalAI]);

  useAnimalMovement(groupRef, activeDest, {
    moveSpeed: () => movementSpeed.current,
    collisionRadius,
    selfId: config.id,
    onArrive: handleArrive,
  });

  // User click → override AI and go to destination
  // We detect newness via destinationSerial (incremented on every click in App)
  useEffect(() => {
    if (!userDestination || !destinationSerial) return;
    if (destinationSerial === prevSerial.current) return;
    prevSerial.current = destinationSerial;

    const dest = userDestination.clone();
    dest.x = THREE.MathUtils.clamp(dest.x, -WORLD_HALF, WORLD_HALF);
    dest.z = THREE.MathUtils.clamp(dest.z, -WORLD_HALF, WORLD_HALF);
    if (isPondAt(dest.x, dest.z, 0.4)) return;
    dest.y = getTerrainHeight(dest.x, dest.z);

    // Cancel any forced behavior
    prevForcedBehavior.current = null;
    aiWalking.current = false;
    lastAIDest.current = null;
    animalAI.override();
    behaviorPhase.current = 0;

    movementSource.current = 'user';
    movementSpeed.current = isRunning ? config.runSpeed : config.walkSpeed;
    setActiveDest(dest);
    playWalk(isRunning);
  }, [
    destinationSerial,
    userDestination,
    isRunning,
    playWalk,
    animalAI,
    config.runSpeed,
    config.walkSpeed,
  ]);

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

    // The deep pond stays blocked; the shallow stream is intentionally passable.
    if (isPondAt(pos.x, pos.z, 0.15)) {
      pos.x = lastSafePosition.current.x;
      pos.z = lastSafePosition.current.z;
    }

    // Hard collisions apply only to trunks, large rocks, and other animals.
    resolveCollisions(pos, config.id, collisionRadius);
    pos.x = THREE.MathUtils.clamp(pos.x, -WORLD_HALF, WORLD_HALF);
    pos.z = THREE.MathUtils.clamp(pos.z, -WORLD_HALF, WORLD_HALF);

    if (isPondAt(pos.x, pos.z, 0.15)) {
      pos.x = lastSafePosition.current.x;
      pos.z = lastSafePosition.current.z;
    }

    const targetY = getTerrainHeight(pos.x, pos.z) - footSink;
    if (pos.y > targetY + 0.005) {
      verticalVelocity.current -= 20 * delta;
      pos.y = Math.max(targetY, pos.y + verticalVelocity.current * delta);
    } else {
      pos.y = targetY;
      verticalVelocity.current = 0;
    }
    terrainY.current = targetY;
    lastSafePosition.current.copy(pos);

    // Update live position in collision registry
    registerAnimal(config.id, pos, collisionRadius);

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
    const hasActiveMovement = activeDest !== null;
    const hasUserMovement = hasActiveMovement && movementSource.current === 'user';
    const ai = animalAI.update(
      delta,
      pos,
      urgentNeed.current,
      hasUserMovement ? null : forcedBehavior
    );
    const restorativeBehavior = ai.isPerforming ? ai.aiState : 'Idle';
    const statsResult = animalStats.update(delta, restorativeBehavior);
    urgentNeed.current = statsResult.urgentNeed;

    onStatsUpdate?.(config.id, statsResult);
    onBehaviorUpdate?.(config.id, ai.aiState);

    // AI autonomous movement — only when not under user/forced control
    if (!hasActiveMovement && ai.destination && !aiWalking.current) {
      if (ai.destination !== lastAIDest.current) {
        lastAIDest.current = ai.destination;
        aiWalking.current = true;
        movementSource.current = 'ai';
        movementSpeed.current = ai.shouldRun ? config.runSpeed : config.walkSpeed;
        setActiveDest(ai.destination.clone());
        playWalk(ai.shouldRun);
      }
    }

    // Procedural behaviors
    const doGraze = (ai.shouldGraze || ai.shouldHunt) && !hasActiveMovement;
    const doDrink = ai.shouldDrink && !hasActiveMovement;
    const doSleep = ai.shouldSleep && !hasActiveMovement;
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

    // Lower and softly lean the visible model while sleeping. The root stays
    // terrain-locked, so waking never causes hovering or sinking.
    if (presentationRef.current) {
      const targetLower = doSleep ? -SLEEP_BODY_LOWER : 0;
      const targetLean = doSleep ? 0.12 : 0;
      const poseFactor = 1 - Math.exp(-2.4 * delta);
      presentationRef.current.position.y = THREE.MathUtils.lerp(
        presentationRef.current.position.y,
        targetLower,
        poseFactor
      );
      presentationRef.current.rotation.z = THREE.MathUtils.lerp(
        presentationRef.current.rotation.z,
        targetLean,
        poseFactor
      );
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
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
          <ringGeometry args={[1.05, 1.22, 40]} />
          <meshBasicMaterial color="#b9ff93" transparent opacity={0.72} depthWrite={false} />
        </mesh>
      )}
      <group ref={presentationRef}>
        <primitive object={clonedScene} scale={config.scale} />
      </group>
    </group>
  );
}
