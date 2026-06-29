import { useState, useCallback, useRef, useEffect } from 'react';
import { SPECIES_EMOJIS, getBehaviorDisplay } from '../config/designTokens';

/**
 * useNotifications — Meaningful event feed system.
 *
 * Only surfaces notable ecosystem events:
 *  - Hunt (predator catches prey)
 *  - Flee (danger)
 *  - Sleep (first time — animal found shelter)
 *  - Time-of-day transitions (sunrise, sunset, night)
 *
 * Routine actions (Graze, Wander, Drink) are NOT notified —
 * those belong on the animal card, not the feed.
 */

let nextId = 1;

// Only notable behaviors generate notifications
const NOTABLE_BEHAVIORS = {
  Hunt:  (name, emoji) => `${emoji} ${name} caught prey`,
  Flee:  (name, emoji) => `${emoji} ${name} is fleeing!`,
  Sleep: (name, emoji) => `${emoji} ${name} found shelter`,
};

// Longer cooldown to reduce spam
const COOLDOWN_MS = 45000;

// Time-of-day notification thresholds
const TIME_EVENTS = [
  { hour: 6,  message: '☀️ Dawn breaks over the meadow' },
  { hour: 18, message: '🌅 Sunset paints the sky' },
  { hour: 21, message: '🌙 Night has fallen' },
];

export default function useNotifications(animalConfigs, behaviors, maxVisible = 3) {
  const [notifications, setNotifications] = useState([]);
  const prevBehaviors = useRef({});
  const cooldowns = useRef({});
  const firedTimeEvents = useRef(new Set());

  // Watch for notable behavior changes
  useEffect(() => {
    const now = Date.now();
    for (const cfg of animalConfigs) {
      const prev = prevBehaviors.current[cfg.id];
      const current = behaviors[cfg.id];
      if (!current || current === prev) continue;

      prevBehaviors.current[cfg.id] = current;

      // Only notable behaviors
      if (!NOTABLE_BEHAVIORS[current]) continue;

      // Cooldown check
      const key = `${cfg.id}:${current}`;
      if (cooldowns.current[key] && now - cooldowns.current[key] < COOLDOWN_MS) continue;
      cooldowns.current[key] = now;

      const species = cfg.species || cfg.id;
      const emoji = SPECIES_EMOJIS[species] || '🐾';
      const name = cfg.displayName || cfg.name;
      const message = NOTABLE_BEHAVIORS[current](name, emoji);
      const behaviorInfo = getBehaviorDisplay(current);

      const id = nextId++;
      setNotifications((prev) => {
        const next = [{ id, message, color: behaviorInfo.color, icon: behaviorInfo.icon }, ...prev];
        return next.slice(0, maxVisible + 2);
      });

      // Auto-dismiss after 6s (slightly longer for important events)
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 6000);
    }
  }, [behaviors, animalConfigs, maxVisible]);

  // Time-of-day events (check every 30s via simulation clock)
  useEffect(() => {
    const checkTimeEvents = () => {
      const hour = new Date().getHours();
      for (const evt of TIME_EVENTS) {
        const key = `time:${evt.hour}`;
        if (hour === evt.hour && !firedTimeEvents.current.has(key)) {
          firedTimeEvents.current.add(key);
          const id = nextId++;
          setNotifications((prev) => {
            return [{ id, message: evt.message, color: '#FACC15', icon: '🌅' }, ...prev].slice(0, maxVisible + 2);
          });
          setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
          }, 8000);
        }
      }
    };

    const interval = setInterval(checkTimeEvents, 30000);
    return () => clearInterval(interval);
  }, [maxVisible]);

  // Reset time events daily
  useEffect(() => {
    const midnight = setInterval(() => {
      firedTimeEvents.current.clear();
    }, 3600000); // every hour, clear and re-check
    return () => clearInterval(midnight);
  }, []);

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    notifications: notifications.slice(0, maxVisible),
    dismiss,
  };
}
