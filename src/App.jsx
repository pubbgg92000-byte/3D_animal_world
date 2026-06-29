import { Suspense, useState, useCallback, useRef, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

// Components
import Moose from './components/Moose';
import Ground from './components/Ground';
import Trees from './components/Trees';
import TallGrass from './components/TallGrass';
import WaterPools from './components/WaterPools';
import Sky from './components/Sky';
import FloatingParticles from './components/FloatingParticles';
import CameraController from './components/CameraController';
import LoadingScreen from './components/LoadingScreen';
import UIOverlay from './components/UIOverlay';

/* ========================================
   Constants
   ======================================== */

const WALK_SPEED = 2.5;
const RUN_SPEED = 5.0;

/* ========================================
   Error Boundary — catches GLB load failures
   ======================================== */

class MooseErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.warn('[MooseErrorBoundary] Model failed to load:', error.message);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/* ========================================
   Lighting Sub-component
   ======================================== */

function SceneLighting() {
  return (
    <>
      {/* Golden-hour directional sunlight */}
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

      {/* Soft ambient fill */}
      <ambientLight intensity={0.35} color="#b4d4ff" />

      {/* Warm hemisphere for sky/ground colour bleed */}
      <hemisphereLight
        skyColor="#87ceeb"
        groundColor="#3a5a1e"
        intensity={0.4}
      />
    </>
  );
}

/* ========================================
   App Component
   ======================================== */

export default function App() {
  // Moose destination and mode
  const [destination, setDestination] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // Animation state for UI
  const [animationName, setAnimationName] = useState('Idle');

  // AI state for UI
  const [aiState, setAIState] = useState('Idle');

  // Camera mode
  const [cameraMode, setCameraMode] = useState('follow');

  // Moose position for camera
  const moosePosition = useRef(new THREE.Vector3(0, 0, 0));

  // Derive UI state label
  const stateLabel =
    animationName === 'Running'
      ? 'Running'
      : animationName === 'Walking'
        ? 'Walking'
        : 'Idle';

  // Speed for UI display
  const currentSpeed = isRunning ? RUN_SPEED : animationName !== 'Idle' ? WALK_SPEED : 0;

  // ---------- Handlers ----------

  const handleGroundClick = useCallback((point) => {
    setDestination(point);
    setIsRunning(false);
  }, []);

  const handleGroundDoubleClick = useCallback((point) => {
    setDestination(point);
    setIsRunning(true);
  }, []);

  const handleArrive = useCallback(() => {
    setDestination(null);
    setIsRunning(false);
    setAnimationName('Idle');
  }, []);

  const handleAnimChange = useCallback((name) => {
    setAnimationName(name);
  }, []);

  const handlePositionUpdate = useCallback((pos) => {
    moosePosition.current.copy(pos);
  }, []);

  const handleAIStateChange = useCallback((state) => {
    setAIState(state);
  }, []);

  // ---------- Render ----------

  return (
    <>
      {/* Loading overlay */}
      <LoadingScreen />

      {/* HUD overlay */}
      <UIOverlay
        animationName={animationName}
        speed={currentSpeed}
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
        aiState={aiState}
      />

      {/* 3D Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
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
        {/* Environment */}
        <SceneLighting />
        <Sky />
        <Ground
          onClick={handleGroundClick}
          onDoubleClick={handleGroundDoubleClick}
        />
        <Trees />
        <TallGrass />
        <WaterPools />
        <FloatingParticles />

        {/* Camera system */}
        <CameraController
          targetPosition={moosePosition.current}
          mode={cameraMode}
          mooseState={stateLabel}
        />

        {/* Moose with AI */}
        <MooseErrorBoundary>
          <Suspense fallback={null}>
            <Moose
              destination={destination}
              isRunning={isRunning}
              onAnimChange={handleAnimChange}
              onArrive={handleArrive}
              onPositionUpdate={handlePositionUpdate}
              onAIStateChange={handleAIStateChange}
            />
          </Suspense>
        </MooseErrorBoundary>
      </Canvas>
    </>
  );
}
