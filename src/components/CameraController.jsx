import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/* ========================================
   Camera mode presets
   ======================================== */

const MODES = {
  /** Third-person follow — orbits around moose, user can pan/zoom/rotate */
  follow: {
    offset: new THREE.Vector3(6, 3.5, 8),
    lookAtHeight: 1.5,
    autoRotate: true,
    autoRotateSpeed: 0.3,
    minDistance: 3,
    maxDistance: 40,
    minPolarAngle: 0.2,
    maxPolarAngle: Math.PI / 2.1,
  },
  /** First-person view — close behind moose head */
  fpv: {
    offset: new THREE.Vector3(0, 2.8, -1.5),
    lookAtHeight: 2.2,
    autoRotate: false,
    autoRotateSpeed: 0,
    minDistance: 1,
    maxDistance: 5,
    minPolarAngle: 0.5,
    maxPolarAngle: Math.PI / 2.5,
  },
  /** Aerial / bird's eye view */
  aerial: {
    offset: new THREE.Vector3(0, 25, 0.1),
    lookAtHeight: 0,
    autoRotate: true,
    autoRotateSpeed: 0.15,
    minDistance: 10,
    maxDistance: 60,
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI / 2,
  },
  /** Cinematic long shot */
  cinematic: {
    offset: new THREE.Vector3(15, 5, 18),
    lookAtHeight: 1.2,
    autoRotate: true,
    autoRotateSpeed: 0.12,
    minDistance: 8,
    maxDistance: 80,
    minPolarAngle: 0.1,
    maxPolarAngle: Math.PI / 2,
  },
  /** Free camera — full user control, no auto-follow */
  free: {
    offset: null,
    lookAtHeight: 0,
    autoRotate: false,
    autoRotateSpeed: 0,
    minDistance: 1,
    maxDistance: 100,
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI - 0.1,
  },
};

/** Damping for smooth camera transitions */
const TRANSITION_SPEED = 2.0;

/* ========================================
   CameraController Component
   ======================================== */

/**
 * CameraController — full camera system with multiple modes.
 *
 * User can always pan/rotate/zoom with mouse. Camera modes
 * control the default position and auto-behavior.
 *
 * @param {THREE.Vector3} props.targetPosition — moose world position
 * @param {string}        props.mode           — "follow"|"fpv"|"aerial"|"cinematic"|"free"
 * @param {string}        props.mooseState     — "Idle"|"Walking"|"Running"
 */
export default function CameraController({
  targetPosition,
  mode = 'follow',
  mooseState = 'Idle',
}) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const isTransitioning = useRef(false);
  const prevMode = useRef(mode);

  const config = MODES[mode] || MODES.follow;

  // Trigger smooth transition when mode changes
  useEffect(() => {
    if (prevMode.current !== mode) {
      isTransitioning.current = true;
      prevMode.current = mode;
      // Transition completes after ~1.5 seconds
      const timer = setTimeout(() => {
        isTransitioning.current = false;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  useFrame((_, delta) => {
    if (!targetPosition || !controlsRef.current) return;

    const controls = controlsRef.current;
    const moosePos = targetPosition;

    // In free mode, don't auto-follow
    if (mode === 'free') return;

    const offset = config.offset;
    if (!offset) return;

    // Compute desired camera position
    const desiredPos = new THREE.Vector3(
      moosePos.x + offset.x,
      moosePos.y + offset.y,
      moosePos.z + offset.z
    );

    // Compute desired lookAt target
    const desiredTarget = new THREE.Vector3(
      moosePos.x,
      moosePos.y + config.lookAtHeight,
      moosePos.z
    );

    // Smooth transition
    const factor = 1.0 - Math.exp(-TRANSITION_SPEED * delta);

    // Update OrbitControls target (what camera looks at)
    controls.target.lerp(desiredTarget, factor);

    // Only reposition camera if transitioning or in follow/fpv modes
    if (isTransitioning.current || mode === 'fpv') {
      camera.position.lerp(desiredPos, factor);
    } else if (mode !== 'free') {
      // In follow/aerial/cinematic: smoothly nudge camera to track moose
      // but let user orbit freely around the target
      const currentOffset = camera.position.clone().sub(controls.target);
      const targetCenter = desiredTarget;
      const newPos = targetCenter.clone().add(currentOffset);

      camera.position.lerp(newPos, factor);
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      enableDamping={true}
      dampingFactor={0.08}
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
