import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import useAnimalMovement from '../hooks/useAnimalMovement';
import useAnimalAI from '../hooks/useAnimalAI';
import useAnimalStats from '../hooks/useAnimalStats';
import { registerAnimal, unregisterAnimal, resolveCollisions } from '../utils/collisionRegistry';
import { WORLD_HALF, getPondRockPerchOffset, getTerrainHeight, isPondAt, isStreamAt } from '../utils/world';

/* ========================================
   Constants
   ======================================== */
const GRAZE_NECK_ANGLE = 1.4;
const GRAZE_JAW_ANGLE = 0.2;
const DRINK_NECK_ANGLE = 1.6;
const RABBIT_STREAM_LEAP_HEIGHT = 0.72;
const FUR_TEXTURES = new Map();
const FACIAL_MATERIALS = new Map();
const ANIMATION_KEY_CACHE = new WeakMap();
const _boneEuler = new THREE.Euler();
const _boneQuat = new THREE.Quaternion();
const _commandLook = new THREE.Vector3();
const _kidFriendlyLight = new THREE.Color('#fff0c8');

const FUR_PROFILES = {
  moose: {
    base: '#8b6540',
    highlight: '#d0ad78',
    shadow: '#3e2b1e',
    guard: '#1f1712',
    repeat: [4, 8],
    bump: 0.018,
    roughness: 0.92,
    fiberStrength: 0.12,
  },
  deer: {
    base: '#a86c38',
    highlight: '#d8b172',
    shadow: '#4b2e1a',
    guard: '#2b1d12',
    repeat: [5, 7],
    bump: 0.016,
    roughness: 0.9,
    fiberStrength: 0.1,
  },
  bear: {
    base: '#3a2517',
    highlight: '#6f4b2f',
    shadow: '#120d0a',
    guard: '#0b0806',
    repeat: [6, 9],
    bump: 0.03,
    roughness: 0.96,
    fiberStrength: 0.18,
  },
  fox: {
    base: '#b64f1d',
    highlight: '#e18a43',
    shadow: '#432316',
    guard: '#21100a',
    repeat: [5, 8],
    bump: 0.02,
    roughness: 0.9,
    fiberStrength: 0.14,
  },
  rabbit: {
    base: '#8f7964',
    highlight: '#c4b29c',
    shadow: '#4f4035',
    guard: '#2c241f',
    repeat: [7, 6],
    bump: 0.018,
    roughness: 0.94,
    fiberStrength: 0.13,
  },
};

const FACE_PROFILES = {
  moose: {
    eye: { offset: [0.16, 0.08, 0.34], size: 0.035 },
    nose: { offset: [0, -0.1, 0.62], scale: [0.16, 0.07, 0.09] },
    muzzle: { offset: [0, -0.13, 0.46], scale: [0.2, 0.08, 0.12], color: '#6d5139' },
  },
  deer: {
    eye: { offset: [0.12, 0.07, 0.28], size: 0.026 },
    nose: { offset: [0, -0.08, 0.48], scale: [0.1, 0.045, 0.06] },
    muzzle: { offset: [0, -0.1, 0.36], scale: [0.14, 0.06, 0.09], color: '#d8c19d' },
  },
  bear: {
    eye: { offset: [0.11, 0.08, 0.22], size: 0.03 },
    nose: { offset: [0, -0.04, 0.42], scale: [0.16, 0.08, 0.1] },
    muzzle: { offset: [0, -0.08, 0.31], scale: [0.2, 0.09, 0.12], color: '#7a5738' },
  },
  fox: {
    eye: { offset: [0.08, 0.05, 0.2], size: 0.02 },
    nose: { offset: [0, -0.035, 0.38], scale: [0.065, 0.035, 0.045] },
    muzzle: { offset: [0, -0.06, 0.26], scale: [0.11, 0.045, 0.07], color: '#ecd8b5' },
  },
  rabbit: {
    eye: { offset: [0.065, 0.055, 0.13], size: 0.018 },
    nose: { offset: [0, -0.03, 0.27], scale: [0.045, 0.025, 0.035], color: '#2d1d1f' },
    muzzle: { offset: [0, -0.045, 0.2], scale: [0.075, 0.035, 0.05], color: '#d9cabc' },
  },
};

