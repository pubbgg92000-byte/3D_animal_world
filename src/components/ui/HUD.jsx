import { useState, useEffect, useCallback, useRef, Suspense, lazy, useMemo, memo } from 'react';
import TopBar from './TopBar';
import AnimalPanel from './AnimalPanel';
import AnimalCarousel from './AnimalCarousel';
import MiniMap from './MiniMap';
import DiscoveryPopup from './DiscoveryPopup';

// Lazy-loaded overlays — only fetched when the user opens them
const EncyclopediaOverlay = lazy(() => import('./EncyclopediaOverlay'));
const SearchOverlay = lazy(() => import('./SearchOverlay'));
const SettingsDrawer = lazy(() => import('./SettingsDrawer'));
const NotificationFeed = lazy(() => import('./NotificationFeed'));
const LearningToggle = lazy(() => import('./LearningToggle'));
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
function HUD({
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
  // Progressive loading stage
  loadStage = 4,
}) {
  const [panelCollapsed, setPanelCollapsed] = useState(true);
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
  const [animalTrayOpen, setAnimalTrayOpen] = useState(false);
  const collapseTimer = useRef(null);

  // Simulation clock
  const clock = useSimulationClock(simSpeed);

  // Report simMinutes upstream so Sky/Lighting can use it
  useEffect(() => {
    onClockUpdate?.(clock.simMinutes);
  }, [clock.simMinutes, onClockUpdate]);

  // Notifications — deferred until world is mostly loaded
  const { notifications, dismiss } = useNotifications(
    loadStage >= 3 ? animalConfigs : [],
    loadStage >= 3 ? animalBehaviors : {}
  );

  // Selected animal config
  const selectedConfig = useMemo(
    () => animalConfigs.find((c) => c.id === selectedAnimalId),
    [animalConfigs, selectedAnimalId]
  );
  const selectedStats = animalStats[selectedAnimalId] || {};
  const selectedBehavior = animalBehaviors[selectedAnimalId] || 'Idle';

  // Responsive breakpoint detection
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => {
      setIsMobile(e.matches);
      if (e.matches) {
        setPanelHidden(true);
        setPanelCollapsed(true);
      }
    };
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
      setPanelCollapsed(isMobile);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (isMobile) return undefined;
      collapseTimer.current = setTimeout(() => {
        setPanelCollapsed(true);
        collapseTimer.current = null;
      }, 5000);
    }
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, [isMobile, selectedAnimalId]);

  // Select handler with audio
  const handleSelectAnimal = useCallback((id) => {
    onSelectAnimal?.(id);
    if (isMobile) {
      setAnimalTrayOpen(false);
      setPanelHidden(false);
      setPanelCollapsed(true);
    }
    playSelect();
  }, [isMobile, onSelectAnimal]);

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
    if (isMobile) setAnimalTrayOpen(false);
  }, [isMobile]);

  // Panel close (hide entirely)
  const handlePanelClose = useCallback(() => {
    playPanelClose();
    setPanelHidden(true);
  }, []);

  const handleAnimalTrayToggle = useCallback(() => {
    setAnimalTrayOpen((open) => {
      const next = !open;
      if (next) {
        setPanelHidden(true);
        setPanelCollapsed(true);
      }
      return next;
    });
    playClick();
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

  const learningControls = useMemo(() => (
    <>
      <Suspense fallback={null}>
        <LearningToggle active={learningMode} onToggle={handleLearningToggle} />
      </Suspense>
      <button
        className="wt-topbar__icon-btn"
        onClick={() => setEncyclopediaOpen(true)}
        title="Wildlife Encyclopedia"
        aria-label="Open encyclopedia"
      >
        📖
      </button>
    </>
  ), [handleLearningToggle, learningMode]);

  return (
    <div id="wt-hud" className="wt-hud">
      {/* ── TOP ── */}
      <TopBar
        time={clock.formatted}
        timeOfDay={clock.timeOfDay}
        onSearchOpen={() => setSearchOpen(true)}
        onSettingsToggle={handleSettingsToggle}
        extraButtons={learningControls}
      />

      {/* ── LEFT / BOTTOM-SHEET: Selected Animal Panel ── */}
      {!panelHidden && (
        <div className={[
          'wt-hud__left',
          isMobile ? 'wt-hud__left--mobile' : '',
          isMobile && panelCollapsed ? 'wt-hud__left--mobile-collapsed' : '',
        ].filter(Boolean).join(' ')}>
          <AnimalPanel
            config={selectedConfig}
            stats={selectedStats}
            behavior={selectedBehavior}
            onForceAbility={onForceAbility}
            collapsed={panelCollapsed}
            onToggleCollapse={handlePanelToggle}
            onClose={handlePanelClose}
            learningMode={learningMode}
            isMobile={isMobile}
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
          isMobile={isMobile}
          expanded={animalTrayOpen}
          onToggleExpanded={handleAnimalTrayToggle}
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
        {notifications.length > 0 && (
          <Suspense fallback={null}>
            <NotificationFeed
              notifications={notifications}
              onDismiss={dismiss}
            />
          </Suspense>
        )}
      </div>

      {/* ── DRAWER: Settings ── */}
      {settingsOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* ── MODAL: Search Overlay (lazy-loaded) ── */}
      {searchOpen && (
        <Suspense fallback={null}>
          <SearchOverlay
            animals={animalConfigs}
            behaviors={animalBehaviors}
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelect={handleSelectAnimal}
          />
        </Suspense>
      )}

      {/* ── MODAL: Encyclopedia (lazy-loaded) ── */}
      {encyclopediaOpen && (
        <Suspense fallback={null}>
          <EncyclopediaOverlay
            open={encyclopediaOpen}
            onClose={() => setEncyclopediaOpen(false)}
          />
        </Suspense>
      )}

      {/* ── Discovery Popup ── */}
      <DiscoveryPopup selectedAnimalId={selectedAnimalId} />

      {/* ── Flash Selection Popup ── */}
      <SelectionFlash
        selectedId={selectedAnimalId}
        animalConfigs={animalConfigs}
      />
      {/* ── Streaming Indicator ── */}
      {loadStage < 4 && (
        <div className="wt-streaming-indicator" aria-live="polite">
          <span className="wt-streaming-indicator__dot" />
          Streaming World…
        </div>
      )}
    </div>
  );
}

export default memo(HUD);

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
