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
    shadowMapSize: 2048,
    grassDensity: 1.0,
    particleCount: 300,
    fireflyCount: 50,
    maxDPR: 1.35,
    enableBlur: true,
    minimapUpdateRate: 500,
    treeDetailDistance: 80,
    enableShadows: true,
  },
  medium: {
    tier: 'medium',
    shadowMapSize: 1024,
    grassDensity: 0.6,
    particleCount: 150,
    fireflyCount: 25,
    maxDPR: 1.0,
    enableBlur: false,
    minimapUpdateRate: 1000,
    treeDetailDistance: 50,
    enableShadows: true,
  },
  low: {
    tier: 'low',
    shadowMapSize: 512,
    grassDensity: 0.3,
    particleCount: 60,
    fireflyCount: 10,
    maxDPR: 0.85,
    enableBlur: false,
    minimapUpdateRate: 2000,
    treeDetailDistance: 30,
    enableShadows: false,
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