function getProfile(species, override = null) {
  return {
    ...(FUR_PROFILES[species] || FUR_PROFILES.deer),
    ...(override || {}),
  };
}

function getFurDetailTexture(textureKey, species, override = null) {
  if (FUR_TEXTURES.has(textureKey)) return FUR_TEXTURES.get(textureKey);
  if (typeof document === 'undefined') return null;
  const profile = getProfile(species, override);
  const base = new THREE.Color(profile.base);
  const highlight = new THREE.Color(profile.highlight);
  const shadow = new THREE.Color(profile.shadow);
  const guard = new THREE.Color(profile.guard);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = profile.base;
  context.fillRect(0, 0, 256, 256);

  let seed = [...species].reduce((sum, char) => sum + char.charCodeAt(0), 17);
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let y = 0; y < 256; y += 2) {
    const mixColor = base.clone().lerp(random() > 0.52 ? highlight : shadow, 0.08 + random() * 0.14);
    context.globalAlpha = 0.16;
    context.strokeStyle = `#${mixColor.getHexString()}`;
    context.beginPath();
    context.moveTo(0, y + random() * 2);
    context.lineTo(256, y + random() * 2);
    context.stroke();
  }

  for (let i = 0; i < 2200; i++) {
    const color = random() > 0.62 ? highlight : random() > 0.2 ? shadow : guard;
    context.strokeStyle = `#${color.getHexString()}`;
    context.globalAlpha = 0.12 + random() * 0.35;
    context.lineWidth = 0.25 + random() * 0.9;
    const x = random() * 256;
    const y = random() * 256;
    const length = 5 + random() * (species === 'bear' ? 16 : 10);
    const curl = (random() - 0.5) * 6;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + curl * 0.5, y + length * 0.55, x + curl, y + length);
    context.stroke();
  }

  if (species === 'fox') {
    context.globalAlpha = 0.34;
    const belly = context.createLinearGradient(0, 120, 0, 256);
    belly.addColorStop(0, 'rgba(255,245,220,0)');
    belly.addColorStop(1, 'rgba(255,235,199,0.55)');
    context.fillStyle = belly;
    context.fillRect(0, 0, 256, 256);
  }

  if (species === 'deer' || species === 'moose') {
    context.globalAlpha = profile.patchAlpha ?? (species === 'deer' ? 0.16 : 0.08);
    context.fillStyle = profile.patch || '#f1d9ad';
    for (let i = 0; i < (profile.patchCount ?? (species === 'deer' ? 52 : 24)); i++) {
      const x = random() * 256;
      const y = random() * 190;
      context.beginPath();
      context.ellipse(x, y, 1.8 + random() * 2.7, 1 + random() * 1.6, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }

    if (profile.belly) {
      context.globalAlpha = 0.24;
      const belly = context.createLinearGradient(0, 128, 0, 256);
      belly.addColorStop(0, 'rgba(255,255,255,0)');
      belly.addColorStop(1, profile.belly);
      context.fillStyle = belly;
      context.fillRect(0, 0, 256, 256);
    }
  }

  if (species === 'rabbit') {
    context.globalAlpha = profile.patchAlpha ?? 0.18;
    context.fillStyle = profile.patch || profile.highlight;
    const patchCount = profile.patchCount ?? 18;
    for (let i = 0; i < patchCount; i++) {
      const x = random() * 256;
      const y = random() * 230;
      const sx = 5 + random() * 18;
      const sy = 3 + random() * 14;
      context.beginPath();
      context.ellipse(x, y, sx, sy, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = profile.bellyAlpha ?? 0.22;
    const belly = context.createLinearGradient(0, 120, 0, 256);
    belly.addColorStop(0, 'rgba(255,255,255,0)');
    belly.addColorStop(1, profile.belly || 'rgba(235,225,210,0.42)');
    context.fillStyle = belly;
    context.fillRect(0, 0, 256, 256);
  }

  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(profile.repeat[0], profile.repeat[1]);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  FUR_TEXTURES.set(textureKey, texture);
  return texture;
}

function getFaceMaterial(kind, color = '#080605') {
  const key = `${kind}-${color}`;
  if (FACIAL_MATERIALS.has(key)) return FACIAL_MATERIALS.get(key);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: kind === 'eye' ? 0.32 : 0.7,
    metalness: 0,
    envMapIntensity: kind === 'eye' ? 0.7 : 0.18,
  });
  FACIAL_MATERIALS.set(key, material);
  return material;
}

