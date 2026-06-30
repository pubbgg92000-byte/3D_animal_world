import { Suspense, lazy, useState, useCallback, useRef, useEffect, useMemo, Component, memo, Profiler } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Config
import { ANIMAL_LIST } from './config/animalConfig';
import perfConfig, { isMobileDevice } from './config/performanceConfig';

// Components
import Sky from './components/Sky';
import CameraController from './components/CameraController';
import LoadingScreen from './components/LoadingScreen';
import DestinationMarker from './components/DestinationMarker';
import HUD from './components/ui/HUD';
import Terrain from './components/environment/Terrain/Terrain';

import { playClick } from './hooks/useAudioFeedback';
import {
  createWaterApproachPoints,
  isWaterAt,
} from './utils/world';
import { markStartupPhase, reportFpsSample, reportReactCommit, reportRuntimeStats } from './utils/startupProfiler';

const CANVAS_DPR = [1, perfConfig.maxDPR];
const SHADOW_CONFIG = perfConfig.enableShadows ? { type: THREE.PCFShadowMap } : false;
const GL_CONFIG = {
  antialias: perfConfig.tier !== 'low',
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.2,
  outputColorSpace: THREE.SRGBColorSpace,
};
const CAMERA_CONFIG = {
  fov: 45,
  near: 0.1,
  far: 500,
  position: [8, 5, 10],
};
const IS_CONSTRAINED_DEVICE = perfConfig.tier !== 'high' || isMobileDevice();
const HIGH_QUALITY_STREAMING =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('quality') === 'high';
const STREAM_DECOR = HIGH_QUALITY_STREAMING && !IS_CONSTRAINED_DEVICE;
const INITIAL_ANIMAL_RATIO = 0.2;
const INITIAL_ANIMAL_COUNT = Math.max(1, Math.ceil(ANIMAL_LIST.length * INITIAL_ANIMAL_RATIO));
const MIN_LOADING_SCREEN_MS = 3000;
const ANIMAL_MODEL_STREAM_INTERVAL = IS_CONSTRAINED_DEVICE ? 2200 : 1400;
const Animal = lazy(() => import('./components/Animal'));
const Fish = lazy(() => import('./components/Fish'));
const Pond = lazy(() => import('./components/Pond'));
const PondStream = lazy(() => import('./components/Pond').then((module) => ({ default: module.PondStream })));
const FloatingParticles = lazy(() => import('./components/FloatingParticles'));
const AssetManager = lazy(() => import('./components/environment/AssetManager'));
const Forest = lazy(() => import('./components/environment/Forest/Forest'));
const Grass = lazy(() => import('./components/environment/Grass/Grass'));

const LAST_SELECTED_ANIMAL_KEY = 'wild-trails:last-selected-animal';
const MINIMAL_MARKERS_KEY = 'wild-trails:minimal-destination-markers';
const FIRST_TOUR_SEEN_KEY = 'wild-trails:first-tour-seen';
const WATER_APPROACH_POINTS = createWaterApproachPoints();

function getLocalMinutesSinceMidnight() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

const COMMANDS = {
  walk: {
    type: 'walk',
    label: 'Explore',
    icon: '🍃',
    behavior: null,
    feedback: 'Exploring',
  },
  drink: {
    type: 'drink',
    label: 'Drink',
    icon: '💧',
    behavior: 'Drink',
    feedback: 'Hydrated',
  },
  food: {
    type: 'food',
    label: 'Search Food',
    icon: '🍓',
    behavior: 'Graze',
    feedback: '+15 Energy',
  },
  rest: {
    type: 'rest',
    label: 'Rest',
    icon: '🌲',
    behavior: 'Sleep',
    feedback: 'Well Rested',
  },
  shelter: {
    type: 'shelter',
    label: 'Shelter',
    icon: '🪵',
    behavior: 'Sleep',
    feedback: 'Sheltered',
  },
  hunt: {
    type: 'hunt',
    label: 'Hunt',
    icon: '🐾',
    behavior: 'Hunt Prey',
    feedback: 'Caught Prey',
  },
  fish: {
    type: 'fish',
    label: 'Fish',
    icon: '🐟',
    behavior: 'Hunt Fish',
    feedback: 'Caught Fish',
  },
};

