import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ================================================================
   POND — sunken rocky bowl with clear water
   Reference: natural garden pond with large rim rocks, pebble bed,
   lily pads, reeds and crystal-clear water you can see through.
   ================================================================ */

export const POND_POSITION = new THREE.Vector3(0, 0, 5);  // world centre of pond
export const POND_RADIUS   = 5.5;
// The terrain is depressed to -1.6 at the pond centre.
// Water surface sits at -0.35 (visible above the bowl floor, below terrain rim).
const WATER_Y  = -0.35;
const BED_Y    = -1.45;  // pond floor — close to terrain depression depth

/* ================================================================
   Seeded RNG
   ================================================================ */
function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/* ================================================================
   Water surface shader — clear, animated, Fresnel + sparkle
   ================================================================ */
const WATER_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float w = sin(pos.x * 3.1 + uTime * 1.4) * 0.012
            + sin(pos.z * 2.7 + uTime * 1.1) * 0.010
            + sin((pos.x - pos.z) * 2.0 + uTime * 1.8) * 0.008;
    pos.z += w;
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WATER_FRAG = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform vec3  uCam;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main(){
    // perturbed normal for Fresnel
    vec2 n1uv = vUv*7.0 + vec2(uTime*0.05, uTime*0.03);
    vec2 n2uv = vUv*5.0 + vec2(-uTime*0.03, uTime*0.06);
    float nx = noise(n1uv)*2.0-1.0;
    float nz = noise(n2uv)*2.0-1.0;
    vec3 N = normalize(vec3(nx*0.15, 1.0, nz*0.12));

    vec3 V = normalize(uCam - vWorldPos);
    float fresnel = pow(1.0 - max(dot(V, N), 0.0), 2.5);

    // colour: transparent teal centre → blue-sky edges
    float d = length(vUv - 0.5) * 2.0;
    vec3 deepCol    = vec3(0.04, 0.22, 0.50);
    vec3 shallowCol = vec3(0.20, 0.62, 0.82);
    vec3 skyCol     = vec3(0.55, 0.78, 1.00);
    vec3 col = mix(deepCol, shallowCol, d);
    col = mix(col, skyCol, fresnel * 0.60);

    // sun specular
    vec3 sun = normalize(vec3(0.5, 1.0, -0.3));
    vec3 H   = normalize(sun + V);
    float sp = pow(max(dot(N, H), 0.0), 220.0) * 2.0;
    col += vec3(1.0, 0.97, 0.88) * sp;

    // sparkle
    float sk = noise(vUv*50.0 + uTime*1.0);
    sk = pow(sk, 16.0) * 2.0;
    col += vec3(0.85, 0.95, 1.0) * sk;

    float alpha = mix(0.50, 0.82, fresnel + d * 0.3);
    gl_FragColor = vec4(col, clamp(alpha, 0.45, 0.88));
  }
