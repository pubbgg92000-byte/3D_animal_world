import { useRef, useEffect, useCallback, memo } from 'react';
import {
  SPECIES_COLORS,
} from '../../config/designTokens';
import {
  WORLD_SIZE,
  POND_X, POND_Z, POND_RADIUS,
  STREAM_START_Z, STREAM_END_Z,
  streamCenterX,
} from '../../utils/world';

/**
 * MiniMap — Canvas 2D overlay minimap.
 *
 * Draws: terrain base, water (pond + stream), animal dots,
 * selected animal highlight, camera indicator.
 *
 * Interactive: click to pan camera (future).
 */

const MAP_SIZE = 152;
const HALF = WORLD_SIZE / 2;

function worldToMap(x, z) {
  const px = ((x + HALF) / WORLD_SIZE) * MAP_SIZE;
  const py = ((z + HALF) / WORLD_SIZE) * MAP_SIZE;
  return [px, py];
}

function MiniMap({
  animalConfigs = [],
  animalPositions = {},
  selectedId,
  cameraPosition,
}) {
  const canvasRef = useRef(null);
  const dataRef = useRef({
    animalConfigs,
    animalPositions,
    selectedId,
    cameraPosition,
  });

  useEffect(() => {
    dataRef.current = {
      animalConfigs,
      animalPositions,
      selectedId,
      cameraPosition,
    };
  }, [animalConfigs, animalPositions, selectedId, cameraPosition]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const {
      animalConfigs: currentConfigs,
      animalPositions: currentPositions,
      selectedId: currentSelectedId,
      cameraPosition: currentCameraPosition,
    } = dataRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MAP_SIZE * dpr;
    canvas.height = MAP_SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = 'rgba(12, 22, 16, 0.85)';
    ctx.beginPath();
    ctx.roundRect(0, 0, MAP_SIZE, MAP_SIZE, 10);
    ctx.fill();

    // Terrain grid — subtle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const pos = (i / 4) * MAP_SIZE;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, MAP_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(MAP_SIZE, pos);
      ctx.stroke();
    }

    // Pond
    const [px, pz] = worldToMap(POND_X, POND_Z);
    const pondR = (POND_RADIUS / WORLD_SIZE) * MAP_SIZE;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.arc(px, pz, pondR, 0, Math.PI * 2);
    ctx.fill();

    // Stream
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let z = STREAM_START_Z; z <= STREAM_END_Z; z += 2) {
      const cx = streamCenterX(z);
      const [mx, mz] = worldToMap(cx, z);
      if (z === STREAM_START_Z) ctx.moveTo(mx, mz);
      else ctx.lineTo(mx, mz);
    }
    ctx.stroke();

    // Animals
    for (const cfg of currentConfigs) {
      const pos = currentPositions[cfg.id];
      if (!pos) continue;
      const species = cfg.species || cfg.id;
      const [ax, az] = worldToMap(pos.x, pos.z);
      const isSelected = cfg.id === currentSelectedId;

      if (isSelected) {
        // Selection ring
        ctx.strokeStyle = '#4ADE80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ax, az, 5, 0, Math.PI * 2);
        ctx.stroke();

        // Glow
        ctx.fillStyle = 'rgba(74, 222, 128, 0.3)';
        ctx.beginPath();
        ctx.arc(ax, az, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Animal dot
      ctx.fillStyle = SPECIES_COLORS[species] || '#fff';
      ctx.beginPath();
      ctx.arc(ax, az, isSelected ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camera position
    if (currentCameraPosition) {
      const [cx, cz] = worldToMap(currentCameraPosition.x, currentCameraPosition.z);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(cx, cz, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, []);

  useEffect(() => {
    draw();
    const interval = setInterval(draw, 100); // 10 FPS; decoupled from React/r3f frames.
    return () => clearInterval(interval);
  }, [draw]);

  return (
    <div className="wt-minimap">
      <canvas
        ref={canvasRef}
        className="wt-minimap__canvas"
        style={{ width: MAP_SIZE, height: MAP_SIZE }}
      />
    </div>
  );
}

export default memo(MiniMap);
