import { useRef } from 'react';
import { Sky as DreiSky, Cloud } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

/* ========================================
   Constants — bright blue sky, midday feel
   ======================================== */
const SUN_POSITION = [100, 80, -50];
const FOG_COLOR = '#a8d4f0';
const FOG_NEAR  = 60;
const FOG_FAR   = 200;

/* ========================================
   Sky Component
   ======================================== */
export default function Sky() {
  const cloudGroupRef  = useRef();
  const cloudGroup2Ref = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (cloudGroupRef.current) {
      cloudGroupRef.current.position.x = Math.sin(t * 0.012) * 6;
      cloudGroupRef.current.position.z = Math.cos(t * 0.009) * 4;
    }
    if (cloudGroup2Ref.current) {
      cloudGroup2Ref.current.position.x = Math.sin(t * 0.008 + 1.2) * 8;
      cloudGroup2Ref.current.position.z = Math.cos(t * 0.010 + 0.7) * 5;
    }
  });

  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      {/* Bright blue sky — high sun, low turbidity */}
      <DreiSky
        distance={450000}
        sunPosition={SUN_POSITION}
        inclination={0.6}
        azimuth={0.18}
        mieCoefficient={0.003}
        mieDirectionalG={0.85}
        rayleigh={0.8}
        turbidity={3}
      />

      {/* First cloud layer — main fluffy whites */}
      <group ref={cloudGroupRef}>
        <Cloud position={[-18, 22, -15]} speed={0.08} opacity={0.90} width={28} depth={4}  segments={28} color="#ffffff" />
        <Cloud position={[ 22, 26, -8 ]} speed={0.06} opacity={0.85} width={22} depth={3}  segments={22} color="#f8f8ff" />
        <Cloud position={[  8, 20, -25]} speed={0.07} opacity={0.88} width={25} depth={3.5} segments={24} color="#ffffff" />
        <Cloud position={[-30, 28, 10 ]} speed={0.05} opacity={0.80} width={32} depth={4}  segments={30} color="#f5f5ff" />
        <Cloud position={[ 35, 24, 20 ]} speed={0.09} opacity={0.82} width={20} depth={3}  segments={20} color="#ffffff" />
        <Cloud position={[-10, 30, 30 ]} speed={0.06} opacity={0.78} width={26} depth={3.5} segments={26} color="#eef5ff" />
        <Cloud position={[ 15, 18, 40 ]} speed={0.08} opacity={0.85} width={18} depth={2.5} segments={18} color="#ffffff" />
        <Cloud position={[-40, 25, -5 ]} speed={0.05} opacity={0.75} width={30} depth={4}  segments={28} color="#f0f0ff" />
      </group>

      {/* Second cloud layer — higher, lighter */}
      <group ref={cloudGroup2Ref}>
        <Cloud position={[  5, 36, -12]} speed={0.04} opacity={0.55} width={35} depth={5}  segments={20} color="#ffffff" />
        <Cloud position={[-25, 38,  18]} speed={0.03} opacity={0.50} width={40} depth={5}  segments={22} color="#f8faff" />
        <Cloud position={[ 40, 34,  -2]} speed={0.05} opacity={0.60} width={30} depth={4}  segments={20} color="#ffffff" />
        <Cloud position={[-12, 40, -35]} speed={0.04} opacity={0.48} width={38} depth={5}  segments={24} color="#eef2ff" />
        <Cloud position={[ 28, 35,  35]} speed={0.03} opacity={0.52} width={36} depth={4.5} segments={22} color="#ffffff" />
      </group>
    </>
  );
}
