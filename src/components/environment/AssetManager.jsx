import { createContext, useContext, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export const FOREST_PACK_URL = '/low_poly_forest_tree_pack.glb';

const AssetContext = createContext(null);

function rootChildren(scene) {
  scene.updateMatrixWorld(true);
  return scene.getObjectByName('RootNode')?.children || scene.children;
}

function bakeAsset(id, name, objects) {
  const parts = [];
  const bounds = new THREE.Box3();

  for (const object of objects) {
    object.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      bounds.union(geometry.boundingBox);
      parts.push({
        geometry,
        material: child.material,
        sourceName: child.name,
      });
    });
  }

  if (parts.length === 0 || bounds.isEmpty()) return null;

  const center = bounds.getCenter(new THREE.Vector3());
  const offset = new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z);
  const normalizedBounds = new THREE.Box3();

  for (const part of parts) {
    part.geometry.applyMatrix4(offset);
    part.geometry.computeBoundingBox();
    part.geometry.computeBoundingSphere();
    normalizedBounds.union(part.geometry.boundingBox);
  }

  const size = normalizedBounds.getSize(new THREE.Vector3());
  return {
    id,
    name,
    parts,
    size,
    baseRadius: Math.max(size.x, size.z) * 0.5,
  };
}

function buildForestCatalog(scene) {
  const children = rootChildren(scene);
  const backgroundTrees = children.filter((child) => child.name.startsWith('Background_Tree_Atlas'));
  const rocks = children.filter((child) => child.name.startsWith('Rocks'));
  const branches = children.filter((child) => child.name.startsWith('Tree_Branches'));
  const trunks = children.filter((child) => child.name.startsWith('Tree_Trunk'));

  const treeAssets = backgroundTrees
    .map((object, index) => bakeAsset(`atlas-tree-${index}`, object.name, [object]))
    .filter(Boolean);

  const pairedCount = Math.min(branches.length, trunks.length);
  for (let index = 0; index < pairedCount; index++) {
    const asset = bakeAsset(
      `full-tree-${index}`,
      `Forest Tree ${index + 1}`,
      [trunks[index], branches[index]]
    );
    if (asset) treeAssets.push(asset);
  }

  return {
    trees: treeAssets,
    rocks: rocks
      .map((object, index) => bakeAsset(`rock-${index}`, object.name, [object]))
      .filter(Boolean),
  };
}

export function AssetManager({ children }) {
  const forestGltf = useGLTF(FOREST_PACK_URL);

  const value = useMemo(
    () => ({
      forest: buildForestCatalog(forestGltf.scene),
    }),
    [forestGltf.scene]
  );

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
}

export default AssetManager;

export function useAssetManager() {
  const value = useContext(AssetContext);
  if (!value) throw new Error('useAssetManager must be used inside AssetManager');
  return value;
}

// Preload removed — forest pack lazy-loads when stage 3 mounts this component
