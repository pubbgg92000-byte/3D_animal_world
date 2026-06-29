/**
 * collisionRegistry — lightweight shared collision state.
 *
 * Tree trunks are static circles (x, z, radius).
 * Animals are dynamic circles updated every frame.
 *
 * The movement hook reads both lists to push animals out of overlap.
 */
import * as THREE from 'three';

// ── Static obstacles (tree trunks) ───────────────────────────────
// Each entry: { x, z, r }
export const TREE_OBSTACLES = [];

/** Called once by Trees.jsx after tree positions are computed. */
export function registerTreeObstacles(trees) {
  TREE_OBSTACLES.length = 0;
  for (const t of trees) {
    // trunk radius scaled with tree scale (base cylinder radius * scale)
    TREE_OBSTACLES.push({ x: t.x, z: t.z, r: 0.25 * t.scale });
  }
}

// ── Dynamic obstacles (animals) ──────────────────────────────────
// Map of animalId → THREE.Vector3 (live position reference)
const _animalPositions = new Map();

export function registerAnimal(id, posRef) {
  _animalPositions.set(id, posRef);
}

export function unregisterAnimal(id) {
  _animalPositions.delete(id);
}

/** Returns an array of { x, z, r } for all animals except `excludeId`. */
export function getAnimalObstacles(excludeId, radius = 1.2) {
  const out = [];
  for (const [id, pos] of _animalPositions) {
    if (id === excludeId) continue;
    out.push({ x: pos.x, z: pos.z, r: radius });
  }
  return out;
}

// ── Resolve overlap — push `pos` out of all obstacles ────────────
const _sep = new THREE.Vector3();

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
    if (dist2 < minDist * minDist && dist2 > 0.0001) {
      const dist = Math.sqrt(dist2);
      const push = (minDist - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }

  // Other animals
  for (const [id, other] of _animalPositions) {
    if (id === selfId) continue;
    const dx = pos.x - other.x;
    const dz = pos.z - other.z;
    const dist2 = dx * dx + dz * dz;
    const minDist = animalRadius * 2.0;
    if (dist2 < minDist * minDist && dist2 > 0.0001) {
      const dist = Math.sqrt(dist2);
      const push = (minDist - dist) / dist * 0.5; // split push 50/50
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }
}
