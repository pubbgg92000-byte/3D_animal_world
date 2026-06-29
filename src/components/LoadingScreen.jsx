import { useState, useEffect, useRef } from 'react';

/**
 * LoadingScreen — Progressive loading with auto-entry.
 *
 * Flow:
 *  1. Show "WILD TRAILS" with animated progress bar
 *  2. Status messages rotate through ecosystem stages
 *  3. At ~30%, auto-trigger onEnter (Canvas starts rendering)
 *  4. Screen continues showing at reduced opacity
 *  5. At 100%, fades out cinematically (1.2s dissolve)
 *
 * No button. No interaction required. Seamless immersion.
 */

const LOADING_MESSAGES = [
  { at: 0,  text: 'Preparing ecosystem…' },
  { at: 15, text: 'Generating terrain…' },
  { at: 30, text: 'Planting meadow…' },
  { at: 45, text: 'Growing forests…' },
  { at: 60, text: 'Waking wildlife…' },
  { at: 75, text: 'Setting sun position…' },
  { at: 90, text: 'Releasing particles…' },
  { at: 98, text: 'Ready' },
];

function getStatusMessage(progress) {
  let msg = LOADING_MESSAGES[0].text;
  for (const entry of LOADING_MESSAGES) {
    if (progress >= entry.at) msg = entry.text;
  }
  return msg;
}

export default function LoadingScreen({ entered = false, onEnter }) {
  const [show, setShow] = useState(true);
  const [progress, setProgress] = useState(0);
  const [dissolving, setDissolving] = useState(false);
  const hasTriggeredEntry = useRef(false);
  const onEnterRef = useRef(onEnter);

  // Keep ref in sync so the timer closure doesn't go stale
  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  // Progress animation: 0 → 100 over ~2.5s with easeOutCubic
  // Runs ONCE on mount — no dependency on progress
  useEffect(() => {
    const startedAt = performance.now();
    const timer = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const t = Math.min(elapsed / 2500, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const p = Math.min(100, Math.round(eased * 100));
      setProgress(p);

      // Auto-enter at ~30% — Canvas begins rendering
      if (p >= 30 && !hasTriggeredEntry.current) {
        hasTriggeredEntry.current = true;
        onEnterRef.current?.();
      }

      if (t >= 1) clearInterval(timer);
    }, 40);

    return () => clearInterval(timer);
  }, []); // Run once on mount

  // Dissolve: once progress is done. Canvas entry usually happens at 30%,
  // but this fail-safe prevents the loader from sticking on slower browsers.
  useEffect(() => {
    if (progress >= 98 && !dissolving) {
      setDissolving(true);
      const timer = setTimeout(() => setShow(false), 250);
      return () => clearTimeout(timer);
    }
  }, [progress, dissolving]);

  if (!show) return null;

  const statusMessage = getStatusMessage(progress);
  const isWorldVisible = entered && progress >= 30;

  return (
    <div
      className={`loading-screen ${dissolving ? 'loading-screen--dissolve' : ''} ${isWorldVisible ? 'loading-screen--world-visible' : ''}`}
    >
      <div className="loading-screen__content">
        <h1 className="loading-title">Wild Trails</h1>

        <p className="loading-subtitle">{statusMessage}</p>

        <div className="loading-bar-container">
          <div
            className="loading-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="loading-percentage">{progress}%</p>
      </div>
    </div>
  );
}
