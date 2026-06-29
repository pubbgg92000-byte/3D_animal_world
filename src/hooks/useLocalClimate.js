import { useEffect, useMemo, useState } from 'react';

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
  'Asia/Kolkata': { location: 'Kolkata, IN', latitude: 22.5726, longitude: 88.3639 },
  'Asia/Calcutta': { location: 'Kolkata, IN', latitude: 22.5726, longitude: 88.3639 },
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

function getSeason(date, latitude) {
  const month = date.getMonth();
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
  weatherUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code,is_day');
  weatherUrl.searchParams.set('timezone', 'auto');

  const placeUrl = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
  placeUrl.searchParams.set('latitude', latitude);
  placeUrl.searchParams.set('longitude', longitude);
  placeUrl.searchParams.set('count', '1');
  placeUrl.searchParams.set('language', 'en');
  placeUrl.searchParams.set('format', 'json');

  const [weatherResponse, placeResponse] = await Promise.all([
    fetch(weatherUrl),
    fetch(placeUrl),
  ]);

  if (!weatherResponse.ok) throw new Error('Weather unavailable');

  const weather = await weatherResponse.json();
  const place = placeResponse.ok ? await placeResponse.json() : null;
  const current = weather.current || {};
  const weatherState = WEATHER_CODES[current.weather_code] || WEATHER_CODES[0];
  const placeResult = place?.results?.[0];
  const location = [placeResult?.name, placeResult?.admin1, placeResult?.country_code]
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

  return {
    icon: current.is_day === 0 && current.weather_code === 0 ? '🌙' : weatherState.icon,
    label: weatherState.label,
    temperature: Number.isFinite(current.temperature_2m)
      ? `${Math.round(current.temperature_2m)}°`
      : null,
    humidity: Number.isFinite(current.relative_humidity_2m)
      ? `${Math.round(current.relative_humidity_2m)}%`
      : null,
    location: location || null,
    latitude,
    longitude,
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

  useEffect(() => {
    let cancelled = false;

    const applyFallbackSeason = () => {
      if (cancelled) return;
      setSnapshot((current) => ({
        ...current,
        season: getSeason(new Date(), current.latitude),
      }));
    };

    const seasonTimer = setInterval(applyFallbackSeason, 60 * 60 * 1000);

    const applyTimezoneClimate = async (permission = 'timezone') => {
      try {
        const climate = await fetchTimezoneClimate(
          timezoneDetails.timeZone,
          timezoneDetails.fallbackLocation
        );
        if (cancelled) return;
        setSnapshot((current) => ({
          ...current,
          ...climate,
          season: getSeason(new Date(), climate.latitude),
          permission,
        }));
      } catch {
        applyFallbackSeason();
      }
    };

    if (!navigator.geolocation) {
      applyTimezoneClimate('timezone');
      return () => {
        cancelled = true;
        clearInterval(seasonTimer);
      };
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const climate = await fetchClimate(coords.latitude, coords.longitude);
          if (cancelled) return;
          setSnapshot((current) => ({
            ...current,
            ...climate,
            season: getSeason(new Date(), coords.latitude),
            permission: 'granted',
          }));
        } catch {
          if (cancelled) return;
          setSnapshot((current) => ({
            ...current,
            season: getSeason(new Date(), coords.latitude),
            permission: 'unavailable',
          }));
        }
      },
      () => {
        if (cancelled) return;
        setSnapshot((current) => ({
          ...current,
          permission: 'denied',
          season: getSeason(new Date()),
        }));
        applyTimezoneClimate('timezone');
      },
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1000,
        timeout: 6000,
      }
    );

    return () => {
      cancelled = true;
      clearInterval(seasonTimer);
    };
  }, [timezoneDetails.fallbackLocation, timezoneDetails.timeZone]);

  return snapshot;
}
