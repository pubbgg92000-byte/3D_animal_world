import { useRef, useMemo, useEffect, useState } from 'react';
import { Cloud } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ========================================
   Sky — Procedural time-of-day atmosphere
   ========================================

   Reads simMinutesRef (0–1440, minutes since midnight) per frame.
   Smoothly interpolates between 7 time-of-day presets:
     Dawn → Morning → Midday → Afternoon → Evening → Dusk → Night

   Sun position, sky gradient, fog, and cloud tinting all respond to time.
   ======================================== */

// ── Time-of-day presets (hour → colors) ──
// Each preset: { hour, zenith: [r,g,b], horizon: [r,g,b], fog: [r,g,b], cloudTint: '#hex' }
const PRESETS = [
  { hour: 0,   zenith: [0.02, 0.02, 0.06], horizon: [0.05, 0.06, 0.12], fog: [0.04, 0.05, 0.10], cloudTint: '#1a1a2e' },
  { hour: 5,   zenith: [0.04, 0.04, 0.10], horizon: [0.08, 0.08, 0.16], fog: [0.06, 0.06, 0.14], cloudTint: '#252540' },
  { hour: 6,   zenith: [0.18, 0.18, 0.38], horizon: [0.92, 0.55, 0.32], fog: [0.82, 0.58, 0.42], cloudTint: '#ff9966' },
  { hour: 7,   zenith: [0.22, 0.42, 0.72], horizon: [0.88, 0.72, 0.52], fog: [0.80, 0.72, 0.58], cloudTint: '#ffc080' },
  { hour: 9,   zenith: [0.16, 0.56, 0.94], horizon: [0.72, 0.90, 1.00], fog: [0.75, 0.90, 1.00], cloudTint: '#ffffff' },
  { hour: 12,  zenith: [0.14, 0.52, 0.92], horizon: [0.68, 0.88, 1.00], fog: [0.75, 0.90, 1.00], cloudTint: '#ffffff' },
  { hour: 15,  zenith: [0.16, 0.54, 0.90], horizon: [0.70, 0.88, 0.98], fog: [0.74, 0.88, 0.98], cloudTint: '#fff8f0' },
  { hour: 17,  zenith: [0.22, 0.38, 0.68], horizon: [0.95, 0.65, 0.35], fog: [0.85, 0.65, 0.42], cloudTint: '#ffaa66' },
  { hour: 18.5,zenith: [0.12, 0.14, 0.35], horizon: [0.72, 0.28, 0.22], fog: [0.55, 0.28, 0.25], cloudTint: '#cc5533' },
  { hour: 20,  zenith: [0.04, 0.04, 0.12], horizon: [0.10, 0.08, 0.18], fog: [0.08, 0.08, 0.14], cloudTint: '#222244' },
  { hour: 24,  zenith: [0.02, 0.02, 0.06], horizon: [0.05, 0.06, 0.12], fog: [0.04, 0.05, 0.10], cloudTint: '#1a1a2e' },
];

