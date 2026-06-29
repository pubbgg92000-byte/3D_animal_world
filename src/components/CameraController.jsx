import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/* ========================================
   Camera mode presets — cinematic feel
   ======================================== */

const MODES = {
  /** Third-person follow — orbits around animal, user can pan/zoom/rotate */
  follow: {
    offset: new THREE.Vector3(8, 8.5, 11),
    lookAtHeight: 1.5,
    autoRotate: true,
    autoRotateSpeed: 0.2,
    minDistance: 5,
    maxDistance: 40,
    minPolarAngle: 0.2,
    maxPolarAngle: Math.PI / 2.1,
    positionSpring: 1.8,
    targetSpring: 2.5,
    forcePosition: false,
  },
  /** First-person view — close behind animal head */
  fpv: {
    offset: new THREE.Vector3(0, 2.8, -1.5),
    lookAtHeight: 2.2,
    autoRotate: false,
    autoRotateSpeed: 0,
    minDistance: 1,
    maxDistance: 5,
    minPolarAngle: 0.5,
    maxPolarAngle: Math.PI / 2.5,
    positionSpring: 3.5,
    targetSpring: 4.0,
    forcePosition: true,
  },
  /** Aerial / bird's eye view */
  aerial: {
    offset: new THREE.Vector3(0, 25, 0.1),
    lookAtHeight: 0,
    autoRotate: true,
    autoRotateSpeed: 0.1,
    minDistance: 10,
    maxDistance: 60,
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI / 2,
    positionSpring: 1.2,
    targetSpring: 2.0,
    forcePosition: false,
  },
  /** Cinematic orbit — slow sweeping */
  cinematic: {
    offset: new THREE.Vector3(15, 5, 18),
    lookAtHeight: 1.2,
    autoRotate: true,
    autoRotateSpeed: 0.08,
    minDistance: 8,
    maxDistance: 80,
    minPolarAngle: 0.1,
    maxPolarAngle: Math.PI / 2,
    positionSpring: 0.8,
    targetSpring: 1.5,
    forcePosition: false,
  },
  /** Free camera — full user control, no auto-follow */
  free: {
    offset: null,
    lookAtHeight: 0,
    autoRotate: false,
    autoRotateSpeed: 0,
    minDistance: 1,
    maxDistance: 180,
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI - 0.1,
    positionSpring: 2.0,
    targetSpring: 2.0,
    forcePosition: false,
  },
};

/* ========================================
   Spring-based damping system
   ======================================== */

/**
 * Spring damper: exponential decay that produces smooth,
 * non-linear camera transitions with natural deceleration.
 *
 * @param {number} spring - Spring constant (higher = faster)
 * @param {number} delta  - Frame time in seconds
 * @returns {number} Blend factor [0..1]
 */
function springFactor(spring, delta) {
  return 1.0 - Math.exp(-spring * delta);
}

/* ========================================
   CameraController Component
   ======================================== */

/**
 * CameraController — cinematic camera system with spring-based smoothing.
 *
 * All transitions use exponential spring damping, never snapping instantly.
 * User can always pan/rotate/zoom with mouse. Camera modes control the
 * default position and auto-behavior.
 *
 * @param {THREE.Vector3} props.targetPosition — animal world position
 * @param {string}        props.mode           — "follow"|"fpv"|"aerial"|"cinematic"|"free"
 * @param {string}        props.mooseState     — "Idle"|"Walking"|"Running"
 */
export default function CameraController({
  targetPosition,
  mode = 'follow',
  mooseState = 'Idle',
  fov = 45,
  smoothness = 0.5,
  zoomSpeed = 1,
}) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const isTransitioning = useRef(false);
  const prevMode = useRef(mode);
  const transitionProgress = useRef(0);

  // Velocity tracking for anticipation
  const prevTargetPos = useRef(new THREE.Vector3());
  const targetVelocity = useRef(new THREE.Vector3());

  const config = MODES[mode] || MODES.follow;

  // Trigger smooth transition when mode changes
  useEffect(() => {
    if (prevMode.current !== mode) {
      isTransitioning.current = true;
      transitionProgress.current = 0;
      prevMode.current = mode;
      // Transition completes after ~2 seconds
      const timer = setTimeout(() => {
        isTransitioning.current = false;
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    // Dynamic FOV
    if (Math.abs(camera.fov - fov) > 0.5) {
      camera.fov += (fov - camera.fov) * springFactor(2.0, delta);
      camera.updateProjectionMatrix();
    }

    const controls = controlsRef.current;
    if (!targetPosition) {
      controls.update();
      return;
    }
    const animalPos = targetPosition;

    // Track velocity for anticipation (documentary-style)
    targetVelocity.current.subVectors(animalPos, prevTargetPos.current).divideScalar(Math.max(delta, 0.001));
    prevTargetPos.current.copy(animalPos);

    // In free mode, don't auto-follow
    if (mode === 'free') {
      controls.update();
      return;
    }

    const offset = config.offset;
    if (!offset) return;

    // ── Anticipation: slightly offset target in movement direction ──
    const speed = targetVelocity.current.length();
    const anticipation = new THREE.Vector3();
    if (speed > 0.5 && mode === 'follow') {
      anticipation.copy(targetVelocity.current)
        .normalize()
        .multiplyScalar(Math.min(speed * 0.15, 2.0));
    }

    // Compute desired camera position
    const desiredPos = new THREE.Vector3(
      animalPos.x + offset.x,
      animalPos.y + offset.y,
      animalPos.z + offset.z
    );

    // Compute desired lookAt target (with anticipation)
    const desiredTarget = new THREE.Vector3(
      animalPos.x + anticipation.x * 0.5,
      animalPos.y + config.lookAtHeight,
      animalPos.z + anticipation.z * 0.5
    );

    // ── Spring-based transitions ──
    // smoothness scales all spring constants (0.1 = very smooth, 1 = snappy)
    const smoothScale = 0.3 + smoothness * 1.4;
    const transSpring = isTransitioning.current ? 3.0 * smoothScale : config.positionSpring * smoothScale;
    const targetSpring = config.targetSpring * smoothScale;

    const posFactor = springFactor(transSpring, delta);
    const tgtFactor = springFactor(targetSpring, delta);

    // Update OrbitControls target (what camera looks at)
    controls.target.lerp(desiredTarget, tgtFactor);

    // Position behavior depends on mode
    if (isTransitioning.current || config.forcePosition) {
      // Full position tracking during transitions or FPV
      camera.position.lerp(desiredPos, posFactor);
    } else if (mode !== 'free') {
      // Smoothly nudge camera to track animal while preserving user orbit
      const currentOffset = camera.position.clone().sub(controls.target);
      const newPos = desiredTarget.clone().add(currentOffset);
      camera.position.lerp(newPos, posFactor);
    }

    // Keep the follow camera above tree canopies and terrain
    if (mode === 'follow') {
      camera.position.y = Math.max(camera.position.y, animalPos.y + 8.25);
    }

    // Increment transition progress
    if (isTransitioning.current) {
      transitionProgress.current += delta;
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      zoomSpeed={zoomSpeed}
      panSpeed={1.2}
      enableRotate={true}
      enableDamping={true}
      dampingFactor={0.06}
      autoRotate={config.autoRotate && mooseState === 'Idle'}
      autoRotateSpeed={config.autoRotateSpeed}
      minDistance={config.minDistance}
      maxDistance={config.maxDistance}
      minPolarAngle={config.minPolarAngle}
      maxPolarAngle={config.maxPolarAngle}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      makeDefault
    />
  );
}
