import { useRef, useEffect, useState, memo } from 'react';
import { STAT_COLORS } from '../../config/designTokens';

/**
 * StatBar — Animated stat bar with semantic coloring.
 *
 * Features:
 *  - Smooth animated fill (500ms easeOutExpo)
 *  - Semantic color per stat type
 *  - Low-value warning glow
 *  - Icon prefix
 *  - Interpolated value display
 */

const STAT_META = {
  energy:    { icon: '⚡', label: 'Energy',    colorKey: 'energy' },
  hydration: { icon: '💧', label: 'Hydration', colorKey: 'hydration' },
  hunger:    { icon: '🍖', label: 'Hunger',    colorKey: 'hunger' },
};

function StatBar({ stat = 'energy', value = 100, compact = false }) {
  const meta = STAT_META[stat] || STAT_META.energy;
  const pct = Math.max(0, Math.min(100, value));
  const colors = STAT_COLORS[meta.colorKey];

  // Animate the displayed value for smooth transitions
  const [displayPct, setDisplayPct] = useState(pct);
  const animFrame = useRef(null);
  const currentVal = useRef(pct);

  useEffect(() => {
    const start = currentVal.current;
    const diff = pct - start;
    if (Math.abs(diff) < 0.5) {
      setDisplayPct(pct);
      currentVal.current = pct;
      return;
    }

    const startTime = performance.now();
    const duration = 500;

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const val = start + diff * eased;
      currentVal.current = val;
      setDisplayPct(val);
      if (t < 1) animFrame.current = requestAnimationFrame(animate);
    };

    animFrame.current = requestAnimationFrame(animate);
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); };
  }, [pct]);

  const barColor = pct < 20 ? STAT_COLORS.danger.base
                 : pct < 40 ? STAT_COLORS.hunger.base
                 : colors.base;

  const glowColor = pct < 20 ? STAT_COLORS.danger.glow : 'transparent';

  if (compact) {
    return (
      <div className="wt-stat-mini">
        <div
          className="wt-stat-mini__fill"
          style={{
            width: `${displayPct}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    );
  }

  return (
    <div className="wt-stat">
      <span className="wt-stat__icon">{meta.icon}</span>
      <span className="wt-stat__label">{meta.label}</span>
      <div className="wt-stat__track" style={{ boxShadow: `0 0 8px ${glowColor}` }}>
        <div
          className="wt-stat__fill"
          style={{
            width: `${displayPct}%`,
            backgroundColor: barColor,
            boxShadow: pct < 30 ? `0 0 6px ${barColor}` : 'none',
          }}
        />
      </div>
      <span className="wt-stat__value">{Math.round(displayPct)}%</span>
    </div>
  );
}

export default memo(StatBar);
