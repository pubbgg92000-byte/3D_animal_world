import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { DIET } from '../config/animalConfig';
import { TREE_POSITIONS } from '../components/Trees';
import { WATER_POSITIONS } from '../components/WaterPools';
import { GRASS_POSITIONS } from '../components/TallGrass';

/* ========================================
   AI Behavior States
   ======================================== */
export const AI_STATE = {
  IDLE: 'Idle',
  WANDER: 'Wander',
  GRAZE: 'Graze',   // Herbivores eat grass
  HUNT: 'Hunt',     // Carnivores eat fish/prey
  DRINK: 'Drink',
  SLEEP: 'Sleep',
};

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
   Helpers
   ======================================== */
function findNearest(positions, pos, maxDist = 50) {
  if (!positions || positions.length === 0) return null;
  let best = null;
  let bestDist = maxDist;
  for (const p of positions) {
    const d = pos.distanceTo(p);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function randomPoint(center, radius) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * radius;
  const x = center.x + Math.cos(angle) * r;
  const z = center.z + Math.sin(angle) * r;
  return new THREE.Vector3(
    Math.max(-50, Math.min(50, x)),
    getTerrainHeight(x, z),
    Math.max(-50, Math.min(50, z))
  );
}

/* ========================================
   useAnimalAI Hook
   ======================================== */
export default function useAnimalAI(diet = DIET.HERBIVORE) {
  const state = useRef(AI_STATE.IDLE);
  const stateTimer = useRef(0);
  const stateDuration = useRef(2 + Math.random() * 3);
  const isOverridden = useRef(false);
  const overrideTimer = useRef(0);
  const destination = useRef(null);

  const pickNextBehavior = useCallback(
    (pos, urgentNeed) => {
      // If there's an urgent need, prioritize it
      if (urgentNeed === 'hunger') {
        if (diet === DIET.CARNIVORE) {
          // Carnivore → go to water pool to catch fish
          const water = findNearest(WATER_POSITIONS, pos, 60);
          if (water) {
            state.current = AI_STATE.HUNT;
            stateDuration.current = 5 + Math.random() * 4;
            const dir = new THREE.Vector3().subVectors(water, pos).normalize();
            destination.current = water.clone().sub(dir.multiplyScalar(1.5));
            destination.current.y = getTerrainHeight(destination.current.x, destination.current.z);
            return;
          }
        } else {
          // Herbivore → graze
          const grass = findNearest(GRASS_POSITIONS, pos, 40);
          if (grass) {
            state.current = AI_STATE.GRAZE;
            stateDuration.current = 6 + Math.random() * 5;
            destination.current = randomPoint(grass, 2);
            return;
          }
        }
      }

      if (urgentNeed === 'hydration') {
        const water = findNearest(WATER_POSITIONS, pos, 60);
        if (water) {
          state.current = AI_STATE.DRINK;
          stateDuration.current = 5 + Math.random() * 3;
          const dir = new THREE.Vector3().subVectors(water, pos).normalize();
          destination.current = water.clone().sub(dir.multiplyScalar(1.8));
          destination.current.y = getTerrainHeight(destination.current.x, destination.current.z);
          return;
        }
      }

      if (urgentNeed === 'energy') {
        const tree = findNearest(TREE_POSITIONS, pos, 40);
        if (tree) {
          state.current = AI_STATE.SLEEP;
          stateDuration.current = 8 + Math.random() * 6;
          destination.current = randomPoint(tree, 2);
          return;
        }
      }

      // Normal random behavior selection
      const roll = Math.random();

      if (roll < 0.25) {
        state.current = AI_STATE.WANDER;
        stateDuration.current = 5 + Math.random() * 4;
        destination.current = randomPoint(pos, 15);
      } else if (roll < 0.50) {
        if (diet === DIET.CARNIVORE) {
          const water = findNearest(WATER_POSITIONS, pos, 60);
          if (water) {
            state.current = AI_STATE.HUNT;
            stateDuration.current = 5 + Math.random() * 4;
            const dir = new THREE.Vector3().subVectors(water, pos).normalize();
            destination.current = water.clone().sub(dir.multiplyScalar(1.5));
            destination.current.y = getTerrainHeight(destination.current.x, destination.current.z);
          } else {
            state.current = AI_STATE.WANDER;
            stateDuration.current = 4;
            destination.current = randomPoint(pos, 12);
          }
        } else {
          const grass = findNearest(GRASS_POSITIONS, pos, 40);
          state.current = AI_STATE.GRAZE;
          stateDuration.current = 6 + Math.random() * 5;
          destination.current = grass ? randomPoint(grass, 2) : null;
        }
      } else if (roll < 0.72) {
        const water = findNearest(WATER_POSITIONS, pos, 60);
        if (water) {
          state.current = AI_STATE.DRINK;
          stateDuration.current = 5 + Math.random() * 3;
          const dir = new THREE.Vector3().subVectors(water, pos).normalize();
          destination.current = water.clone().sub(dir.multiplyScalar(1.8));
          destination.current.y = getTerrainHeight(destination.current.x, destination.current.z);
        } else {
          state.current = AI_STATE.IDLE;
          stateDuration.current = 3;
          destination.current = null;
        }
      } else {
        const tree = findNearest(TREE_POSITIONS, pos, 40);
        if (tree) {
          state.current = AI_STATE.SLEEP;
          stateDuration.current = 8 + Math.random() * 6;
          destination.current = randomPoint(tree, 2);
        } else {
          state.current = AI_STATE.IDLE;
          stateDuration.current = 4;
          destination.current = null;
        }
      }
    },
    [diet]
  );

  const update = useCallback(
    (delta, pos, urgentNeed) => {
      if (isOverridden.current) {
        overrideTimer.current += delta;
        if (overrideTimer.current > 8) {
          isOverridden.current = false;
          state.current = AI_STATE.IDLE;
          stateTimer.current = 0;
          stateDuration.current = 2;
        }
        return {
          destination: null,
          aiState: state.current,
          isWalking: false,
          shouldGraze: false,
          shouldHunt: false,
          shouldDrink: false,
          shouldSleep: false,
        };
      }

      stateTimer.current += delta;

      if (stateTimer.current > stateDuration.current) {
        if (state.current === AI_STATE.IDLE) {
          pickNextBehavior(pos, urgentNeed);
        } else {
          state.current = AI_STATE.IDLE;
          stateDuration.current = 2 + Math.random() * 3;
          destination.current = null;
        }
        stateTimer.current = 0;
      }

      const progress = stateTimer.current / stateDuration.current;
      const hasDestination = destination.current !== null;

      return {
        destination: destination.current,
        aiState: state.current,
        isWalking:
          hasDestination &&
          (state.current === AI_STATE.WANDER ||
            (progress < 0.4 && state.current !== AI_STATE.IDLE)),
        shouldGraze: state.current === AI_STATE.GRAZE && progress > 0.3,
        shouldHunt: state.current === AI_STATE.HUNT && progress > 0.3,
        shouldDrink: state.current === AI_STATE.DRINK && progress > 0.3,
        shouldSleep: state.current === AI_STATE.SLEEP && progress > 0.3,
      };
    },
    [pickNextBehavior]
  );

  const override = useCallback(() => {
    isOverridden.current = true;
    overrideTimer.current = 0;
    destination.current = null;
  }, []);

  return { update, override, getState: () => state.current };
}
