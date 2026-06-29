import { useState, useEffect, useRef, useMemo } from 'react';

/* ========================================
   Stat Bar Component
   ======================================== */
function StatBar({ label, value, color, icon }) {
  const percentage = Math.max(0, Math.min(100, value));
  const barColor =
    percentage < 20 ? '#ef4444' : percentage < 40 ? '#f59e0b' : color;

  return (
    <div className="stat-bar-container">
      <span className="stat-bar-label">
        {icon} {label}
      </span>
      <div className="stat-bar-track">
        <div
          className="stat-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      <span className="stat-bar-value">{Math.round(percentage)}%</span>
    </div>
  );
}

/* ========================================
   Mini Stat Bar — for unselected animals
   ======================================== */
function MiniStatBar({ value, color }) {
  const p = Math.max(0, Math.min(100, value));
  const c = p < 20 ? '#ef4444' : p < 40 ? '#f59e0b' : color;
  return (
    <div className="mini-stat-track">
      <div className="mini-stat-fill" style={{ width: `${p}%`, backgroundColor: c }} />
    </div>
  );
}

/* ========================================
   Animal Info
   ======================================== */
const ANIMAL_EMOJIS = {
  moose: '🫎',
  deer: '🦌',
  bear: '🐻',
  fox: '🦊',
  rabbit: '🐇',
};

const ANIMAL_ACTIONS = {
  moose: ['Walk', 'Run', 'Graze', 'Drink', 'Sleep'],
  deer: ['Walk', 'Run', 'Graze', 'Drink', 'Sleep'],
  bear: ['Walk', 'Run', 'Hunt Fish', 'Drink', 'Sleep'],
  fox: ['Walk', 'Run', 'Hunt Prey', 'Drink', 'Sleep'],
  rabbit: ['Walk', 'Run', 'Graze', 'Drink', 'Sleep'],
};

/* ========================================
   UIOverlay Component
   ======================================== */
export default function UIOverlay({
  selectedAnimalId,
  animalConfigs = [],
  animalStats = {},
  animalBehaviors = {},
  cameraMode = 'follow',
  onCameraModeChange,
  onSelectAnimal,
  onForceAbility,
}) {
  const [fps, setFps] = useState(60);
  const [flashMessage, setFlashMessage] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const prevSelectedId = useRef(null);

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

  // Flash popup when selection changes
  useEffect(() => {
    if (selectedAnimalId && selectedAnimalId !== prevSelectedId.current) {
      prevSelectedId.current = selectedAnimalId;
      const cfg = animalConfigs.find((c) => c.id === selectedAnimalId);
      if (cfg) {
        setFlashMessage(`${ANIMAL_EMOJIS[cfg.id] || '🐾'} ${cfg.name} Selected`);
        setSettingsOpen(true);
        const timer = setTimeout(() => setFlashMessage(null), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedAnimalId, animalConfigs]);

  const selectedConfig = useMemo(
    () => animalConfigs.find((c) => c.id === selectedAnimalId),
    [animalConfigs, selectedAnimalId]
  );
  const selectedStats = animalStats[selectedAnimalId] || {};
  const selectedBehavior = animalBehaviors[selectedAnimalId] || 'Idle';
  const actions = ANIMAL_ACTIONS[selectedAnimalId] || [];

  return (
    <div id="ui-overlay" style={{ pointerEvents: 'none' }}>

      {/* -------- Flash Popup (center) -------- */}
      {flashMessage && (
        <div className="flash-popup" style={{ pointerEvents: 'none' }}>
          {flashMessage}
        </div>
      )}

      {/* -------- Settings Toggle Button (top-left corner) -------- */}
      <button
        className="settings-toggle"
        style={{ pointerEvents: 'auto' }}
        onClick={() => setSettingsOpen((o) => !o)}
        title={settingsOpen ? 'Close Settings' : 'Open Settings'}
      >
        {settingsOpen ? '✕' : '⚙️'}
      </button>

      {/* -------- Settings Panel (top-left, collapsible) -------- */}
      {settingsOpen && (
        <div className="hud-panel settings-panel" style={{ pointerEvents: 'auto' }}>
          {selectedConfig ? (
            <>
              {/* Selected animal header */}
              <div className="panel-title">
                <span className="animal-emoji">
                  {ANIMAL_EMOJIS[selectedConfig.id] || '🐾'}
                </span>
                <span>{selectedConfig.name}</span>
                <span className="behavior-badge">{selectedBehavior}</span>
              </div>

              {/* Stats */}
              <StatBar label="Energy" value={selectedStats.energy ?? 100} color="#4ade80" icon="⚡" />
              <StatBar label="Hydration" value={selectedStats.hydration ?? 100} color="#60a5fa" icon="💧" />
              <StatBar label="Hunger" value={selectedStats.hunger ?? 100} color="#f97316" icon="🍖" />

              {/* Abilities — now clickable buttons */}
              <div className="actions-section">
                <div className="actions-label">Abilities</div>
                <div className="actions-list">
                  {actions.map((action) => {
                    const isActive =
                      selectedBehavior === action ||
                      (action === 'Walk' && selectedBehavior === 'Wander') ||
                      (action === 'Hunt Fish' && selectedBehavior === 'Hunt') ||
                      (action === 'Hunt Prey' && selectedBehavior === 'Hunt');
                    return (
                      <button
                        key={action}
                        className={`action-chip ${isActive ? 'active' : ''}`}
                        onClick={() => onForceAbility?.(action)}
                        title={`Force ${action}`}
                      >
                        {action}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Camera modes */}
              <div className="actions-section">
                <div className="actions-label">Camera</div>
                <div className="camera-buttons-inline">
                  {['follow', 'fpv', 'aerial', 'cinematic', 'free'].map((mode) => (
                    <button
                      key={mode}
                      className={`cam-chip ${cameraMode === mode ? 'active' : ''}`}
                      onClick={() => onCameraModeChange?.(mode)}
                    >
                      {{ follow: '🎯', fpv: '👁', aerial: '🦅', cinematic: '🎬', free: '🔓' }[mode]}{' '}
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stat-row" style={{ marginTop: '4px' }}>
                <span className="stat-label">FPS</span>
                <span className="stat-value fps-value">{fps}</span>
              </div>
            </>
          ) : (
            <div className="panel-title">
              <span>🐾</span>
              <span>Click an animal to select</span>
            </div>
          )}
        </div>
      )}

      {/* -------- Animal Selector with mini bars (bottom-left) -------- */}
      <div className="hud-panel animal-selector" style={{ pointerEvents: 'auto' }}>
        <div className="animal-buttons">
          {animalConfigs.map((cfg) => {
            const stats = animalStats[cfg.id] || {};
            const behavior = animalBehaviors[cfg.id] || 'Idle';
            const isSelected = selectedAnimalId === cfg.id;

            return (
              <button
                key={cfg.id}
                className={`animal-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectAnimal?.(cfg.id)}
                title={`${cfg.name} — ${behavior}`}
              >
                <span className="animal-btn-emoji">
                  {ANIMAL_EMOJIS[cfg.id] || '🐾'}
                </span>
                <span className="animal-btn-name">{cfg.name}</span>
                <div className="animal-btn-bars">
                  <MiniStatBar value={stats.energy ?? 100} color="#4ade80" />
                  <MiniStatBar value={stats.hydration ?? 100} color="#60a5fa" />
                  <MiniStatBar value={stats.hunger ?? 100} color="#f97316" />
                </div>
                <span className="animal-btn-behavior">{behavior}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
