/**
 * Wild Trails — Performance Configuration
 *
 * Detects device capabilities and provides tier-specific settings.
 * Used throughout the app to scale rendering quality.
 *
 * Tiers:
 *  - "high":   Desktop, high-DPR displays, ≥4 GB RAM
 *  - "medium": Tablets, mid-range phones
 *  - "low":    Low-end phones, ≤4 GB RAM, low-DPR
 */

function detectTier() {
  if (typeof window === 'undefined') return 'high';

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const dpr = window.devicePixelRatio || 1;
  // navigator.deviceMemory is Chrome-only; fallback conservatively
  const memory = navigator.deviceMemory || (isMobile ? 4 : 8);
  const cores = navigator.hardwareConcurrency || 4;
  const smallScreen = window.innerWidth <= 768;

  if (!isMobile && memory >= 6 && cores >= 4) return 'high';
  if (isMobile && memory <= 3) return 'low';
  if (isMobile && smallScreen && dpr <= 2 && cores <= 4) return 'low';
  if (isMobile || smallScreen) return 'medium';
  return 'high';
}

const tier = detectTier();

const TIER_CONFIGS = {
  high: {
    tier: 'high',
    shadowMapSize: 1536,
    grassDensity: 0.72,
    particleCount: 180,
    fireflyCount: 32,
    maxDPR: 1.35,
    enableBlur: true,
    minimapUpdateRate: 900,
    treeDetailDistance: 80,
    enableShadows: true,
    maxRenderedAnimals: 7,
  },
  medium: {
    tier: 'medium',
    shadowMapSize: 1024,
    grassDensity: 0.38,
    particleCount: 80,
    fireflyCount: 14,
    maxDPR: 1.0,
    enableBlur: false,
    minimapUpdateRate: 1500,
    treeDetailDistance: 50,
    enableShadows: false,
    maxRenderedAnimals: 4,
  },
  low: {
    tier: 'low',
    shadowMapSize: 512,
    grassDensity: 0.18,
    particleCount: 30,
    fireflyCount: 6,
    maxDPR: 0.85,
    enableBlur: false,
    minimapUpdateRate: 2000,
    treeDetailDistance: 30,
    enableShadows: false,
    maxRenderedAnimals: 3,
  },
};

export const perfConfig = TIER_CONFIGS[tier];

export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );
}

export default perfConfig;
