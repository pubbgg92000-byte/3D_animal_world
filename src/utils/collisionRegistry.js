import * as THREE from 'three';

/**
 * collisionRegistry — lightweight shared collision state.
 *
 * Tree trunks are static circles (x, z, radius).
 * Animals are dynamic circles updated every frame.
 *
 * The movement hook reads both lists to push animals out of overlap.
 */
// ── Static obstacles (tree trunks and large boulders) ────────────
// Decorative grass, flowers, reeds, and bushes are intentionally absent.
export const TREE_OBSTACLES = [];
const _staticGroups = new Map();

function rebuildStaticObstacles() {
  TREE_OBSTACLES.length = 0;
  for (const obstacles of _staticGroups.values()) {
    TREE_OBSTACLES.push(...obstacles);
  }
}

export function registerStaticObstacles(groupId, obstacles) {
  _staticGroups.set(
    groupId,
    obstacles.map((obstacle) => ({
      x: obstacle.x,
      z: obstacle.z,
      r: obstacle.r,
    }))
  );
  rebuildStaticObstacles();
}

export function unregisterStaticObstacles(groupId) {
  _staticGroups.delete(groupId);
  rebuildStaticObstacles();
}

/** Called once by Trees.jsx after tree positions are computed. */
export function registerTreeObstacles(trees) {
  registerStaticObstacles(
    'trees',
    trees.map((tree) => ({
      x: tree.x,
      z: tree.z,
      r: 0.25 * tree.scale,
    }))
  );
}

// ── Dynamic obstacles (animals) ──────────────────────────────────
// Map of animalId → THREE.Vector3 (live position reference)
const _animalPositions = new Map();

export function registerAnimal(id, posRef, radius = 0.8) {
  _animalPositions.set(id, { pos: posRef, r: radius });
}

export function unregisterAnimal(id) {
  _animalPositions.delete(id);
}

/** Returns an array of { x, z, r } for all animals except `excludeId`. */
export function getAnimalObstacles(excludeId, radius = 1.2) {
  const out = [];
  for (const [id, animal] of _animalPositions) {
    if (id === excludeId) continue;
    out.push({
      x: animal.pos.x,
      z: animal.pos.z,
      r: animal.r || radius,
    });
  }
  return out;
}

export function getHerdCenter(species, excludeId) {
  const center = new THREE.Vector3();
  let count = 0;
  for (const [id, animal] of _animalPositions) {
    if (id === excludeId) continue;
    if (id !== species && !id.startsWith(`${species}-`)) continue;
    center.add(animal.pos);
    count++;
  }
  return count > 0 ? center.multiplyScalar(1 / count) : null;
}

// ── Resolve overlap — push `pos` out of all obstacles ────────────
/**
 * Push `pos` out of any overlapping static or dynamic obstacle.
 * Modifies pos.x / pos.z in place.
 */
export function resolveCollisions(pos, selfId, animalRadius = 0.8) {
  // Trees
  for (const ob of TREE_OBSTACLES) {
    const dx = pos.x - ob.x;
    const dz = pos.z - ob.z;
    const dist2 = dx * dx + dz * dz;
    const minDist = ob.r + animalRadius;
    if (dist2 <= 0.0001) {
      pos.x += minDist;
    } else if (dist2 < minDist * minDist) {
      const dist = Math.sqrt(dist2);
      const push = (minDist - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }

  // Other animals
  for (const [id, otherAnimal] of _animalPositions) {
    if (id === selfId) continue;
    const other = otherAnimal.pos;
    const dx = pos.x - other.x;
    const dz = pos.z - other.z;
    const dist2 = dx * dx + dz * dz;
    const minDist = animalRadius + otherAnimal.r;
    if (dist2 <= 0.0001) {
      pos.x += id < selfId ? minDist * 0.5 : -minDist * 0.5;
    } else if (dist2 < minDist * minDist) {
      const dist = Math.sqrt(dist2);
      const push = (minDist - dist) / dist * 0.5; // split push 50/50
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
}
