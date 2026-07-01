import * as THREE from 'three';

export const WORLD_SIZE = 120;
export const WORLD_HALF = WORLD_SIZE / 2 - 2;

export const POND_X = 0;
export const POND_Z = 5;
export const POND_RADIUS = 5.5;
export const POND_WATER_Y = 0.22;

export const STREAM_START_Z = POND_Z + POND_RADIUS;
// Let the stream reach the visible edge of the playable plain instead of
// stopping short in the meadow. WORLD_HALF is the same clamped boundary used
// for animals/camera-friendly world movement.
export const STREAM_END_Z = WORLD_HALF;

const POND_HUNT_ROCKS = [
  [0.00, 1.01, 1.8, 1.2, 1.5],
  [0.11, 1.04, 2.0, 1.4, 1.7],
  [0.22, 1.06, 1.6, 1.1, 1.4],
  [0.33, 1.03, 1.9, 1.3, 1.6],
  [0.44, 1.07, 2.2, 1.5, 1.9],
  [0.61, 1.05, 1.7, 1.15, 1.5],
  [0.72, 1.03, 1.5, 1.05, 1.35],
  [0.83, 1.06, 2.1, 1.4, 1.8],
  [0.94, 1.04, 1.6, 1.1, 1.4],
];

export function baseTerrainHeight(x, z) {
  const h1 = Math.sin(x * 0.04) * Math.cos(z * 0.052);
  const h2 = Math.sin(x * 0.084 + 1.7) * Math.cos(z * 0.068 + 0.5);
  const rollingGround = (h1 * 0.6 + h2 * 0.4) * 1.2;

  // A broad northwest hill: high enough to read clearly in the landscape,
  // but with a long natural slope that animals can traverse smoothly.
  const hillX = (x + 42) / 22;
  const hillZ = (z + 28) / 27;
  const hill = Math.exp(-(hillX * hillX + hillZ * hillZ)) * 8.5;

  return rollingGround + hill;
}

export function streamCenterX(z) {
  const t = THREE.MathUtils.clamp(
    (z - STREAM_START_Z) / (STREAM_END_Z - STREAM_START_Z),
    0,
    1
  );
  return Math.sin(t * Math.PI * 3.2) * 0.65;
}

export function streamHalfWidth(z) {
  const t = THREE.MathUtils.clamp(
    (z - STREAM_START_Z) / (STREAM_END_Z - STREAM_START_Z),
    0,
    1
  );
  return THREE.MathUtils.lerp(1.25, 0.6, t);
}

function smoothstep(t) {
  const v = THREE.MathUtils.clamp(t, 0, 1);
  return v * v * (3 - 2 * v);
}

export function getStreamWaterHeight(z) {
  const clampedZ = THREE.MathUtils.clamp(z, STREAM_START_Z, STREAM_END_Z);
  const t = THREE.MathUtils.clamp(
    (clampedZ - STREAM_START_Z) / 6,
    0,
    1
  );
  const localSurface = baseTerrainHeight(streamCenterX(clampedZ), clampedZ) - 0.16;
  return THREE.MathUtils.lerp(POND_WATER_Y - 0.18, localSurface, smoothstep(t));
}

/** Ground height shared by terrain, animals, vegetation, trees, and AI. */
export function getTerrainHeight(x, z) {
  let y = baseTerrainHeight(x, z);

  const pondDistance = Math.hypot(x - POND_X, z - POND_Z);
  if (pondDistance < POND_RADIUS) {
    const blend = smoothstep(pondDistance / POND_RADIUS);
    y = THREE.MathUtils.lerp(-1.6, y, blend);
  }

  const streamMouthStart = STREAM_START_Z - 0.65;
  if (z >= streamMouthStart && z <= STREAM_END_Z) {
    const clampedZ = THREE.MathUtils.clamp(z, STREAM_START_Z, STREAM_END_Z);
    const center = streamCenterX(clampedZ);
    const mouthBlend = smoothstep((z - streamMouthStart) / (STREAM_START_Z - streamMouthStart));
    const halfWidth = streamHalfWidth(clampedZ) + THREE.MathUtils.lerp(1.05, 0.62, mouthBlend);
    const distance = Math.abs(x - center);
    if (distance < halfWidth) {
      const blend = smoothstep(distance / halfWidth);
      const centerDepth = THREE.MathUtils.lerp(0.34, 0.2, blend);
      const bedY = getStreamWaterHeight(clampedZ) - centerDepth;
      y = Math.min(y, THREE.MathUtils.lerp(bedY, y, blend));
    }
  }

  return y;
}