function createFacialAccents(species) {
  const profile = FACE_PROFILES[species];
  if (!profile) return [];
  const accents = [];
  const eyeGeometry = new THREE.SphereGeometry(profile.eye.size, 10, 8);
  const eyeMaterial = getFaceMaterial('eye');
  const glossMaterial = getFaceMaterial('eye-gloss', '#f7f1df');
  const noseMaterial = getFaceMaterial('nose', profile.nose.color || '#080605');
  const muzzleMaterial = getFaceMaterial('muzzle', profile.muzzle.color);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.name = `wildlife-${species}-eye-${side}`;
    eye.position.set(profile.eye.offset[0] * side, profile.eye.offset[1], profile.eye.offset[2]);
    eye.castShadow = false;
    accents.push(eye);

    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(profile.eye.size * 0.28, 8, 6),
      glossMaterial
    );
    glint.name = `wildlife-${species}-eye-glint-${side}`;
    glint.position.set(
      profile.eye.offset[0] * side - profile.eye.size * 0.2 * side,
      profile.eye.offset[1] + profile.eye.size * 0.28,
      profile.eye.offset[2] + profile.eye.size * 0.55
    );
    glint.castShadow = false;
    accents.push(glint);
  }

  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), muzzleMaterial);
  muzzle.name = `wildlife-${species}-muzzle`;
  muzzle.position.set(...profile.muzzle.offset);
  muzzle.scale.set(...profile.muzzle.scale);
  muzzle.castShadow = false;
  muzzle.receiveShadow = true;
  accents.push(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), noseMaterial);
  nose.name = `wildlife-${species}-nose`;
  nose.position.set(...profile.nose.offset);
  nose.scale.set(...profile.nose.scale);
  nose.castShadow = false;
  accents.push(nose);

  return accents;
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

/* ========================================
   Material enhancement — fur tint + shader
   ======================================== */
function enhanceMaterials(root, config) {
  const species = config.species || config.id;
  const textureKey = config.furProfile ? `${species}-${config.id}` : species;
  const profile = getProfile(species, config.furProfile);
  const furDetail = getFurDetailTexture(textureKey, species, config.furProfile);
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;

    if (!child.userData.wildTrailsMaterialClone) {
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material?.clone?.() || material)
        : child.material?.clone?.() || child.material;
      child.userData.wildTrailsMaterialClone = true;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!mat) continue;

      if (config.bodyMaterials.includes(mat.name)) {
        mat.color
          .set(config.furTint || profile.base)
          .lerp(_kidFriendlyLight, profile.brightnessBoost ?? 0.16);
        mat.roughness = profile.roughness;
        mat.metalness = 0.0;
        mat.envMapIntensity = 0.32;
        if (mat.normalScale) mat.normalScale.set(1.45, 1.45);
        if (furDetail) {
          mat.map = furDetail;
          mat.bumpMap = furDetail;
          mat.bumpScale = profile.bump;
          mat.roughnessMap = furDetail;
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
            rim = pow(rim, 2.2) * 0.42;
            gl_FragColor.rgb += vec3(0.38, 0.28, 0.16) * rim;
            float strandNoise = fract(sin(dot(vWorldPos.xz * 170.0, vec2(12.9898, 78.233))) * 43758.5453);
            float fiberMask = pow(abs(sin(vWorldPos.y * 230.0 + strandNoise * 9.0)), 9.0);
            gl_FragColor.rgb *= 0.82 + strandNoise * 0.18 + fiberMask * ${profile.fiberStrength.toFixed(3)};
            float topLight = pow(max(dot(vWorldNormal, vec3(0.0, 1.0, 0.0)), 0.0), 0.55);
            float underside = 1.0 - topLight;
            gl_FragColor.rgb *= 0.76 + topLight * 0.38;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.72, 0.66, 0.58), underside * 0.12);
            float backLight = pow(1.0 - abs(dot(viewDir, vWorldNormal)), 3.0);
            gl_FragColor.rgb += vec3(0.22, 0.16, 0.08) * backLight;
            #include <dithering_fragment>`
          );
        };
        mat.customProgramCacheKey = () => `wildlife-fur-${textureKey}`;
        mat.needsUpdate = true;
      }

      if (config.antlerMaterials.includes(mat.name)) {
        mat.color.set(species === 'deer' ? '#9b8060' : '#80694d');
        mat.roughness = 0.88;
        mat.metalness = 0.02;
        mat.envMapIntensity = 0.12;
        mat.needsUpdate = true;
      }
    }
  });
}

