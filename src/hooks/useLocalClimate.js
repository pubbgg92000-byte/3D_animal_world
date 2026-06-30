import { useCallback, useEffect, useMemo, useState } from 'react';

const WEATHER_CODES = {
  0: { icon: '☀️', label: 'Clear' },
  1: { icon: '🌤️', label: 'Mostly Clear' },
  2: { icon: '⛅', label: 'Partly Cloudy' },
  3: { icon: '☁️', label: 'Cloudy' },
  45: { icon: '🌫️', label: 'Fog' },
  48: { icon: '🌫️', label: 'Fog' },
  51: { icon: '🌦️', label: 'Drizzle' },
  53: { icon: '🌦️', label: 'Drizzle' },
  55: { icon: '🌦️', label: 'Drizzle' },
  61: { icon: '🌧️', label: 'Rain' },
  63: { icon: '🌧️', label: 'Rain' },
  65: { icon: '🌧️', label: 'Heavy Rain' },
  71: { icon: '❄️', label: 'Snow' },
  73: { icon: '❄️', label: 'Snow' },
  75: { icon: '❄️', label: 'Heavy Snow' },
  80: { icon: '🌦️', label: 'Showers' },
  81: { icon: '🌦️', label: 'Showers' },
  82: { icon: '⛈️', label: 'Storm Showers' },
  95: { icon: '⛈️', label: 'Thunderstorm' },
};

const TIMEZONE_FALLBACKS = {
  'Asia/Kolkata': { location: 'Hyderabad, Telangana, IN', latitude: 17.385, longitude: 78.4867 },
  'Asia/Calcutta': { location: 'Hyderabad, Telangana, IN', latitude: 17.385, longitude: 78.4867 },
  'America/New_York': { location: 'New York, US', latitude: 40.7128, longitude: -74.006 },
  'America/Chicago': { location: 'Chicago, US', latitude: 41.8781, longitude: -87.6298 },
  'America/Denver': { location: 'Denver, US', latitude: 39.7392, longitude: -104.9903 },
  'America/Los_Angeles': { location: 'Los Angeles, US', latitude: 34.0522, longitude: -118.2437 },
  'Europe/London': { location: 'London, GB', latitude: 51.5072, longitude: -0.1276 },
};

function titleCase(value) {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getTimezoneDetails() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time';
  const city = timeZone.includes('/') ? titleCase(timeZone.split('/').at(-1)) : timeZone;
  const shortName = new Intl.DateTimeFormat(undefined, {
    timeZoneName: 'short',
    hour: 'numeric',
  })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value;

  return {
    timeZone,
    timeZoneLabel: shortName ? `${city} ${shortName}` : city,
    fallbackLocation: city,
  };
}

function formatTimeZoneLabel(timeZone, abbreviation) {
  const city = timeZone?.includes('/') ? titleCase(timeZone.split('/').at(-1)) : timeZone;
  return [city, abbreviation].filter(Boolean).join(' ') || 'Local Time';
}

function getSeason(date, latitude, longitude) {
  const month = date.getMonth();
  const isIndiaRegion =
    latitude != null &&
    longitude != null &&
    latitude >= 6 &&
    latitude <= 36 &&
    longitude >= 68 &&
    longitude <= 98;
  if (isIndiaRegion && month >= 5 && month <= 8) return 'Rainy Season';
  const northern = latitude == null || latitude >= 0;
  const seasons = northern
    ? ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter']
    : ['Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter', 'Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer'];
  return seasons[month];
}

