import { useState, useEffect } from 'react';
import useLocalClimate from '../../hooks/useLocalClimate';

/**
 * TopBar — Minimal, cinematic.
 *
 * Layout: center-aligned time/weather only.
 * Right: search (🔍) + settings (⚙️)
 * Auto-fading tutorial hint.
 */

export default function TopBar({
  time = '09:00 AM',
  timeOfDay = 'Morning',
  onSearchOpen,
  onSettingsToggle,
  extraButtons,
}) {
  const [showHint, setShowHint] = useState(true);
  const climate = useLocalClimate();

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
          <span className="wt-topbar__climate">{climate.label}</span>
          <span className="wt-topbar__separator">·</span>
          <span className="wt-topbar__season">{climate.season}</span>
        </div>
        <div className="wt-topbar__local-context" title={climate.timeZone}>
          <span>{climate.location}</span>
          <span className="wt-topbar__separator">·</span>
          <span>{climate.timeZoneLabel}</span>
        </div>

        {/* Tutorial hint — auto-fades */}
        {showHint && (
          <div className="wt-topbar__hint">
            Click to Move · Double Click to Run · Click Animal to Follow
          </div>
        )}
      </div>

      {/* ── Right: Extra + Search + Settings ── */}
      <div className="wt-topbar__right">
        {extraButtons}
        <button
          className="wt-topbar__icon-btn"
          onClick={onSearchOpen}
          title="Search animals (⌘K)"
        >
          🔍
        </button>
        <button
          className="wt-topbar__icon-btn"
          onClick={onSettingsToggle}
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}
