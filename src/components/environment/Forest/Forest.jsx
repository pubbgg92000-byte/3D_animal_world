import { useEffect, useMemo } from 'react';
import { useAssetManager } from '../AssetManager';
import { generateForest, WORLD_SEED } from '../worldGenerator';
import { registerStaticObstacles, unregisterStaticObstacles } from '../../../utils/collisionRegistry';
import Tree from './Tree';
import Rock from './Rock';

function groupByAsset(instances) {
  const groups = new Map();
  for (const instance of instances) {
    if (!groups.has(instance.assetIndex)) groups.set(instance.assetIndex, []);
    groups.get(instance.assetIndex).push(instance);
  }
  return groups;
}

export default function Forest() {
  const { forest } = useAssetManager();
  const generated = useMemo(
    () => generateForest(WORLD_SEED, forest.trees, forest.rocks),
    [forest.rocks, forest.trees]
  );
  const treeGroups = useMemo(() => groupByAsset(generated.trees), [generated.trees]);
  const rockGroups = useMemo(() => groupByAsset(generated.rocks), [generated.rocks]);

  useEffect(() => {
    registerStaticObstacles(
      'asset-forest',
      generated.trees.map((tree) => {
        const asset = forest.trees[tree.assetIndex];
        return {
          x: tree.x,
          z: tree.z,
          r: Math.max(0.24, Math.min(0.9, asset.baseRadius * tree.scale * 0.18)),
        };
      })
    );
    registerStaticObstacles(
      'asset-rocks',
      generated.rocks.map((rock) => {
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
      unregisterStaticObstacles('asset-forest');
      unregisterStaticObstacles('asset-rocks');
    };
  }, [forest.rocks, forest.trees, generated.rocks, generated.trees]);

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
