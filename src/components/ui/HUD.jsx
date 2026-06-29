import { useState, useEffect, useCallback, useRef } from 'react';
import TopBar from './TopBar';
import AnimalPanel from './AnimalPanel';
import AnimalCarousel from './AnimalCarousel';
import SettingsDrawer from './SettingsDrawer';
import MiniMap from './MiniMap';
import NotificationFeed from './NotificationFeed';
import SearchOverlay from './SearchOverlay';
import LearningToggle from './LearningToggle';
import DiscoveryPopup from './DiscoveryPopup';
import EncyclopediaOverlay from './EncyclopediaOverlay';
import useSimulationClock from '../../hooks/useSimulationClock';
import useNotifications from '../../hooks/useNotifications';
import { playSelect, playClick, playCameraMode, playPanelOpen, playPanelClose } from '../../hooks/useAudioFeedback';
import { SPECIES_EMOJIS } from '../../config/designTokens';

/**
 * HUD — Root HUD layout with zone-based positioning.
 *
 * Zones:
 *  - Top:    TopBar (time, weather, search, settings, learning toggle)
 *  - Left:   AnimalPanel (selected animal, collapsible, educational)
 *  - Bottom: AnimalCarousel (animal dock)
 *  - Right:  MiniMap + NotificationFeed
 *  - Drawer: SettingsDrawer (camera modes, tuning, sim speed)
 *  - Modal:  SearchOverlay, EncyclopediaOverlay
 *  - Float:  DiscoveryPopup
 *
 * All positioned via CSS fixed layout. Covers <20% of viewport.
 */