/* ========================================
   Animation resolver — fuzzy match clip names
   ======================================== */
function resolveAnimKey(actions, key) {
  if (!actions || !key) return null;
  let cache = ANIMATION_KEY_CACHE.get(actions);
  if (!cache) {
    cache = new Map();
    ANIMATION_KEY_CACHE.set(actions, cache);
  }
  if (cache.has(key)) return cache.get(key);
  if (actions[key]) {
    cache.set(key, key);
    return key;
  }
  const keys = Object.keys(actions);
  for (const k of keys) {
    if (k.toLowerCase().includes(key.toLowerCase())) {
      cache.set(key, k);
      return k;
    }
  }
  cache.set(key, null);
  return null;
}

function crossFadeToAnim(actions, currentAction, targetKey, fadeDuration = 0.3, timeScale = 1.0) {
  const resolved = resolveAnimKey(actions, targetKey);
  if (!resolved) return currentAction;

  const action = actions[resolved];
  if (!action) return currentAction;
  const alreadyActive =
    currentAction === action &&
    action.isRunning?.() &&
    Math.abs((action.timeScale || 1) - timeScale) < 0.001;

  if (alreadyActive) return action;

  action.setLoop(THREE.LoopRepeat);
  action.timeScale = timeScale;

  if (currentAction && currentAction !== action) {
    if (!action.isRunning?.()) action.reset();
    action.crossFadeFrom(currentAction, fadeDuration, true);
  } else if (!action.isRunning?.()) {
    action.reset();
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
  onReady,
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
  const leapPhase = useRef(0);
  const leapOffset = useRef(0);
  const lastPosition = useRef(new THREE.Vector3());
  const lastSafePosition = useRef(new THREE.Vector3());
  const verticalVelocity = useRef(0);
  const stillTimer = useRef(0);
  const wasMoving = useRef(false);
  const entranceProgress = useRef(0);
  const readySent = useRef(false);

  // Bones
  const neckBones = useRef([]);
  const headBone = useRef(null);
  const jawBone = useRef(null);
  const tailBone = useRef(null);
  const spineBone = useRef(null);
  const boneBaseQuats = useRef(new Map());
  const facialAccents = useRef([]);

  // AI + Stats
  const animalAI = useAnimalAI(config.diet, config.species || config.id, config.id);
  const animalStats = useAnimalStats(config.decayRates);
  const aiWalking = useRef(false);
  const lastAIDest = useRef(null);
  const movementSource = useRef(null);
  const movementSpeed = useRef(config.walkSpeed);
  const urgentNeed = useRef(null);
  const userStartTimer = useRef(null);
  const commandLookTarget = useRef(null);
  const collisionRadius = config.collisionRadius || 0.8;
  const species = config.species || config.id;
  const isRabbit = species === 'rabbit';
  const isSmallAnimal = species === 'rabbit' || species === 'fox';
  const footSink = isRabbit ? 0.018 : 0.04;

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
    boneBaseQuats.current.clear();
    clonedScene.traverse((child) => {
      if (child.isBone) boneBaseQuats.current.set(child.uuid, child.quaternion.clone());
    });
  }, [clonedScene, config.bones]);

  useEffect(() => {
    const head = headBone.current;
    if (!head) return undefined;
    facialAccents.current.forEach((accent) => accent.removeFromParent());
    facialAccents.current = createFacialAccents(config.species || config.id);
    facialAccents.current.forEach((accent) => head.add(accent));
    return () => {
      facialAccents.current.forEach((accent) => {
        accent.geometry?.dispose?.();
        accent.removeFromParent();
      });
      facialAccents.current = [];
    };
  }, [clonedScene, config.id, config.species]);

  const setBoneRot = useCallback((bone, axis, angle) => {
    if (!bone) return;
    const base = boneBaseQuats.current.get(bone.uuid);
    if (!base) return;
    _boneEuler.set(0, 0, 0);
    _boneEuler[axis] = angle;
    _boneQuat.setFromEuler(_boneEuler);
    bone.quaternion.copy(base).multiply(_boneQuat);
  }, []);

  const setNeckBend = useCallback((angle, multiplier = 1) => {
    const bones = neckBones.current;
    const count = bones.length;
    if (count === 0) return;
    const share = multiplier / count;
    for (const bone of bones) setBoneRot(bone, 'x', angle * share);
  }, [setBoneRot]);

  // Wait for actions + start idle
  useEffect(() => {
    const check = setInterval(() => {
      const idleKey = resolveAnimKey(actions, config.anims.idle);
      if (idleKey) {
        clearInterval(check);
        actionsReady.current = true;
        currentAnim.current = crossFadeToAnim(actions, null, config.anims.idle);
        setIdle(true);
        if (!readySent.current) {
          readySent.current = true;
          onReady?.(config.id);
        }
      }
    }, 100);
    return () => clearInterval(check);
  }, [actions, config.anims.idle, config.id, onReady]);

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

  const handleStuck = useCallback(() => {
    playIdle();
    aiWalking.current = false;
    lastAIDest.current = null;
    setActiveDest(null);
    if (movementSource.current === 'user') {
      animalAI.clearOverride();
    } else {
      animalAI.repick?.();
    }
    movementSource.current = null;
  }, [animalAI, playIdle]);

  const { climbingRef, climbIntensity } = useAnimalMovement(groupRef, activeDest, {
    moveSpeed: () => movementSpeed.current,
    collisionRadius,
    streamSpeedMultiplier: isSmallAnimal ? 1.05 : 0.72,
    climbHeight: config.climbHeight || 0.3,
    selfId: config.id,
    onArrive: handleArrive,
    onStuck: handleStuck,
  });

  // User click → override AI and go to destination
  // We detect newness via destinationSerial (incremented on every click in App)
  useEffect(() => {
    if (!userDestination || !destinationSerial) return;
    if (destinationSerial === prevSerial.current) return;
    prevSerial.current = destinationSerial;
    if (userStartTimer.current) clearTimeout(userStartTimer.current);

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
    commandLookTarget.current = dest.clone();
    setActiveDest(null);
    playIdle();
    userStartTimer.current = setTimeout(() => {
      commandLookTarget.current = null;
      setActiveDest(dest);
      playWalk(isRunning);
      userStartTimer.current = null;
    }, 420);
  }, [
    destinationSerial,
    userDestination,
    isRunning,
    playIdle,
    playWalk,
    animalAI,
    config.runSpeed,
    config.walkSpeed,
  ]);

  useEffect(() => () => {
    if (userStartTimer.current) clearTimeout(userStartTimer.current);
    commandLookTarget.current = null;
  }, []);

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

    if (entranceProgress.current < 1 && presentationRef.current) {
      entranceProgress.current = Math.min(1, entranceProgress.current + delta * 1.8);
      const eased = 1 - Math.pow(1 - entranceProgress.current, 3);
      const scale = THREE.MathUtils.lerp(0.86, 1, eased);
      presentationRef.current.scale.setScalar(scale);
    }

    if (commandLookTarget.current && headBone.current) {
      _commandLook.copy(commandLookTarget.current).sub(pos).setY(0);
      if (_commandLook.lengthSq() > 0.01) {
        _commandLook.normalize();
        const yaw = Math.atan2(_commandLook.x, _commandLook.z) - groupRef.current.rotation.y;
        setBoneRot(headBone.current, 'y', THREE.MathUtils.clamp(yaw * 0.22, -0.32, 0.32));
      }
    }

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

    const targetY = getTerrainHeight(pos.x, pos.z) - footSink + getPondRockPerchOffset(pos.x, pos.z);
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
    const doIdle = !commandLookTarget.current && !doGraze && !doDrink && !doSleep && idle;
    const doStreamLeap = isSmallAnimal && hasActiveMovement && isStreamAt(pos.x, pos.z, 0.9);

    if (doStreamLeap) {
      leapPhase.current += delta * 5.4;
      const hop = Math.max(0, Math.sin(leapPhase.current));
      leapOffset.current = THREE.MathUtils.lerp(
        leapOffset.current,
        hop * RABBIT_STREAM_LEAP_HEIGHT,
        1 - Math.exp(-14 * delta)
      );
    } else {
      leapPhase.current = 0;
      leapOffset.current = THREE.MathUtils.lerp(
        leapOffset.current,
        0,
        1 - Math.exp(-9 * delta)
      );
    }

    if (doGraze || doDrink || doSleep || doIdle) {
      behaviorPhase.current += delta;
    } else {
      behaviorPhase.current = 0;
    }

    const phase = behaviorPhase.current;

    // GRAZING — head all the way down
    if (doGraze) {
      const species = config.species || config.id;
      const huntPose = ai.shouldHunt;
      const neckMultiplier = huntPose
        ? species === 'bear' ? 0.34 : species === 'fox' ? 0.28 : 0.45
        : 1;
      const cycle = 5.0;
      const t = (phase % cycle) / cycle;
      let neckAngle = 0;
      let jawAngle = 0;

      if (t < 0.2) {
        neckAngle = GRAZE_NECK_ANGLE * smoothstep(t / 0.2);
      } else if (t < 0.75) {
        neckAngle = GRAZE_NECK_ANGLE;
        const chewT = (t - 0.2) / 0.55;
        neckAngle += Math.sin(chewT * Math.PI * 8) * (huntPose ? 0.015 : 0.04);
        jawAngle = GRAZE_JAW_ANGLE * (0.5 + 0.5 * Math.sin(chewT * Math.PI * 10));
      } else {
        neckAngle = GRAZE_NECK_ANGLE * (1.0 - smoothstep((t - 0.75) / 0.25));
      }

      setNeckBend(neckAngle, neckMultiplier);
      setBoneRot(headBone.current, 'x', neckAngle * 0.12 * neckMultiplier);
      setBoneRot(jawBone.current, 'x', jawAngle * (huntPose ? 0.35 : 1));
      setBoneRot(tailBone.current, 'z', Math.sin(phase * 2.5) * 0.08);
    }

    // DRINKING
    if (doDrink) {
      const species = config.species || config.id;
      const drinkProfile = {
        bear: { neck: 0.48, head: 0.08, jaw: 0.025, bob: 0.006 },
        fox: { neck: 0.34, head: 0.05, jaw: 0.018, bob: 0.004 },
        rabbit: { neck: 0.42, head: 0.06, jaw: 0.018, bob: 0.004 },
        deer: { neck: 0.72, head: 0.12, jaw: 0.045, bob: 0.012 },
        moose: { neck: 0.78, head: 0.14, jaw: 0.05, bob: 0.012 },
      }[species] || { neck: 0.55, head: 0.09, jaw: 0.03, bob: 0.008 };
      const cycle = 4.0;
      const t = (phase % cycle) / cycle;
      let neckAngle = 0;
      let jawAngle = 0;

      if (t < 0.15) {
        neckAngle = DRINK_NECK_ANGLE * smoothstep(t / 0.15);
      } else if (t < 0.8) {
        neckAngle = DRINK_NECK_ANGLE;
        const drinkT = (t - 0.15) / 0.65;
        jawAngle = drinkProfile.jaw * Math.sin(drinkT * Math.PI * 8);
        neckAngle += Math.sin(drinkT * Math.PI * 4) * drinkProfile.bob;
      } else {
        neckAngle = DRINK_NECK_ANGLE * (1.0 - smoothstep((t - 0.8) / 0.2));
      }

      setNeckBend(neckAngle, drinkProfile.neck);
      setBoneRot(headBone.current, 'x', neckAngle * drinkProfile.head);
      setBoneRot(jawBone.current, 'x', jawAngle);
    }

    // SLEEPING — keep the root and visible body above terrain.
    if (doSleep) {
      const settleT = Math.min(1, phase / 2.5);
      const easeT = smoothstep(settleT);
      pos.y = terrainY.current;
      setNeckBend(0.4 * easeT, 0.7);
      setBoneRot(spineBone.current, 'x', Math.sin(phase * 0.8) * 0.018);
      setBoneRot(tailBone.current, 'z', Math.sin(phase * 0.5) * 0.08 * easeT);
    }

    // Lower and softly lean the visible model while sleeping or climbing.
    // The root stays terrain-locked, so waking/stopping never causes hovering.
    if (presentationRef.current) {
      const restLift = doSleep ? (isRabbit ? 0.045 : 0.075) : 0;
      const targetLower = restLift;
      const targetY = targetLower + leapOffset.current;

      // Climbing tilt: lean forward slightly when stepping over rocks
      const climbTilt = (climbIntensity?.current || 0) * 0.1; // forward lean
      const targetLean = doSleep ? 0.12 : doStreamLeap ? -0.16 : 0;
      const poseFactor = 1 - Math.exp(-2.4 * delta);
      presentationRef.current.position.y = THREE.MathUtils.lerp(
        presentationRef.current.position.y,
        targetY,
        poseFactor
      );
      presentationRef.current.rotation.z = THREE.MathUtils.lerp(
        presentationRef.current.rotation.z,
        targetLean,
        poseFactor
      );
      // Apply forward tilt on X axis during climbing
      presentationRef.current.rotation.x = THREE.MathUtils.lerp(
        presentationRef.current.rotation.x || 0,
        climbTilt,
        poseFactor
      );
    }

    // Head compensates for climb tilt — keeps head more level
    if (headBone.current && !doGraze && !doDrink && !doSleep) {
      const compensate = -(climbIntensity?.current || 0) * 0.08;
      if (Math.abs(compensate) > 0.001) {
        headBone.current.rotation.x += compensate;
      }
    }

    // IDLE look-around — use setBoneRot (absolute) not additive to avoid drift
    if (doIdle && phase > 2.0) {
      const lt = (phase % 6.0) / 6.0;
      // Set head rotation absolutely so it doesn't accumulate frame-over-frame
      if (headBone.current) {
        setBoneRot(headBone.current, 'y', Math.sin(lt * Math.PI * 2) * 0.15);
      }
      if (tailBone.current) {
        setBoneRot(tailBone.current, 'z', Math.sin(phase * 1.8) * 0.08);
      }
    } else if (doIdle) {
      // Reset head/tail when phase just started
      setBoneRot(headBone.current, 'y', 0);
      setBoneRot(tailBone.current, 'z', 0);
    }
  });

  // Selection ring scale based on animal size
  const ringScale = species === 'rabbit' ? 0.6
                  : species === 'fox'    ? 0.8
                  : species === 'deer'   ? 0.95
                  : species === 'bear'   ? 1.2
                  : 1.0;

  return (
    <group
      ref={groupRef}
      dispose={null}
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* ── Selection Ring — animated rotating ring with glow ── */}
      {isSelected && (
        <SelectionRing ringScale={ringScale} />
      )}
      <group ref={presentationRef}>
        <primitive object={clonedScene} scale={config.scale} />
      </group>
    </group>
  );
}

