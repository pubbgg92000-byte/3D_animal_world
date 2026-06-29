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
    // Stats decay rates (per second)
    decayRates: { energy: 0.008, hydration: 0.012, hunger: 0.010 },
  },

  deer: {
    id: 'deer',
    name: 'Deer',
    model: '/models/deer.glb',
    diet: DIET.HERBIVORE,
    scale: 1.0,
    walkSpeed: 3.0,
    runSpeed: 6.0,
    walkTimescale: 1.0,
    runTimescale: 1.8,
    anims: {
      idle: 'Idle',
      walk: 'WalkFast_F',
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
    decayRates: { energy: 0.009, hydration: 0.013, hunger: 0.011 },
  },

  bear: {
    id: 'bear',
    name: 'Bear',
    model: '/models/bear.glb',
    diet: DIET.CARNIVORE,
    scale: 1.0,
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
    decayRates: { energy: 0.007, hydration: 0.010, hunger: 0.014 },
  },

  fox: {
    id: 'fox',
    name: 'Fox',
    model: '/models/fox.glb',
    diet: DIET.CARNIVORE,
    scale: 1.0,
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
    decayRates: { energy: 0.010, hydration: 0.011, hunger: 0.015 },
  },

  rabbit: {
    id: 'rabbit',
    name: 'Rabbit',
    model: '/models/rabbit.glb',
    diet: DIET.HERBIVORE,
    scale: 1.0,
    walkSpeed: 2.0,
    runSpeed: 5.5,
    walkTimescale: 1.0,
    runTimescale: 2.2,
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
    decayRates: { energy: 0.012, hydration: 0.014, hunger: 0.013 },
  },
};

/** Array form — only active animals */
export const ANIMAL_LIST = [ANIMALS.moose, ANIMALS.deer];

/** Get config by ID */
export function getAnimalConfig(id) {
  return ANIMALS[id] || null;
}
