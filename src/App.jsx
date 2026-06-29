import { Suspense, useState, useCallback, useRef, useEffect, Component } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Config
import { ANIMAL_LIST } from './config/animalConfig';

// Components
import Animal from './components/Animal';
import Fish from './components/Fish';
import Pond, { PondStream } from './components/Pond';
import Sky from './components/Sky';
import FloatingParticles from './components/FloatingParticles';
import CameraController from './components/CameraController';
import LoadingScreen from './components/LoadingScreen';
import DestinationMarker from './components/DestinationMarker';
import HUD from './components/ui/HUD';
import AssetManager from './components/environment/AssetManager';
import Forest from './components/environment/Forest/Forest';
import Grass from './components/environment/Grass/Grass';
import Terrain from './components/environment/Terrain/Terrain';

import { playClick } from './hooks/useAudioFeedback';

const CANVAS_DPR = [1, 1.35];
const SHADOW_CONFIG = { type: THREE.PCFShadowMap };
const GL_CONFIG = {
  antialias: true,
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
const LAST_SELECTED_ANIMAL_KEY = 'wild-trails:last-selected-animal';

function getInitialSelectedAnimalId() {
  if (typeof window === 'undefined') return ANIMAL_LIST[0]?.id || 'moose';
  try {
    const savedId = window.localStorage.getItem(LAST_SELECTED_ANIMAL_KEY);
    if (savedId && ANIMAL_LIST.some((animal) => animal.id === savedId)) {
      return savedId;
    }
  } catch {
    // localStorage can be blocked in private/restricted browser contexts.
  }
  return ANIMAL_LIST[0]?.id || 'moose';
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
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/* ========================================
   Lighting
   ======================================== */
function SceneLighting({ simMinutesRef }) {
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
}

/* ========================================
   Camera Position Reporter
   ======================================== */
function CameraPositionReporter({ onUpdate }) {
  const { camera } = useThree();

  // Report camera position every 500ms for minimap
  useEffect(() => {
    const interval = setInterval(() => {
      onUpdate?.({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
    }, 500);
    return () => clearInterval(interval);
  }, [camera, onUpdate]);

  return null;
}

/* ========================================
   Arrival Detection threshold (world units)
   ======================================== */
const ARRIVAL_THRESHOLD = 2.5;

/* ========================================
   App Component
   ======================================== */
export default function App() {
  const [entered, setEntered] = useState(false);
  const [loadStage, setLoadStage] = useState(0);

  // Selection
  const [selectedId, setSelectedId] = useState(getInitialSelectedAnimalId);

  // Per-animal destinations
  const [destinations, setDestinations] = useState({});
  const [destinationSerials, setDestinationSerials] = useState({});
  const [runningFor, setRunningFor] = useState({});

  // Active destination marker (only for selected animal)
  const [activeMarker, setActiveMarker] = useState(null); // { position: THREE.Vector3, arrived: false }

  // Per-animal stats and behaviors
  const [allStats, setAllStats] = useState({});
  const [allBehaviors, setAllBehaviors] = useState({});
  const [forcedBehaviors, setForcedBehaviors] = useState({});

  // Camera
  const [cameraMode, setCameraMode] = useState('follow');
  const [cameraPosition, setCameraPosition] = useState(null);
  const [cameraSettings, setCameraSettings] = useState({
    fov: 45,
    smoothness: 0.5,
    zoomSpeed: 1,
  });
  const animalPositions = useRef({});
  const [animalPositionsSnapshot, setAnimalPositionsSnapshot] = useState({});

  // Simulation time ref — updated by HUD clock, read by Sky/Lighting per-frame
  const simMinutesRef = useRef(540); // start at 09:00
  const handleClockUpdate = useCallback((m) => {
    simMinutesRef.current = m;
  }, []);

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
            setActiveMarker((prev) => prev ? { ...prev, arrived: true } : null);
            // Clear marker after dissolve animation
            setTimeout(() => setActiveMarker(null), 1500);
          }
        }
      }
    }, 300);
    return () => clearInterval(interval);
  }, [activeMarker, selectedId]);

  // Progressive asset streaming
  useEffect(() => {
    if (!entered) {
      setLoadStage(0);
      return undefined;
    }

    const timers = [
      setTimeout(() => setLoadStage(1), 220),   // grass starts after first frame
      setTimeout(() => setLoadStage(2), 850),   // forest follows
      setTimeout(() => setLoadStage(3), 1500),  // remaining animals stream in
    ];
    return () => timers.forEach(clearTimeout);
  }, [entered]);

  // ---------- Handlers ----------

  const handleGroundClick = useCallback(
    (point) => {
      if (!selectedId) return;
      playClick();
      setDestinations((prev) => ({ ...prev, [selectedId]: point }));
      setDestinationSerials((prev) => ({ ...prev, [selectedId]: (prev[selectedId] || 0) + 1 }));
      setRunningFor((prev) => ({ ...prev, [selectedId]: false }));
      // Set marker
      setActiveMarker({ position: point.clone(), arrived: false });
    },
    [selectedId]
  );

  const handleGroundDoubleClick = useCallback(
    (point) => {
      if (!selectedId) return;
      playClick();
      setDestinations((prev) => ({ ...prev, [selectedId]: point }));
      setDestinationSerials((prev) => ({ ...prev, [selectedId]: (prev[selectedId] || 0) + 1 }));
      setRunningFor((prev) => ({ ...prev, [selectedId]: true }));
      // Set marker
      setActiveMarker({ position: point.clone(), arrived: false });
    },
    [selectedId]
  );

  const handleSelectAnimal = useCallback((id) => {
    setSelectedId(id);
    // Clear marker on animal change
    setActiveMarker(null);
    try {
      window.localStorage.setItem(LAST_SELECTED_ANIMAL_KEY, id);
    } catch {
      // Selection still works even if persistence is unavailable.
    }
  }, []);

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
  const cameraTarget = animalPositions.current[selectedId] || new THREE.Vector3();

  // State label for camera
  const selectedBehavior = allBehaviors[selectedId] || 'Idle';
  const mooseState =
    selectedBehavior === 'Wander' || selectedBehavior === 'Hunt'
      ? 'Walking'
      : selectedBehavior === 'Sleep'
        ? 'Idle'
        : 'Idle';

  // Auto-enter handler (called by LoadingScreen at ~30%)
  const handleAutoEnter = useCallback(() => {
    setEntered(true);
  }, []);

  return (
    <>
      <LoadingScreen entered={entered} onEnter={handleAutoEnter} />

      {entered && (
      <>

      <HUD
        selectedAnimalId={selectedId}
        animalConfigs={ANIMAL_LIST}
        animalStats={allStats}
        animalBehaviors={allBehaviors}
        animalPositions={animalPositionsSnapshot}
        cameraMode={cameraMode}
        cameraPosition={cameraPosition}
        cameraSettings={cameraSettings}
        onCameraModeChange={setCameraMode}
        onCameraSettingsChange={setCameraSettings}
        onSelectAnimal={handleSelectAnimal}
        onForceAbility={handleForceAbility}
        onClockUpdate={handleClockUpdate}
      />

      <Canvas
        shadows={SHADOW_CONFIG}
        dpr={CANVAS_DPR}
        gl={GL_CONFIG}
        camera={CAMERA_CONFIG}
      >
        <SceneLighting simMinutesRef={simMinutesRef} />
        <Sky simMinutesRef={simMinutesRef} />
        <Terrain
          onClick={handleGroundClick}
          onDoubleClick={handleGroundDoubleClick}
        />
        {loadStage >= 1 && (
          <Suspense fallback={null}>
            <Grass />
          </Suspense>
        )}
        <Pond />
        {loadStage >= 1 && <Fish />}
        <PondStream />
        <FloatingParticles />

        {loadStage >= 2 && (
          <Suspense fallback={null}>
            <AssetManager>
              <Forest />
            </AssetManager>
          </Suspense>
        )}

        <CameraController
          targetPosition={cameraTarget}
          mode={cameraMode}
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
            animalPosition={animalPositions.current[selectedId]}
          />
        )}

        {/* Spawn all animals */}
        {ANIMAL_LIST
          .filter((cfg) => loadStage >= 3 || cfg.id === selectedId)
          .map((cfg) => (
          <AnimalErrorBoundary key={cfg.id} animalId={cfg.id}>
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
              />
            </Suspense>
          </AnimalErrorBoundary>
        ))}
      </Canvas>
      </>
      )}
    </>
  );
}
