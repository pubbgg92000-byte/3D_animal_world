import { useRef } from 'react';
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
  focusKey = null,
  mode = 'follow',
  mooseState = 'Idle',
  fov = 45,
  smoothness = 0.5,
  zoomSpeed = 1,
}) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const isTransitioning = useRef(false);
  const isUserInteracting = useRef(false);
  const prevMode = useRef(mode);
  const prevFocusKey = useRef(focusKey);
  const transitionUntil = useRef(0);
  const initializedTarget = useRef(false);

  // Reused frame vectors: avoids camera GC spikes while the animal is moving.
  const prevTargetPos = useRef(new THREE.Vector3());
  const targetVelocity = useRef(new THREE.Vector3());
  const smoothedVelocity = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const desiredPos = useRef(new THREE.Vector3());
  const oldTarget = useRef(new THREE.Vector3());
  const targetDelta = useRef(new THREE.Vector3());
  const predictedAnimal = useRef(new THREE.Vector3());
  const presetOffset = useRef(new THREE.Vector3());
  const tempVec = useRef(new THREE.Vector3());

  const config = MODES[mode] || MODES.follow;

  useFrame(({ clock }, delta) => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    const now = clock.elapsedTime;
    const safeDelta = Math.min(delta, 1 / 30);

    // Mode/focus transitions are tracked in the render loop so camera motion
    // never depends on React timers or state updates.
    if (prevMode.current !== mode) {
      prevMode.current = mode;
      transitionUntil.current = now + 1.6;
      isTransitioning.current = true;
    }

    if (prevFocusKey.current !== focusKey) {
      prevFocusKey.current = focusKey;
      transitionUntil.current = now + 1.35;
      isTransitioning.current = true;
      initializedTarget.current = false;
    }

    isTransitioning.current = now < transitionUntil.current;

    // Dynamic FOV
    if (Math.abs(camera.fov - fov) > 0.5) {
      camera.fov += (fov - camera.fov) * springFactor(2.0, safeDelta);
      camera.updateProjectionMatrix();
    }

    if (!targetPosition) {
      controls.update();
      return;
    }

    const animalPos = targetPosition;

    if (!initializedTarget.current) {
      prevTargetPos.current.copy(animalPos);
      targetVelocity.current.set(0, 0, 0);
      smoothedVelocity.current.set(0, 0, 0);
      initializedTarget.current = true;
    }

    // Smooth velocity prediction keeps fast direction changes from kicking the
    // camera to a new offset in one frame.
    targetVelocity.current
      .subVectors(animalPos, prevTargetPos.current)
      .divideScalar(Math.max(safeDelta, 0.001));
    prevTargetPos.current.copy(animalPos);
    smoothedVelocity.current.lerp(targetVelocity.current, springFactor(5.5, safeDelta));

    // In free mode, don't auto-follow
    if (mode === 'free') {
      controls.update();
      return;
    }

    const offset = config.offset;
    if (!offset) return;

    predictedAnimal.current.copy(animalPos);
    const speed = smoothedVelocity.current.length();
    if (speed > 0.5 && mode === 'follow') {
      tempVec.current
        .copy(smoothedVelocity.current)
        .normalize()
        .multiplyScalar(Math.min(speed * 0.08, 1.35));
      predictedAnimal.current.add(tempVec.current);
    }

    desiredTarget.current.set(animalPos.x, animalPos.y + config.lookAtHeight, animalPos.z);
    desiredPos.current.set(
      predictedAnimal.current.x + offset.x,
      predictedAnimal.current.y + offset.y,
      predictedAnimal.current.z + offset.z
    );

    // A single damping pass drives the follow target; OrbitControls damping is
    // disabled below so controls and manual camera movement do not double-smooth.
    const smoothScale = 0.3 + smoothness * 1.4;
    const transSpring = isTransitioning.current ? 3.0 * smoothScale : config.positionSpring * smoothScale;
    const targetSpring = (mode === 'follow' ? 10.0 : config.targetSpring) * smoothScale;

    const posFactor = springFactor(transSpring, safeDelta);
    const tgtFactor = springFactor(targetSpring, safeDelta);

    oldTarget.current.copy(controls.target);
    controls.target.lerp(desiredTarget.current, tgtFactor);
    targetDelta.current.subVectors(controls.target, oldTarget.current);

    // Position behavior depends on mode
    if (isTransitioning.current || config.forcePosition) {
      // Full position tracking during transitions or FPV
      camera.position.lerp(desiredPos.current, posFactor);
    } else if (mode !== 'free') {
      // Move the camera by the same delta as the controls target. This keeps
      // user orbit, zoom, and touch gestures intact without letting follow drift.
      camera.position.add(targetDelta.current);

      if (!isUserInteracting.current && mode === 'follow') {
        presetOffset.current.copy(offset);
        tempVec.current.subVectors(camera.position, controls.target);
        tempVec.current.lerp(presetOffset.current, springFactor(0.45, safeDelta));
        camera.position.copy(controls.target).add(tempVec.current);
      }
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
      enableDamping={false}
      dampingFactor={0}
      autoRotate={config.autoRotate && mooseState === 'Idle'}
      autoRotateSpeed={config.autoRotateSpeed}
      minDistance={config.minDistance}
      maxDistance={config.maxDistance}
      minPolarAngle={config.minPolarAngle}
      maxPolarAngle={config.maxPolarAngle}
      mouseButtons={{
        // Leave primary click to R3F meshes so animal inspection/selection works.
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      onStart={() => {
        isUserInteracting.current = true;
      }}
      onEnd={() => {
        isUserInteracting.current = false;
      }}
      makeDefault
    />
  );
}
