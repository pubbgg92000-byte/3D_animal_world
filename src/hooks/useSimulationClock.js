import { useState, useRef, useEffect } from 'react';

/**
 * useSimulationClock — Local day/night cycle clock.
 *
 * Starts from the visitor's real local time so the sky/theme matches the day.
 */
export default function useSimulationClock(speedMultiplier = 1) {
  const getLocalMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  };

  const [simMinutes, setSimMinutes] = useState(getLocalMinutes);
  const liveMinutes = useRef(getLocalMinutes());
  const lastTick = useRef(performance.now());
  const lastUiUpdate = useRef(0);
  const paused = useRef(false);

  useEffect(() => {
    let animId;
    const tick = (now) => {
      if (!paused.current) {
        const elapsed = (now - lastTick.current) / 1000; // real seconds
        liveMinutes.current = (liveMinutes.current + (elapsed / 60) * speedMultiplier) % 1440;

        // Updating React state every animation frame forces the HUD/App tree to
        // re-render constantly. Keep the simulated clock smooth internally, but
        // refresh the visible UI once per second.
        if (now - lastUiUpdate.current > 1000) {
          lastUiUpdate.current = now;
          setSimMinutes(liveMinutes.current);
        }
      }
      lastTick.current = now;
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [speedMultiplier]);

  const hours = Math.floor(simMinutes / 60);
  const minutes = Math.floor(simMinutes % 60);
  const isPM = hours >= 12;
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  // Determine time of day
  let timeOfDay = 'Night';
  if (hours >= 6 && hours < 10) timeOfDay = 'Morning';
  else if (hours >= 10 && hours < 14) timeOfDay = 'Midday';
  else if (hours >= 14 && hours < 17) timeOfDay = 'Afternoon';
  else if (hours >= 17 && hours < 20) timeOfDay = 'Evening';

  return {
    simMinutes,
    hours,
    minutes,
    formatted: `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`,
    timeOfDay,
    pause: () => { paused.current = true; },
    resume: () => { paused.current = false; },
    isPaused: paused.current,
  };
}