export default function HUD({
  // Animal data
  selectedAnimalId,
  animalConfigs = [],
  animalStats = {},
  animalBehaviors = {},
  animalPositions = {},
  // Camera
  cameraMode = 'follow',
  cameraPosition,
  cameraSettings = { fov: 45, smoothness: 0.5, zoomSpeed: 1 },
  onCameraModeChange,
  onCameraSettingsChange,
  // Interactions
  onSelectAnimal,
  onForceAbility,
  minimalDestinationMarkers = false,
  onMinimalDestinationMarkersChange,
  // Clock reporting (for Sky/Lighting)
  onClockUpdate,
}) {
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelHidden, setPanelHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [encyclopediaOpen, setEncyclopediaOpen] = useState(false);
  const [learningMode, setLearningMode] = useState(() => {
    try { return localStorage.getItem('wild-trails:learning-mode') === 'true'; }
    catch { return false; }
  });
  const [simSpeed, setSimSpeed] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const collapseTimer = useRef(null);

  // Simulation clock
  const clock = useSimulationClock(simSpeed);

  // Report simMinutes upstream so Sky/Lighting can use it
  useEffect(() => {
    onClockUpdate?.(clock.simMinutes);
  }, [clock.simMinutes, onClockUpdate]);

  // Notifications
  const { notifications, dismiss } = useNotifications(
    animalConfigs,
    animalBehaviors
  );

  // Selected animal config
  const selectedConfig = animalConfigs.find((c) => c.id === selectedAnimalId);
  const selectedStats = animalStats[selectedAnimalId] || {};
  const selectedBehavior = animalBehaviors[selectedAnimalId] || 'Idle';

  // Responsive breakpoint detection
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Persist learning mode
  useEffect(() => {
    try { localStorage.setItem('wild-trails:learning-mode', String(learningMode)); }
    catch { /* silent */ }
  }, [learningMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Cmd/Ctrl+K → Search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
      // Space → Pause/Resume
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        setSimSpeed((s) => (s === 0 ? 1 : 0));
      }
      // 1-4 → Speed
      if (['1', '2', '3', '4'].includes(e.key) && e.target === document.body) {
        const speeds = { '1': 1, '2': 2, '3': 4, '4': 4 };
        setSimSpeed(speeds[e.key]);
      }
      // Escape → close modals
      if (e.key === 'Escape') {
        setSettingsOpen(false);
        setEncyclopediaOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Show expanded panel briefly when an animal is selected, then collapse.
  useEffect(() => {
    if (!selectedAnimalId) {
      setPanelHidden(true);
      setPanelCollapsed(true);
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
      return undefined;
    }

    if (selectedAnimalId) {
      setPanelHidden(false);
      setPanelCollapsed(false);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      collapseTimer.current = setTimeout(() => {
        setPanelCollapsed(true);
        collapseTimer.current = null;
      }, isMobile ? 3600 : 5000);
    }
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, [isMobile, selectedAnimalId]);

  // Select handler with audio
  const handleSelectAnimal = useCallback((id) => {
    onSelectAnimal?.(id);
    playSelect();
  }, [onSelectAnimal]);

  // Camera mode handler with audio
  const handleCameraMode = useCallback((mode) => {
    onCameraModeChange?.(mode);
    playCameraMode();
  }, [onCameraModeChange]);

  // Panel toggle with audio
  const handlePanelToggle = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    setPanelCollapsed((c) => {
      if (c) playPanelOpen();
      else playPanelClose();
      return !c;
    });
  }, []);

  // Panel close (hide entirely)
  const handlePanelClose = useCallback(() => {
    playPanelClose();
    setPanelHidden(true);
  }, []);

  // Settings toggle
  const handleSettingsToggle = useCallback(() => {
    setSettingsOpen((o) => !o);
  }, []);

  // Learning mode toggle
  const handleLearningToggle = useCallback(() => {
    setLearningMode((v) => !v);
    playClick();
  }, []);

  return (
    <div id="wt-hud" className="wt-hud">
      {/* ── TOP ── */}
      <TopBar
        time={clock.formatted}
        timeOfDay={clock.timeOfDay}
        onSearchOpen={() => setSearchOpen(true)}
        onSettingsToggle={handleSettingsToggle}
        extraButtons={
          <>
            <LearningToggle active={learningMode} onToggle={handleLearningToggle} />
            <button
              className="wt-topbar__icon-btn"
              onClick={() => setEncyclopediaOpen(true)}
              title="Wildlife Encyclopedia"
              aria-label="Open encyclopedia"
            >
              📖
            </button>
          </>
        }
      />

      {/* ── LEFT: Selected Animal Panel ── */}
      {!panelHidden && (
        <div className="wt-hud__left">
          <AnimalPanel
            config={selectedConfig}
            stats={selectedStats}
            behavior={selectedBehavior}
            onForceAbility={onForceAbility}
            collapsed={panelCollapsed}
            onToggleCollapse={handlePanelToggle}
            onClose={handlePanelClose}
            learningMode={learningMode}
          />
        </div>
      )}

      {/* ── BOTTOM: Animal Carousel ── */}
      <div className="wt-hud__bottom">
        <AnimalCarousel
          animals={animalConfigs}
          stats={animalStats}
          behaviors={animalBehaviors}
          selectedId={selectedAnimalId}
          onSelect={handleSelectAnimal}
        />
      </div>

      {/* ── RIGHT: MiniMap + Notifications ── */}
      <div className="wt-hud__right">
        <MiniMap
          animalConfigs={animalConfigs}
          animalPositions={animalPositions}
          selectedId={selectedAnimalId}
          cameraPosition={cameraPosition}
        />
        <NotificationFeed
          notifications={notifications}
          onDismiss={dismiss}
        />
      </div>

      {/* ── DRAWER: Settings ── */}
      <SettingsDrawer
        open={settingsOpen}
        onToggle={handleSettingsToggle}
        currentMode={cameraMode}
        onModeChange={handleCameraMode}
        cameraSettings={cameraSettings}
        onCameraSettingsChange={onCameraSettingsChange}
        simSpeed={simSpeed}
        onSimSpeedChange={setSimSpeed}
        minimalDestinationMarkers={minimalDestinationMarkers}
        onMinimalDestinationMarkersChange={onMinimalDestinationMarkersChange}
      />

      {/* ── MODAL: Search Overlay ── */}
      <SearchOverlay
        animals={animalConfigs}
        behaviors={animalBehaviors}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSelectAnimal}
      />

      {/* ── MODAL: Encyclopedia ── */}
      <EncyclopediaOverlay
        open={encyclopediaOpen}
        onClose={() => setEncyclopediaOpen(false)}
      />

      {/* ── Discovery Popup ── */}
      <DiscoveryPopup selectedAnimalId={selectedAnimalId} />

      {/* ── Flash Selection Popup ── */}
      <SelectionFlash
        selectedId={selectedAnimalId}
        animalConfigs={animalConfigs}
      />
    </div>
  );
}

/* ── Selection Flash — brief popup on animal selection ── */
function SelectionFlash({ selectedId, animalConfigs }) {
  const [flash, setFlash] = useState(null);
  const prevId = useRef(null);

  useEffect(() => {
    if (selectedId && selectedId !== prevId.current) {
      prevId.current = selectedId;
      const cfg = animalConfigs.find((c) => c.id === selectedId);
      if (cfg) {
        const species = cfg.species || cfg.id;
        const emoji = SPECIES_EMOJIS[species] || '🐾';
        setFlash(`${emoji} ${cfg.displayName || cfg.name}`);
        const timer = setTimeout(() => setFlash(null), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedId, animalConfigs]);

  if (!flash) return null;

  return (
    <div className="wt-flash" aria-live="polite">
      {flash}
    </div>
  );
}
