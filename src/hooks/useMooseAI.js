import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { TREE_POSITIONS } from '../components/Trees';
import { WATER_POSITIONS } from '../components/WaterPools';
import { GRASS_POSITIONS } from '../components/TallGrass';

/* ========================================
   AI Behavior States
   ======================================== */

export const AI_STATE = {
  IDLE: 'Idle',
  WANDER: 'Wander',
  GRAZE: 'Graze',
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

function findNearest(positions, moosePos, maxDist = 50) {
  if (!positions || positions.length === 0) return null;
  let best = null;
  let bestDist = maxDist;
  for (const p of positions) {
    const d = moosePos.distanceTo(p);
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
  const y = getTerrainHeight(x, z);
  return new THREE.Vector3(x, y, z);
}

/* ========================================
   useMooseAI Hook
   ======================================== */

/**
 * Autonomous moose behavior state machine.
 * Cycles through: IDLE → WANDER/GRAZE/DRINK/SLEEP
 * User clicks override autonomous behavior.
 *
 * @returns {{ update, getState, override, aiState }}
 */
export default function useMooseAI() {
  const state = useRef(AI_STATE.IDLE);
  const stateTimer = useRef(0);
  const stateDuration = useRef(3); // seconds in current state
  const isOverridden = useRef(false);
  const overrideTimer = useRef(0);
  const destination = useRef(null);

  /**
   * Pick the next autonomous behavior.
   */
  const pickNextBehavior = useCallback((moosePos) => {
    const roll = Math.random();

    if (roll < 0.3) {
      // WANDER — walk to a random nearby point
      state.current = AI_STATE.WANDER;
      stateDuration.current = 6 + Math.random() * 4;
      const target = randomPoint(moosePos, 15);
      // Clamp to field
      target.x = Math.max(-50, Math.min(50, target.x));
      target.z = Math.max(-50, Math.min(50, target.z));
      destination.current = target;
    } else if (roll < 0.55) {
      // GRAZE — walk to nearest grass patch
      const grass = findNearest(GRASS_POSITIONS, moosePos, 40);
      if (grass) {
        state.current = AI_STATE.GRAZE;
        stateDuration.current = 6 + Math.random() * 5;
        // Walk to a point near the grass
        destination.current = randomPoint(grass, 2);
      } else {
        // No grass nearby — just graze in place
        state.current = AI_STATE.GRAZE;
        stateDuration.current = 5;
        destination.current = null;
      }
    } else if (roll < 0.78) {
      // DRINK — walk to nearest water
      const water = findNearest(WATER_POSITIONS, moosePos, 60);
      if (water) {
        state.current = AI_STATE.DRINK;
        stateDuration.current = 5 + Math.random() * 3;
        // Walk to the edge of the pool
        const dirToPool = new THREE.Vector3()
          .subVectors(water, moosePos)
          .normalize();
        const edgePoint = water.clone().sub(dirToPool.multiplyScalar(1.8));
        edgePoint.y = getTerrainHeight(edgePoint.x, edgePoint.z);
        destination.current = edgePoint;
      } else {
        // No water — idle instead
        state.current = AI_STATE.IDLE;
        stateDuration.current = 3;
        destination.current = null;
      }
    } else {
      // SLEEP — walk to nearest tree
      const tree = findNearest(TREE_POSITIONS, moosePos, 40);
      if (tree) {
        state.current = AI_STATE.SLEEP;
        stateDuration.current = 8 + Math.random() * 6;
        // Walk near the tree
        const nearTree = randomPoint(tree, 2);
        destination.current = nearTree;
      } else {
        state.current = AI_STATE.IDLE;
        stateDuration.current = 4;
        destination.current = null;
      }
    }
  }, []);

  /**
   * Update the AI each frame.
   * Returns { destination, aiState, isWalking, shouldGraze, shouldDrink, shouldSleep }
   */
  const update = useCallback(
    (delta, moosePos) => {
      // If user overrode, wait for them to finish before resuming AI
      if (isOverridden.current) {
        overrideTimer.current += delta;
        // Resume AI after 8 seconds of no user input
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
          shouldDrink: false,
          shouldSleep: false,
        };
      }

      stateTimer.current += delta;

      // State expired → go back to idle then pick new behavior
      if (stateTimer.current > stateDuration.current) {
        if (state.current === AI_STATE.IDLE) {
          pickNextBehavior(moosePos);
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
        shouldDrink: state.current === AI_STATE.DRINK && progress > 0.3,
        shouldSleep: state.current === AI_STATE.SLEEP && progress > 0.3,
      };
    },
    [pickNextBehavior]
  );

  /**
   * User clicked — override AI temporarily.
   */
  const override = useCallback(() => {
    isOverridden.current = true;
    overrideTimer.current = 0;
    destination.current = null;
  }, []);

  return { update, override, getState: () => state.current };
}
