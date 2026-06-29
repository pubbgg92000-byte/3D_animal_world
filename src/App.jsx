import { Suspense, useState, useCallback, useRef, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

// Config
import { ANIMAL_LIST } from './config/animalConfig';

// Components
import Animal from './components/Animal';
import Ground from './components/Ground';
import Trees from './components/Trees';
import TallGrass from './components/TallGrass';
import WaterPools from './components/WaterPools';
import Fish from './components/Fish';
import Pond from './components/Pond';
import SmallPrey from './components/SmallPrey';
import Sky from './components/Sky';
import FloatingParticles from './components/FloatingParticles';
import CameraController from './components/CameraController';
import LoadingScreen from './components/LoadingScreen';
import UIOverlay from './components/UIOverlay';

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
        position={[50, 30, -20]}
        intensity={1.8}
        color="#ffd59e"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
      />
      <ambientLight intensity={0.35} color="#b4d4ff" />
      <hemisphereLight skyColor="#87ceeb" groundColor="#3a5a1e" intensity={0.4} />
    </>
  );
}

/* ========================================
   App Component
   ======================================== */
export default function App() {
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
      <LoadingScreen />

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
        shadows
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{
          fov: 45,
          near: 0.1,
          far: 500,
          position: [8, 5, 10],
        }}
      >
        <SceneLighting />
        <Sky />
        <Ground
          onClick={handleGroundClick}
          onDoubleClick={handleGroundDoubleClick}
        />
        <Trees />
        <TallGrass />
        <WaterPools />
        <Pond />
        <Fish />
        <SmallPrey />
        <FloatingParticles />

        <CameraController
          targetPosition={cameraTarget}
          mode={cameraMode}
          mooseState={mooseState}
        />

        {/* Spawn all animals */}
        {ANIMAL_LIST.map((cfg) => (
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
  );
}
