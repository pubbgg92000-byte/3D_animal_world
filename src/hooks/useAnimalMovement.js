import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TREE_OBSTACLES } from '../utils/collisionRegistry';

/**
 * useAnimalMovement — smooth rotation + translation toward a destination,
 * with predictive obstacle avoidance: when a tree or world boundary is ahead,
 * the animal steers sideways rather than walking into it.
 */

const FLIP_QUAT = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI
);

// Module-level reusables
const _dir     = new THREE.Vector3();
const _tgt     = new THREE.Quaternion();
const _corr    = new THREE.Quaternion();
const _mat     = new THREE.Matrix4();
const _tmpPos  = new THREE.Vector3();
const _ahead   = new THREE.Vector3();
const _steer   = new THREE.Vector3();

const WORLD_HALF = 38; // animals stay within ±38 on x and z

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
  const hasArrived      = useRef(false);
  const avoidStrength   = useRef(0);  // blended avoidance (0=none,1=max)
  const avoidDir        = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!groupRef.current || !destination) return;

    const obj = groupRef.current;

    _dir.copy(destination).sub(obj.position);
    _dir.y = 0;
    const dist = _dir.length();

    if (dist < arrivalThreshold) {
      if (!hasArrived.current) {
        hasArrived.current = true;
        avoidStrength.current = 0;
        onArrive?.();
      }
      return;
    }

    hasArrived.current = false;
    _dir.normalize();

    // ── Obstacle avoidance ─────────────────────────────────────────
    // Look ahead along current facing by ~2 m; if any tree is within
    // avoidance radius, compute a perpendicular steer direction.
    const LOOK_AHEAD  = 2.2;
    const AVOID_DIST  = 1.8;

    _ahead.copy(obj.position).addScaledVector(_dir, LOOK_AHEAD);

    let closestOb = null;
    let closestD  = Infinity;

    for (const ob of TREE_OBSTACLES) {
      const dx = _ahead.x - ob.x;
      const dz = _ahead.z - ob.z;
      const d  = Math.sqrt(dx * dx + dz * dz);
      if (d < ob.r + AVOID_DIST && d < closestD) {
        closestD  = d;
        closestOb = ob;
      }
    }

    // World boundary avoidance
    let boundarySteer = false;
    _steer.set(0, 0, 0);
    if (Math.abs(_ahead.x) > WORLD_HALF) {
      _steer.x = -Math.sign(_ahead.x) * 1.5;
      boundarySteer = true;
    }
    if (Math.abs(_ahead.z) > WORLD_HALF) {
      _steer.z = -Math.sign(_ahead.z) * 1.5;
      boundarySteer = true;
    }

    if (closestOb) {
      // Steer perpendicular to obstacle → animal direction (left or right)
      const toOb = new THREE.Vector3(closestOb.x - obj.position.x, 0, closestOb.z - obj.position.z).normalize();
      // Cross product with up gives perpendicular; pick whichever side faces destination more
      const perpA = new THREE.Vector3(-toOb.z, 0, toOb.x);
      const perpB = new THREE.Vector3( toOb.z, 0, -toOb.x);
      const side  = perpA.dot(_dir) > perpB.dot(_dir) ? perpA : perpB;
      _steer.add(side);
    } else if (boundarySteer) {
      // already set above
    } else {
      // No obstacle — pure seek
      _steer.copy(_dir);
    }

    // Blend steer
    const needsAvoid = closestOb !== null || boundarySteer;
    avoidStrength.current += needsAvoid
      ? Math.min(1, delta * 6)
      : -Math.min(avoidStrength.current, delta * 3);
    avoidStrength.current = Math.max(0, Math.min(1, avoidStrength.current));

    if (_steer.lengthSq() > 0) _steer.normalize();

    const moveDir = new THREE.Vector3().lerpVectors(_dir, _steer, avoidStrength.current).normalize();
    moveDir.y = 0; // always keep movement horizontal — prevent floating

    // ── Rotation ──────────────────────────────────────────────────
    _tmpPos.copy(obj.position).addScaledVector(moveDir, 1);
    _mat.lookAt(obj.position, _tmpPos, THREE.Object3D.DEFAULT_UP);
    _tgt.setFromRotationMatrix(_mat);
    _corr.copy(_tgt).multiply(FLIP_QUAT);

    const rotFactor = 1.0 - Math.exp(-rotationSpeed * delta);
    obj.quaternion.slerp(_corr, rotFactor);

    // ── Translation ───────────────────────────────────────────────
    const angleDiff = obj.quaternion.angleTo(_corr);
    if (angleDiff < turnThreshold) {
      const step = Math.min(moveSpeed * delta, dist);
      obj.position.addScaledVector(moveDir, step);
    }
  });
}
