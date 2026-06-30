import { useEffect, useMemo } from 'react';
import { useAssetManager } from '../AssetManager';
import { generateForest, WORLD_SEED } from '../worldGenerator';
import { registerStaticObstacles, unregisterStaticObstacles } from '../../../utils/collisionRegistry';
import {
  POND_RADIUS,
  POND_X,
  POND_Z,
  STREAM_END_Z,
  STREAM_START_Z,
  streamCenterX,
  streamHalfWidth,
} from '../../../utils/world';
import Tree from './Tree';
import Rock from './Rock';

function isInWaterClearing({ x, z }, margin = 0) {
  if (Math.hypot(x - POND_X, z - POND_Z) < POND_RADIUS + margin) return true;
  if (z < STREAM_START_Z - 1 || z > STREAM_END_Z + 1) return false;

  const clampedZ = Math.min(STREAM_END_Z, Math.max(STREAM_START_Z, z));
  const channelRadius = streamHalfWidth(clampedZ) + margin;
  return Math.abs(x - streamCenterX(clampedZ)) < channelRadius;
}

function groupByAsset(instances) {
  const groups = new Map();
  for (const instance of instances) {
    if (!groups.has(instance.assetIndex)) groups.set(instance.assetIndex, []);
    groups.get(instance.assetIndex).push(instance);
  }
  return groups;
}

export default function Forest({
  center = [0, 0, 0],
  region = 'all',
  nearRadius = 24,
  onReady,
}) {
  const { forest } = useAssetManager();
  const generated = useMemo(
    () => generateForest(WORLD_SEED, forest.trees, forest.rocks),
    [forest.rocks, forest.trees]
  );
  const visibleTrees = useMemo(
    () => generated.trees.filter((tree) => {
      if (isInWaterClearing(tree, 6.2)) return false;
      const nearby = Math.hypot(tree.x - center[0], tree.z - center[2]) <= nearRadius;
      return region === 'near' ? nearby : region === 'distant' ? !nearby : true;
    }),
    [center, generated.trees, nearRadius, region]
  );
  const visibleRocks = useMemo(
    () => generated.rocks.filter((rock) => {
      if (isInWaterClearing(rock, 1.4)) return false;
      const nearby = Math.hypot(rock.x - center[0], rock.z - center[2]) <= nearRadius;
      return region === 'near' ? nearby : region === 'distant' ? !nearby : true;
    }),
    [center, generated.rocks, nearRadius, region]
  );
  const treeGroups = useMemo(() => groupByAsset(visibleTrees), [visibleTrees]);
  const rockGroups = useMemo(() => groupByAsset(visibleRocks), [visibleRocks]);

  useEffect(() => {
    registerStaticObstacles(
      `asset-forest-${region}`,
      visibleTrees.map((tree) => {
        const asset = forest.trees[tree.assetIndex];
        return {
          x: tree.x,
          z: tree.z,
          r: Math.max(0.24, Math.min(0.9, asset.baseRadius * tree.scale * 0.18)),
        };
      })
    );
    registerStaticObstacles(
      `asset-rocks-${region}`,
      visibleRocks.map((rock) => {
        const asset = forest.rocks[rock.assetIndex];
        return {
          x: rock.x,
          z: rock.z,
          r: Math.max(0.25, asset.baseRadius * rock.scale * 0.82),
          // Rock height from bounding box — drives climb-over vs steer-around
          height: (asset.size?.y || 0.5) * rock.scale * 0.6,
        };
      })
    );
    return () => {
      unregisterStaticObstacles(`asset-forest-${region}`);
      unregisterStaticObstacles(`asset-rocks-${region}`);
    };
  }, [forest.rocks, forest.trees, region, visibleRocks, visibleTrees]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(frame);
  }, [onReady]);

  return (
    <group name="asset-forest">
      {[...treeGroups.entries()].map(([assetIndex, instances]) => (
        <Tree
          key={`trees-${assetIndex}`}
          asset={forest.trees[assetIndex]}
          instances={instances}
        />
      ))}
      {[...rockGroups.entries()].map(([assetIndex, instances]) => (
        <Rock
          key={`rocks-${assetIndex}`}
          asset={forest.rocks[assetIndex]}
          instances={instances}
        />
      ))}
    </group>
  );
}
