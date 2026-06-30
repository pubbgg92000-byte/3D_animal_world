import * as THREE from 'three';

const DEFAULT_LATITUDE = 17.385;
const DEG_TO_RAD = Math.PI / 180;

export function getSolarDay(latitude = DEFAULT_LATITUDE, date = new Date()) {
  const dayStart = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - dayStart) / 86400000);
  const latRad = THREE.MathUtils.clamp(latitude, -66, 66) * DEG_TO_RAD;
  const declination = 23.44 * DEG_TO_RAD * Math.sin(((360 / 365) * (dayOfYear - 81)) * DEG_TO_RAD);
  const hourAngle = Math.acos(THREE.MathUtils.clamp(-Math.tan(latRad) * Math.tan(declination), -1, 1));
  const daylightHours = (2 * hourAngle * 24) / (2 * Math.PI);

  return {
    sunrise: 12 - daylightHours / 2,
    sunset: 12 + daylightHours / 2,
    daylightHours,
  };
}

export function getSunVector(hour, latitude = DEFAULT_LATITUDE, target = new THREE.Vector3()) {
  const { sunrise, sunset } = getSolarDay(latitude);
  const dayProgress = THREE.MathUtils.clamp((hour - sunrise) / Math.max(0.1, sunset - sunrise), 0, 1);
  const eastWestAngle = dayProgress * Math.PI;
  const height = Math.sin(eastWestAngle);
  const eastWest = Math.cos(eastWestAngle);

  // World convention: +X east, -X west, -Z north, +Z south. The sun arcs
  // through the south in the northern hemisphere and north in the southern.
  const hemisphereBias = latitude >= 0 ? 0.28 : -0.28;
  return target.set(eastWest, Math.max(-0.2, height), hemisphereBias * height).normalize();
}

export function getSunIntensity(hour, latitude = DEFAULT_LATITUDE) {
  const { sunrise, sunset } = getSolarDay(latitude);
  const twilight = 0.7;

  if (hour < sunrise - twilight || hour > sunset + twilight) return 0;
  if (hour < sunrise) return (hour - (sunrise - twilight)) / twilight;
  if (hour > sunset) return 1 - (hour - sunset) / twilight;
  return 1;
}