function lerpArray(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

function getPresetAt(hour) {
  // Wrap hour to 0-24
  const h = ((hour % 24) + 24) % 24;
  let lo = PRESETS[0], hi = PRESETS[1];
  for (let i = 0; i < PRESETS.length - 1; i++) {
    if (h >= PRESETS[i].hour && h < PRESETS[i + 1].hour) {
      lo = PRESETS[i];
      hi = PRESETS[i + 1];
      break;
    }
  }
  const t = (h - lo.hour) / (hi.hour - lo.hour || 1);
  const smoothT = t * t * (3 - 2 * t); // smoothstep
  return {
    zenith: lerpArray(lo.zenith, hi.zenith, smoothT),
    horizon: lerpArray(lo.horizon, hi.horizon, smoothT),
    fog: lerpArray(lo.fog, hi.fog, smoothT),
    cloudTint: lo.cloudTint, // snap — clouds lerp separately
  };
}

// Shader uniforms
const SKY_VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform float uSunIntensity;
  varying vec3 vDirection;

  void main() {
    float height = smoothstep(-0.08, 0.85, vDirection.y);
    vec3 color = mix(uHorizon, uZenith, height);

    // Sun glow
    float sunDot = max(0.0, dot(normalize(vDirection), uSunDir));
    float sunGlow = pow(sunDot, 64.0) * uSunIntensity * 1.2;
    float sunHaze = pow(sunDot, 8.0) * uSunIntensity * 0.15;
    color += vec3(1.0, 0.9, 0.7) * sunGlow;
    color += vec3(1.0, 0.85, 0.6) * sunHaze;

    // Stars at night (when zenith is very dark)
    float darkness = 1.0 - smoothstep(0.0, 0.08, length(uZenith));
    if (darkness > 0.1 && vDirection.y > 0.1) {
      // Procedural star field
      vec3 p = normalize(vDirection) * 500.0;
      float n = fract(sin(dot(floor(p.xz * 0.5), vec2(127.1, 311.7))) * 43758.5453);
      float star = step(0.992, n) * darkness * smoothstep(0.1, 0.4, vDirection.y);
      float twinkle = 0.5 + 0.5 * sin(n * 6.28 + uSunIntensity * 10.0);
      color += vec3(0.8, 0.85, 1.0) * star * twinkle;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const _sunDir = new THREE.Vector3();
const _fogColor = new THREE.Color();

function getCloudMood(label = '') {
  const value = label.toLowerCase();
  if (value.includes('storm') || value.includes('thunder')) {
    return { color: '#667085', opacity: 0.92, speed: 1.9, scale: [1.18, 0.78, 1.26] };
  }
  if (value.includes('rain') || value.includes('showers') || value.includes('drizzle')) {
    return { color: '#9aa6b8', opacity: 0.86, speed: 1.55, scale: [1.1, 0.76, 1.18] };
  }
  if (value.includes('cloud') || value.includes('fog')) {
    return { color: '#d8dee8', opacity: 0.78, speed: 0.95, scale: [1.04, 0.86, 1.08] };
  }
  return { color: '#ffffff', opacity: 0.56, speed: 0.62, scale: [0.9, 0.76, 0.95] };
}

export default function Sky({ simMinutesRef }) {
  const shaderRef = useRef();
  const fogRef = useRef();
  const cloudGroupRef = useRef();
  const cloudGroup2Ref = useRef();
  const [climate, setClimate] = useState({ label: 'Clear' });
  const cloudMood = getCloudMood(climate.label);

  useEffect(() => {
    const handler = (event) => setClimate(event.detail || { label: 'Clear' });
    window.addEventListener('wild-trails:climate', handler);
    return () => window.removeEventListener('wild-trails:climate', handler);
  }, []);

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Vector3(0.16, 0.56, 0.94) },
      uHorizon: { value: new THREE.Vector3(0.72, 0.90, 1.00) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.7, -0.5).normalize() },
      uSunIntensity: { value: 1.0 },
    }),
    []
  );

  useFrame(({ scene, clock }) => {
    const t = clock.getElapsedTime();
    const m = simMinutesRef?.current ?? 540;
    const hour = m / 60;

    // Get interpolated preset
    const preset = getPresetAt(hour);

    // Update sky shader
    if (shaderRef.current) {
      const u = shaderRef.current.uniforms;
      u.uZenith.value.set(...preset.zenith);
      u.uHorizon.value.set(...preset.horizon);

      // Sun direction from hour
      const sunAngle = ((hour - 6) / 12) * Math.PI;
      const sunHeight = Math.sin(sunAngle);
      const sunX = Math.cos(sunAngle);
      _sunDir.set(sunX, Math.max(-0.2, sunHeight), -0.3).normalize();
      u.uSunDir.value.copy(_sunDir);

      // Sun intensity (0 at night, 1 midday)
      const isDay = hour >= 5.5 && hour <= 20.5;
      let intensity = 0;
      if (hour >= 5.5 && hour < 7) intensity = (hour - 5.5) / 1.5;
      else if (hour >= 7 && hour <= 18) intensity = 1;
      else if (hour > 18 && hour <= 20.5) intensity = 1 - (hour - 18) / 2.5;
      u.uSunIntensity.value = intensity;
    }

    // Update fog
    if (scene.fog) {
      _fogColor.setRGB(...preset.fog);
      scene.fog.color.lerp(_fogColor, 0.05);
      // Fog distance: closer at dawn/dusk for atmosphere
      const isTransition = (hour >= 5.5 && hour < 8) || (hour >= 17 && hour < 20.5);
      scene.fog.near = isTransition ? 60 : 90;
      scene.fog.far = isTransition ? 180 : 260;
    }

    // Update background color
    const bgColor = lerpArray(preset.horizon, preset.zenith, 0.3);
    scene.background?.setRGB?.(...bgColor);

    // Cloud drift
    if (cloudGroupRef.current) {
      cloudGroupRef.current.position.x = Math.sin(t * 0.012 * cloudMood.speed) * 8;
      cloudGroupRef.current.position.z = Math.cos(t * 0.009 * cloudMood.speed) * 5;
      cloudGroupRef.current.rotation.y = Math.sin(t * 0.018 * cloudMood.speed) * 0.04;
    }
    if (cloudGroup2Ref.current) {
      cloudGroup2Ref.current.position.x = Math.sin(t * 0.008 * cloudMood.speed + 1.2) * 10;
      cloudGroup2Ref.current.position.z = Math.cos(t * 0.010 * cloudMood.speed + 0.7) * 6;
      cloudGroup2Ref.current.rotation.y = Math.cos(t * 0.014 * cloudMood.speed) * 0.035;
    }
  });

  return (
    <>
      <color attach="background" args={['#59b9f3']} />
      <fog ref={fogRef} attach="fog" args={['#bfe5ff', 90, 260]} />

      {/* Procedural sky dome */}
      <mesh scale={230} renderOrder={-10}>
        <sphereGeometry args={[1, 32, 18]} />
        <shaderMaterial
          ref={shaderRef}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
          vertexShader={SKY_VERTEX}
          fragmentShader={SKY_FRAGMENT}
          uniforms={uniforms}
        />
      </mesh>

      {/* First cloud layer — main fluffy whites */}
      <group ref={cloudGroupRef} scale={cloudMood.scale}>
        <Cloud position={[-18, 22, -15]} speed={0.05 * cloudMood.speed} opacity={cloudMood.opacity} width={30} depth={5.4} segments={34} color={cloudMood.color} />
        <Cloud position={[ 22, 26, -8 ]} speed={0.04 * cloudMood.speed} opacity={cloudMood.opacity * 0.94} width={24} depth={4.4} segments={28} color={cloudMood.color} />
        <Cloud position={[  8, 20, -25]} speed={0.045 * cloudMood.speed} opacity={cloudMood.opacity * 0.96} width={27} depth={4.8} segments={30} color={cloudMood.color} />
        <Cloud position={[-30, 28, 10 ]} speed={0.035 * cloudMood.speed} opacity={cloudMood.opacity * 0.9} width={34} depth={5.6} segments={34} color={cloudMood.color} />
        <Cloud position={[ 35, 24, 20 ]} speed={0.055 * cloudMood.speed} opacity={cloudMood.opacity * 0.88} width={22} depth={4.2} segments={24} color={cloudMood.color} />
        <Cloud position={[-10, 30, 30 ]} speed={0.04 * cloudMood.speed} opacity={cloudMood.opacity * 0.86} width={28} depth={4.8} segments={30} color={cloudMood.color} />
        <Cloud position={[ 15, 18, 40 ]} speed={0.05 * cloudMood.speed} opacity={cloudMood.opacity * 0.9} width={20} depth={3.8} segments={22} color={cloudMood.color} />
        <Cloud position={[-40, 25, -5 ]} speed={0.035 * cloudMood.speed} opacity={cloudMood.opacity * 0.84} width={32} depth={5.2} segments={32} color={cloudMood.color} />
      </group>

      {/* Second cloud layer — higher, lighter */}
      <group ref={cloudGroup2Ref} scale={cloudMood.scale}>
        <Cloud position={[  5, 36, -12]} speed={0.028 * cloudMood.speed} opacity={cloudMood.opacity * 0.62} width={38} depth={6.0} segments={24} color={cloudMood.color} />
        <Cloud position={[-25, 38,  18]} speed={0.023 * cloudMood.speed} opacity={cloudMood.opacity * 0.56} width={44} depth={6.2} segments={26} color={cloudMood.color} />
        <Cloud position={[ 40, 34,  -2]} speed={0.032 * cloudMood.speed} opacity={cloudMood.opacity * 0.66} width={34} depth={5.2} segments={24} color={cloudMood.color} />
        <Cloud position={[-12, 40, -35]} speed={0.026 * cloudMood.speed} opacity={cloudMood.opacity * 0.54} width={42} depth={6.0} segments={28} color={cloudMood.color} />
        <Cloud position={[ 28, 35,  35]} speed={0.022 * cloudMood.speed} opacity={cloudMood.opacity * 0.58} width={40} depth={5.6} segments={26} color={cloudMood.color} />
      </group>
    </>
  );
}
