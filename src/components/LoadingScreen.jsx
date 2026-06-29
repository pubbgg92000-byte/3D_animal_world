import { useState, useEffect } from 'react';

/**
 * LoadingScreen — HTML overlay showing loading progress.
 * Fades out smoothly once assets are loaded.
 */
export default function LoadingScreen({ entered = false, onEnter }) {
  const [show, setShow] = useState(true);
  const [introProgress, setIntroProgress] = useState(0);

  useEffect(() => {
    if (entered) {
      const timer = setTimeout(() => setShow(false), 520);
      return () => clearTimeout(timer);
    }

    setShow(true);
    setIntroProgress(0);
    const startedAt = performance.now();
    const timer = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const eased = 1 - Math.pow(1 - Math.min(elapsed / 1400, 1), 3);
      setIntroProgress(Math.min(100, Math.round(eased * 100)));
      if (elapsed >= 1400) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [entered]);

  if (!show) return null;

  const displayedProgress = entered ? 100 : introProgress;
  const fadeClass = entered ? 'fade-out' : '';
  const ready = introProgress >= 100;

  return (
    <div className={`loading-screen ${fadeClass}`}>
      <h1 className="loading-title">Wild Trails</h1>
      <p className="loading-subtitle">
        {entered ? 'Entering the meadow…' : 'Preparing the trail…'}
      </p>

      <div className="loading-bar-container">
        <div
          className="loading-bar-fill"
          style={{ width: `${displayedProgress}%` }}
        />
      </div>

      <p className="loading-percentage">{Math.round(displayedProgress)}%</p>

      {!entered && ready && (
        <button className="enter-button" type="button" onClick={onEnter} autoFocus>
          Enter Wild Trails
        </button>
      )}

      {!entered && ready && (
        <p className="loading-note">More wildlife and grass will keep growing after you enter.</p>
      )}
    </div>
  );
}
