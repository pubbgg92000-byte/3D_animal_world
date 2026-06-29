import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TREE_OBSTACLES, getAnimalObstacles } from '../utils/collisionRegistry';
import { WORLD_HALF, isPondAt, isStreamAt } from '../utils/world';

const FLIP_QUAT = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI
);

const _desired = new THREE.Vector3();
const _steer = new THREE.Vector3();
const _smooth = new THREE.Vector3();
const _away = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _ahead = new THREE.Vector3();
const _targetQuaternion = new THREE.Quaternion();
const _correctedQuaternion = new THREE.Quaternion();
const _lookMatrix = new THREE.Matrix4();
const _lookPoint = new THREE.Vector3();

function stableSign(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return hash % 2 === 0 ? 1 : -1;
}

/**
 * useAnimalMovement — Height-aware movement with natural rock traversal.
 *
 * Animals evaluate obstacle height before deciding to steer:
 *  - If obstacle.height <= climbHeight → walk directly over (isClimbing = true)
 *  - If obstacle.height > climbHeight → steer around as before
 *
 * @param {React.RefObject} groupRef — ref to the animal's group object
 * @param {THREE.Vector3|null} destination — target position
 * @param {Object} options — movement configuration
 * @param {number} options.climbHeight — max obstacle height this species can step over
 */
