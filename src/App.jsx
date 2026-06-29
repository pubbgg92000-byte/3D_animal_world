import { Suspense, useState, useCallback, useRef, useEffect, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

// Config
import { ANIMAL_LIST } from './config/animalConfig';

// Components
import Animal from './components/Animal';
import Pond, { PondStream } from './components/Pond';
import Sky from './components/Sky';
import FloatingParticles from './components/FloatingParticles';
import CameraController from './components/CameraController';
import LoadingScreen from './components/LoadingScreen';
import UIOverlay from './components/UIOverlay';
import AssetManager from './components/environment/AssetManager';
import Forest from './components/environment/Forest/Forest';
import Grass from './components/environment/Grass/Grass';
import Terrain from './components/environment/Terrain/Terrain';

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
function SceneLighting() {
  return (
    <>
      <directionalLight
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
      <ambientLight intensity={0.48} color="#cfe7ff" />
      <hemisphereLight skyColor="#8ed4ff" groundColor="#52752f" intensity={0.62} />
    </>
  );
}

/* ========================================
   App Component
   ======================================== */
export default function App() {
  const [entered, setEntered] = useState(false);
  const [loadStage, setLoadStage] = useState(0);

  // Selection
  const [selectedId, setSelectedId] = useState('moose');

  // Per-animal destinations (only selected animal gets one)
  const [destinations, setDestinations] = useState({});
  const [destinationSerials, setDestinationSerials] = useState({});
  const [runningFor, setRunningFor] = useState({});

  // Per-animal stats and behaviors
  const [allStats, setAllStats] = useState({});
  const [allBehaviors, setAllBehaviors] = useState({});
  const [forcedBehaviors, setForcedBehaviors] = useState({});

  // Camera
  const [cameraMode, setCameraMode] = useState('follow');
  const animalPositions = useRef({});

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
      setDestinations((prev) => ({ ...prev, [selectedId]: point }));
      setDestinationSerials((prev) => ({ ...prev, [selectedId]: (prev[selectedId] || 0) + 1 }));
      setRunningFor((prev) => ({ ...prev, [selectedId]: false }));
    },
    [selectedId]
  );

  const handleGroundDoubleClick = useCallback(
    (point) => {
      if (!selectedId) return;
      setDestinations((prev) => ({ ...prev, [selectedId]: point }));
      setDestinationSerials((prev) => ({ ...prev, [selectedId]: (prev[selectedId] || 0) + 1 }));
      setRunningFor((prev) => ({ ...prev, [selectedId]: true }));
    },
    [selectedId]
  );

  const handleSelectAnimal = useCallback((id) => {
    setSelectedId(id);
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

  return (
    <>
      <LoadingScreen entered={entered} onEnter={() => setEntered(true)} />

      {!entered ? null : (
      <>

      <UIOverlay
        selectedAnimalId={selectedId}
        animalConfigs={ANIMAL_LIST}
        animalStats={allStats}
        animalBehaviors={allBehaviors}
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
        onSelectAnimal={handleSelectAnimal}
        onForceAbility={handleForceAbility}
      />

      <Canvas
        shadows={SHADOW_CONFIG}
        dpr={CANVAS_DPR}
        gl={GL_CONFIG}
        camera={CAMERA_CONFIG}
      >
        <SceneLighting />
        <Sky />
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
        />

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
