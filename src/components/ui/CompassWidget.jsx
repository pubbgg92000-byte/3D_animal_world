import { Compass } from 'lucide-react';
import { getSunVector } from '../../utils/solar';

export default function CompassWidget({ climate, simMinutes = 720, cameraPosition }) {
  const latitude = climate?.latitude ?? 17.385;
  const hour = simMinutes / 60;
  const sun = getSunVector(hour, latitude);
  const sunX = Math.max(-1, Math.min(1, sun.x));
  const sunY = Math.max(-1, Math.min(1, sun.z));
  const isLive = climate?.permission === 'granted';
  const isRequesting = climate?.permission === 'requesting';
  const heading = cameraPosition?.heading ?? 0;
  const statusLabel = isRequesting ? 'Locating' : isLive ? 'Live' : 'Local';

  return (
    <button
      className={`wt-compass ${isLive ? 'wt-compass--live' : ''}`}
      type="button"
      onClick={climate?.requestPreciseLocation}
      title="Use current location for real-world compass and sun path"
      aria-label="Use current location for compass"
    >
      <span
        className="wt-compass__rose"
        style={{ '--sun-x': sunX, '--sun-y': sunY, '--camera-heading': `${-heading}rad` }}
        aria-hidden="true"
      >
        <span className="wt-compass__label wt-compass__label--n">N</span>
        <span className="wt-compass__label wt-compass__label--e">E</span>
        <span className="wt-compass__label wt-compass__label--s">S</span>
        <span className="wt-compass__label wt-compass__label--w">W</span>
        <span className="wt-compass__sun" />
        <Compass className="wt-compass__icon" aria-hidden="true" />
      </span>
      <span className="wt-compass__meta">
        <span>{statusLabel}</span>
      </span>
    </button>
  );
}
