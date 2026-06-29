import { useState, useEffect, useRef, useCallback } from 'react';

/** Camera mode labels and icons */
const CAMERA_MODES = [
  { id: 'follow', label: 'Follow', icon: '🎯' },
  { id: 'fpv', label: 'FPV', icon: '👁' },
  { id: 'aerial', label: 'Aerial', icon: '🦅' },
  { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
  { id: 'free', label: 'Free', icon: '🔓' },
];

/**
 * UIOverlay — stats, instructions, and camera mode switcher.
 */
export default function UIOverlay({
  animationName = 'Idle',
  speed = 0,
  cameraMode = 'follow',
  onCameraModeChange,
  aiState = 'Idle',
}) {
  const [fps, setFps] = useState(60);
  const [instructionsVisible, setInstructionsVisible] = useState(true);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  // FPS counter
  useEffect(() => {
    let animId;
    const countFrame = () => {
      frameCount.current++;
      const now = performance.now();
      const elapsed = now - lastTime.current;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / elapsed));
        frameCount.current = 0;
        lastTime.current = now;
      }
      animId = requestAnimationFrame(countFrame);
    };
    animId = requestAnimationFrame(countFrame);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Auto-hide instructions
  useEffect(() => {
    const timer = setTimeout(() => setInstructionsVisible(false), 15000);
    return () => clearTimeout(timer);
  }, []);

  // Re-show on keypress
  const showInstructions = useCallback(() => {
    setInstructionsVisible(true);
    setTimeout(() => setInstructionsVisible(false), 6000);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', showInstructions);
    return () => window.removeEventListener('keydown', showInstructions);
  }, [showInstructions]);

  const displaySpeed = animationName === 'Idle' ? '0.0' : speed.toFixed(1);

  return (
    <div className="ui-overlay">
      {/* Stats — top left */}
      <div className="stats-panel">
        <h3>Scene Info</h3>
        <div className="stat-row">
          <span className="stat-label">Animation</span>
          <span className="stat-value animation-name">{animationName}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Speed</span>
          <span className="stat-value">{displaySpeed} m/s</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">FPS</span>
          <span className="stat-value">{fps}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Camera</span>
          <span className="stat-value animation-name">{cameraMode}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Behavior</span>
          <span className="stat-value animation-name">{aiState}</span>
        </div>
      </div>

      {/* Camera mode switcher — top right */}
      <div className="camera-panel">
        <h3>Camera Mode</h3>
        <div className="camera-buttons">
          {CAMERA_MODES.map((m) => (
            <button
              key={m.id}
              className={`camera-btn ${cameraMode === m.id ? 'active' : ''}`}
              onClick={() => onCameraModeChange?.(m.id)}
              title={m.label}
            >
              <span className="camera-btn-icon">{m.icon}</span>
              <span className="camera-btn-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Instructions — bottom center */}
      <div className={`instructions-panel ${instructionsVisible ? '' : 'hidden'}`}>
        <div className="instruction-item">
          <span className="instruction-key">Click</span>
          Walk to point
        </div>
        <div className="instruction-separator" />
        <div className="instruction-item">
          <span className="instruction-key">Dbl-Click</span>
          Run to point
        </div>
        <div className="instruction-separator" />
        <div className="instruction-item">
          <span className="instruction-key">Drag</span>
          Orbit camera
        </div>
        <div className="instruction-separator" />
        <div className="instruction-item">
          <span className="instruction-key">Scroll</span>
          Zoom
        </div>
        <div className="instruction-separator" />
        <div className="instruction-item">
          <span className="instruction-key">Right-Drag</span>
          Pan
        </div>
      </div>
    </div>
  );
}
