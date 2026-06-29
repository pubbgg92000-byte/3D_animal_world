import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { DIET } from '../config/animalConfig';
import { TREE_POSITIONS } from '../components/Trees';
import { GRASS_POSITIONS } from '../components/TallGrass';
import { getHerdCenter } from '../utils/collisionRegistry';
import {
  WORLD_HALF,
  createPondRockHuntPoints,
  createWaterApproachPoints,
  getTerrainHeight,
  randomDryPoint,
} from '../utils/world';

export const AI_STATE = {
  IDLE: 'Idle',
  WANDER: 'Wander',
  GRAZE: 'Graze',
  HUNT: 'Hunt',
  DRINK: 'Drink',
  SLEEP: 'Sleep',
};

const WATER_APPROACHES = createWaterApproachPoints();
const POND_ROCK_HUNT_POINTS = createPondRockHuntPoints();
const WORLD_CENTER = new THREE.Vector3(0, 0, 0);

function nearestPoint(points, position, maxDistance = Infinity) {
  let nearest = null;
  let nearestDistance = maxDistance;
  for (const point of points) {
    const distance = position.distanceTo(point);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function pointNearTree(position) {
  const tree = nearestPoint(TREE_POSITIONS, position, 90);
  if (!tree) return randomDryPoint(position, 10);
  const away = new THREE.Vector3().subVectors(position, tree).setY(0);
  if (away.lengthSq() < 0.01) away.set(1, 0, 0);
  away.normalize().multiplyScalar(2.3);
  const point = tree.clone().add(away);
  point.y = getTerrainHeight(point.x, point.z);
  return point;
}

function grazingPoint(position) {
  const grass = nearestPoint(GRASS_POSITIONS, position, 90);
  return grass ? randomDryPoint(grass, 3) : randomDryPoint(position, 12);
}

function roamingPoint(position, herdCenter = null) {
  if (herdCenter && Math.random() < 0.35) {
    return randomDryPoint(herdCenter, 22);
  }
  return Math.random() < 0.68
    ? randomDryPoint(WORLD_CENTER, WORLD_HALF - 5)
    : randomDryPoint(position, 34);
}

function huntingPoint(position, species, fallback) {
  if (species === 'bear' || species === 'fox') {
    return nearestPoint(POND_ROCK_HUNT_POINTS, position)?.clone() || fallback;
  }
  return fallback;
}

export default function useAnimalAI(diet = DIET.HERBIVORE, species = null, animalId = null) {
  const state = useRef(AI_STATE.IDLE);
  const stateTimer = useRef(0);
  const stateDuration = useRef(4 + Math.random() * 4);
  const destination = useRef(null);
  const arrived = useRef(true);
  const userOverride = useRef(false);
  const overrideTimer = useRef(0);
  const lastForcedBehavior = useRef(null);
  const forcedRun = useRef(false);

  const chooseRoamingPoint = useCallback(
    (position) => roamingPoint(position, species ? getHerdCenter(species, animalId) : null),
    [animalId, species]
  );

  const begin = useCallback((nextState, nextDestination, duration) => {
    state.current = nextState;
    destination.current = nextDestination;
    arrived.current = nextDestination === null;
    stateTimer.current = 0;
    stateDuration.current = duration;
  }, []);

  const pickNextBehavior = useCallback((position, urgentNeed) => {
    if (urgentNeed === 'hydration') {
      begin(AI_STATE.DRINK, nearestPoint(WATER_APPROACHES, position)?.clone() || null, 10 + Math.random() * 6);
      return;
    }

    if (urgentNeed === 'hunger') {
      if (diet === DIET.CARNIVORE) {
        const fallback = nearestPoint(WATER_APPROACHES, position)?.clone() || chooseRoamingPoint(position);
        begin(AI_STATE.HUNT, huntingPoint(position, species, fallback), 14 + Math.random() * 8);
      } else {
        begin(AI_STATE.GRAZE, grazingPoint(position), 16 + Math.random() * 10);
      }
      return;
    }

    if (urgentNeed === 'energy') {
      begin(AI_STATE.SLEEP, pointNearTree(position), 22 + Math.random() * 14);
      return;
    }

    const roll = Math.random();
    if (roll < 0.55) {
      begin(AI_STATE.WANDER, chooseRoamingPoint(position), 20);
    } else if (roll < 0.73) {
      begin(
        diet === DIET.CARNIVORE ? AI_STATE.HUNT : AI_STATE.GRAZE,
        diet === DIET.CARNIVORE
          ? huntingPoint(position, species, nearestPoint(WATER_APPROACHES, position)?.clone() || chooseRoamingPoint(position))
          : grazingPoint(position),
        14 + Math.random() * 10
      );
    } else if (roll < 0.87) {
      begin(AI_STATE.DRINK, nearestPoint(WATER_APPROACHES, position)?.clone() || null, 10 + Math.random() * 6);
    } else {
      begin(AI_STATE.SLEEP, pointNearTree(position), 20 + Math.random() * 14);
    }
  }, [begin, chooseRoamingPoint, diet, species]);

  const applyForcedBehavior = useCallback((behavior, position) => {
    const key = behavior.toLowerCase();
    forcedRun.current = key === 'run';

    if (key === 'walk' || key === 'run' || key === 'wander') {
      begin(AI_STATE.WANDER, chooseRoamingPoint(position), 20);
    } else if (key === 'graze') {
      begin(AI_STATE.GRAZE, grazingPoint(position), 20);
    } else if (key.includes('hunt')) {
      const fallback = nearestPoint(WATER_APPROACHES, position)?.clone() || chooseRoamingPoint(position);
      begin(AI_STATE.HUNT, huntingPoint(position, species, fallback), 20);
    } else if (key === 'drink') {
      begin(AI_STATE.DRINK, nearestPoint(WATER_APPROACHES, position)?.clone() || null, 16);
    } else if (key === 'sleep') {
      begin(AI_STATE.SLEEP, pointNearTree(position), 30);
    }
  }, [begin, chooseRoamingPoint, species]);

  const update = useCallback((delta, position, urgentNeed, forcedBehavior = null) => {
    if (forcedBehavior && forcedBehavior !== lastForcedBehavior.current) {
      lastForcedBehavior.current = forcedBehavior;
      userOverride.current = false;
      applyForcedBehavior(forcedBehavior, position);
    } else if (!forcedBehavior) {
      lastForcedBehavior.current = null;
      forcedRun.current = false;
    }

    if (userOverride.current) {
      overrideTimer.current += delta;
      if (overrideTimer.current <= 30) {
        return {
          destination: null,
          aiState: AI_STATE.WANDER,
          isWalking: true,
          isPerforming: false,
          shouldRun: false,
          shouldGraze: false,
          shouldHunt: false,
          shouldDrink: false,
          shouldSleep: false,
        };
      }
      userOverride.current = false;
      begin(AI_STATE.IDLE, null, 2);
    }

    const isPerforming = arrived.current && state.current !== AI_STATE.IDLE && state.current !== AI_STATE.WANDER;
    if (arrived.current) stateTimer.current += delta;

    if (state.current === AI_STATE.WANDER && arrived.current) {
      begin(AI_STATE.IDLE, null, 3 + Math.random() * 5);
    } else if (stateTimer.current >= stateDuration.current) {
      if (state.current === AI_STATE.IDLE) pickNextBehavior(position, urgentNeed);
      else begin(AI_STATE.IDLE, null, 4 + Math.random() * 5);
    }

    const performingNow = arrived.current && state.current !== AI_STATE.IDLE && state.current !== AI_STATE.WANDER;
    return {
      destination: arrived.current ? null : destination.current,
      aiState: state.current,
      isWalking: !arrived.current,
      isPerforming: performingNow || isPerforming,
      shouldRun: forcedRun.current && !arrived.current,
      shouldGraze: performingNow && state.current === AI_STATE.GRAZE,
      shouldHunt: performingNow && state.current === AI_STATE.HUNT,
      shouldDrink: performingNow && state.current === AI_STATE.DRINK,
      shouldSleep: performingNow && state.current === AI_STATE.SLEEP,
    };
  }, [applyForcedBehavior, begin, pickNextBehavior]);

  const override = useCallback(() => {
    userOverride.current = true;
    overrideTimer.current = 0;
    destination.current = null;
    arrived.current = true;
    lastForcedBehavior.current = null;
  }, []);

  const clearOverride = useCallback(() => {
    userOverride.current = false;
    overrideTimer.current = 0;
    begin(AI_STATE.IDLE, null, 2 + Math.random() * 3);
  }, [begin]);

  const arrive = useCallback(() => {
    arrived.current = true;
    destination.current = null;
    stateTimer.current = 0;
  }, []);

  const repick = useCallback(() => {
    arrived.current = true;
    destination.current = null;
    state.current = AI_STATE.IDLE;
    stateTimer.current = stateDuration.current;
  }, []);

  return {
    update,
    override,
    clearOverride,
    arrive,
    repick,
    getState: () => state.current,
  };
}
