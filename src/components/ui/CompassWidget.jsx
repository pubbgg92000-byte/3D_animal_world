import { Compass } from 'lucide-react';
import { getSolarDay, getSunVector } from '../../utils/solar';

function formatSolarTime(hour) {
  const normalized = ((hour % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const m = Math.round((normalized - h) * 60);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function CompassWidget({ climate, simMinutes = 720 }) {
  const latitude = climate?.latitude ?? 17.385;
  const { sunrise, sunset } = getSolarDay(latitude);
  const hour = simMinutes / 60;
  const sun = getSunVector(hour, latitude);
  const sunX = Math.max(-1, Math.min(1, sun.x));
  const sunY = Math.max(-1, Math.min(1, sun.z));
  const isLive = climate?.permission === 'granted';
  const isRequesting = climate?.permission === 'requesting';

  return (
    <button
      className={`wt-compass ${isLive ? 'wt-compass--live' : ''}`}
      type="button"
      onClick={climate?.requestPreciseLocation}
      title="Use current location for real-world compass and sun path"
      aria-label="Use current location for compass"
    >
      <span className="wt-compass__rose" aria-hidden="true">
        <span className="wt-compass__label wt-compass__label--n">N</span>
        <span className="wt-compass__label wt-compass__label--e">E</span>
        <span className="wt-compass__label wt-compass__label--s">S</span>
        <span className="wt-compass__label wt-compass__label--w">W</span>
        <span className="wt-compass__sun" style={{ '--sun-x': sunX, '--sun-y': sunY }} />
        <Compass className="wt-compass__icon" aria-hidden="true" />
      </span>
      <span className="wt-compass__meta">
        <span>{isRequesting ? 'Locating' : isLive ? 'Live' : 'Tap for local'}</span>
        <span>Rise E · Set W</span>
        <span>{formatSolarTime(sunrise)} / {formatSolarTime(sunset)}</span>
      </span>
    </button>
  );
}
