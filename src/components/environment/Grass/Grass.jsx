import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  WORLD_HALF,
  STREAM_END_Z,
  STREAM_START_Z,
  getTerrainHeight,
  isWaterAt,
  streamCenterX,
  streamHalfWidth,
} from '../../../utils/world';
import { createRandom, WORLD_SEED } from '../worldGenerator';

const BLADE_COUNT = 15000;
const FLOWER_COUNT = 420;
const FLOWER_COLORS = ['#f7e16b', '#f6a2bf', '#aeb8ff', '#ffffff', '#ef8c62'];
const GRASS_COLORS = ['#356f32', '#43843a', '#559244', '#6a9d4a', '#3d7937'];

function createGrassGeometry() {
  // Two tapered blades cross at each instance, so grass has volume from every angle.
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -0.5,0,0,  0.5,0,0,  -0.22,0.68,0,
     0.5,0,0,  0,1,0,     -0.22,0.68,0,
     0,0,-0.5, 0,0,0.5,   0,0.68,-0.22,
     0,0,0.5,  0,1,0,     0,0.68,-0.22,
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function setInstanceMatrices(mesh, matrices) {
  if (!mesh) return;
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

export default function Grass() {
  const grassRef = useRef();
  const flowerHeadRefs = useRef([]);
  const flowerStemRef = useRef();
  const grassMaterialRef = useRef();
  const grassGeometry = useMemo(createGrassGeometry, []);

  const { grassMatrices, grassColors, flowerHeadMatrices, flowerStemMatrices, flowerColors } = useMemo(() => {
    const random = createRandom(`${WORLD_SEED}:meadow`);
    const dummy = new THREE.Object3D();
    const blades = [];
    const bladeColors = [];
    const flowerHeads = [];
    const flowerStems = [];
    const colors = [];

    let grassAttempts = 0;
    while (blades.length < BLADE_COUNT && grassAttempts++ < BLADE_COUNT * 3) {
      const x = (random() * 2 - 1) * (WORLD_HALF - 1);
      const z = (random() * 2 - 1) * (WORLD_HALF - 1);
      if (isWaterAt(x, z, 1.1)) continue;
      // Broad low-density patches break up the procedural uniformity.
      const patch = Math.sin(x * 0.19) + Math.cos(z * 0.16) + Math.sin((x + z) * 0.08);
      if (patch < -0.9 && random() > 0.3) continue;
      const height = 0.14 + random() * 0.3;
      const width = 0.055 + random() * 0.065;
      dummy.position.set(x, getTerrainHeight(x, z) + 0.012, z);
      dummy.rotation.set((random() - 0.5) * 0.08, random() * Math.PI, (random() - 0.5) * 0.16);
      dummy.scale.set(width, height, width);
      dummy.updateMatrix();
      blades.push(dummy.matrix.clone());
      bladeColors.push(new THREE.Color(GRASS_COLORS[Math.floor(random() * GRASS_COLORS.length)]));
    }

    for (let index = 0; index < FLOWER_COUNT; index++) {
      let x;
      let z;
      if (index < 110) {
        z = STREAM_START_Z + random() * (STREAM_END_Z - STREAM_START_Z);
        const side = random() > 0.5 ? 1 : -1;
        x = streamCenterX(z) + side * (streamHalfWidth(z) + 0.5 + random() * 1.15);
      } else {
        const angle = random() * Math.PI * 2;
        const radius = 5 + Math.sqrt(random()) * 31;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
      }
      if (isWaterAt(x, z, 0.8)) continue;
      const height = 0.2 + random() * 0.25;
      const groundY = getTerrainHeight(x, z);
      dummy.position.set(x, groundY + height * 0.5, z);
      dummy.rotation.set(0, random() * Math.PI, 0);
      dummy.scale.set(0.12, height / 3.5, 0.12);
      dummy.updateMatrix();
      flowerStems.push(dummy.matrix.clone());

      dummy.position.set(x, groundY + height, z);
      dummy.scale.setScalar(0.055 + random() * 0.035);
      dummy.updateMatrix();
      flowerHeads.push(dummy.matrix.clone());
      colors.push(new THREE.Color(FLOWER_COLORS[index % FLOWER_COLORS.length]));
    }
    return {
      grassMatrices: blades,
      grassColors: bladeColors,
      flowerHeadMatrices: flowerHeads,
      flowerStemMatrices: flowerStems,
      flowerColors: colors,
    };
  }, []);

  useEffect(() => {
    setInstanceMatrices(grassRef.current, grassMatrices);
    grassColors.forEach((color, index) => grassRef.current?.setColorAt(index, color));
    if (grassRef.current?.instanceColor) grassRef.current.instanceColor.needsUpdate = true;
    setInstanceMatrices(flowerStemRef.current, flowerStemMatrices);
    setInstanceMatrices(flowerHeadRefs.current[0], flowerHeadMatrices);
    flowerColors.forEach((color, index) => flowerHeadRefs.current[0]?.setColorAt(index, color));
    if (flowerHeadRefs.current[0]?.instanceColor) {
      flowerHeadRefs.current[0].instanceColor.needsUpdate = true;
    }
  }, [flowerColors, flowerHeadMatrices, flowerStemMatrices, grassColors, grassMatrices]);

  useFrame(({ clock }) => {
    const shader = grassMaterialRef.current?.userData?.shader;
    if (shader) shader.uniforms.uWindTime.value = clock.elapsedTime;
  });

  return (
    <group name="meadow-grass">
      <instancedMesh ref={grassRef} args={[null, null, grassMatrices.length]}>
        <primitive object={grassGeometry} attach="geometry" />
        <meshStandardMaterial
          ref={grassMaterialRef}
          color="#ffffff"
          roughness={0.88}
          side={THREE.DoubleSide}
          onBeforeCompile={(shader) => {
            shader.uniforms.uWindTime = { value: 0 };
            shader.vertexShader = shader.vertexShader.replace(
              '#include <common>',
              '#include <common>\nuniform float uWindTime;'
            );
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
               float bladePhase = instanceMatrix[3][0] * 0.31 + instanceMatrix[3][2] * 0.19;
               float tipWeight = smoothstep(0.0, 1.0, position.y);
               transformed.x += sin(uWindTime * 1.15 + bladePhase) * tipWeight * 0.22;
               transformed.z += cos(uWindTime * 0.83 + bladePhase) * tipWeight * 0.08;`
            );
            grassMaterialRef.current.userData.shader = shader;
          }}
        />
      </instancedMesh>

      <instancedMesh ref={flowerStemRef} args={[null, null, flowerStemMatrices.length]}>
        <cylinderGeometry args={[0.08, 0.12, 3.5, 4]} />
        <meshStandardMaterial color="#397b35" roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={(mesh) => { flowerHeadRefs.current[0] = mesh; }}
        args={[null, null, flowerHeadMatrices.length]}
      >
        <sphereGeometry args={[1, 6, 5]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  );
}
