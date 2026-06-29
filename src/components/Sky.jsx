import { useRef } from 'react';
import { Sky as DreiSky, Cloud } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

/* ========================================
   Constants
   ======================================== */

/** Sun position — low angle for golden hour feel */
const SUN_POSITION = [50, 15, -30];

/** Fog parameters */
const FOG_COLOR = '#c9dbb2';
const FOG_NEAR = 30;
const FOG_FAR = 90;

/* ========================================
   Sky Component
   ======================================== */

/**
 * Sky — HDRI-like sky with sun, clouds, and atmospheric fog.
 * Creates an early-morning golden-hour feel.
 */
export default function Sky() {
  const cloudGroupRef = useRef();

  // Slowly drift clouds
  useFrame(({ clock }) => {
    if (!cloudGroupRef.current) return;
    cloudGroupRef.current.position.x = Math.sin(clock.getElapsedTime() * 0.02) * 5;
    cloudGroupRef.current.position.z = Math.cos(clock.getElapsedTime() * 0.015) * 3;
  });

  return (
    <>
      {/* Atmospheric fog */}
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      {/* Procedural sky dome */}
      <DreiSky
        distance={450000}
        sunPosition={SUN_POSITION}
        inclination={0.52}
        azimuth={0.25}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
        rayleigh={1.5}
        turbidity={8}
      />

      {/* Cloud layer */}
      <group ref={cloudGroupRef}>
        <Cloud
          position={[-15, 18, -10]}
          speed={0.15}
          opacity={0.4}
          width={20}
          depth={3}
          segments={20}
          color="#f5e6d3"
        />
        <Cloud
          position={[20, 22, 5]}
          speed={0.1}
          opacity={0.35}
          width={15}
          depth={2}
          segments={15}
          color="#f5e6d3"
        />
        <Cloud
          position={[5, 20, -20]}
          speed={0.12}
          opacity={0.3}
          width={18}
          depth={2.5}
          segments={18}
          color="#fcebd4"
        />
        <Cloud
          position={[-25, 25, 15]}
          speed={0.08}
          opacity={0.25}
          width={22}
          depth={3}
          segments={16}
          color="#f0dcc8"
        />
      </group>
    </>
  );
}
