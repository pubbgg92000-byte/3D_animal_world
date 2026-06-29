/**
 * WaterPools — small water pools removed.
 * Only the WATER_POSITIONS export is kept for AI drinking destinations;
 * it now points to the stream end near the world edge where animals drink.
 */
import { createWaterApproachPoints } from '../utils/world';

/**
 * Animals will head to the stream outlet to drink.
 * WATER_POSITIONS is imported by useAnimalAI.
 */
export const WATER_POSITIONS = createWaterApproachPoints();

/** No-op component — all pool visuals removed */
export default function WaterPools() {
  return null;
}
