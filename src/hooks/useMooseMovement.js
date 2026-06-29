import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * useMooseMovement — drives rotation + translation toward a destination.
 *
 * The moose FIRST rotates to face the destination, THEN walks forward.
 * Includes a 180° Y offset because the Sketchfab model faces +Z
 * while Three.js lookAt points -Z.
 */

/** 180° rotation around Y axis to flip the model's facing direction */
const FLIP_QUAT = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI
);

// Reusable objects (module-level to avoid per-frame allocations)
const _direction = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _correctedQuat = new THREE.Quaternion();
const _lookMatrix = new THREE.Matrix4();

export default function useMooseMovement(
  groupRef,
  destination,
  {
    moveSpeed = 2.5,
    rotationSpeed = 5.0,
    arrivalThreshold = 0.4,
    turnThreshold = 0.3,
    onArrive,
  } = {}
) {
  const isMoving = useRef(false);
  const hasArrived = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current || !destination) {
      isMoving.current = false;
      return;
    }

    const moose = groupRef.current;

    // Direction from moose to destination (XZ plane only)
    _direction.copy(destination).sub(moose.position);
    _direction.y = 0;
    const distance = _direction.length();

    // Check arrival
    if (distance < arrivalThreshold) {
      if (!hasArrived.current) {
        hasArrived.current = true;
        isMoving.current = false;
        onArrive?.();
      }
      return;
    }

    hasArrived.current = false;
    _direction.normalize();

    // Compute target rotation
    const targetPos = moose.position.clone().add(_direction);
    _lookMatrix.lookAt(moose.position, targetPos, THREE.Object3D.DEFAULT_UP);
    _targetQuat.setFromRotationMatrix(_lookMatrix);

    // Apply 180° Y flip so model faces TOWARD the destination
    _correctedQuat.copy(_targetQuat).multiply(FLIP_QUAT);

    // Smoothly interpolate rotation
    const rotFactor = 1.0 - Math.exp(-rotationSpeed * delta);
    moose.quaternion.slerp(_correctedQuat, rotFactor);

    // Only move once roughly facing the destination
    const angleDiff = moose.quaternion.angleTo(_correctedQuat);
    if (angleDiff < turnThreshold) {
      isMoving.current = true;
      const step = Math.min(moveSpeed * delta, distance);
      moose.position.addScaledVector(_direction, step);
    } else {
      isMoving.current = true;
    }
  });

  return { isMoving };
}