function getNearestWaterBank(point) {
  let best = WATER_APPROACH_POINTS[0];
  let bestDistance = Infinity;
  for (const candidate of WATER_APPROACH_POINTS) {
    const distance = candidate.distanceToSquared(point);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best.clone();
}

function getCommandOptions(point, selectedConfig) {
  const species = selectedConfig?.species || selectedConfig?.id;
  const isPredator = species === 'bear' || species === 'fox';
  const nearWater = isWaterAt(point.x, point.z, 1.2);
  const options = [];

  if (nearWater) {
    options.push(species === 'bear' ? COMMANDS.fish : COMMANDS.drink);
    if (species !== 'bear') options.push(COMMANDS.drink);
  }

  options.push(COMMANDS.walk);
  if (isPredator) options.push(COMMANDS.hunt);
  else options.push(COMMANDS.food);
  options.push(COMMANDS.rest, COMMANDS.shelter);

  return Array.from(new Map(options.map((option) => [option.type, option])).values());
}

const EcosystemActionMenu = memo(function EcosystemActionMenu({ commandTarget, selectedConfig, onChoose, onClose }) {
  if (!commandTarget) return null;
  const options = getCommandOptions(commandTarget.point, selectedConfig);
  const x = Math.min(window.innerWidth - 220, Math.max(16, commandTarget.screen.x));
  const y = Math.min(window.innerHeight - 210, Math.max(72, commandTarget.screen.y));

  return (
    <div
      className="wt-ecosystem-menu"
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Choose natural behaviour"
    >
      <div className="wt-ecosystem-menu__title">Guide wildlife</div>
      {options.map((option) => (
        <button
          key={option.type}
          className="wt-ecosystem-menu__item"
          onClick={() => onChoose(option)}
          role="menuitem"
        >
          <span>{option.icon}</span>
          <strong>{option.label}</strong>
        </button>
      ))}
      <button className="wt-ecosystem-menu__dismiss" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
});

function getInitialSelectedAnimalId() {
  return null;
}

function getStoredSelectedAnimalId() {
  if (typeof window === 'undefined') return null;
  try {
    const savedId = window.localStorage.getItem(LAST_SELECTED_ANIMAL_KEY);
    return savedId && ANIMAL_LIST.some((animal) => animal.id === savedId) ? savedId : null;
  } catch {
    return null;
  }
}

function shouldRunFirstTour() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(FIRST_TOUR_SEEN_KEY) !== 'true';
  } catch {
    return false;
  }
}

function rememberFirstTourSeen() {
  try {
    window.localStorage.setItem(FIRST_TOUR_SEEN_KEY, 'true');
  } catch {
    // Tour is optional; failure just means it may run again in restricted storage.
  }
}

/* ========================================
   Error Boundary
   ======================================== */
class AnimalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.warn(`[AnimalError] ${this.props.animalId}:`, error.message);
    this.props.onError?.(this.props.animalId);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/* ========================================
   Lighting
   ======================================== */
