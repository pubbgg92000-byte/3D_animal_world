import { useState, useEffect } from 'react';
import { Info, Menu, Search, Settings, X } from 'lucide-react';

/**
 * TopBar — Minimal, cinematic.
 *
 * Layout: center-aligned time/weather only.
 * Right: search + settings/menu
 * Auto-fading tutorial hint.
 */

export default function TopBar({
  time = '09:00 AM',
  timeOfDay = 'Morning',
  onGuideOpen,
  onSearchOpen,
  onSettingsToggle,
  extraButtons,
  isMobile = false,
  climate,
}) {
  const [showHint, setShowHint] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Auto-fade tutorial hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="wt-topbar">
      {/* ── Left: empty — the world is the brand ── */}
      <div className="wt-topbar__left" />

      {/* ── Center: Time · Weather · Season ── */}
      <div className="wt-topbar__center">
        <div className="wt-topbar__time-weather">
          <span className="wt-topbar__time" title={`Wildlife clock: ${timeOfDay}`}>{time}</span>
          <span className="wt-topbar__separator">·</span>
          <span className="wt-topbar__weather">{climate.icon}</span>
          {climate.temperature && (
            <>
              <span className="wt-topbar__temp">{climate.temperature}</span>
              <span className="wt-topbar__separator">·</span>
            </>
          )}
          {!isMobile && (
            <>
              <span className="wt-topbar__climate">{climate.label}</span>
              <span className="wt-topbar__separator">·</span>
              <span className="wt-topbar__season">{climate.season}</span>
            </>
          )}
        </div>
        <div className="wt-topbar__local-context" title={climate.timeZone}>
          <span>{climate.location}</span>
          <span className="wt-topbar__separator">·</span>
          <span>{climate.timeZoneLabel}</span>
          {climate.coordinatesLabel && (
            <>
              <span className="wt-topbar__separator">·</span>
              <span title="Weather coordinates">📌 {climate.coordinatesLabel}</span>
            </>
          )}
          {climate.precipitation && (
            <>
              <span className="wt-topbar__separator">·</span>
              <span title="Current precipitation">☔ {climate.precipitation}</span>
            </>
          )}
          {climate.permission === 'granted' && (
            <>
              <span className="wt-topbar__separator">·</span>
              <span title="Weather uses your current location">📍 Live local</span>
            </>
          )}
        </div>

        {/* Tutorial hint — auto-fades */}
        {showHint && (
          <div className="wt-topbar__hint">
            Click to Move · Double Click to Run · Right Drag to Pan · Click Animal to Follow
          </div>
        )}

        {isMobile && detailsOpen && (
          <>
            <button
              className="wt-topbar__scrim"
              type="button"
              aria-label="Close menu"
              onClick={() => setDetailsOpen(false)}
            />
            <div className="wt-topbar__details" role="menu">
              <div className="wt-topbar__detail-row">
                <span>{climate.label}</span>
                <span>{climate.season}</span>
              </div>
              <div className="wt-topbar__detail-row">
                <span>{climate.location}</span>
                <span>{climate.timeZoneLabel}</span>
              </div>
              <div className="wt-topbar__detail-row">
                {climate.coordinatesLabel && <span>📌 {climate.coordinatesLabel}</span>}
                {climate.precipitation && <span>☔ {climate.precipitation}</span>}
              </div>
              {climate.permission === 'granted' && (
                <div className="wt-topbar__detail-row">
                  <span>📍 Live local weather</span>
                </div>
              )}
              <div className="wt-topbar__detail-actions">
                {extraButtons}
                <button
                  className="wt-topbar__icon-btn"
                  onClick={onSettingsToggle}
                  title="Settings"
                  aria-label="Settings"
                  data-tooltip="Tune camera, simulation speed, and markers"
                >
                  <Settings aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Right: Extra + Search + Settings ── */}
      <div className="wt-topbar__right">
        {!isMobile && extraButtons}
        <button
          className="wt-topbar__icon-btn"
          onClick={onGuideOpen}
          title="Guide book"
          aria-label="Open guide book"
          data-tooltip="Controls, wildlife guide, and project info"
        >
          <Info aria-hidden="true" />
        </button>
        <button
          className="wt-topbar__icon-btn"
          onClick={onSearchOpen}
          title="Search animals (⌘K)"
          aria-label="Search animals"
          data-tooltip="Search and jump to any animal"
        >
          <Search aria-hidden="true" />
        </button>
        {isMobile ? (
          <button
            className="wt-topbar__icon-btn wt-topbar__more"
            type="button"
            aria-label="Show weather, learning, and settings"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
            title={detailsOpen ? 'Close menu' : 'More'}
          >
            {detailsOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        ) : (
          <button
            className="wt-topbar__icon-btn"
            onClick={onSettingsToggle}
            title="Settings"
            aria-label="Settings"
            data-tooltip="Tune camera, simulation speed, and markers"
          >
            <Settings aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
