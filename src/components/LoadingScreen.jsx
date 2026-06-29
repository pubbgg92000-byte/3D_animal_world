import { useState, useEffect } from 'react';
import { useProgress } from '@react-three/drei';

/**
 * LoadingScreen — HTML overlay showing loading progress.
 * Fades out smoothly once assets are loaded.
 */
export default function LoadingScreen() {
  const { progress, active } = useProgress();
  const [show, setShow] = useState(true);

  // Delay hide to allow fade-out animation
  useEffect(() => {
    if (!active && progress === 100) {
      const timer = setTimeout(() => setShow(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [active, progress]);

  if (!show) return null;

  const fadeClass = !active && progress === 100 ? 'fade-out' : '';

  return (
    <div className={`loading-screen ${fadeClass}`}>
      <h1 className="loading-title">Interactive Moose</h1>
      <p className="loading-subtitle">Preparing the meadow…</p>

      <div className="loading-bar-container">
        <div
          className="loading-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="loading-percentage">{Math.round(progress)}%</p>
    </div>
  );
}
