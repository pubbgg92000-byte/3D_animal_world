import { useState, useCallback } from 'react';

/**
 * CameraWidget — Floating camera mode picker.
 *
 * A single floating button that expands into a radial menu
 * of camera modes. Collapses after selection.
 */

const CAMERA_MODES = [
  { id: 'follow',    icon: '🎯', label: 'Follow' },
  { id: 'fpv',       icon: '👁', label: 'First Person' },
  { id: 'cinematic', icon: '🎬', label: 'Orbit' },
  { id: 'aerial',    icon: '🦅', label: 'Aerial' },
  { id: 'free',      icon: '🔓', label: 'Free' },
];

export default function CameraWidget({ currentMode = 'follow', onModeChange }) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback((mode) => {
    onModeChange?.(mode);
    setOpen(false);
  }, [onModeChange]);

  const currentInfo = CAMERA_MODES.find((m) => m.id === currentMode) || CAMERA_MODES[0];

  return (
    <div className={`wt-camera-widget ${open ? 'wt-camera-widget--open' : ''}`}>
      {/* Expanded options */}
      {open && (
        <div className="wt-camera-widget__menu">
          {CAMERA_MODES.map((mode, i) => (
            <button
              key={mode.id}
              className={`wt-camera-widget__option ${
                currentMode === mode.id ? 'wt-camera-widget__option--active' : ''
              }`}
              onClick={() => handleSelect(mode.id)}
              aria-pressed={currentMode === mode.id}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="wt-camera-widget__option-icon">{mode.icon}</span>
              <span className="wt-camera-widget__option-label">{mode.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB button */}
      <button
        className="wt-camera-widget__fab"
        onClick={() => setOpen((o) => !o)}
        title={`Camera: ${currentInfo.label}`}
      >
        <span className="wt-camera-widget__fab-icon">
          {open ? '✕' : '🎥'}
        </span>
      </button>
    </div>
  );
}