`;

/* ================================================================
   Water surface mesh
   ================================================================ */
function WaterSurface({ radius }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCam:  { value: new THREE.Vector3() },
    },
    transparent: true,
    depthWrite:  false,
    side: THREE.DoubleSide,
  }), []);

  useFrame(({ clock, camera }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uCam.value.copy(camera.position);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, 0]} renderOrder={2}>
      <circleGeometry args={[radius, 80]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/* ================================================================
   Sunken bowl — the key piece that gives depth
   A cylinder open at the top, walls slanting inward toward the bed.
   We build it from two concentric rings + a floor disc.
   ================================================================ */
function PondBowl({ radius }) {
  // Wall: tapers from water-level radius down to narrower floor
  const depth = Math.abs(BED_Y - WATER_Y);
  const wallGeo = useMemo(() => new THREE.CylinderGeometry(
    radius * 0.92,   // top — slightly inside the terrain rim
    radius * 0.60,   // bottom — narrower floor
    depth,
    48, 2, true      // open top + bottom
  ), [radius, depth]);

  const floorGeo = useMemo(() => new THREE.CircleGeometry(radius * 0.61, 48), [radius]);

  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#4a5e50',
    roughness: 0.95,
    side: THREE.BackSide,   // visible from inside
  }), []);

  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#6a8070',
    roughness: 0.95,
  }), []);

  const wallY = (WATER_Y + BED_Y) / 2;

  return (
    <group>
      <mesh geometry={wallGeo} material={wallMat} position={[0, wallY, 0]} receiveShadow />
      <mesh geometry={floorGeo} material={floorMat}
            rotation={[-Math.PI / 2, 0, 0]} position={[0, BED_Y + 0.02, 0]} receiveShadow />
    </group>
  );
}

/* ================================================================
   Pebble bed on the floor — seen through clear water
   ================================================================ */
function PebbleBed({ radius }) {
  const rng = useMemo(() => seededRng(7), []);

  const pebbles = useMemo(() => {
    const arr = [];
    const floorR = radius * 0.62;
    for (let i = 0; i < 160; i++) {
      const r = rng() * floorR;
      const a = rng() * Math.PI * 2;
      const sz = 0.06 + rng() * 0.18;
      arr.push({
        key: i,
        px: Math.cos(a) * r,
        pz: Math.sin(a) * r,
        sx: sz * (0.7 + rng() * 0.6),
        sy: sz * 0.3,
        sz: sz * (0.7 + rng() * 0.6),
        rotY: rng() * Math.PI,
        ci: Math.floor(rng() * 5),
      });
    }
    return arr;
  }, [radius, rng]);

  const BED_COLORS = ['#6e7e78','#586870','#7a8a7e','#5c6c64','#8a9890'];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, BED_Y + 0.01, 0]} receiveShadow>
        <circleGeometry args={[radius * 0.64, 48]} />
        <meshStandardMaterial color="#9ab4b8" roughness={0.97} />
      </mesh>
      {pebbles.map((p) => (
        <mesh key={p.key}
              position={[p.px, BED_Y + p.sy * 0.5 + 0.02, p.pz]}
              rotation={[0.1, p.rotY, 0.05]}
              scale={[p.sx, p.sy, p.sz]}
              receiveShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color={BED_COLORS[p.ci]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================
   Larger submerged stones on the bed
   ================================================================ */
function SubmergedRocks({ radius }) {
  const rng = useMemo(() => seededRng(42), []);
  const stones = useMemo(() => {
    const arr = [];
    const floorR = radius * 0.58;
    for (let i = 0; i < 22; i++) {
      const r = rng() * floorR;
      const a = rng() * Math.PI * 2;
      arr.push({
        key: i,
        px: Math.cos(a) * r, pz: Math.sin(a) * r,
        sx: 0.18 + rng() * 0.5, sy: 0.1 + rng() * 0.28, sz: 0.18 + rng() * 0.45,
        rotY: rng() * Math.PI,
      });
    }
    return arr;
  }, [radius, rng]);

  return (
    <group>
      {stones.map((s) => (
        <mesh key={s.key}
              position={[s.px, BED_Y + s.sy * 0.5 + 0.04, s.pz]}
              rotation={[0.1, s.rotY, 0.07]}
              scale={[s.sx, s.sy, s.sz]}
              receiveShadow>
          <dodecahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color="#4e5e58" roughness={0.92} metalness={0.04} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================
   Large chunky rim rocks — like the reference image
   Placed just outside / on the lip of the pond, varying sizes,
   some overlapping slightly into the water.
   ================================================================ */
const RIM_ROCKS = [
  // [angleFrac 0-1,  rFactor,  sx,   sy,   sz,  tiltX, rotY]
  [0.00, 1.01, 1.8, 1.2, 1.5, 0.15, 0.3],
  [0.06, 0.97, 1.3, 0.9, 1.2, 0.10, 1.8],
  [0.11, 1.04, 2.0, 1.4, 1.7, 0.18, 0.7],
  [0.17, 0.99, 1.1, 0.8, 1.0, 0.08, 2.2],
  [0.22, 1.06, 1.6, 1.1, 1.4, 0.14, 1.1],
  [0.28, 0.96, 1.0, 0.7, 0.9, 0.07, 0.5],
  [0.33, 1.03, 1.9, 1.3, 1.6, 0.16, 1.6],
  [0.39, 0.98, 1.2, 0.85, 1.1, 0.09, 2.8],
  [0.44, 1.07, 2.2, 1.5, 1.9, 0.20, 0.2],
  [0.50, 1.00, 1.4, 1.0, 1.3, 0.12, 1.4],
  [0.56, 0.95, 1.0, 0.72, 0.95, 0.08, 0.9],
  [0.61, 1.05, 1.7, 1.15, 1.5, 0.15, 2.0],
  [0.67, 0.98, 1.3, 0.88, 1.2, 0.10, 0.4],
  [0.72, 1.03, 1.5, 1.05, 1.35, 0.13, 1.7],
  [0.78, 0.97, 1.1, 0.78, 1.0, 0.09, 2.5],
  [0.83, 1.06, 2.1, 1.4, 1.8, 0.17, 0.8],
  [0.89, 0.99, 1.2, 0.82, 1.1, 0.11, 1.3],
  [0.94, 1.04, 1.6, 1.1, 1.4, 0.14, 0.6],
  // second outer row — slightly bigger, further out
  [0.03, 1.30, 1.5, 1.0, 1.3, 0.10, 1.0],
  [0.14, 1.28, 1.8, 1.2, 1.6, 0.12, 2.1],
  [0.26, 1.32, 1.3, 0.9, 1.2, 0.08, 0.3],
  [0.38, 1.29, 2.0, 1.4, 1.7, 0.15, 1.5],
  [0.51, 1.31, 1.4, 0.95, 1.3, 0.11, 2.6],
  [0.63, 1.27, 1.7, 1.15, 1.5, 0.13, 0.7],
  [0.76, 1.33, 1.2, 0.82, 1.1, 0.09, 1.9],
  [0.88, 1.30, 1.9, 1.3, 1.6, 0.14, 0.4],
];

function RimRocks({ radius }) {
  const ROCK_COLORS = [
    '#8c8a7e', '#727068', '#a09c8e', '#b4b0a0', '#686460',
  ];

  return (
    <group>
      {RIM_ROCKS.map(([frac, rf, sx, sy, sz, tiltX, rotY], i) => {
        const angle = frac * Math.PI * 2;
        const r = radius * rf;
        const px = Math.cos(angle) * r;
        const pz = Math.sin(angle) * r;
        const py = sy * 0.35 - 0.15;
        const tiltSign = i % 2 === 0 ? 1 : -1;
        const col = ROCK_COLORS[i % ROCK_COLORS.length];
        return (
          <mesh key={i}
                position={[px, py, pz]}
                rotation={[tiltX * tiltSign, rotY, tiltX * 0.5]}
                scale={[sx, sy, sz]}
                castShadow receiveShadow>
            <dodecahedronGeometry args={[0.85, 0]} />
            <meshStandardMaterial color={col} roughness={0.93} metalness={0.02} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ================================================================
   Gravel / pebble surround — the gravelly ground around the pond
   ================================================================ */
function GravelSurround({ radius }) {
  const rng = useMemo(() => seededRng(88), []);
  const pebbles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 200; i++) {
      const r = radius * 1.05 + rng() * radius * 0.8;
      const a = rng() * Math.PI * 2;
      const sz = 0.04 + rng() * 0.12;
      arr.push({
        key: i,
        px: Math.cos(a) * r, pz: Math.sin(a) * r,
        sx: sz * (0.8 + rng() * 0.4), sy: sz * 0.25, sz: sz * (0.8 + rng() * 0.4),
        rotY: rng() * Math.PI, ci: Math.floor(rng() * 4),
      });
    }
    return arr;
  }, [radius, rng]);

  const GRAVEL_COLORS = ['#c8b890','#b8a880','#d4c8a0','#a89870'];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <ringGeometry args={[radius * 0.98, radius * 2.2, 56]} />
        <meshStandardMaterial color="#c0ae88" roughness={0.97} />
      </mesh>
      {pebbles.map((p) => (
        <mesh key={p.key}
              position={[p.px, p.sy * 0.3, p.pz]}
              rotation={[0.05, p.rotY, 0.03]}
              scale={[p.sx, p.sy, p.sz]}
              receiveShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color={GRAVEL_COLORS[p.ci]} roughness={0.97} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================
   Lily pads — floating on water surface
   ================================================================ */
function LilyPads({ radius }) {
  const rng = useMemo(() => seededRng(23), []);
  const pads = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 9; i++) {
      const r = radius * (0.10 + rng() * 0.68);
      const a = rng() * Math.PI * 2;
      arr.push({
        key: i, px: Math.cos(a) * r, pz: Math.sin(a) * r,
        scale: 0.20 + rng() * 0.30,
        rot: rng() * Math.PI * 2,
        notch: rng() * 0.55,
        hasFlower: rng() > 0.65,
      });
    }
    return arr;
  }, [radius, rng]);

  const padMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1e5e20', roughness: 0.7, side: THREE.DoubleSide }), []);
  const fMat    = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f0dded', roughness: 0.6 }), []);
  const fcMat   = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f5c842', roughness: 0.5 }), []);

  return (
    <group>
      {pads.map((p) => (
        <group key={p.key} position={[p.px, WATER_Y + 0.03, p.pz]}>
          <mesh rotation={[-Math.PI / 2, 0, p.rot]} scale={p.scale}>
            <circleGeometry args={[1, 20, p.notch, Math.PI * 2 - p.notch * 1.3]} />
            <primitive object={padMat} />
          </mesh>
          {p.hasFlower && (
            <group position={[0, 0.06, 0]} scale={p.scale * 0.38}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.85, 8]} />
                <primitive object={fMat} />
              </mesh>
              <mesh position={[0, 0.06, 0]}>
                <sphereGeometry args={[0.24, 6, 6]} />
                <primitive object={fcMat} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

/* ================================================================
   Reeds & cattails — around the rim, between rocks
   ================================================================ */
function Reeds({ radius }) {
  const rng = useMemo(() => seededRng(31), []);
  const stalks = useMemo(() => {
    const arr = [];
    for (let c = 0; c < 12; c++) {
      const baseA = (c / 12) * Math.PI * 2 + c * 0.4;
      const clR   = radius * 1.1 + rng() * 0.5;
      const count = 2 + Math.floor(rng() * 5);
      for (let j = 0; j < count; j++) {
        const a = baseA + (j - count / 2) * 0.18 + rng() * 0.08;
        const r = clR + (rng() - 0.5) * 0.4;
        arr.push({
          key: `${c}-${j}`,
          px: Math.cos(a) * r, pz: Math.sin(a) * r,
          h: 0.7 + rng() * 0.9,
          tilt: (rng() - 0.5) * 0.2,
          isCattail: rng() > 0.45,
        });
      }
    }
    return arr;
  }, [radius, rng]);

  const stemMat    = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a6824', roughness: 0.85 }), []);
  const cattailMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5c3010', roughness: 0.95 }), []);
  const bladeMat   = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a7a2a', roughness: 0.82, side: THREE.DoubleSide }), []);

  return (
    <group>
      {stalks.map((s) => (
        <group key={s.key} position={[s.px, 0, s.pz]} rotation={[s.tilt, 0, s.tilt * 0.4]}>
          {s.isCattail ? (
            <>
              <mesh position={[0, s.h * 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.022, 0.030, s.h, 4]} />
                <primitive object={stemMat} />
              </mesh>
              <mesh position={[0, s.h + 0.11, 0]}>
                <cylinderGeometry args={[0.042, 0.042, 0.24, 6]} />
                <primitive object={cattailMat} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, s.h * 0.5, 0]} rotation={[0, s.tilt * 5, s.tilt * 0.4]}>
              <planeGeometry args={[0.07, s.h]} />
              <primitive object={bladeMat} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/* ================================================================
   Expanding ripple rings on the water
   ================================================================ */
function RippleRing({ r, delay, speed, ox = 0, oz = 0 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * speed + delay) % 1.0;
    ref.current.scale.setScalar(0.08 + t * 0.92);
    ref.current.material.opacity = (1 - t) * 0.22;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[ox, WATER_Y + 0.01, oz]}>
      <ringGeometry args={[r * 0.9, r * 0.95, 36]} />
      <meshBasicMaterial color="#c8e8f8" transparent opacity={0.20} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ================================================================
   Main Pond Component
   ================================================================ */
export default function Pond() {
  const r = POND_RADIUS;
  const { x, y, z } = POND_POSITION;

  return (
    <group position={[x, y, z]}>

      {/* ---- Surround gravel + rim rocks ---- */}
      <GravelSurround radius={r} />
      <RimRocks radius={r} />

      {/* ---- Sunken basin walls + floor ---- */}
      <PondBowl radius={r} />

      {/* ---- Bed contents (below water) ---- */}
      <PebbleBed radius={r} />
      <SubmergedRocks radius={r} />

      {/* ---- Water surface (sits at WATER_Y) ---- */}
      <WaterSurface radius={r} />

      {/* ---- Things floating on the water ---- */}
      <LilyPads radius={r} />
      <RippleRing r={r * 0.80} delay={0.00} speed={0.20} />
      <RippleRing r={r * 0.80} delay={0.40} speed={0.20} />
      <RippleRing r={r * 0.80} delay={0.75} speed={0.20} />
      <RippleRing r={r * 0.28} delay={0.10} speed={0.38} ox={1.8} oz={-1.2} />
      <RippleRing r={r * 0.22} delay={0.60} speed={0.38} ox={-1.5} oz={2.0} />

      {/* ---- Reeds around the rim ---- */}
      <Reeds radius={r} />

    </group>
  );
}