export function isPondAt(x, z, margin = 0) {
  return Math.hypot(x - POND_X, z - POND_Z) < POND_RADIUS - 0.35 + margin;
}

export function isStreamAt(x, z, margin = 0) {
  if (z < STREAM_START_Z || z > STREAM_END_Z) return false;
  return Math.abs(x - streamCenterX(z)) < streamHalfWidth(z) + margin;
}

export function isWaterAt(x, z, margin = 0) {
  return isPondAt(x, z, margin) || isStreamAt(x, z, margin);
}

export function clampToWorld(point, padding = 1.5) {
  point.x = THREE.MathUtils.clamp(point.x, -WORLD_HALF + padding, WORLD_HALF - padding);
  point.z = THREE.MathUtils.clamp(point.z, -WORLD_HALF + padding, WORLD_HALF - padding);
  point.y = getTerrainHeight(point.x, point.z);
  return point;
}

/** Dry stream-bank destinations animals can safely reach to drink. */
export function createWaterApproachPoints() {
  const points = [];

  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const distance = POND_RADIUS + 0.42;
    const x = POND_X + Math.cos(angle) * distance;
    const z = POND_Z + Math.sin(angle) * distance;
    points.push(new THREE.Vector3(x, getTerrainHeight(x, z), z));
  }

  for (const z of [14, 22, 32, 44, 52, STREAM_END_Z - 0.9]) {
    const center = streamCenterX(z);
    const bank = streamHalfWidth(z) + 0.28;
    for (const side of [-1, 1]) {
      const x = center + side * bank;
      points.push(new THREE.Vector3(x, getTerrainHeight(x, z), z));
    }
  }
  return points;
}

export function isStreamBankPoint(point, margin = 0.9) {
  return point.z >= STREAM_START_Z - 0.25
    && point.z <= STREAM_END_Z + 0.25
    && Math.abs(point.x - streamCenterX(point.z)) < streamHalfWidth(point.z) + margin;
}

export function createPondRockHuntPoints() {
  return POND_HUNT_ROCKS.map(([fraction, radiusFactor]) => {
    const angle = fraction * Math.PI * 2;
    const distance = POND_RADIUS * radiusFactor;
    const x = POND_X + Math.cos(angle) * distance;
    const z = POND_Z + Math.sin(angle) * distance;
    return new THREE.Vector3(x, getTerrainHeight(x, z), z);
  });
}

export function getPondRockPerchOffset(x, z) {
  let lift = 0;
  for (const [fraction, radiusFactor, sx, sy, sz] of POND_HUNT_ROCKS) {
    const angle = fraction * Math.PI * 2;
    const cx = POND_X + Math.cos(angle) * POND_RADIUS * radiusFactor;
    const cz = POND_Z + Math.sin(angle) * POND_RADIUS * radiusFactor;
    const distance = Math.hypot(x - cx, z - cz);
    const radius = Math.max(sx, sz) * 0.5;
    if (distance > radius) continue;
    const t = 1 - distance / Math.max(0.001, radius);
    lift = Math.max(lift, (0.22 + sy * 0.32) * smoothstep(t));
  }
  return lift;
}

export function randomDryPoint(center, radius, attempts = 16) {
  for (let i = 0; i < attempts; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;
    const point = clampToWorld(
      new THREE.Vector3(
        center.x + Math.cos(angle) * distance,
        0,
        center.z + Math.sin(angle) * distance
      )
    );
    if (!isWaterAt(point.x, point.z, 0.5)) return point;
  }

  const fallback = clampToWorld(center.clone());
  if (isWaterAt(fallback.x, fallback.z, 0.5)) fallback.x += POND_RADIUS + 2;
  return clampToWorld(fallback);
}
