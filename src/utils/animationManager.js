/**
 * AnimationManager — utility for managing Three.js animation crossfades.
 *
 * Works directly with the `actions` map returned by drei's `useAnimations`.
 * Resolves clean names like "Idle" to raw keys like "Moose|Moose_Idle"
 * at call time (not at build time) to avoid drei proxy timing issues.
 */

/** Duration (seconds) for default crossfades */
const DEFAULT_FADE_DURATION = 0.35;

/**
 * Resolve a clean animation name to its raw key in the actions map.
 *
 * Searches for a raw key that ends with the clean name.
 * e.g., "Idle" matches "Moose|Moose_Idle"
 *       "WalkFast_F" matches "Moose|Moose_WalkFast_F"
 *
 * @param {Object} actions — drei useAnimations actions map
 * @param {string} cleanName — short name like "Idle" or "WalkFast_F"
 * @returns {string|null} the raw key, or null if not found
 */
function resolveActionKey(actions, cleanName) {
  if (!actions) return null;

  // Direct match first
  if (actions[cleanName]) return cleanName;

  // Search for a key ending with the clean name
  const keys = Object.keys(actions);
  for (const key of keys) {
    if (key.endsWith(cleanName) && actions[key]) {
      return key;
    }
  }
  return null;
}

/**
 * Crossfade from one animation to another.
 *
 * @param {Object}  actions       — drei useAnimations actions map (raw)
 * @param {string}  fromName      — clean name of current animation (or null)
 * @param {string}  toName        — clean name of target animation
 * @param {number}  [duration]    — crossfade duration in seconds
 * @param {number}  [timeScale]   — playback speed multiplier
 * @returns {string} toName on success, fromName on failure
 */
export function crossFadeTo(
  actions,
  fromName,
  toName,
  duration = DEFAULT_FADE_DURATION,
  timeScale = 1
) {
  const toKey = resolveActionKey(actions, toName);
  if (!toKey) {
    console.warn(
      `[AnimationManager] "${toName}" not found. Available:`,
      Object.keys(actions).filter((k) => actions[k] !== null)
    );
    return fromName;
  }

  const toAction = actions[toKey];

  // Configure target
  toAction.setEffectiveTimeScale(timeScale);
  toAction.setEffectiveWeight(1);
  toAction.time = 0;

  const fromKey = fromName ? resolveActionKey(actions, fromName) : null;
  if (fromKey && fromKey !== toKey && actions[fromKey]) {
    const fromAction = actions[fromKey];
    toAction.enabled = true;
    toAction.play();
    fromAction.crossFadeTo(toAction, duration, true);
  } else {
    toAction.reset().fadeIn(duration).play();
  }

  return toName;
}

/**
 * Check if an animation is available.
 */
export function hasAnimation(actions, cleanName) {
  return resolveActionKey(actions, cleanName) !== null;
}

/**
 * Stop all running animations.
 */
export function stopAll(actions, duration = DEFAULT_FADE_DURATION) {
  if (!actions) return;
  for (const key of Object.keys(actions)) {
    const action = actions[key];
    if (action && action.isRunning()) {
      action.fadeOut(duration);
    }
  }
}