/* ── Animated Selection Ring ── */
function SelectionRing({ ringScale = 1 }) {
  const ringRef = useRef();
  const glowRef = useRef();
  const pulseRef = useRef(0);

  useFrame((_, delta) => {
    if (ringRef.current) {
      // Slow rotation
      ringRef.current.rotation.z += delta * 0.5;
      // Gentle pulse
      pulseRef.current += delta * 2.5;
      const pulse = 1 + Math.sin(pulseRef.current) * 0.04;
      ringRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current) {
      // Breathe opacity
      const breathe = 0.2 + Math.sin(pulseRef.current * 0.8) * 0.1;
      glowRef.current.material.opacity = breathe;
    }
  });

  const inner = 1.05 * ringScale;
  const outer = 1.2 * ringScale;
  const glowOuter = 1.6 * ringScale;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
      {/* Outer glow disc */}
      <mesh ref={glowRef}>
        <ringGeometry args={[inner * 0.5, glowOuter, 48]} />
        <meshBasicMaterial
          color="#4ADE80"
          transparent
          opacity={0.15}
          depthWrite={false}
          side={2}
        />
      </mesh>
      {/* Main ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[inner, outer, 48]} />
        <meshBasicMaterial
          color="#4ADE80"
          transparent
          opacity={0.65}
          depthWrite={false}
          side={2}
        />
      </mesh>
    </group>
  );
}
