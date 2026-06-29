import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * usePointerFollow — subtly rotates the moose toward the pointer
 * when idle, creating a "watching the cursor" effect.
 *
 * @param {React.RefObject} groupRef  — ref to moose root Group
 * @param {boolean}         enabled   — only applies rotation when true (idle state)
 * @param {Object}          opts
 * @param {number}          opts.maxAngle      — max rotation in radians (~30°)
 * @param {number}          opts.smoothFactor  — interpolation speed
 */
export default function usePointerFollow(
  groupRef,
  enabled = true,
  { maxAngle = Math.PI / 6, smoothFactor = 2.0 } = {}
) {
  const { camera, pointer } = useThree();

  // Reusable objects
  const _raycaster = useRef(new THREE.Raycaster());
  const _groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const _intersect = useRef(new THREE.Vector3());
  const _dir = useRef(new THREE.Vector3());
  const _targetQuat = useRef(new THREE.Quaternion());
  const _baseQuat = useRef(null);
  const _lookMat = useRef(new THREE.Matrix4());

  useFrame((_, delta) => {
    if (!groupRef.current || !enabled) return;

    const moose = groupRef.current;

    // Store base quaternion on first frame while idle
    if (_baseQuat.current === null) {
      _baseQuat.current = moose.quaternion.clone();
    }

    // Cast ray from pointer onto ground plane
    _raycaster.current.setFromCamera(pointer, camera);
    const hit = _raycaster.current.ray.intersectPlane(
      _groundPlane.current,
      _intersect.current
    );

    if (!hit) return;

    // Direction from moose to pointer hit point (XZ only)
    const dir = _dir.current;
    dir.copy(_intersect.current).sub(moose.position);
    dir.y = 0;

    if (dir.lengthSq() < 0.01) return;

    dir.normalize();

    // Compute target rotation
    const targetPos = moose.position.clone().add(dir);
    _lookMat.current.lookAt(moose.position, targetPos, THREE.Object3D.DEFAULT_UP);
    _targetQuat.current.setFromRotationMatrix(_lookMat.current);

    // Clamp the rotation angle relative to the base orientation
    const baseQuat = _baseQuat.current;
    const angleBetween = baseQuat.angleTo(_targetQuat.current);

    if (angleBetween > maxAngle) {
      // Partially interpolate toward the target, clamped
      const clampRatio = maxAngle / angleBetween;
      _targetQuat.current.copy(baseQuat).slerp(_targetQuat.current, clampRatio);
    }

    // Smoothly interpolate
    const factor = 1.0 - Math.exp(-smoothFactor * delta);
    moose.quaternion.slerp(_targetQuat.current, factor);
  });

  // Reset base quaternion when disabled (e.g., moose starts walking)
  const resetBase = () => {
    _baseQuat.current = null;
  };

  return { resetBase };
}
