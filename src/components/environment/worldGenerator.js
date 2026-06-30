import { WORLD_HALF, getTerrainHeight, isWaterAt } from '../../utils/world';

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRandom(seed) {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function querySeed() {
  if (typeof window === 'undefined') return 'wild-trails-server';
  const requested = new URLSearchParams(window.location.search).get('seed');
  return requested || `wild-trails-${Date.now()}-${Math.random()}`;
}

export const WORLD_SEED = querySeed();

function gaussian(random) {
  const u = Math.max(0.0001, random());
  const v = Math.max(0.0001, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function dryPlacement(x, z, waterMargin = 2) {
  return (
    Math.abs(x) < WORLD_HALF - 1 &&
    Math.abs(z) < WORLD_HALF - 1 &&
    !isWaterAt(x, z, waterMargin)
  );
}

export function generateForest(seed, treeAssets, rockAssets) {
  const random = createRandom(`${seed}:forest`);
  const trees = [];
  const rocks = [];
  const clusters = [];

  for (let index = 0; index < 16; index++) {
    const angle = (index / 16) * Math.PI * 2 + (random() - 0.5) * 0.28;
    const radius = 43 + random() * 12;
    clusters.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
  }

  // An extra asymmetric woodland cluster makes the hill side feel denser.
  clusters.push({ x: -42, z: -28 }, { x: -48, z: -12 }, { x: -28, z: -45 });

  let attempts = 0;
  while (trees.length < 180 && attempts++ < 1600) {
    const cluster = clusters[Math.floor(random() * clusters.length)];
    const x = cluster.x + gaussian(random) * (5.5 + random() * 3.5);
    const z = cluster.z + gaussian(random) * (5.5 + random() * 3.5);
    const clearingDistance = Math.hypot(x, z);
    if (clearingDistance < 19 || !dryPlacement(x, z, 2.6)) continue;
    if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 1.65)) continue;

    const assetIndex = Math.floor(random() * treeAssets.length);
    const asset = treeAssets[assetIndex];
    const targetHeight = 5.5 + random() * 5.5;
    const scale = targetHeight / Math.max(0.1, asset.size.y);
    trees.push({
      id: `tree-${trees.length}`,
      assetIndex,
      x,
      y: getTerrainHeight(x, z),
      z,
      rotation: random() * Math.PI * 2,
      scale,
      phase: random() * Math.PI * 2,
      sway: 0.55 + random() * 0.65,
    });
  }

  const rockClusters = Array.from({ length: 15 }, () => ({
    x: (random() * 2 - 1) * (WORLD_HALF - 8),
    z: (random() * 2 - 1) * (WORLD_HALF - 8),
    count: 2 + Math.floor(random() * 5),
  }));

  for (const cluster of rockClusters) {
    for (let index = 0; index < cluster.count; index++) {
      const x = cluster.x + gaussian(random) * 2.2;
      const z = cluster.z + gaussian(random) * 2.2;
      if (!dryPlacement(x, z, 1.5)) continue;
      const assetIndex = Math.floor(random() * rockAssets.length);
      const asset = rockAssets[assetIndex];
      const targetWidth = 0.7 + random() * 2.5;
      rocks.push({
        id: `rock-${rocks.length}`,
        assetIndex,
        x,
        y: getTerrainHeight(x, z),
        z,
        rotation: random() * Math.PI * 2,
        tilt: (random() - 0.5) * 0.18,
        scale: targetWidth / Math.max(0.1, Math.max(asset.size.x, asset.size.z)),
      });
    }
  }

  return { trees, rocks, seed };
}

export function randomDryPoint(random, zone = 'meadow') {
  for (let attempt = 0; attempt < 80; attempt++) {
    let x;
    let z;
    if (zone === 'meadow') {
      const angle = random() * Math.PI * 2;
      const radius = 8 + Math.sqrt(random()) * 18;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    } else if (zone === 'edge') {
      const angle = random() * Math.PI * 2;
      const radius = 30 + random() * 18;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    } else {
      x = (random() * 2 - 1) * (WORLD_HALF - 5);
      z = (random() * 2 - 1) * (WORLD_HALF - 5);
    }
    if (dryPlacement(x, z, 1.8)) return { x, y: getTerrainHeight(x, z), z };
  }
  return { x: 0, y: getTerrainHeight(0, -18), z: -18 };
}