const SceneLighting = memo(function SceneLighting({ simMinutesRef }) {
  const dirLightRef = useRef();
  const ambientRef = useRef();
  const hemiRef = useRef();

  // Animate lighting based on time of day
  useFrame(() => {
    const m = simMinutesRef?.current ?? 540;
    const hour = m / 60;
    // Sun position: rises east, arcs overhead, sets west
    const sunAngle = ((hour - 6) / 12) * Math.PI; // 0 at 6am, π at 6pm
    const sunHeight = Math.sin(sunAngle);
    const isDay = hour >= 5.5 && hour <= 20.5;

    if (dirLightRef.current) {
      // Sun position
      const sx = Math.cos(sunAngle) * 55;
      const sy = Math.max(5, sunHeight * 55);
      const sz = -30;
      dirLightRef.current.position.set(sx, sy, sz);

      // Intensity: bright midday, dim at dawn/dusk, very dim at night
      let intensity = 2.15;
      if (hour < 6) intensity = 0.1;
      else if (hour < 8) intensity = 0.4 + ((hour - 6) / 2) * 1.75;
      else if (hour > 18) intensity = Math.max(0.1, 2.15 - ((hour - 18) / 2.5) * 2.05);
      else if (hour > 20) intensity = 0.1;
      dirLightRef.current.intensity = intensity;

      // Color temperature: warm at dawn/dusk, neutral midday
      let r = 1, g = 0.945, b = 0.81; // default warm white
      if (hour >= 6 && hour < 8) {
        const t = (hour - 6) / 2;
        r = 1; g = 0.7 + t * 0.245; b = 0.45 + t * 0.36;
      } else if (hour >= 17 && hour < 20) {
        const t = (hour - 17) / 3;
        r = 1; g = 0.945 - t * 0.25; b = 0.81 - t * 0.45;
      } else if (hour >= 20 || hour < 6) {
        r = 0.3; g = 0.35; b = 0.55;
      }
      dirLightRef.current.color.setRGB(r, g, b);
    }

    // Ambient: dimmer at night
    if (ambientRef.current) {
      ambientRef.current.intensity = isDay ? 0.48 : 0.12;
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = isDay ? 0.62 : 0.15;
    }
  });

  return (
    <>
      <directionalLight
        ref={dirLightRef}
        position={[55, 55, -30]}
        intensity={2.15}
        color="#fff1cf"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={170}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0005}
      />
      <ambientLight ref={ambientRef} intensity={0.48} color="#cfe7ff" />
      <hemisphereLight ref={hemiRef} skyColor="#8ed4ff" groundColor="#52752f" intensity={0.62} />
    </>
  );
});

function StartupSceneReporter({ loadStage, onFirstInteractiveFrame }) {
  const { gl } = useThree();
  const firstInteractiveFrameSent = useRef(false);
  const statsTime = useRef(0);
  const fpsWindow = useRef({ startedAt: 0, frames: 0 });

  useEffect(() => {
    markStartupPhase('renderer');
    return undefined;
  }, []);

  useFrame(({ clock }) => {
    if (loadStage >= 1 && !firstInteractiveFrameSent.current) {
      firstInteractiveFrameSent.current = true;
      markStartupPhase('render-first-frame', { stage: loadStage });
      reportRuntimeStats(gl);
      onFirstInteractiveFrame?.();
    }

    if (clock.elapsedTime - statsTime.current > 1) {
      statsTime.current = clock.elapsedTime;
      reportRuntimeStats(gl);
    }

    if (!fpsWindow.current.startedAt) fpsWindow.current.startedAt = clock.elapsedTime;
    fpsWindow.current.frames += 1;
    const elapsed = clock.elapsedTime - fpsWindow.current.startedAt;
    if (elapsed >= 3) {
      reportFpsSample(Math.round(fpsWindow.current.frames / elapsed));
      fpsWindow.current = { startedAt: clock.elapsedTime, frames: 0 };
    }
  });

  return null;
}

/* ========================================
   Camera Position Reporter
   ======================================== */