async function fetchClimate(latitude, longitude) {
  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.searchParams.set('latitude', latitude);
  weatherUrl.searchParams.set('longitude', longitude);
  weatherUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,precipitation,rain,showers,weather_code,is_day');
  weatherUrl.searchParams.set('timezone', 'auto');

  const weatherResponse = await fetch(weatherUrl);

  if (!weatherResponse.ok) throw new Error('Weather unavailable');

  const weather = await weatherResponse.json();
  const current = weather.current || {};
  const measuredRain =
    (Number.isFinite(current.rain) ? current.rain : 0) +
    (Number.isFinite(current.showers) ? current.showers : 0) +
    (Number.isFinite(current.precipitation) ? current.precipitation : 0);
  const weatherState = measuredRain > 0
    ? { icon: '🌧️', label: measuredRain >= 2 ? 'Rain' : 'Light Rain' }
    : WEATHER_CODES[current.weather_code] || WEATHER_CODES[0];
  return {
    icon: current.is_day === 0 && current.weather_code === 0 ? '🌙' : weatherState.icon,
    label: weatherState.label,
    temperature: Number.isFinite(current.temperature_2m)
      ? `${Math.round(current.temperature_2m)}°`
      : null,
    humidity: Number.isFinite(current.relative_humidity_2m)
      ? `${Math.round(current.relative_humidity_2m)}%`
      : null,
    precipitation: Number.isFinite(current.precipitation)
      ? `${current.precipitation.toFixed(1)} mm`
      : null,
    rain: Number.isFinite(current.rain) ? current.rain : null,
    showers: Number.isFinite(current.showers) ? current.showers : null,
    coordinatesLabel: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    latitude,
    longitude,
    timeZone: weather.timezone || null,
    timeZoneLabel: formatTimeZoneLabel(weather.timezone, weather.timezone_abbreviation),
    utcOffsetSeconds: weather.utc_offset_seconds,
  };
}

async function fetchClimateForPlace(placeName) {
  const searchUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  searchUrl.searchParams.set('name', placeName);
  searchUrl.searchParams.set('count', '1');
  searchUrl.searchParams.set('language', 'en');
  searchUrl.searchParams.set('format', 'json');

  const response = await fetch(searchUrl);
  if (!response.ok) throw new Error('Location unavailable');

  const data = await response.json();
  const result = data?.results?.[0];
  if (!result) throw new Error('Location unavailable');

  const climate = await fetchClimate(result.latitude, result.longitude);
  return {
    ...climate,
    location: [result.name, result.country_code].filter(Boolean).join(', '),
  };
}

async function fetchTimezoneClimate(timeZone, placeName) {
  const fallback = TIMEZONE_FALLBACKS[timeZone];
  if (fallback) {
    const climate = await fetchClimate(fallback.latitude, fallback.longitude);
    return {
      ...climate,
      location: fallback.location,
    };
  }

  return fetchClimateForPlace(placeName);
}

export default function useLocalClimate() {
  const timezoneDetails = useMemo(() => getTimezoneDetails(), []);
  const [snapshot, setSnapshot] = useState({
    location: timezoneDetails.fallbackLocation,
    timeZone: timezoneDetails.timeZone,
    timeZoneLabel: timezoneDetails.timeZoneLabel,
    season: getSeason(new Date()),
    icon: '🌤️',
    label: 'Local Climate',
    temperature: null,
    humidity: null,
    permission: 'prompt',
  });

  const applyTimezoneClimate = useCallback(async (permission = 'timezone') => {
    try {
      const climate = await fetchTimezoneClimate(
        timezoneDetails.timeZone,
        timezoneDetails.fallbackLocation
      );
      setSnapshot((current) => ({
        ...current,
        ...climate,
        season: getSeason(new Date(), climate.latitude, climate.longitude),
        permission,
      }));
    } catch {
      setSnapshot((current) => ({
        ...current,
        season: getSeason(new Date(), current.latitude, current.longitude),
      }));
    }
  }, [timezoneDetails.fallbackLocation, timezoneDetails.timeZone]);

  const requestPreciseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      applyTimezoneClimate('unavailable');
      return;
    }

    setSnapshot((current) => ({ ...current, permission: 'requesting' }));
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const climate = await fetchClimate(coords.latitude, coords.longitude);
          setSnapshot((current) => ({
            ...current,
            ...climate,
            location: 'Current location',
            season: getSeason(new Date(), climate.latitude, climate.longitude),
            permission: 'granted',
          }));
        } catch {
          applyTimezoneClimate('timezone');
        }
      },
      () => applyTimezoneClimate('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 15 * 60 * 1000 }
    );
  }, [applyTimezoneClimate]);

  useEffect(() => {
    let cancelled = false;

    const applyFallbackSeason = () => {
      if (cancelled) return;
      setSnapshot((current) => ({
        ...current,
          season: getSeason(new Date(), current.latitude, current.longitude),
      }));
    };

    const seasonTimer = setInterval(applyFallbackSeason, 60 * 60 * 1000);

    applyTimezoneClimate('timezone');

    return () => {
      cancelled = true;
      clearInterval(seasonTimer);
    };
  }, [applyTimezoneClimate]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('wild-trails:climate', { detail: snapshot }));
  }, [snapshot]);

  return { ...snapshot, requestPreciseLocation };
}
