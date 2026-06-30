import { useState, useEffect } from 'react';

/**
 * LoadingScreen — Progressive loading tied to real world readiness.
 *
 * Flow:
 *  1. Show "WILD TRAILS" with animated progress bar
 *  2. Progress driven by actual loadStage from App (0–4)
 *  3. Auto-fade once the world is playable (stage ≥ 1)
 *  4. No button. No interaction required. Seamless immersion.
 */

const STAGE_PROGRESS = [10, 30, 55, 80, 100];
const STAGE_MESSAGES = [
  'Loading Terrain',
  'Loading Animals',
  'Streaming Grass',
  'Streaming Forest',
  'Streaming Wildlife',
];
const FEATURE_MESSAGES = [
  'Tip: select any animal and the camera will focus it wherever it is.',
  'Wildlife can walk, run, drink, graze, rest, hunt, and fish.',
  'The pond includes live fish, lily pads, reeds, rocks, ripples, and stream banks.',
  'Weather, clouds, season, local time, and lighting adapt to your location.',
  'Right-drag pans the map. Double click sends the selected animal running.',
];

export default function LoadingScreen({
  loadStage = 0,
  worldReady = false,
  readyAnimals = 0,
  initialAnimalCount = 1,
  nearbyHabitatReady = false,
}) {
  const [show, setShow] = useState(true);
  const [dissolving, setDissolving] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);

  const animalProgress = Math.min(1, readyAnimals / initialAnimalCount);
  const targetProgress = worldReady
    ? 100
    : loadStage < 1
      ? STAGE_PROGRESS[0]
      : Math.min(98, Math.round(STAGE_PROGRESS[Math.min(loadStage, STAGE_PROGRESS.length - 1)] * 0.35 + animalProgress * 63));
  const statusMessage = loadStage < 1
    ? STAGE_MESSAGES[0]
    : !nearbyHabitatReady
      ? 'Preparing nearby trees and grass'
    : readyAnimals < initialAnimalCount
      ? `Preparing nearby wildlife ${readyAnimals}/${initialAnimalCount}`
      : 'Entering the meadow';

  useEffect(() => {
    const timer = setInterval(() => {
      setFeatureIndex((index) => (index + 1) % FEATURE_MESSAGES.length);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setDisplayProgress((current) => Math.max(current, targetProgress));
  }, [targetProgress]);

  // Dissolve once the world is playable
  useEffect(() => {
    if (!worldReady) return undefined;
    setDissolving(true);
    const timer = setTimeout(() => setShow(false), 250);
    return () => clearTimeout(timer);
  }, [worldReady]);

  if (!show) return null;

  return (
    <div
      className={`loading-screen ${dissolving ? 'loading-screen--dissolve' : ''} ${worldReady ? 'loading-screen--world-visible' : ''}`}
    >
      <div className="loading-screen__content">
        <h1 className="loading-title">Wild Trails</h1>

        <p className="loading-subtitle">{statusMessage}</p>

        <div className="loading-bar-container">
          <div
            className="loading-bar-fill"
            style={{ width: `${displayProgress}%` }}
          />
        </div>

        <p className="loading-percentage">{displayProgress}%</p>
        <p className="loading-subtitle">{FEATURE_MESSAGES[featureIndex]}</p>
      </div>
    </div>
  );
}
