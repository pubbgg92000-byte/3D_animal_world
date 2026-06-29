/**
 * Wild Trails — Design Tokens
 *
 * Centralized design system for the entire UI.
 * All UI components import from here to ensure consistency.
 */

/* ── Semantic Stat Colors ── */
export const STAT_COLORS = {
  energy:    { base: '#FACC15', glow: 'rgba(250, 204, 21, 0.35)' },
  hydration: { base: '#38BDF8', glow: 'rgba(56, 189, 248, 0.35)' },
  hunger:    { base: '#FB923C', glow: 'rgba(251, 146, 60, 0.35)' },
  danger:    { base: '#F87171', glow: 'rgba(248, 113, 113, 0.35)' },
  sleep:     { base: '#C084FC', glow: 'rgba(192, 132, 252, 0.35)' },
  healthy:   { base: '#4ADE80', glow: 'rgba(74, 222, 128, 0.35)' },
  searching: { base: '#2DD4BF', glow: 'rgba(45, 212, 191, 0.35)' },
};

/* ── Species Palette ── */
export const SPECIES_COLORS = {
  moose:  '#C4975A',
  deer:   '#D4A574',
  bear:   '#8B6914',
  fox:    '#E87040',
  rabbit: '#B8A090',
};

/* ── Species Emojis ── */
export const SPECIES_EMOJIS = {
  moose:  '🫎',
  deer:   '🦌',
  bear:   '🐻',
  fox:    '🦊',
  rabbit: '🐇',
};

/* ── Species Abilities ── */
export const SPECIES_ABILITIES = {
  moose:  ['Walk', 'Run', 'Graze', 'Drink', 'Sleep'],
  deer:   ['Walk', 'Run', 'Graze', 'Drink', 'Sleep'],
  bear:   ['Walk', 'Run', 'Hunt Fish', 'Drink', 'Sleep'],
  fox:    ['Walk', 'Run', 'Hunt Prey', 'Drink', 'Sleep'],
  rabbit: ['Walk', 'Run', 'Graze', 'Drink', 'Sleep'],
};

/* ── Animation Timing ── */
export const TIMING = {
  button:  150,
  card:    250,
  panel:   300,
  camera:  400,
  bar:     500,
  notification: 350,
};

/* ── Easing Curves (CSS cubic-bezier) ── */
export const EASING = {
  easeOutExpo:    'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOutCubic: 'cubic-bezier(0.65, 0, 0.35, 1)',
  spring:         'cubic-bezier(0.34, 1.56, 0.64, 1)',
  smooth:         'cubic-bezier(0.25, 0.1, 0.25, 1)',
};

/* ── Breakpoints ── */
export const BREAKPOINTS = {
  mobile:  768,
  tablet:  1200,
  desktop: 1200,
};

/* ── Z-Index Layers ── */
export const Z_INDEX = {
  world:        0,
  hud:          10,
  panel:        20,
  notification: 30,
  modal:        40,
  tooltip:      50,
  loading:      1000,
};

/* ── Glassmorphism ── */
export const GLASS = {
  bg:          'rgba(8, 14, 12, 0.42)',
  bgHover:     'rgba(12, 20, 16, 0.52)',
  border:      'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.14)',
  blur:        '20px',
  blurHeavy:   '28px',
};

/* ── Behavior → Label + Color Map ── */
export const BEHAVIOR_DISPLAY = {
  Idle:    { label: 'Resting',           color: STAT_COLORS.healthy.base,   icon: '💤' },
  Wander:  { label: 'Exploring',         color: STAT_COLORS.searching.base, icon: '🚶' },
  Graze:   { label: 'Grazing',           color: STAT_COLORS.healthy.base,   icon: '🌿' },
  Drink:   { label: 'Drinking',          color: STAT_COLORS.hydration.base, icon: '💧' },
  Sleep:   { label: 'Sleeping',          color: STAT_COLORS.sleep.base,     icon: '😴' },
  Hunt:    { label: 'Hunting',           color: STAT_COLORS.danger.base,    icon: '🎯' },
  Flee:    { label: 'Fleeing',           color: STAT_COLORS.danger.base,    icon: '💨' },
  Walk:    { label: 'Walking',           color: STAT_COLORS.searching.base, icon: '🚶' },
  Run:     { label: 'Running',           color: STAT_COLORS.energy.base,    icon: '🏃' },
};

export function getBehaviorDisplay(behavior) {
  return BEHAVIOR_DISPLAY[behavior] || {
    label: behavior || 'Idle',
    color: STAT_COLORS.healthy.base,
    icon: '🐾',
  };
}

/* ── Health Status ── */
export function getHealthStatus(stats) {
  const energy    = stats?.energy ?? 100;
  const hydration = stats?.hydration ?? 100;
  const hunger    = stats?.hunger ?? 100;
  const avg = (energy + hydration + hunger) / 3;

  if (avg < 20) return { label: 'Critical', color: STAT_COLORS.danger.base };
  if (avg < 40) return { label: 'Stressed',  color: STAT_COLORS.hunger.base };
  if (avg < 60) return { label: 'Fair',      color: STAT_COLORS.energy.base };
  return           { label: 'Healthy',   color: STAT_COLORS.healthy.base };
}
