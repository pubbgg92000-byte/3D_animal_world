import { useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { WORLD_SIZE, getTerrainHeight } from '../../../utils/world';

const SEGMENTS = 96;
const LONG_PRESS_MS = 400;
const LONG_PRESS_MOVE_THRESHOLD = 10; // px
const CLICK_DRAG_THRESHOLD = 6; // px

export default function Terrain({ onClick, onDoubleClick, onMiddleClick, onLongPress, onContextMenu }) {
  const pressTimer = useRef(null);
  const pressStartPos = useRef(null);
  const pressEvent = useRef(null);
  const didLongPress = useRef(false);
  const didDrag = useRef(false);

  const geometry = useMemo(() => {
    const result = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
    result.rotateX(-Math.PI / 2);
    const positions = result.attributes.position;
    const colors = [];

    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const y = getTerrainHeight(x, z);
      positions.setY(index, y);

      const meadow = Math.max(0, 1 - Math.hypot(x, z) / 46);
      const fineGrass = Math.sin(x * 1.7) * Math.cos(z * 1.35) * 0.015;
      const broadGrass = Math.sin(x * 0.19 + z * 0.13) * 0.035;
      const variation = broadGrass + fineGrass;
      const color = new THREE.Color().setHSL(
        0.305 + variation,
        0.58 + meadow * 0.12,
        0.31 + meadow * 0.075
      );
      colors.push(color.r, color.g, color.b);
    }

    result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    result.computeVertexNormals();
    return result;
  }, []);

  const getScreen = useCallback((nativeEvent) => ({
    x: nativeEvent?.clientX ?? window.innerWidth / 2,
    y: nativeEvent?.clientY ?? window.innerHeight / 2,
  }), []);

  const clearPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((event) => {
    didLongPress.current = false;
    didDrag.current = false;
    if (event.nativeEvent?.button !== 0) return;
    pressStartPos.current = {
      x: event.nativeEvent?.clientX ?? 0,
      y: event.nativeEvent?.clientY ?? 0,
    };
    pressEvent.current = event;

    clearPress();
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      const point = pressEvent.current?.point?.clone();
      if (point) {
        onLongPress?.(point, getScreen(pressEvent.current?.nativeEvent));
      }
      pressTimer.current = null;
    }, LONG_PRESS_MS);
  }, [clearPress, getScreen, onLongPress]);

  const handlePointerMove = useCallback((event) => {
    if (!pressTimer.current || !pressStartPos.current) return;
    const dx = (event.nativeEvent?.clientX ?? 0) - pressStartPos.current.x;
    const dy = (event.nativeEvent?.clientY ?? 0) - pressStartPos.current.y;
    if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD) {
      didDrag.current = true;
    }
    if (Math.abs(dx) > LONG_PRESS_MOVE_THRESHOLD || Math.abs(dy) > LONG_PRESS_MOVE_THRESHOLD) {
      clearPress();
    }
  }, [clearPress]);

  const handlePointerUp = useCallback((event) => {
    clearPress();
    if (event.nativeEvent?.button !== 1 || didDrag.current) return;
    event.stopPropagation();
    onMiddleClick?.(event.point.clone(), getScreen(event.nativeEvent));
  }, [clearPress, getScreen, onMiddleClick]);

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(event) => {
        event.stopPropagation();
        // Skip click if we just fired a long-press
        if (didLongPress.current) {
          didLongPress.current = false;
          return;
        }
        if (didDrag.current) {
          didDrag.current = false;
          return;
        }
        onClick?.(event.point.clone(), getScreen(event.nativeEvent));
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDoubleClick?.(event.point.clone(), getScreen(event.nativeEvent));
      }}
      onContextMenu={(event) => {
        event.nativeEvent?.preventDefault?.();
        if (!onContextMenu) return;
        event.stopPropagation();
        onContextMenu?.(event.point.clone(), getScreen(event.nativeEvent));
      }}
    >
      <meshStandardMaterial
        color="#3f7738"
        vertexColors
        roughness={0.94}
        metalness={0}
      />
    </mesh>
  );
}
