import { useState, useEffect, useRef } from 'react';

/**
 * TopBar — Minimal, cinematic.
 *
 * Layout: center-aligned time/weather only.
 * Right: search (🔍) + settings (⚙️)
 * Auto-fading tutorial hint.
 */

const WEATHER_STATES = ['☀️', '⛅', '🌤️'];

export default function TopBar({
  time = '09:00 AM',
  timeOfDay = 'Morning',
  onSearchOpen,
  onSettingsToggle,
  extraButtons,
}) {
  const [showHint, setShowHint] = useState(true);

  // Auto-fade tutorial hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Decorative weather
  const weatherIcon = WEATHER_STATES[Math.floor(Date.now() / 120000) % WEATHER_STATES.length];

  return (
    <div className="wt-topbar">
      {/* ── Left: empty — the world is the brand ── */}
      <div className="wt-topbar__left" />

      {/* ── Center: Time · Weather · Season ── */}
      <div className="wt-topbar__center">
        <div className="wt-topbar__time-weather">
          <span className="wt-topbar__time">{time}</span>
          <span className="wt-topbar__separator">·</span>
          <span className="wt-topbar__weather">{weatherIcon}</span>
          <span className="wt-topbar__separator">·</span>
          <span className="wt-topbar__temp">23°</span>
          <span className="wt-topbar__separator">·</span>
          <span className="wt-topbar__season">Spring</span>
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
