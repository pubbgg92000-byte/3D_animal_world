/**
 * WaterPools — small water pools removed.
 * Only the WATER_POSITIONS export is kept for AI drinking destinations;
 * it now points to the stream end near the world edge where animals drink.
 */
import * as THREE from 'three';
import { STREAM_END } from './Pond';

/**
 * Animals will head to the stream outlet to drink.
 * WATER_POSITIONS is imported by useAnimalAI.
 */
export const WATER_POSITIONS = [STREAM_END];

/** No-op component — all pool visuals removed */
export default function WaterPools() {
  return null;
}
