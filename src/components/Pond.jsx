import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  POND_X,
  POND_Z,
  POND_RADIUS as WORLD_POND_RADIUS,
  POND_WATER_Y,
  STREAM_START_Z,
  STREAM_END_Z,
  streamCenterX,
  streamHalfWidth,
} from '../utils/world';
import { registerStaticObstacles, unregisterStaticObstacles } from '../utils/collisionRegistry';

/* ================================================================
   POND — full water level that overflows into a stream
   Stream flows from pond south edge to world boundary (z = +40)
   ================================================================ */

export const POND_POSITION = new THREE.Vector3(POND_X, 0, POND_Z);
export const POND_RADIUS = WORLD_POND_RADIUS;

// Water is full and visibly close to the rim.
const WATER_Y  = POND_WATER_Y;
const BED_Y    = -1.45;   // pond floor depth

// Stream end — where animals drink (edge of 80×80 world, z-positive side)
export const STREAM_END = new THREE.Vector3(
  streamCenterX(STREAM_END_Z),
  0,
  STREAM_END_Z
);

/* ================================================================
   Seeded RNG
   ================================================================ */
function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/* ================================================================
   Water surface shader
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
    vec2 n1uv = vUv*7.0 + vec2(uTime*0.05, uTime*0.03);
    vec2 n2uv = vUv*5.0 + vec2(-uTime*0.03, uTime*0.06);
    float nx = noise(n1uv)*2.0-1.0;
    float nz = noise(n2uv)*2.0-1.0;
    vec3 N = normalize(vec3(nx*0.15, 1.0, nz*0.12));
    vec3 V = normalize(uCam - vWorldPos);
    float fresnel = pow(1.0 - max(dot(V, N), 0.0), 2.5);
    float d = length(vUv - 0.5) * 2.0;
    vec3 deepCol    = vec3(0.04, 0.22, 0.50);
    vec3 shallowCol = vec3(0.20, 0.62, 0.82);
    vec3 skyCol     = vec3(0.55, 0.78, 1.00);
    vec3 col = mix(deepCol, shallowCol, d);
    col = mix(col, skyCol, fresnel * 0.60);
    vec3 sun = normalize(vec3(0.5, 1.0, -0.3));
    vec3 H   = normalize(sun + V);
    float sp = pow(max(dot(N, H), 0.0), 220.0) * 2.0;
    col += vec3(1.0, 0.97, 0.88) * sp;
    float sk = noise(vUv*50.0 + uTime*1.0);
    sk = pow(sk, 16.0) * 2.0;
    col += vec3(0.85, 0.95, 1.0) * sk;
    float alpha = mix(0.60, 0.92, fresnel + d * 0.3);
    gl_FragColor = vec4(col, clamp(alpha, 0.55, 0.94));
  }
`;

function WaterSurface({ radius }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCam:  { value: new THREE.Vector3() },
    },
    transparent: true,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  }), []);
  useFrame(({ clock, camera }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uCam.value.copy(camera.position);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, 0]} renderOrder={0}>
      <circleGeometry args={[radius, 80]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/* ================================================================
   Stream — flows from south pond edge toward z=+40 world boundary
   Width tapers from ~2.5 at pond to ~1.0 at edge
   ================================================================ */
const STREAM_WATER_FRAG = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform vec3  uCam;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main(){
    // flowing ripple along stream axis (v = flow direction)
    vec2 flow = vUv * vec2(4.0, 18.0) + vec2(0.0, -uTime * 1.8);
    float n = noise(flow) * 0.5 + noise(flow * 2.1 + 1.3) * 0.5;
    vec3 V = normalize(uCam - vWorldPos);
    float fresnel = pow(1.0 - max(dot(normalize(vec3(0.0,1.0,0.0)), V), 0.0), 2.0);
    vec3 col = mix(vec3(0.15, 0.50, 0.75), vec3(0.45, 0.78, 0.95), n);
    col = mix(col, vec3(0.6, 0.85, 1.0), fresnel * 0.4);
    float alpha = 0.70 + fresnel * 0.15;
    gl_FragColor = vec4(col, alpha);
  }
