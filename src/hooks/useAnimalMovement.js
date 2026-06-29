import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * useAnimalMovement — smooth rotation + translation toward a destination.
 * Models face +Z so we apply a 180° Y flip to the lookAt quaternion.
 */

const FLIP_QUAT = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI
);

// Module-level reusables — avoid per-frame GC
const _dir      = new THREE.Vector3();
const _tgt      = new THREE.Quaternion();
const _corr     = new THREE.Quaternion();
const _mat      = new THREE.Matrix4();
const _tmpPos   = new THREE.Vector3();

export default function useAnimalMovement(
  groupRef,
  destination,
  {
    moveSpeed        = 2.5,
    rotationSpeed    = 5.0,
    arrivalThreshold = 0.5,
    turnThreshold    = 0.4,
    onArrive,
  } = {}
) {
  const hasArrived = useRef(false);

  useFrame((_, delta) => {
    if (!groupRef.current || !destination) return;

    const obj = groupRef.current;

    _dir.copy(destination).sub(obj.position);
    _dir.y = 0;
    const dist = _dir.length();

    if (dist < arrivalThreshold) {
      if (!hasArrived.current) {
        hasArrived.current = true;
        onArrive?.();
      }
      return;
    }

    hasArrived.current = false;
    _dir.normalize();

    // Build lookAt quaternion + 180° flip
    _tmpPos.copy(obj.position).addScaledVector(_dir, 1);
    _mat.lookAt(obj.position, _tmpPos, THREE.Object3D.DEFAULT_UP);
    _tgt.setFromRotationMatrix(_mat);
    _corr.copy(_tgt).multiply(FLIP_QUAT);

    // Slerp toward target facing
    const rotFactor = 1.0 - Math.exp(-rotationSpeed * delta);
    obj.quaternion.slerp(_corr, rotFactor);

    // Translate once roughly facing
    const angleDiff = obj.quaternion.angleTo(_corr);
    if (angleDiff < turnThreshold) {
      const step = Math.min(moveSpeed * delta, dist);
      obj.position.addScaledVector(_dir, step);
    }
  });
}