export default function useAnimalMovement(
  groupRef,
  destination,
  {
    moveSpeed = 2.5,
    rotationSpeed = 5,
    arrivalThreshold = 0.5,
    turnThreshold = 0.62,
    collisionRadius = 0.8,
    streamSpeedMultiplier = 0.68,
    climbHeight = 0.3,
    selfId = '',
    onArrive,
    onStuck,
  } = {}
) {
  const hasArrived = useRef(false);
  const lastDestination = useRef(null);
  const smoothDirection = useRef(new THREE.Vector3(0, 0, 1));
  const avoidanceKey = useRef(null);
  const avoidanceSide = useRef(1);
  const avoidanceHold = useRef(0);
  const progressAnchor = useRef(new THREE.Vector3());
  const progressTimer = useRef(0);
  const escapeTimer = useRef(0);
  const lastDistance = useRef(Infinity);
  const noProgressTimer = useRef(0);
  // Climbing state — exposed for animation system
  const climbingRef = useRef(false);
  const climbIntensity = useRef(0); // 0–1, how steep the climb feels

  useFrame((_, delta) => {
    const object = groupRef.current;
    if (!object || !destination) return;

    if (lastDestination.current !== destination) {
      lastDestination.current = destination;
      progressAnchor.current.copy(object.position);
      progressTimer.current = 0;
      escapeTimer.current = 0;
      lastDistance.current = Infinity;
      noProgressTimer.current = 0;
      avoidanceKey.current = null;
    }

    _desired.copy(destination).sub(object.position).setY(0);
    const distance = _desired.length();
    if (distance < arrivalThreshold) {
      if (!hasArrived.current) {
        hasArrived.current = true;
        avoidanceKey.current = null;
        noProgressTimer.current = 0;
        onArrive?.();
      }
      // Fade out climbing when stopped
      climbingRef.current = false;
      climbIntensity.current *= Math.max(0, 1 - 4 * delta);
      return;
    }

    hasArrived.current = false;
    _desired.normalize();
    _steer.copy(_desired);

    const obstacles = TREE_OBSTACLES.concat(getAnimalObstacles(selfId, collisionRadius));
    let blockingObstacle = null;
    let bestScore = Infinity;
    let isOnClimbableObstacle = false;

    for (const obstacle of obstacles) {
      const relativeX = obstacle.x - object.position.x;
      const relativeZ = obstacle.z - object.position.z;
      const forward = relativeX * _desired.x + relativeZ * _desired.z;
      const lateral = Math.abs(relativeX * _desired.z - relativeZ * _desired.x);
      const clearance = obstacle.r + collisionRadius + 0.38;
      const directDistance = Math.hypot(relativeX, relativeZ);
      const threatensPath = forward > -0.35 && forward < 4.6 && lateral < clearance;
      const alreadyClose = directDistance < clearance + 0.35;
      if (!threatensPath && !alreadyClose) continue;

      // ── Height-aware check: can this animal step over? ──
      const obstacleHeight = obstacle.height ?? 999;
      if (obstacleHeight <= climbHeight) {
        // Animal CAN step over this obstacle — don't steer, mark as climbing
        if (directDistance < clearance + 0.2) {
          isOnClimbableObstacle = true;
        }
        continue; // Skip this obstacle entirely — don't avoid it
      }

      // Obstacle too tall — treat as blocking (original behavior)
      const score = Math.max(0, forward) + lateral * 0.3;
      if (score < bestScore) {
        bestScore = score;
        blockingObstacle = obstacle;
      }
    }

    // Update climbing state smoothly
    if (isOnClimbableObstacle) {
      climbingRef.current = true;
      climbIntensity.current = Math.min(1, climbIntensity.current + 3 * delta);
    } else {
      climbingRef.current = false;
      climbIntensity.current = Math.max(0, climbIntensity.current - 2 * delta);
    }

    _ahead.copy(object.position).addScaledVector(_desired, 2.5);
    const waterAhead = isPondAt(_ahead.x, _ahead.z, 0.35);
    const boundaryAhead = Math.abs(_ahead.x) > WORLD_HALF || Math.abs(_ahead.z) > WORLD_HALF;

    if (blockingObstacle || waterAhead || boundaryAhead) {
      const key = blockingObstacle
        ? `${Math.round(blockingObstacle.x * 5)}:${Math.round(blockingObstacle.z * 5)}`
        : waterAhead
          ? 'water'
          : 'boundary';

      if (avoidanceKey.current !== key || avoidanceHold.current <= 0) {
        avoidanceKey.current = key;
        avoidanceSide.current = stableSign(`${selfId}:${key}`);
        avoidanceHold.current = 1.1;
      }
      avoidanceHold.current -= delta;

      _tangent.set(-_desired.z * avoidanceSide.current, 0, _desired.x * avoidanceSide.current);
      _steer.copy(_desired).multiplyScalar(0.72).addScaledVector(_tangent, 0.82);

      if (blockingObstacle) {
        _away
          .set(
            object.position.x - blockingObstacle.x,
            0,
            object.position.z - blockingObstacle.z
          )
          .normalize();
        _steer.addScaledVector(_away, 0.95);
      }

      if (boundaryAhead) {
        _steer.x += -Math.sign(_ahead.x) * Math.max(0, Math.abs(_ahead.x) - WORLD_HALF + 1);
        _steer.z += -Math.sign(_ahead.z) * Math.max(0, Math.abs(_ahead.z) - WORLD_HALF + 1);
      }
    } else {
      avoidanceHold.current = Math.max(0, avoidanceHold.current - delta);
      if (avoidanceHold.current === 0) avoidanceKey.current = null;
    }

    if (distance < lastDistance.current - 0.03) {
      lastDistance.current = distance;
      noProgressTimer.current = 0;
    } else {
      noProgressTimer.current += delta;
    }

    // Detect lack of forward progress and commit to one escape arc long enough
    // to leave dense obstacle clusters instead of alternating left/right.
    progressTimer.current += delta;
    if (object.position.distanceToSquared(progressAnchor.current) > 0.36) {
      progressAnchor.current.copy(object.position);
      progressTimer.current = 0;
    } else if ((progressTimer.current > 1.2 || noProgressTimer.current > 1.6) && escapeTimer.current <= 0) {
      escapeTimer.current = 1.0;
      progressTimer.current = 0;
      avoidanceSide.current = stableSign(`${selfId}:${Math.round(object.position.x)}:${Math.round(object.position.z)}`);
    }

    if (noProgressTimer.current > 2.8) {
      // Close enough but orbiting around the target/obstacle: finish the move
      // instead of endlessly circling. Farther away: reset to direct steering.
      if (distance < Math.max(arrivalThreshold * 3.2, 1.7)) {
        hasArrived.current = true;
        noProgressTimer.current = 0;
        avoidanceKey.current = null;
        onArrive?.();
        return;
      }
      onStuck?.();
      smoothDirection.current.copy(_desired);
      avoidanceKey.current = null;
      avoidanceHold.current = 0;
      noProgressTimer.current = 0;
      lastDistance.current = Infinity;
      return;
    }

    if (escapeTimer.current > 0) {
      escapeTimer.current -= delta;
      _tangent.set(-_desired.z * avoidanceSide.current, 0, _desired.x * avoidanceSide.current);
      _steer.addScaledVector(_tangent, 1.05).addScaledVector(_desired, 0.6);
    }

    if (_steer.lengthSq() < 0.001) _steer.copy(_desired);
    _steer.normalize();

    const steerFactor = 1 - Math.exp(-4.2 * delta);
    _smooth.copy(smoothDirection.current).lerp(_steer, steerFactor).setY(0);
    if (_smooth.lengthSq() > 0.001) smoothDirection.current.copy(_smooth.normalize());

    _lookPoint.copy(object.position).add(smoothDirection.current);
    _lookMatrix.lookAt(object.position, _lookPoint, THREE.Object3D.DEFAULT_UP);
    _targetQuaternion.setFromRotationMatrix(_lookMatrix);
    _correctedQuaternion.copy(_targetQuaternion).multiply(FLIP_QUAT);

    const rotationFactor = 1 - Math.exp(-rotationSpeed * delta);
    object.quaternion.slerp(_correctedQuaternion, rotationFactor);

    if (object.quaternion.angleTo(_correctedQuaternion) < turnThreshold || noProgressTimer.current > 0.9) {
      const baseSpeed = typeof moveSpeed === 'function' ? moveSpeed() : moveSpeed;
      let speed = isStreamAt(object.position.x, object.position.z, 0.05)
        ? baseSpeed * streamSpeedMultiplier
        : baseSpeed;

      // Slow down 30% while climbing over obstacles
      if (climbingRef.current) {
        speed *= 0.7;
      }

      object.position.addScaledVector(
        smoothDirection.current,
        Math.min(speed * delta, distance)
      );
    }
  });

  // Return climbing state for animation system
  return { climbingRef, climbIntensity };
}
