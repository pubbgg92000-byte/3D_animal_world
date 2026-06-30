/**
 * Wild Trails — single high-quality configuration.
 *
 * The app intentionally uses one consistent visual mode: GLB animals, GLB fish,
 * full pond/stream details, shadows, and rich vegetation for every visitor.
 */
export const perfConfig = {
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
  maxRenderedAnimals: 999,
};

export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );
}

export default perfConfig;
