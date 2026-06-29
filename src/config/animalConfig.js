import { WORLD_HALF, getTerrainHeight, isWaterAt } from '../utils/world';
import { createRandom, WORLD_SEED } from '../components/environment/worldGenerator';

/**
 * Central configuration for all animals in the ecosystem.
 *
 * Each entry maps animation keys (idle/walk) to the actual clip names
 * in the GLB file, so the generic Animal component works for any model.
 */

export const DIET = {
  HERBIVORE: 'herbivore',
  CARNIVORE: 'carnivore',
};

/**
 * Animal definitions.
 */
export const ANIMALS = {
  moose: {
    id: 'moose',
    name: 'Moose',
    model: '/models/moose.glb',
    diet: DIET.HERBIVORE,
    scale: 1.0,
    collisionRadius: 0.9,
    walkSpeed: 2.5,
    runSpeed: 5.0,
    walkTimescale: 1.0,
    runTimescale: 1.8,
    // Map generic keys → actual animation clip names in the GLB
    anims: {
      idle: 'Idle',         // resolves via fuzzy match to "Moose|Moose_Idle"
      walk: 'WalkFast_F',   // resolves to "Moose|Moose_WalkFast_F"
    },
    // Body material name(s) to apply fur texture
    bodyMaterials: ['M_Moose'],
    antlerMaterials: ['M_Moose_Antler'],
    // Bone name patterns for procedural animation
    bones: {
      neck: ['Neck1', 'Neck2', 'Neck3'],
      head: 'Head',
      jaw: 'Jaw',
      tail: 'Tail1',
      spine: 'Spine1',
    },
    // Base tint color for fur (applied as material.color)
    furTint: '#d4b896',
    // Spawn position
    spawnPos: [-8, 0, 0],
    // Max obstacle height this species can step over (world units)
    climbHeight: 0.55,
    // Stats decay rates (per second)
    decayRates: { energy: 0.0025, hydration: 0.0035, hunger: 0.0030 },
  },

  deer: {
    id: 'deer',
    name: 'Deer',
    model: '/models/deer.glb',
    diet: DIET.HERBIVORE,
    scale: 1.0,
    collisionRadius: 0.75,
    walkSpeed: 3.0,
    runSpeed: 8.5,           // deer are fast
    walkTimescale: 1.1,
    runTimescale: 2.6,       // fast gallop timescale
    anims: {
      idle: 'Idle',
      walk: 'WalkFast_F',    // gallop uses the fast walk anim at high timescale
    },
    bodyMaterials: ['M_Deer'],
    antlerMaterials: ['M_DeerAntler'],
    bones: {
      neck: ['Neck1', 'Neck2', 'Neck3'],
      head: 'Head',
      jaw: 'Jaw',
      tail: 'Tail1',
      spine: 'Spine1',
    },
    furTint: '#c4975a',
    spawnPos: [14, 0, -8],
    climbHeight: 0.45,
    decayRates: { energy: 0.0028, hydration: 0.0038, hunger: 0.0032 },
  },

  bear: {
    id: 'bear',
    name: 'Bear',
    model: '/models/bear.glb',
    diet: DIET.CARNIVORE,
    scale: 1.0,
    collisionRadius: 1.0,
    walkSpeed: 2.0,
    runSpeed: 4.5,
    walkTimescale: 1.0,
    runTimescale: 1.6,
    anims: {
      idle: 'Idle',
      walk: 'WalkFast_F',
    },
    bodyMaterials: ['M_Bear'],
    antlerMaterials: [],
    bones: {
      neck: ['Neck1', 'Neck2', 'Neck3'],
      head: 'Head',
      jaw: 'Jaw',
      tail: ['Tail1', 'Tail'],
      spine: 'Spine1',
    },
    furTint: '#4a3520',
    spawnPos: [-18, 0, 15],
    climbHeight: 0.60,
    decayRates: { energy: 0.0022, hydration: 0.0030, hunger: 0.0038 },
  },

  fox: {
    id: 'fox',
    name: 'Fox',
    model: '/models/fox.glb',
    diet: DIET.CARNIVORE,
    scale: 1.0,
    collisionRadius: 0.55,
    walkSpeed: 3.5,
    runSpeed: 7.0,
    walkTimescale: 1.0,
    runTimescale: 2.0,
    anims: {
      idle: 'Stand',       // Fox has "Fox|Fox_Stand" instead of idle
      walk: 'WalkFast_F',
    },
    bodyMaterials: ['M_Fox', 'M_Fox_Fur'],
    antlerMaterials: [],
    bones: {
      neck: ['Neck1', 'Neck2', 'Neck3'],
      head: 'Head',
      jaw: 'Jaw',
      tail: ['Tail1', 'Tail'],
      spine: 'Spine1',
    },
    furTint: '#c4652a',
    spawnPos: [20, 0, 18],
    climbHeight: 0.35,
    decayRates: { energy: 0.0032, hydration: 0.0034, hunger: 0.0040 },
  },

  rabbit: {
    id: 'rabbit',
    name: 'Rabbit',
    model: '/models/rabbit.glb',
    diet: DIET.HERBIVORE,
    scale: 1.0,
    collisionRadius: 0.35,
    walkSpeed: 2.0,
    runSpeed: 5.5,
    walkTimescale: 1.75,
    runTimescale: 3.8,
    anims: {
      idle: 'Idle',
      walk: 'WalkSlow_F',  // Rabbit has WalkSlow
    },
    bodyMaterials: ['M_Rabbit'],
    antlerMaterials: [],
    bones: {
      neck: ['Neck1', 'Neck2'],
      head: 'Head',
      jaw: 'Jaw',
      tail: ['Tail1', 'Tail'],
      spine: 'Spine1',
    },
    furTint: '#a89070',
    spawnPos: [-10, 0, -15],
    climbHeight: 0.15,
    decayRates: { energy: 0.0035, hydration: 0.0040, hunger: 0.0036 },
  },
};

