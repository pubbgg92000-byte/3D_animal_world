const MARK_PREFIX = 'wild-trails:';
const marks = new Map();
const ENABLE_DOM_DIAGNOSTICS =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('debugPerf');

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function markStartupPhase(name, detail = {}) {
  const time = now();
  marks.set(name, { time, detail });

  if (typeof performance !== 'undefined' && performance.mark) {
    try {
      performance.mark(`${MARK_PREFIX}${name}`);
    } catch {
      // User timing can throw in restricted runtimes; keep in-memory marks.
    }
  }

  if (ENABLE_DOM_DIAGNOSTICS) {
    window.__WILD_TRAILS_STARTUP__ = getStartupTimings();
    document.documentElement.dataset.wildTrailsStartup = JSON.stringify(window.__WILD_TRAILS_STARTUP__);
  }
}

export function getStartupTimings() {
  const ordered = [...marks.entries()].sort((a, b) => a[1].time - b[1].time);
  const first = ordered[0]?.[1].time ?? now();

  return ordered.map(([name, mark], index) => {
    const previous = ordered[index - 1]?.[1].time ?? first;
    return {
      name,
      sinceStartMs: Math.round(mark.time - first),
      deltaMs: Math.round(mark.time - previous),
      detail: mark.detail,
    };
  });
}

export function reportRuntimeStats(renderer) {
  if (!renderer || !ENABLE_DOM_DIAGNOSTICS) return;
  const info = renderer.info;
  window.__WILD_TRAILS_RENDER_STATS__ = {
    calls: info.render.calls,
    triangles: info.render.triangles,
    points: info.render.points,
    lines: info.render.lines,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    memory: performance.memory ? {
      usedJSHeapMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
      totalJSHeapMB: Math.round(performance.memory.totalJSHeapSize / 1048576),
      limitJSHeapMB: Math.round(performance.memory.jsHeapSizeLimit / 1048576),
    } : null,
  };
  document.documentElement.dataset.wildTrailsRenderStats = JSON.stringify(window.__WILD_TRAILS_RENDER_STATS__);
}

export function reportFpsSample(fps) {
  if (!ENABLE_DOM_DIAGNOSTICS) return;
  window.__WILD_TRAILS_FPS__ = fps;
  document.documentElement.dataset.wildTrailsFps = String(fps);
}

export function reportReactCommit(id, actualDuration) {
  if (!ENABLE_DOM_DIAGNOSTICS) return;
  const current = window.__WILD_TRAILS_REACT_PROFILER__ || {};
  const entry = current[id] || {
    commits: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
  };

  entry.commits += 1;
  entry.totalDurationMs += actualDuration;
  entry.maxDurationMs = Math.max(entry.maxDurationMs, actualDuration);
  entry.averageDurationMs = entry.totalDurationMs / entry.commits;
  current[id] = entry;

  window.__WILD_TRAILS_REACT_PROFILER__ = current;
  document.documentElement.dataset.wildTrailsReactProfiler = JSON.stringify(current);
}
