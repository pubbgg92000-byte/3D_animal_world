import { useRef } from 'react';
import { Cloud } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ========================================
   Constants — bright blue sky, midday feel
   ======================================== */
const FOG_COLOR = '#bfe5ff';
const FOG_NEAR  = 90;
const FOG_FAR   = 260;

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
      <color attach="background" args={['#59b9f3']} />
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      {/* Stable blue gradient unaffected by scene tone mapping/exposure. */}
      <mesh scale={230} renderOrder={-10}>
        <sphereGeometry args={[1, 32, 18]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
          vertexShader={`
            varying vec3 vDirection;
            void main() {
              vDirection = normalize(position);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vDirection;
            void main() {
              float height = smoothstep(-0.08, 0.85, vDirection.y);
              vec3 horizon = vec3(0.72, 0.90, 1.0);
              vec3 zenith = vec3(0.16, 0.56, 0.94);
              vec3 color = mix(horizon, zenith, height);
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>

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