`;

const STREAM_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main(){
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

function StreamWater() {
  // The stream starts at pond south edge (z=5+5.5=10.5) and flows to z=38
  // We build a tapered ribbon in local coords, translated to world
  const streamMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   STREAM_VERT,
    fragmentShader: STREAM_WATER_FRAG,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
    transparent: true,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  }), []);

  useFrame(({ clock, camera }) => {
    streamMat.uniforms.uTime.value = clock.elapsedTime;
    streamMat.uniforms.uCam.value.copy(camera.position);
  });

  const streamGeo = useMemo(() => {
    const startZ = STREAM_START_Z;
    const endZ = STREAM_END_Z;
    const length = endZ - startZ;
    const segs   = 30;
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const uvs   = [];
    const idx   = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const z = startZ + t * length;        // world z
      const w = streamHalfWidth(z) * 2;
      const slight = streamCenterX(z);

      verts.push(-w / 2 + slight, WATER_Y - 0.01, z);
      verts.push( w / 2 + slight, WATER_Y - 0.01, z);
      uvs.push(0, t, 1, t);
    }

    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, b, c, b, d, c);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Stream bed / banks
  const bedGeo = useMemo(() => {
    const startZ = STREAM_START_Z - 0.5;
    const endZ = STREAM_END_Z + 0.5;
    const length = endZ - startZ;
    const segs   = 30;
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const uvs   = [];
    const idx   = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const z = startZ + t * length;
      const w = streamHalfWidth(z) * 2 + 0.8;
      const slight = streamCenterX(z);
      verts.push(-w / 2 + slight, WATER_Y - 0.04, z);
      verts.push( w / 2 + slight, WATER_Y - 0.04, z);
      uvs.push(0, t, 1, t);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, b, c, b, d, c);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      {/* Muddy stream bed */}
      <mesh geometry={bedGeo}>
        <meshStandardMaterial color="#3a2a12" roughness={0.97} />
      </mesh>
      {/* Flowing water surface */}
      <mesh geometry={streamGeo}>
        <primitive object={streamMat} attach="material" />
      </mesh>
    </group>
  );
}

/* ================================================================
   Pond bowl, pebbles, rocks, rim (unchanged internals)
   ================================================================ */
function PondBowl({ radius }) {
  const depth = Math.abs(BED_Y - WATER_Y);
  const wallGeo = useMemo(() => new THREE.CylinderGeometry(radius * 0.92, radius * 0.60, depth, 48, 2, true), [radius, depth]);
  const floorGeo = useMemo(() => new THREE.CircleGeometry(radius * 0.61, 48), [radius]);
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a5e50', roughness: 0.95, side: THREE.BackSide }), []);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6a8070', roughness: 0.95 }), []);
  const wallY = (WATER_Y + BED_Y) / 2;
  return (
    <group>
      <mesh geometry={wallGeo} material={wallMat} position={[0, wallY, 0]} receiveShadow />
      <mesh geometry={floorGeo} material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, BED_Y + 0.02, 0]} receiveShadow />
    </group>
  );
}

function PebbleBed({ radius }) {
  const rng = useMemo(() => seededRng(7), []);
  const pebbles = useMemo(() => {
    const arr = [];
    const floorR = radius * 0.62;
    for (let i = 0; i < 160; i++) {
      const r = rng() * floorR, a = rng() * Math.PI * 2, sz = 0.06 + rng() * 0.18;
      arr.push({ key: i, px: Math.cos(a)*r, pz: Math.sin(a)*r, sx: sz*(0.7+rng()*0.6), sy: sz*0.3, sz: sz*(0.7+rng()*0.6), rotY: rng()*Math.PI, ci: Math.floor(rng()*5) });
    }
    return arr;
  }, [radius, rng]);
  const BED_COLORS = ['#6e7e78','#586870','#7a8a7e','#5c6c64','#8a9890'];
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,BED_Y+0.01,0]} receiveShadow>
        <circleGeometry args={[radius*0.64,48]} />
        <meshStandardMaterial color="#9ab4b8" roughness={0.97} />
      </mesh>
      {pebbles.map((p) => (
        <mesh key={p.key} position={[p.px,BED_Y+p.sy*0.5+0.02,p.pz]} rotation={[0.1,p.rotY,0.05]} scale={[p.sx,p.sy,p.sz]} receiveShadow>
          <dodecahedronGeometry args={[0.5,0]} />
          <meshStandardMaterial color={BED_COLORS[p.ci]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

const RIM_ROCKS = [
  [0.00,1.01,1.8,1.2,1.5,0.15,0.3],[0.06,0.97,1.3,0.9,1.2,0.10,1.8],[0.11,1.04,2.0,1.4,1.7,0.18,0.7],
  [0.17,0.99,1.1,0.8,1.0,0.08,2.2],[0.22,1.06,1.6,1.1,1.4,0.14,1.1],[0.28,0.96,1.0,0.7,0.9,0.07,0.5],
  [0.33,1.03,1.9,1.3,1.6,0.16,1.6],[0.39,0.98,1.2,0.85,1.1,0.09,2.8],[0.44,1.07,2.2,1.5,1.9,0.20,0.2],
  [0.50,1.00,1.4,1.0,1.3,0.12,1.4],[0.56,0.95,1.0,0.72,0.95,0.08,0.9],[0.61,1.05,1.7,1.15,1.5,0.15,2.0],
  [0.67,0.98,1.3,0.88,1.2,0.10,0.4],[0.72,1.03,1.5,1.05,1.35,0.13,1.7],[0.78,0.97,1.1,0.78,1.0,0.09,2.5],
  [0.83,1.06,2.1,1.4,1.8,0.17,0.8],[0.89,0.99,1.2,0.82,1.1,0.11,1.3],[0.94,1.04,1.6,1.1,1.4,0.14,0.6],
  [0.03,1.30,1.5,1.0,1.3,0.10,1.0],[0.14,1.28,1.8,1.2,1.6,0.12,2.1],[0.26,1.32,1.3,0.9,1.2,0.08,0.3],
  [0.38,1.29,2.0,1.4,1.7,0.15,1.5],[0.51,1.31,1.4,0.95,1.3,0.11,2.6],[0.63,1.27,1.7,1.15,1.5,0.13,0.7],
  [0.76,1.33,1.2,0.82,1.1,0.09,1.9],[0.88,1.30,1.9,1.3,1.6,0.14,0.4],
];

function RimRocks({ radius }) {
  const colors = ['#8c8a7e','#727068','#a09c8e','#b4b0a0','#686460'];
  return (
    <group name="pond-rim-rocks">
      {RIM_ROCKS.map(([fraction,radiusFactor,sx,sy,sz,tiltX,rotY], index) => {
        const angle = fraction * Math.PI * 2;
        const distance = radius * radiusFactor;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * distance, sy * 0.35 - 0.15, Math.sin(angle) * distance]}
            rotation={[tiltX * (index % 2 === 0 ? 1 : -1), rotY, tiltX * 0.5]}
            scale={[sx, sy, sz]}
            castShadow
            receiveShadow
          >
            <dodecahedronGeometry args={[0.85, 0]} />
            <meshStandardMaterial color={colors[index % colors.length]} roughness={0.93} metalness={0.02} />
          </mesh>
        );
      })}
    </group>
  );
}

function GravelSurround({ radius }) {
  const rng = useMemo(() => seededRng(88), []);
  const pebbles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 200; i++) {
      const r = radius*1.05+rng()*radius*0.8, a = rng()*Math.PI*2, sz = 0.04+rng()*0.12;
      arr.push({ key: i, px: Math.cos(a)*r, pz: Math.sin(a)*r, sx: sz*(0.8+rng()*0.4), sy: sz*0.25, sz: sz*(0.8+rng()*0.4), rotY: rng()*Math.PI, ci: Math.floor(rng()*4) });
    }
    return arr;
  }, [radius, rng]);
  const GRAVEL_COLORS = ['#c8b890','#b8a880','#d4c8a0','#a89870'];
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.04,0]} receiveShadow>
        <ringGeometry args={[radius*0.98,radius*2.2,56]} />
        <meshStandardMaterial color="#c0ae88" roughness={0.97} />
      </mesh>
      {pebbles.map((p) => (
        <mesh key={p.key} position={[p.px,p.sy*0.3,p.pz]} rotation={[0.05,p.rotY,0.03]} scale={[p.sx,p.sy,p.sz]} receiveShadow>
          <dodecahedronGeometry args={[0.5,0]} />
          <meshStandardMaterial color={GRAVEL_COLORS[p.ci]} roughness={0.97} />
        </mesh>
      ))}
    </group>
  );
}

function LilyPads({ radius }) {
  const rng = useMemo(() => seededRng(23), []);
  const pads = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 9; i++) {
      const r = radius*(0.10+rng()*0.68), a = rng()*Math.PI*2;
      arr.push({ key: i, px: Math.cos(a)*r, pz: Math.sin(a)*r, scale: 0.20+rng()*0.30, rot: rng()*Math.PI*2, notch: rng()*0.55, hasFlower: rng()>0.65 });
    }
    return arr;
  }, [radius, rng]);
  const padMat = useMemo(() => new THREE.MeshStandardMaterial({ color:'#226f24', roughness:0.78, side:THREE.DoubleSide }), []);
  const fMat   = useMemo(() => new THREE.MeshStandardMaterial({ color:'#f6c8ea', roughness:0.62, side: THREE.DoubleSide }), []);
  const fcMat  = useMemo(() => new THREE.MeshStandardMaterial({ color:'#f5c842', roughness:0.5 }), []);
  return (
    <group>
      {pads.map((p) => (
        <group key={p.key} position={[p.px, WATER_Y+0.03, p.pz]}>
          <mesh rotation={[-Math.PI/2,0,p.rot]} scale={p.scale}>
            <circleGeometry args={[1,20,p.notch,Math.PI*2-p.notch*1.3]} />
            <primitive object={padMat} attach="material" />
          </mesh>
          {p.hasFlower && (
            <group position={[0,0.06,0]} scale={p.scale*0.38}>
              <mesh rotation={[-Math.PI/2,0,0]}>
                <circleGeometry args={[0.85,8]} />
                <primitive object={fMat} attach="material" />
              </mesh>
              <mesh position={[0,0.06,0]}>
                <sphereGeometry args={[0.24,6,6]} />
                <primitive object={fcMat} attach="material" />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

function createSwayMaterial(color, strength = 0.16) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.84,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uTime;'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float phase = instanceMatrix[3][0] * 0.47 + instanceMatrix[3][2] * 0.31;
       float tip = smoothstep(0.0, 1.0, position.y);
       transformed.x += sin(uTime * 1.55 + phase + position.y * 0.7) * tip * ${strength.toFixed(3)};
       transformed.z += cos(uTime * 1.25 + phase + position.x * 0.5) * tip * ${(strength * 0.55).toFixed(3)};`
    );
    material.userData.shader = shader;
  };
  return material;
}

