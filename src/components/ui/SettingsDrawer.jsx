import { useState, useCallback } from 'react';

/**
 * SettingsDrawer — Unified settings panel.
 *
 * Replaces both the CameraWidget FAB and the TopBar speed controls.
 * Opens as a slide-out drawer from the right.
 *
 * Sections:
 *  - Camera: mode radio buttons
 *  - Camera Tuning: FOV, smoothness, zoom speed sliders
 *  - Simulation: speed controls
 */

const CAMERA_MODES = [
  { id: 'follow',    icon: '🎯', label: 'Follow' },
  { id: 'fpv',       icon: '👁', label: 'First Person' },
  { id: 'cinematic', icon: '🎬', label: 'Documentary' },
  { id: 'aerial',    icon: '🦅', label: 'Aerial' },
  { id: 'free',      icon: '🔓', label: 'Free Fly' },
];

const SIM_SPEEDS = [
  { value: 0, label: '⏸', title: 'Pause' },
  { value: 1, label: '1×', title: '1× Speed' },
  { value: 2, label: '2×', title: '2× Speed' },
  { value: 4, label: '4×', title: '4× Speed' },
];

export default function SettingsDrawer({
  open = false,
  onToggle,
  // Camera
  currentMode = 'follow',
  onModeChange,
  cameraSettings = { fov: 45, smoothness: 0.5, zoomSpeed: 1 },
  onCameraSettingsChange,
  // Simulation
  simSpeed = 1,
  onSimSpeedChange,
}) {
  const handleSettingChange = useCallback((key, value) => {
    onCameraSettingsChange?.({ ...cameraSettings, [key]: value });
  }, [cameraSettings, onCameraSettingsChange]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="wt-settings-backdrop" onClick={onToggle} />
      )}

      {/* Drawer */}
      <div className={`wt-settings-drawer ${open ? 'wt-settings-drawer--open' : ''}`}>
        {/* Header */}
        <div className="wt-settings-drawer__header">
          <span className="wt-settings-drawer__title">Settings</span>
          <button className="wt-settings-drawer__close" onClick={onToggle}>✕</button>
        </div>

        {/* ── Camera Mode ── */}
        <div className="wt-settings-drawer__section">
          <div className="wt-settings-drawer__section-title">🎥 Camera</div>
          <div className="wt-settings-drawer__modes">
            {CAMERA_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`wt-settings-drawer__mode ${currentMode === mode.id ? 'wt-settings-drawer__mode--active' : ''}`}
                onClick={() => onModeChange?.(mode.id)}
              >
                <span className="wt-settings-drawer__mode-icon">{mode.icon}</span>
                <span className="wt-settings-drawer__mode-label">{mode.label}</span>
                {currentMode === mode.id && (
                  <span className="wt-settings-drawer__mode-check">●</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Camera Tuning ── */}
        <div className="wt-settings-drawer__section">
          <div className="wt-settings-drawer__section-title">🎛 Tuning</div>

          <div className="wt-settings-drawer__slider-group">
            <div className="wt-settings-drawer__slider-row">
              <label className="wt-settings-drawer__slider-label">Smoothness</label>
              <span className="wt-settings-drawer__slider-value">
                {Math.round(cameraSettings.smoothness * 100)}%
              </span>
            </div>
            <input
              type="range"
              className="wt-settings-drawer__slider"
              min="0.1"
              max="1"
              step="0.05"
              value={cameraSettings.smoothness}
              onChange={(e) => handleSettingChange('smoothness', parseFloat(e.target.value))}
            />
          </div>

          <div className="wt-settings-drawer__slider-group">
            <div className="wt-settings-drawer__slider-row">
              <label className="wt-settings-drawer__slider-label">Zoom Speed</label>
              <span className="wt-settings-drawer__slider-value">
                {cameraSettings.zoomSpeed.toFixed(1)}×
              </span>
            </div>
            <input
              type="range"
              className="wt-settings-drawer__slider"
              min="0.2"
              max="3"
              step="0.1"
              value={cameraSettings.zoomSpeed}
              onChange={(e) => handleSettingChange('zoomSpeed', parseFloat(e.target.value))}
            />
          </div>

          <div className="wt-settings-drawer__slider-group">
            <div className="wt-settings-drawer__slider-row">
              <label className="wt-settings-drawer__slider-label">Field of View</label>
              <span className="wt-settings-drawer__slider-value">{cameraSettings.fov}°</span>
            </div>
            <input
              type="range"
              className="wt-settings-drawer__slider"
              min="30"
              max="75"
              step="1"
              value={cameraSettings.fov}
              onChange={(e) => handleSettingChange('fov', parseInt(e.target.value))}
            />
          </div>
        </div>

        {/* ── Simulation Speed ── */}
        <div className="wt-settings-drawer__section">
          <div className="wt-settings-drawer__section-title">⏱ Simulation</div>
          <div className="wt-settings-drawer__speeds">
            {SIM_SPEEDS.map((s) => (
              <button
                key={s.value}
                className={`wt-settings-drawer__speed ${simSpeed === s.value ? 'wt-settings-drawer__speed--active' : ''}`}
                onClick={() => onSimSpeedChange?.(s.value)}
                title={s.title}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
