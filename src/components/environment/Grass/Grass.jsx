import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
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

const GRASS_MODEL_URL = '/grass.glb';
const TALL_GRASS_MODEL_URL = '/animated_grass_-_vegetation.glb';
const MEADOW_BATCH_COUNT = 14;
const MAIN_GRASS_PATCH_COUNT = 2100;
const TALL_GRASS_PATCH_COUNT = 240;
const FLOWER_COUNT = 420;
const FLOWER_COLORS = ['#f7e16b', '#f6a2bf', '#aeb8ff', '#ffffff', '#ef8c62'];
const GRASS_COLORS = ['#356f32', '#43843a', '#559244', '#6a9d4a', '#3d7937'];

function createGrassMaterial(color) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uWindTime;'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float patchPhase = instanceMatrix[3][0] * 0.28 + instanceMatrix[3][2] * 0.21;
       float tipWeight = smoothstep(0.05, 1.8, position.y);
       transformed.x += sin(uWindTime * 1.45 + patchPhase + position.y * 1.2) * tipWeight * 0.12;
       transformed.z += cos(uWindTime * 1.07 + patchPhase + position.x * 0.2) * tipWeight * 0.06;`
    );
    material.userData.shader = shader;
  };

  return material;
}

function bakeGrassModel(scene, colorOffset = 0) {
  const meshes = [];
  const bounds = new THREE.Box3();

  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    geometry.morphAttributes = {};
    geometry.morphTargetsRelative = false;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    bounds.union(geometry.boundingBox);
    meshes.push({ geometry, name: child.name });
  });

  if (meshes.length === 0 || bounds.isEmpty()) return [];

  const center = bounds.getCenter(new THREE.Vector3());
  const floorOffset = new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z);

  return meshes.map(({ geometry, name }, index) => {
    geometry.applyMatrix4(floorOffset);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return {
      name,
      geometry,
      material: createGrassMaterial(GRASS_COLORS[(index + colorOffset) % GRASS_COLORS.length]),
    };
  });
}

function createBatchCenters(random) {
  const centers = [];
  let attempts = 0;

  while (centers.length < MEADOW_BATCH_COUNT && attempts++ < MEADOW_BATCH_COUNT * 20) {
    const x = (random() * 2 - 1) * (WORLD_HALF - 5);
    const z = (random() * 2 - 1) * (WORLD_HALF - 5);
    if (isWaterAt(x, z, 3.8)) continue;

    const meadowNoise = Math.sin(x * 0.13) + Math.cos(z * 0.11) + Math.sin((x - z) * 0.07);
    if (meadowNoise < -0.15 && random() > 0.28) continue;

    centers.push({
      x,
      z,
      radius: 11 + random() * 11,
      density: 0.92 + random() * 0.34,
    });
  }

  return centers;
}

function randomPointInBatch(random, centers) {
  const center = centers[Math.floor(random() * centers.length)];
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(random()) * center.radius;
  const wobble = Math.sin(angle * 3 + center.x * 0.2) * center.radius * 0.12;

  return {
    x: center.x + Math.cos(angle) * (radius + wobble),
    z: center.z + Math.sin(angle) * (radius - wobble * 0.5),
    center,
    edge: radius / center.radius,
  };
}

function makeGrassMatrices({ count, random, centers, baseScale, tall = false }) {
  const dummy = new THREE.Object3D();
  const matrices = [];
  let attempts = 0;

  while (matrices.length < count && attempts++ < count * 12) {
    const { x, z, center, edge } = randomPointInBatch(random, centers);
    if (Math.abs(x) > WORLD_HALF - 1 || Math.abs(z) > WORLD_HALF - 1) continue;
    if (isWaterAt(x, z, tall ? 2.2 : 1.45)) continue;

    // Feather only the outside edge; the interiors stay dense enough to read as one big batch.
    if (edge > 0.88 && random() > (1 - edge) * 5.5 * center.density) continue;

    const terrainY = getTerrainHeight(x, z);
    const clumpScale = baseScale * (0.75 + random() * 0.65) * center.density;
    const stretch = tall ? 0.75 + random() * 0.55 : 0.85 + random() * 0.45;

    dummy.position.set(x, terrainY + (tall ? 0.002 : 0.004), z);
    dummy.rotation.set((random() - 0.5) * 0.05, random() * Math.PI * 2, (random() - 0.5) * 0.08);
    dummy.scale.set(
      clumpScale * (0.95 + random() * 0.55),
      clumpScale * stretch,
      clumpScale * (0.95 + random() * 0.55)
    );
    dummy.updateMatrix();
    matrices.push(dummy.matrix.clone());
  }

  return matrices;
}

function setInstanceMatrices(mesh, matrices) {
  if (!mesh) return;
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

export default function Grass() {
  const grassRefs = useRef([]);
  const tallGrassRefs = useRef([]);
  const flowerHeadRefs = useRef([]);
  const flowerStemRef = useRef();
  const grassGltf = useGLTF(GRASS_MODEL_URL);
  const tallGrassGltf = useGLTF(TALL_GRASS_MODEL_URL);
  const grassParts = useMemo(() => bakeGrassModel(grassGltf.scene, 0), [grassGltf.scene]);
  const tallGrassParts = useMemo(() => bakeGrassModel(tallGrassGltf.scene, 2), [tallGrassGltf.scene]);

  const { grassMatrices, tallGrassMatrices, flowerHeadMatrices, flowerStemMatrices, flowerColors } = useMemo(() => {
    const random = createRandom(`${WORLD_SEED}:meadow`);
    const centers = createBatchCenters(random);
    const flowerHeads = [];
    const flowerStems = [];
    const colors = [];

    const grassMatrices = makeGrassMatrices({
      count: MAIN_GRASS_PATCH_COUNT,
      random,
      centers,
      baseScale: 0.082,
    });
    const tallGrassMatrices = makeGrassMatrices({
      count: TALL_GRASS_PATCH_COUNT,
      random,
      centers,
      baseScale: 0.019,
      tall: true,
    });

    const dummy = new THREE.Object3D();

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
      grassMatrices,
      tallGrassMatrices,
      flowerHeadMatrices: flowerHeads,
      flowerStemMatrices: flowerStems,
      flowerColors: colors,
    };
  }, []);

  useEffect(() => {
    grassRefs.current.forEach((mesh) => setInstanceMatrices(mesh, grassMatrices));
    tallGrassRefs.current.forEach((mesh) => setInstanceMatrices(mesh, tallGrassMatrices));
    setInstanceMatrices(flowerStemRef.current, flowerStemMatrices);
    setInstanceMatrices(flowerHeadRefs.current[0], flowerHeadMatrices);
    flowerColors.forEach((color, index) => flowerHeadRefs.current[0]?.setColorAt(index, color));
    if (flowerHeadRefs.current[0]?.instanceColor) {
      flowerHeadRefs.current[0].instanceColor.needsUpdate = true;
    }
  }, [flowerColors, flowerHeadMatrices, flowerStemMatrices, grassMatrices, grassParts, tallGrassMatrices, tallGrassParts]);

  useFrame(({ clock }) => {
    [...grassParts, ...tallGrassParts].forEach((part) => {
      const shader = part.material.userData?.shader;
      if (shader) shader.uniforms.uWindTime.value = clock.elapsedTime;
    });
  });

  return (
    <group name="meadow-grass">
      {grassParts.map((part, index) => (
        <instancedMesh
          key={`main-grass-glb-${part.name || index}`}
          ref={(mesh) => { grassRefs.current[index] = mesh; }}
          args={[part.geometry, part.material, grassMatrices.length]}
          receiveShadow
        />
      ))}

      {tallGrassParts.map((part, index) => (
        <instancedMesh
          key={`tall-grass-glb-${part.name || index}`}
          ref={(mesh) => { tallGrassRefs.current[index] = mesh; }}
          args={[part.geometry, part.material, tallGrassMatrices.length]}
          receiveShadow
        />
      ))}

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

useGLTF.preload(GRASS_MODEL_URL);
useGLTF.preload(TALL_GRASS_MODEL_URL);
