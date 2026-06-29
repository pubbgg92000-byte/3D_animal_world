import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function windMaterial(source, height) {
  const material = source.clone();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = { value: 0 };
    shader.uniforms.uAssetHeight = { value: Math.max(0.1, height) };
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uWindTime;
       uniform float uAssetHeight;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float instancePhase = instanceMatrix[3][0] * 0.19 + instanceMatrix[3][2] * 0.13;
       float windWeight = smoothstep(0.05, uAssetHeight, max(position.y, 0.0));
       float windAmplitude = 0.72 + 0.28 * sin(instancePhase * 2.17);
       float gust = sin(uWindTime * 0.72 + instancePhase) * 0.09;
       gust += sin(uWindTime * 1.31 + instancePhase * 1.7) * 0.035;
       gust *= windAmplitude;
       transformed.x += gust * windWeight;
       transformed.z += gust * 0.35 * windWeight;`
    );
    material.userData.windShader = shader;
  };
  material.customProgramCacheKey = () => `wild-trails-wind-${source.uuid}`;
  if (material.transparent) material.alphaTest = Math.max(material.alphaTest || 0, 0.15);
  return material;
}

export default function Tree({ asset, instances }) {
  const meshRefs = useRef([]);
  const materials = useMemo(
    () => asset.parts.map((part) => windMaterial(part.material, asset.size.y)),
    [asset]
  );
  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    return instances.map((instance) => {
      dummy.position.set(instance.x, instance.y, instance.z);
      dummy.rotation.set(0, instance.rotation, 0);
      dummy.scale.setScalar(instance.scale);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [instances]);

  useEffect(() => {
    meshRefs.current.forEach((mesh) => {
      if (!mesh) return;
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    });
  }, [matrices]);

  useFrame(({ clock }) => {
    for (const material of materials) {
      const shader = material.userData.windShader;
      if (shader) shader.uniforms.uWindTime.value = clock.elapsedTime;
    }
  });

  return asset.parts.map((part, index) => (
    <instancedMesh
      key={`${asset.id}-${index}`}
      ref={(mesh) => { meshRefs.current[index] = mesh; }}
      args={[part.geometry, materials[index], instances.length]}
      castShadow
      receiveShadow
    />
  ));
}