function setInstancedMatrices(mesh, matrices) {
  if (!mesh) return;
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

function PoolLongGrass({ radius }) {
  const bladeRef = useRef();
  const bladeMat = useMemo(() => createSwayMaterial('#4f8d2e', 0.20), []);
  const bladeGeo = useMemo(() => new THREE.PlaneGeometry(0.11, 1.0, 1, 4).translate(0, 0.5, 0), []);
  const matrices = useMemo(() => {
    const rng = seededRng(141);
    const dummy = new THREE.Object3D();
    const arr = [];
    for (let cluster = 0; cluster < 54; cluster++) {
      const baseA = (cluster / 54) * Math.PI * 2 + (rng() - 0.5) * 0.16;
      const baseR = radius * (1.03 + rng() * 0.32);
      const count = 6 + Math.floor(rng() * 9);
      for (let i = 0; i < count; i++) {
        const a = baseA + (rng() - 0.5) * 0.42;
        const r = baseR + (rng() - 0.5) * 1.05;
        const h = 0.95 + rng() * 1.25;
        dummy.position.set(Math.cos(a) * r, -0.03, Math.sin(a) * r);
        dummy.rotation.set((rng() - 0.5) * 0.18, a + Math.PI / 2 + (rng() - 0.5) * 0.8, (rng() - 0.5) * 0.22);
        dummy.scale.set(0.8 + rng() * 0.8, h, 0.8 + rng() * 0.45);
        dummy.updateMatrix();
        arr.push(dummy.matrix.clone());
      }
    }
    return arr;
  }, [radius]);

  useEffect(() => setInstancedMatrices(bladeRef.current, matrices), [matrices]);
  useFrame(({ clock }) => {
    const shader = bladeMat.userData?.shader;
    if (shader) shader.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <instancedMesh ref={bladeRef} args={[bladeGeo, bladeMat, matrices.length]} receiveShadow>
    </instancedMesh>
  );
}

function Reeds({ radius }) {
  const rng = useMemo(() => seededRng(31), []);
  const stalks = useMemo(() => {
    const arr = [];
    for (let c = 0; c < 24; c++) {
      const baseA = (c/24)*Math.PI*2+c*0.23, clR = radius*(1.05+rng()*0.24), count = 3+Math.floor(rng()*7);
      for (let j = 0; j < count; j++) {
        const a = baseA+(j-count/2)*0.12+rng()*0.12, r = clR+(rng()-0.5)*0.65;
        arr.push({ key:`${c}-${j}`, px:Math.cos(a)*r, pz:Math.sin(a)*r, h:0.95+rng()*1.25, tilt:(rng()-0.5)*0.24, isCattail:rng()>0.38 });
      }
    }
    return arr;
  }, [radius, rng]);
  const stemMat    = useMemo(() => new THREE.MeshStandardMaterial({ color:'#3a6824', roughness:0.85 }), []);
  const cattailMat = useMemo(() => new THREE.MeshStandardMaterial({ color:'#5c3010', roughness:0.95 }), []);
  const bladeMat   = useMemo(() => new THREE.MeshStandardMaterial({ color:'#4a7a2a', roughness:0.82, side:THREE.DoubleSide }), []);
  return (
    <group>
      {stalks.map((s) => (
        <group key={s.key} position={[s.px,0,s.pz]} rotation={[s.tilt,0,s.tilt*0.4]}>
          {s.isCattail ? (
            <>
              <mesh position={[0,s.h*0.5,0]} castShadow>
                <cylinderGeometry args={[0.022,0.030,s.h,4]} />
                <primitive object={stemMat} attach="material" />
              </mesh>
              <mesh position={[0,s.h+0.11,0]}>
                <cylinderGeometry args={[0.042,0.042,0.24,6]} />
                <primitive object={cattailMat} attach="material" />
              </mesh>
            </>
          ) : (
            <mesh position={[0,s.h*0.5,0]} rotation={[0,s.tilt*5,s.tilt*0.4]}>
              <planeGeometry args={[0.07,s.h]} />
              <primitive object={bladeMat} attach="material" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/* ================================================================
   Ripple rings — longer duration, random positions across pond
   ================================================================ */
// Pre-defined random ripple origins (seeded so they don't change each render)
const RIPPLE_CONFIGS = [
  // [offsetX, offsetZ, radius_factor, delay, speed]  — speed is cycles/sec (lower = longer rings last)
  [  0.0,  0.0, 0.80, 0.00, 0.12 ],
  [  0.0,  0.0, 0.80, 0.35, 0.12 ],
  [  0.0,  0.0, 0.80, 0.70, 0.12 ],
  [  1.8, -1.2, 0.28, 0.10, 0.22 ],
  [ -1.5,  2.0, 0.22, 0.55, 0.22 ],
  [  2.5,  1.0, 0.25, 0.80, 0.18 ],
  [ -2.0, -1.8, 0.30, 0.25, 0.15 ],
  [  0.5,  3.0, 0.20, 0.65, 0.20 ],
  [ -3.0,  0.5, 0.18, 0.45, 0.25 ],
  [  1.2, -2.8, 0.22, 0.15, 0.17 ],
  [ -1.0,  1.5, 0.35, 0.90, 0.14 ],
  [  3.0, -0.5, 0.20, 0.38, 0.21 ],
];

function RippleRing({ r, delay, speed, ox = 0, oz = 0 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    // speed is cycles/sec — lower values mean the ring expands more slowly (lasts longer)
    const t = ((clock.elapsedTime * speed + delay) % 1.0);
    ref.current.scale.setScalar(0.05 + t * 0.95);
    ref.current.material.opacity = (1 - t) * 0.28;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI/2,0,0]} position={[ox, WATER_Y+0.01, oz]} renderOrder={0}>
      <ringGeometry args={[r*0.88, r*0.94, 40]} />
      <meshBasicMaterial color="#c8e8f8" transparent opacity={0.25} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ================================================================
   Main Pond Component
   ================================================================ */
export default function Pond() {
  const r = POND_RADIUS;
  const { x, y, z } = POND_POSITION;

  useEffect(() => {
    registerStaticObstacles(
      'pond-boulders',
      RIM_ROCKS.map(([fraction, radiusFactor, sx, , sz]) => {
        const angle = fraction * Math.PI * 2;
        const distance = r * radiusFactor;
        return {
          x: x + Math.cos(angle) * distance,
          z: z + Math.sin(angle) * distance,
          r: Math.max(sx, sz) * 0.58,
        };
      })
    );
    return () => unregisterStaticObstacles('pond-boulders');
  }, [r, x, z]);

  return (
    <group position={[x, y, z]}>
      <GravelSurround radius={r} />
      <RimRocks radius={r} />
      <PondBowl radius={r} />
      <PebbleBed radius={r} />
      <WaterSurface radius={r} />
      <LilyPads radius={r} />

      {/* Random ripples across the whole pond */}
      {RIPPLE_CONFIGS.map(([ox, oz, rf, delay, speed], i) => (
        <RippleRing key={i} r={r * rf} delay={delay} speed={speed} ox={ox} oz={oz} />
      ))}

      <PoolLongGrass radius={r} />
      <Reeds radius={r} />

      {/* Overflow stream — rendered in world space so no group offset needed */}
    </group>
  );
}

/* ================================================================
   Stream — exported separately, rendered at world root (App.jsx)
   ================================================================ */
export function PondStream() {
  return <StreamWater />;
}
