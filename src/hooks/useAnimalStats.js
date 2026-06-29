import { useRef, useCallback } from 'react';

/**
 * useAnimalStats — tracks energy, hydration, hunger for one animal.
 *
 * Stats range 0–100. Decay rates come from animalConfig.
 * Behaviors restore specific stats.
 */

const MAX = 100;
const MIN = 0;

export default function useAnimalStats(decayRates = {}) {
  const stats = useRef({
    energy: 80 + Math.random() * 20,
    hydration: 70 + Math.random() * 30,
    hunger: 60 + Math.random() * 40,
  });

  const rates = {
    energy: decayRates.energy || 0.008,
    hydration: decayRates.hydration || 0.012,
    hunger: decayRates.hunger || 0.010,
  };

  /**
   * Update stats each frame. Returns current stats + priority needs.
   */
  const update = useCallback((delta, behavior) => {
    const s = stats.current;

    // Decay
    s.energy = Math.max(MIN, s.energy - rates.energy * delta * 100);
    s.hydration = Math.max(MIN, s.hydration - rates.hydration * delta * 100);
    s.hunger = Math.max(MIN, s.hunger - rates.hunger * delta * 100);

    // Restore based on behavior
    switch (behavior) {
      case 'Sleep':
        s.energy = Math.min(MAX, s.energy + 0.15 * delta * 100);
        break;
      case 'Drink':
        s.hydration = Math.min(MAX, s.hydration + 0.25 * delta * 100);
        break;
      case 'Graze':
      case 'Hunt':
        s.hunger = Math.min(MAX, s.hunger + 0.20 * delta * 100);
        break;
    }

    // Determine most urgent need
    let urgentNeed = null;
    if (s.hunger < 20) urgentNeed = 'hunger';
    else if (s.hydration < 25) urgentNeed = 'hydration';
    else if (s.energy < 15) urgentNeed = 'energy';

    return {
      energy: s.energy,
      hydration: s.hydration,
      hunger: s.hunger,
      urgentNeed,
    };
  }, [rates.energy, rates.hydration, rates.hunger]);

  const getStats = useCallback(() => ({ ...stats.current }), []);

  return { update, getStats };
}