function CameraPositionReporter({ onUpdate }) {
  const { camera } = useThree();

  // Report camera position at tier-appropriate rate for minimap
  useEffect(() => {
    const interval = setInterval(() => {
      onUpdate?.({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
    }, perfConfig.minimapUpdateRate);
    return () => clearInterval(interval);
  }, [camera, onUpdate]);

  return null;
}

/* ========================================
   Arrival Detection threshold (world units)
   ======================================== */
const ARRIVAL_THRESHOLD = 2.5;
function getAnimalLoadOrder(selectedId) {
  const selected = ANIMAL_LIST.find((animal) => animal.id === selectedId) || ANIMAL_LIST[0];
  const [sx, , sz] = selected?.spawnPos || [0, 0, 0];
  return [...ANIMAL_LIST]
    .sort((a, b) => {
      if (a.id === selected?.id) return -1;
      if (b.id === selected?.id) return 1;
      const [ax, , az] = a.spawnPos || [0, 0, 0];
      const [bx, , bz] = b.spawnPos || [0, 0, 0];
      return Math.hypot(ax - sx, az - sz) - Math.hypot(bx - sx, bz - sz);
    })
    .map((animal) => animal.id);
}

/* ========================================
   App Component
   ======================================== */
export default function App() {
  // Progressive loading: 5 stages
  // 0: Terrain + Sky + Lighting + Camera
  // 1: Selected animal + Pond + essential UI (world becomes playable)
  // 2: Grass + FloatingParticles
  // 3: Forest + AssetManager + remaining animals
  // 4: Fish + everything else (fully loaded)
  const [loadStage, setLoadStage] = useState(0);
  const [firstInteractiveFrame, setFirstInteractiveFrame] = useState(false);
  const [minimumLoadTimeElapsed, setMinimumLoadTimeElapsed] = useState(false);
  const [nearbyGrassReady, setNearbyGrassReady] = useState(false);
  const [nearbyTreesReady, setNearbyTreesReady] = useState(false);
  const [streamDistantHabitat, setStreamDistantHabitat] = useState(false);
  const [renderedAnimalIds, setRenderedAnimalIds] = useState([]);
  const [readyAnimalIds, setReadyAnimalIds] = useState(() => new Set());

  // Selection
  const [selectedId, setSelectedId] = useState(getInitialSelectedAnimalId);
  const [firstTourActive, setFirstTourActive] = useState(shouldRunFirstTour);
  const initialSelectedId = useRef(ANIMAL_LIST[0]?.id || 'moose');
  const lastSelectedId = useRef(getStoredSelectedAnimalId() || ANIMAL_LIST[0]?.id || 'moose');
  const initialAnimalIds = useMemo(
    () => getAnimalLoadOrder(initialSelectedId.current).slice(0, INITIAL_ANIMAL_COUNT),
    []
  );
  const initialAnimalsReady = initialAnimalIds.every((id) => readyAnimalIds.has(id));
  const initialHabitatCenter = useMemo(() => {
    const selected = ANIMAL_LIST.find((animal) => animal.id === initialSelectedId.current);
    return selected?.spawnPos || [0, 0, 0];
  }, []);
  const nearbyHabitatReady = nearbyGrassReady && nearbyTreesReady;
  const worldReady =
    firstInteractiveFrame &&
    minimumLoadTimeElapsed &&
    initialAnimalsReady &&
    nearbyHabitatReady;

  // Per-animal destinations
  const [destinations, setDestinations] = useState({});
  const [destinationSerials, setDestinationSerials] = useState({});
  const [runningFor, setRunningFor] = useState({});

  // Active destination marker (only for selected animal)
  const [activeMarker, setActiveMarker] = useState(null);
  const [commandTarget, setCommandTarget] = useState(null);
  const [minimalDestinationMarkers, setMinimalDestinationMarkers] = useState(() => {
    try { return localStorage.getItem(MINIMAL_MARKERS_KEY) === 'true'; }
    catch { return false; }
  });

  // Per-animal stats and behaviors
  const [allStats, setAllStats] = useState({});
  const [allBehaviors, setAllBehaviors] = useState({});
  const [forcedBehaviors, setForcedBehaviors] = useState({});

  // Camera
  const [cameraMode, setCameraMode] = useState(() => shouldRunFirstTour() ? 'cinematic' : 'free');
  const lastAnimalCameraMode = useRef('follow');
  const [cameraPosition, setCameraPosition] = useState(null);
  const [cameraSettings, setCameraSettings] = useState({
    fov: 45,
    smoothness: 0.5,
    zoomSpeed: 1,
  });
  const animalPositions = useRef({});
  const [animalPositionsSnapshot, setAnimalPositionsSnapshot] = useState({});
  const tourTarget = useMemo(() => new THREE.Vector3(0, 0, 5), []);

  // Simulation time ref — updated by HUD clock, read by Sky/Lighting per-frame
  const simMinutesRef = useRef(getLocalMinutesSinceMidnight());
  const handleClockUpdate = useCallback((m) => {
    simMinutesRef.current = m;
  }, []);

  useEffect(() => {
    markStartupPhase('app-mounted');
    markStartupPhase('initialize-camera');
    markStartupPhase('initialize-terrain');
    markStartupPhase('initialize-sky');
    markStartupPhase('initialize-lighting');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumLoadTimeElapsed(true), MIN_LOADING_SCREEN_MS);
    return () => clearTimeout(timer);
  }, []);

  // Load the selected animal first, then one nearby animal before entering.
  useEffect(() => {
    if (loadStage < 1) return;
    setRenderedAnimalIds((current) => {
      const nextId = initialAnimalIds.find((id) => !current.includes(id));
      if (!nextId) return current;
      const previousId = initialAnimalIds[initialAnimalIds.indexOf(nextId) - 1];
      if (previousId && !readyAnimalIds.has(previousId)) return current;
      return [...current, nextId];
    });
  }, [initialAnimalIds, loadStage, readyAnimalIds]);

  // Once inside the world, stream one nearby animal during each quiet browser slot.
  useEffect(() => {
    if (
      !worldReady ||
      renderedAnimalIds.length >= ANIMAL_LIST.length ||
      renderedAnimalIds.length >= perfConfig.maxRenderedAnimals
    ) return undefined;
    if (renderedAnimalIds.some((id) => !readyAnimalIds.has(id))) return undefined;
    const order = getAnimalLoadOrder(selectedId || lastSelectedId.current);
    const nextId = order.find((id) => !renderedAnimalIds.includes(id));
    if (!nextId) return undefined;

    let timer;
    let idleId;
    const enqueue = () => {
      timer = setTimeout(() => {
        setRenderedAnimalIds((current) => {
          if (current.includes(nextId) || current.length >= perfConfig.maxRenderedAnimals) return current;
          return [...current, nextId];
        });
      }, ANIMAL_MODEL_STREAM_INTERVAL);
    };

    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(enqueue, { timeout: ANIMAL_MODEL_STREAM_INTERVAL });
    } else {
      enqueue();
    }
    return () => {
      clearTimeout(timer);
      if (idleId && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId);
    };
  }, [readyAnimalIds, renderedAnimalIds, selectedId, worldReady]);

  useEffect(() => {
    if (!worldReady) return undefined;
    let timer;
    let idleId;
    const reveal = () => {
      timer = setTimeout(() => setStreamDistantHabitat(true), 900);
    };
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(reveal, { timeout: 1400 });
    } else {
      reveal();
    }
    return () => {
      clearTimeout(timer);
      if (idleId && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleId);
    };
  }, [worldReady]);

  useEffect(() => {
    try {
      localStorage.setItem(MINIMAL_MARKERS_KEY, String(minimalDestinationMarkers));
    } catch {
      // Settings still work for the current session.
    }
  }, [minimalDestinationMarkers]);

  useEffect(() => {
    if (!commandTarget) return undefined;
    const timer = setTimeout(() => setCommandTarget(null), 4000);
    return () => clearTimeout(timer);
  }, [commandTarget]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') setCommandTarget(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const completeActiveMarker = useCallback(() => {
    const behavior = activeMarker?.command?.behavior;
    setActiveMarker((prev) => prev ? { ...prev, arrived: true } : null);
    setCommandTarget(null);

    if (behavior && selectedId) {
      setForcedBehaviors((current) => ({
        ...current,
        [selectedId]: behavior,
      }));
      setTimeout(() => {
        setForcedBehaviors((current) => {
          if (current[selectedId] !== behavior) return current;
          const next = { ...current };
          delete next[selectedId];
          return next;
        });
      }, 7000);
    }

    setTimeout(() => setActiveMarker(null), 1700);
  }, [activeMarker, selectedId]);

  // Periodically snapshot positions for minimap + arrival detection
  useEffect(() => {
    const interval = setInterval(() => {
      const snap = {};
      for (const [id, pos] of Object.entries(animalPositions.current)) {
        snap[id] = { x: pos.x, y: pos.y, z: pos.z };
      }
      setAnimalPositionsSnapshot(snap);

      // Arrival detection for destination marker
      if (activeMarker && !activeMarker.arrived && selectedId) {
        const animalPos = animalPositions.current[selectedId];
        if (animalPos) {
          const dx = animalPos.x - activeMarker.position.x;
          const dz = animalPos.z - activeMarker.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < ARRIVAL_THRESHOLD) {
            completeActiveMarker();
          }
        }
      }
    }, 300);
    return () => clearInterval(interval);
  }, [activeMarker, completeActiveMarker, selectedId]);

  // Progressive startup phases. Stage 1 is the first playable slice; everything
  // after that streams during idle time or timed gaps so Suspense never gates
  // the first interactive frame.
  useEffect(() => {
    let cancelled = false;
    const idleIds = [];
    const timers = [];

    const scheduleNextStage = (stage, fallbackMs) => {
      const run = () => {
        if (cancelled) return;
        setLoadStage((current) => {
          if (current >= stage) return current;
          markStartupPhase(
            stage === 1 ? 'spawn-nearby-animals' :
              stage === 2 ? 'stream-grass-particles' :
                stage === 3 ? 'stream-forest-ai' :
                  'stream-fish-audio-particles',
            { stage }
          );
          return stage;
        });
      };
      if (typeof requestIdleCallback === 'function') {
        const id = requestIdleCallback(run, { timeout: fallbackMs });
        idleIds.push(id);
        return id;
      }
      const id = setTimeout(run, fallbackMs);
      timers.push(id);
      return id;
    };

    const delay = (ms, fn) => {
      const id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    };

    markStartupPhase('initialize-renderer');
    scheduleNextStage(1, 250);
    delay(650, () => scheduleNextStage(2, 600));
    delay(1400, () => scheduleNextStage(3, 900));
    delay(2300, () => scheduleNextStage(4, 1000));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (typeof cancelIdleCallback === 'function') {
        idleIds.forEach(cancelIdleCallback);
      }
    };
  }, []);

  // ---------- Handlers ----------

  const issueCommand = useCallback(
    (point, command, { run = false } = {}) => {
      if (!selectedId) return;
      const destination = isWaterAt(point.x, point.z, 0.9)
        ? getNearestWaterBank(point)
        : point.clone();

      playClick();
      setDestinations((prev) => ({ ...prev, [selectedId]: destination }));
      setDestinationSerials((prev) => ({ ...prev, [selectedId]: (prev[selectedId] || 0) + 1 }));
      setRunningFor((prev) => ({ ...prev, [selectedId]: run }));
      setActiveMarker({
        position: destination.clone(),
        arrived: false,
        command,
      });
      setCommandTarget(null);
    },
    [selectedId]
  );

  // Single click/tap → walk directly (no popup)
  const handleGroundClick = useCallback(
    (point) => {
      if (!selectedId) return;
      setCommandTarget(null);
      issueCommand(point, COMMANDS.walk);
    },
    [selectedId, issueCommand]
  );

  // Double-click → run
  const handleGroundDoubleClick = useCallback(
    (point) => {
      if (!selectedId) return;
      issueCommand(point, COMMANDS.walk, { run: true });
    },
    [issueCommand, selectedId]
  );

  // Long-press (mobile) or right-click (desktop) → context menu
  const handleGroundLongPress = useCallback(
    (point, screen) => {
      if (!selectedId) return;
      setCommandTarget({ point, screen });
    },
    [selectedId]
  );

  const handleSelectAnimal = useCallback((id) => {
    setActiveMarker(null);
    setCommandTarget(null);
    setRenderedAnimalIds((current) => (
      current.includes(id)
        ? current
        : [id, ...current].slice(0, Math.max(1, perfConfig.maxRenderedAnimals))
    ));
    rememberFirstTourSeen();
    setFirstTourActive(false);

    setSelectedId((current) => {
      if (current === id) {
        if (cameraMode !== 'free') lastAnimalCameraMode.current = cameraMode;
        setCameraMode('free');
        return null;
      }

      lastSelectedId.current = id;
      if (cameraMode === 'free') setCameraMode(lastAnimalCameraMode.current || 'follow');
      else lastAnimalCameraMode.current = cameraMode;

      try {
        window.localStorage.setItem(LAST_SELECTED_ANIMAL_KEY, id);
      } catch {
        // Selection still works even if persistence is unavailable.
      }
      return id;
    });
  }, [cameraMode]);

  const handleAnimalReady = useCallback((id) => {
    setReadyAnimalIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      markStartupPhase('animal-ready', { id, ready: next.size });
      return next;
    });
  }, []);

  const handleNearbyGrassReady = useCallback(() => {
    setNearbyGrassReady(true);
  }, []);

  const handleNearbyTreesReady = useCallback(() => {
    setNearbyTreesReady(true);
  }, []);

  useEffect(() => {
    if (nearbyHabitatReady) markStartupPhase('nearby-glb-habitat-ready');
  }, [nearbyHabitatReady]);

  const handleCameraModeChange = useCallback((mode) => {
    setCameraMode(mode);
    if (selectedId && mode !== 'free') {
      lastAnimalCameraMode.current = mode;
    }
  }, [selectedId]);

  const handlePositionUpdate = useCallback((id, pos) => {
    if (!animalPositions.current[id]) {
      animalPositions.current[id] = new THREE.Vector3();
    }
    animalPositions.current[id].copy(pos);
  }, []);

  const handleStatsUpdate = useCallback((id, stats) => {
    setAllStats((prev) => {
      // Only update if values changed significantly (avoid re-render spam)
      const old = prev[id];
      if (
        old &&
        Math.abs(old.energy - stats.energy) < 0.5 &&
        Math.abs(old.hydration - stats.hydration) < 0.5 &&
        Math.abs(old.hunger - stats.hunger) < 0.5
      ) {
        return prev;
      }
      return { ...prev, [id]: stats };
    });
  }, []);

  const handleBehaviorUpdate = useCallback((id, behavior) => {
    setAllBehaviors((prev) => {
      if (prev[id] === behavior) return prev;
      return { ...prev, [id]: behavior };
    });
  }, []);

  const handleFirstInteractiveFrame = useCallback(() => {
    setFirstInteractiveFrame(true);
  }, []);

  useEffect(() => {
    if (worldReady) markStartupPhase('hide-loading-screen');
  }, [worldReady]);

  useEffect(() => {
    if (!worldReady || !firstTourActive || selectedId) return undefined;
    const timer = setTimeout(() => {
      rememberFirstTourSeen();
      setFirstTourActive(false);
      setCameraMode('free');
    }, 18000);
    return () => clearTimeout(timer);
  }, [firstTourActive, selectedId, worldReady]);

  const handleReactRender = useCallback((id, _phase, actualDuration) => {
    reportReactCommit(id, actualDuration);
  }, []);

  // Force a behavior from the UI — clears after 12s (handled by AI)
  const handleForceAbility = useCallback((ability) => {
    if (!selectedId) return;
    setForcedBehaviors((prev) => ({ ...prev, [selectedId]: ability }));
    // Auto-clear after 12 seconds so it doesn't get stuck
    setTimeout(() => {
      setForcedBehaviors((prev) => {
        if (prev[selectedId] === ability) {
          const next = { ...prev };
          delete next[selectedId];
          return next;
        }
        return prev;
      });
    }, 12000);
  }, [selectedId]);

  // Camera target = selected animal position
  const cameraTargetFallback = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = selectedId
    ? animalPositions.current[selectedId] || cameraTargetFallback
    : firstTourActive
      ? tourTarget
      : null;

  // State label for camera
  const selectedBehavior = allBehaviors[selectedId] || 'Idle';
  const mooseState =
    selectedBehavior === 'Wander' || selectedBehavior === 'Hunt'
      ? 'Walking'
      : selectedBehavior === 'Sleep'
        ? 'Idle'
        : 'Idle';


  return (
    <>
      <LoadingScreen
        loadStage={loadStage}
        worldReady={worldReady}
        readyAnimals={readyAnimalIds.size}
        initialAnimalCount={INITIAL_ANIMAL_COUNT}
        nearbyHabitatReady={nearbyHabitatReady}
      />

      <>

      {worldReady && (
      <Profiler id="HUD" onRender={handleReactRender}>
        <HUD
          selectedAnimalId={selectedId}
          animalConfigs={ANIMAL_LIST}
          animalStats={allStats}
          animalBehaviors={allBehaviors}
          animalPositions={animalPositionsSnapshot}
          cameraMode={selectedId || firstTourActive ? cameraMode : 'free'}
          cameraPosition={cameraPosition}
          cameraSettings={cameraSettings}
          onCameraModeChange={handleCameraModeChange}
          onCameraSettingsChange={setCameraSettings}
          onSelectAnimal={handleSelectAnimal}
          onForceAbility={handleForceAbility}
          onClockUpdate={handleClockUpdate}
          minimalDestinationMarkers={minimalDestinationMarkers}
          onMinimalDestinationMarkersChange={setMinimalDestinationMarkers}
          loadStage={loadStage}
        />
      </Profiler>
      )}

      <EcosystemActionMenu
        commandTarget={commandTarget}
        selectedConfig={ANIMAL_LIST.find((animal) => animal.id === selectedId)}
        onChoose={(command) => issueCommand(commandTarget.point, command)}
        onClose={() => setCommandTarget(null)}
      />

      <Canvas
        shadows={SHADOW_CONFIG}
        dpr={CANVAS_DPR}
        gl={GL_CONFIG}
        camera={CAMERA_CONFIG}
      >
        <StartupSceneReporter
          loadStage={loadStage}
          onFirstInteractiveFrame={handleFirstInteractiveFrame}
        />
        <SceneLighting simMinutesRef={simMinutesRef} />
        <Sky simMinutesRef={simMinutesRef} />
        <Terrain
          onClick={handleGroundClick}
          onDoubleClick={handleGroundDoubleClick}
          onLongPress={handleGroundLongPress}
        />
        {loadStage >= 1 && (
          <Suspense fallback={null}>
            <Grass
              densityMultiplier={perfConfig.grassDensity}
              center={initialHabitatCenter}
              region="near"
              nearRadius={24}
              onReady={handleNearbyGrassReady}
            />
          </Suspense>
        )}
        {streamDistantHabitat && (
          <Suspense fallback={null}>
            <Grass
              densityMultiplier={perfConfig.grassDensity}
              center={initialHabitatCenter}
              region="distant"
              nearRadius={24}
              includeTall={HIGH_QUALITY_STREAMING}
            />
          </Suspense>
        )}
        {loadStage >= 1 && (
          <Suspense fallback={null}>
            <Pond />
          </Suspense>
        )}
        {HIGH_QUALITY_STREAMING && loadStage >= 4 && (
          <Suspense fallback={null}>
            <Fish />
          </Suspense>
        )}
        {loadStage >= 1 && (
          <Suspense fallback={null}>
            <PondStream detail={STREAM_DECOR && loadStage >= 2 ? 'full' : 'essential'} />
          </Suspense>
        )}
        {loadStage >= 2 && (
          <Suspense fallback={null}>
            <FloatingParticles
              dustCount={perfConfig.particleCount}
              fireflyCount={perfConfig.fireflyCount}
            />
          </Suspense>
        )}

        {loadStage >= 1 && (
          <Suspense fallback={null}>
            <AssetManager>
              <Forest
                center={initialHabitatCenter}
                region="near"
                nearRadius={30}
                onReady={handleNearbyTreesReady}
              />
              {streamDistantHabitat && (
                <Forest
                  center={initialHabitatCenter}
                  region="distant"
                  nearRadius={30}
                />
              )}
            </AssetManager>
          </Suspense>
        )}

        <CameraController
          targetPosition={cameraTarget}
          mode={selectedId || firstTourActive ? cameraMode : 'free'}
          mooseState={mooseState}
          fov={cameraSettings.fov}
          smoothness={cameraSettings.smoothness}
          zoomSpeed={cameraSettings.zoomSpeed}
        />

        <CameraPositionReporter onUpdate={setCameraPosition} />

        {/* Destination marker with leaf particles */}
        {activeMarker && (
          <DestinationMarker
            position={activeMarker.position}
            arrived={activeMarker.arrived}
            type={activeMarker.command?.type}
            minimal={minimalDestinationMarkers}
            feedback={activeMarker.command?.feedback}
          />
        )}

        {/* Real animals stream in priority order. Nothing rock-like is shown while a GLB parses. */}
        {loadStage >= 1 && ANIMAL_LIST
          .filter((cfg) => renderedAnimalIds.includes(cfg.id))
          .map((cfg) => (
            <AnimalErrorBoundary
              key={cfg.id}
              animalId={cfg.id}
              onError={handleAnimalReady}
            >
              <Suspense fallback={null}>
                <Animal
                  config={cfg}
                  destination={destinations[cfg.id] || null}
                  destinationSerial={destinationSerials[cfg.id] || 0}
                  isRunning={runningFor[cfg.id] || false}
                  isSelected={selectedId === cfg.id}
                  forcedBehavior={forcedBehaviors[cfg.id] || null}
                  onSelect={handleSelectAnimal}
                  onPositionUpdate={handlePositionUpdate}
                  onStatsUpdate={handleStatsUpdate}
                  onBehaviorUpdate={handleBehaviorUpdate}
                  onReady={handleAnimalReady}
                />
              </Suspense>
            </AnimalErrorBoundary>
          ))}
      </Canvas>
      </>
    </>
  );
}
