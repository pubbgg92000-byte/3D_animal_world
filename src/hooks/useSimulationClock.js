import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useSimulationClock — Simulated day/night cycle clock.
 *
 * 1 real second ≈ 1 simulated minute.
 * Starts at 09:00 AM.
 */
export default function useSimulationClock(speedMultiplier = 1) {
  // Minutes since midnight (start at 09:00 = 540 minutes)
  const [simMinutes, setSimMinutes] = useState(540);
  const lastTick = useRef(performance.now());
  const paused = useRef(false);

  useEffect(() => {
    let animId;
    const tick = (now) => {
      if (!paused.current) {
        const elapsed = (now - lastTick.current) / 1000; // real seconds
        // 1 real second = 1 sim minute × speed
        setSimMinutes((prev) => (prev + elapsed * speedMultiplier) % 1440);
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