/** Array form — only active animals */
function createInstance(base, id, name, spawnPos) {
  return {
    ...base,
    id,
    name,
    species: base.id,
    spawnPos,
  };
}

const spawnRandom = createRandom(`${WORLD_SEED}:animated-animals`);
const occupiedSpawns = [];

function randomSpawn(zone = 'all') {
  for (let attempt = 0; attempt < 80; attempt++) {
    let x;
    let z;
    if (zone === 'meadow') {
      const angle = spawnRandom() * Math.PI * 2;
      const radius = 7 + Math.sqrt(spawnRandom()) * 18;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    } else if (zone === 'edge') {
      const angle = spawnRandom() * Math.PI * 2;
      const radius = 27 + spawnRandom() * 16;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    } else {
      x = (spawnRandom() * 2 - 1) * (WORLD_HALF - 6);
      z = (spawnRandom() * 2 - 1) * (WORLD_HALF - 6);
    }
    if (isWaterAt(x, z, 2.2)) continue;
    if (occupiedSpawns.some(([px, , pz]) => Math.hypot(px - x, pz - z) < 3.2)) continue;
    occupiedSpawns.push([x, getTerrainHeight(x, z), z]);
    return [x, getTerrainHeight(x, z), z];
  }
  return [0, getTerrainHeight(0, -18), -18];
}

/**
 * Personality metadata applied per-instance.
 * Gives each animal a unique identity for the UI.
 */
function withPersonality(instance, meta) {
  return { ...instance, ...meta };
}

/** Animated wildlife models. Each animal has its own movement and AI state. */
export const ANIMAL_LIST = [
  withPersonality(
    createInstance(ANIMALS.moose, 'moose', 'Moose', randomSpawn('meadow')),
    { displayName: 'Magnus', gender: 'Male', age: '6 Years', weight: '520 kg', territory: 'Central Meadow' }
  ),
  withPersonality(
    createInstance(ANIMALS.deer, 'deer', 'Deer', randomSpawn('meadow')),
    { displayName: 'Fern', gender: 'Female', age: '3 Years', weight: '68 kg', territory: 'East Meadow' }
  ),
  withPersonality(
    createInstance(ANIMALS.deer, 'deer-2', 'Deer 2', randomSpawn('meadow')),
    { displayName: 'Birch', gender: 'Male', age: '4 Years', weight: '82 kg', territory: 'South Meadow' }
  ),
  withPersonality(
    createInstance(ANIMALS.deer, 'deer-3', 'Deer 3', randomSpawn('meadow')),
    { displayName: 'Willow', gender: 'Female', age: '2 Years', weight: '55 kg', territory: 'West Clearing' }
  ),
  withPersonality(
    createInstance(ANIMALS.deer, 'deer-4', 'Deer 4', randomSpawn('meadow')),
    { displayName: 'Clover', gender: 'Female', age: '1 Year', weight: '42 kg', territory: 'Pond Edge' }
  ),
  withPersonality(
    createInstance(ANIMALS.bear, 'bear', 'Bear', randomSpawn('edge')),
    { displayName: 'Bruno', gender: 'Male', age: '8 Years', weight: '340 kg', territory: 'North Forest' }
  ),
  withPersonality(
    createInstance(ANIMALS.fox, 'fox', 'Fox', randomSpawn('edge')),
    { displayName: 'Scout', gender: 'Male', age: '3 Years', weight: '7 kg', territory: 'Forest Edge' }
  ),
  withPersonality(
    createInstance(ANIMALS.rabbit, 'rabbit', 'Rabbit', randomSpawn()),
    { displayName: 'Hazel', gender: 'Female', age: '1 Year', weight: '2.1 kg', territory: 'Meadow Burrow' }
  ),
  withPersonality(
    createInstance(ANIMALS.rabbit, 'rabbit-2', 'Rabbit 2', randomSpawn()),
    { displayName: 'Pip', gender: 'Male', age: '8 Months', weight: '1.8 kg', territory: 'Stream Bank' }
  ),
  withPersonality(
    createInstance(ANIMALS.rabbit, 'rabbit-3', 'Rabbit 3', randomSpawn()),
    { displayName: 'Clementine', gender: 'Female', age: '1 Year', weight: '2.0 kg', territory: 'South Burrow' }
  ),
  withPersonality(
    createInstance(ANIMALS.rabbit, 'rabbit-4', 'Rabbit 4', randomSpawn()),
    { displayName: 'Thistle', gender: 'Male', age: '6 Months', weight: '1.5 kg', territory: 'Hill Burrow' }
  ),
];

/** Get config by ID */
export function getAnimalConfig(id) {
  return ANIMALS[id] || null;
}
