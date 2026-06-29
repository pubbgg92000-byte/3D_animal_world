import { useMemo, useState, useEffect } from 'react';
import StatBar from './StatBar';
import AbilityChip from './AbilityChip';
import {
  SPECIES_EMOJIS,
  SPECIES_ABILITIES,
  getBehaviorDisplay,
  getHealthStatus,
} from '../../config/designTokens';
import {
  getSpeciesData,
  getRandomFunFact,
  CONSERVATION_COLORS,
} from '../../config/speciesEncyclopedia';

/**
 * AnimalPanel — Educational wildlife encyclopedia card.
 *
 * Normal mode:  Compact card with identity, activity, mini stats, rotating fun fact
 * Learning mode: Expanded encyclopedia with physical info, diet, habitat, conservation
 *
 * Collapsed: emoji + name + health badge + mini bars + behavior
 * Expanded:  full stats, educational info, abilities
 */
export default function AnimalPanel({
  config,
  stats = {},
  behavior = 'Idle',
  onForceAbility,
  collapsed = false,
  onToggleCollapse,
  onClose,
  learningMode = false,
}) {
  if (!config) return null;

  const species = config.species || config.id;
  const emoji = SPECIES_EMOJIS[species] || '🐾';
  const abilities = SPECIES_ABILITIES[species] || [];
  const behaviorInfo = getBehaviorDisplay(behavior);
  const healthInfo = getHealthStatus(stats);
  const speciesData = getSpeciesData(config.id);

  // Rotating fun fact — changes each time the animal is selected
  const [funFact, setFunFact] = useState(null);
  useEffect(() => {
    if (speciesData) {
      setFunFact(getRandomFunFact(species));
    }
  }, [config.id, species, speciesData]);

  // Map behaviors to active abilities
  const isAbilityActive = useMemo(() => {
    return (action) => {
      if (behavior === action) return true;
      if (action === 'Walk' && behavior === 'Wander') return true;
      if (action === 'Hunt Fish' && behavior === 'Hunt') return true;
      if (action === 'Hunt Prey' && behavior === 'Hunt') return true;
      return false;
    };
  }, [behavior]);

  // Average health percentage for collapsed view
  const avgHealth = Math.round(
    ((stats.energy ?? 100) + (stats.hydration ?? 100) + (stats.hunger ?? 100)) / 3
  );

  const conservationColor = speciesData
    ? CONSERVATION_COLORS[speciesData.conservationStatus] || '#4ADE80'
    : '#4ADE80';

  return (
    <div className={`wt-animal-panel ${collapsed ? 'wt-animal-panel--collapsed' : ''}`}>
      {/* ── Header (always visible) ── */}
      <div className="wt-animal-panel__header-row">
        <button className="wt-animal-panel__header" onClick={onToggleCollapse}>
          <span className="wt-animal-panel__emoji">{emoji}</span>
          <div className="wt-animal-panel__identity">
            <span className="wt-animal-panel__name">{config.displayName || config.name}</span>
            <span className="wt-animal-panel__meta">
              {speciesData?.commonName || config.name}
              {config.gender && ` · ${config.gender}`}
            </span>
          </div>
          <div className="wt-animal-panel__status-badge" style={{ color: healthInfo.color }}>
            <span className="wt-animal-panel__health-dot" style={{ backgroundColor: healthInfo.color }} />
            {healthInfo.label}
          </div>
          <span className={`wt-animal-panel__chevron ${collapsed ? '' : 'wt-animal-panel__chevron--open'}`}>
            ▸
          </span>
        </button>
        <button
          className="wt-animal-panel__close"
          onClick={onClose}
          title="Hide panel"
          aria-label="Close animal panel"
        >
          ✕
        </button>
      </div>

      {/* ── Mini Stats (visible when collapsed) ── */}
      {collapsed && (
        <div className="wt-animal-panel__mini-stats">
          <StatBar stat="energy"    value={stats.energy ?? 100}    compact />
          <StatBar stat="hydration" value={stats.hydration ?? 100} compact />
          <StatBar stat="hunger"    value={stats.hunger ?? 100}    compact />
          <div className="wt-animal-panel__mini-behavior" style={{ color: behaviorInfo.color }}>
            {behaviorInfo.icon} {behaviorInfo.label}
          </div>
        </div>
      )}

      {/* ── Body (collapsible with max-height transition) ── */}
      <div className={`wt-animal-panel__body ${collapsed ? 'wt-animal-panel__body--collapsed' : ''}`}>
        <div className="wt-animal-panel__body-inner">

          {/* Current Activity */}
          <div className="wt-animal-panel__section">
            <div className="wt-animal-panel__row">
              <span className="wt-animal-panel__row-label">Current Activity</span>
              <span className="wt-animal-panel__row-value" style={{ color: behaviorInfo.color }}>
                {behaviorInfo.icon} {behaviorInfo.label}
              </span>
            </div>
            <div className="wt-animal-panel__row">
              <span className="wt-animal-panel__row-label">Mood</span>
              <span className="wt-animal-panel__row-value" style={{ color: healthInfo.color }}>
                {healthInfo.label}
              </span>
            </div>
            {config.age && (
              <div className="wt-animal-panel__row">
                <span className="wt-animal-panel__row-label">Approximate Age</span>
                <span className="wt-animal-panel__row-value">~{config.age}</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="wt-animal-panel__section">
            <div className="wt-animal-panel__section-title">Current Needs</div>
            <div className="wt-animal-panel__stats">
              <StatBar stat="energy"    value={stats.energy ?? 100} />
              <StatBar stat="hydration" value={stats.hydration ?? 100} />
              <StatBar stat="hunger"    value={stats.hunger ?? 100} />
            </div>
          </div>

          {/* Fun Fact Banner — always visible */}
          {funFact && (
            <div className="wt-animal-panel__fun-fact">
              <span className="wt-animal-panel__fun-fact-icon">💡</span>
              <span className="wt-animal-panel__fun-fact-text">{funFact}</span>
            </div>
          )}

          {/* ── Learning Mode: Educational Details ── */}
          {learningMode && speciesData && (
            <>
              {/* Physical Info */}
              <div className="wt-animal-panel__section">
                <div className="wt-animal-panel__section-title">Physical Info</div>
                <div className="wt-animal-panel__row">
                  <span className="wt-animal-panel__row-label">Weight</span>
                  <span className="wt-animal-panel__row-value">{speciesData.approximateWeight}</span>
                </div>
                <div className="wt-animal-panel__row">
                  <span className="wt-animal-panel__row-label">Height</span>
                  <span className="wt-animal-panel__row-value">{speciesData.approximateHeight}</span>
                </div>
                <div className="wt-animal-panel__row">
                  <span className="wt-animal-panel__row-label">Length</span>
                  <span className="wt-animal-panel__row-value">{speciesData.approximateLength}</span>
                </div>
                <div className="wt-animal-panel__row">
                  <span className="wt-animal-panel__row-label">Top Speed</span>
                  <span className="wt-animal-panel__row-value">{speciesData.topSpeed}</span>
                </div>
                <div className="wt-animal-panel__row">
                  <span className="wt-animal-panel__row-label">Lifespan</span>
                  <span className="wt-animal-panel__row-value">{speciesData.averageLifespan}</span>
                </div>
              </div>

              {/* Diet & Habitat */}
              <div className="wt-animal-panel__section">
                <div className="wt-animal-panel__section-title">Diet</div>
                <p className="wt-animal-panel__description">{speciesData.dietDescription}</p>
                <div className="wt-animal-panel__tags">
                  {speciesData.diet.map((item) => (
                    <span key={item} className="wt-animal-panel__tag wt-animal-panel__tag--diet">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="wt-animal-panel__section">
                <div className="wt-animal-panel__section-title">Habitat</div>
                <div className="wt-animal-panel__tags">
                  {speciesData.favouriteHabitat.map((h) => (
                    <span key={h} className="wt-animal-panel__tag wt-animal-panel__tag--habitat">
                      🌿 {h}
                    </span>
                  ))}
                </div>
              </div>

              {/* Predators */}
              <div className="wt-animal-panel__section">
                <div className="wt-animal-panel__section-title">Natural Predators</div>
                <div className="wt-animal-panel__tags">
                  {speciesData.predators.map((p) => (
                    <span key={p} className="wt-animal-panel__tag wt-animal-panel__tag--predator">
                      ⚠️ {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sounds & Footprints */}
              <div className="wt-animal-panel__section">
                <div className="wt-animal-panel__row">
                  <span className="wt-animal-panel__row-label">Sounds</span>
                  <span className="wt-animal-panel__row-value wt-animal-panel__row-value--wrap">
                    🔊 {speciesData.sounds}
                  </span>
                </div>
                <div className="wt-animal-panel__row">
                  <span className="wt-animal-panel__row-label">Tracks</span>
                  <span className="wt-animal-panel__row-value wt-animal-panel__row-value--wrap">
                    🐾 {speciesData.footprints}
                  </span>
                </div>
              </div>

              {/* Conservation Status */}
              <div className="wt-animal-panel__section">
                <div className="wt-animal-panel__conservation">
                  <span
                    className="wt-animal-panel__conservation-badge"
                    style={{ backgroundColor: conservationColor }}
                  >
                    {speciesData.conservationStatus}
                  </span>
                  <span className="wt-animal-panel__conservation-label">Conservation Status</span>
                </div>
              </div>

              {/* Geographic Range */}
              <div className="wt-animal-panel__section">
                <div className="wt-animal-panel__row">
                  <span className="wt-animal-panel__row-label">Range</span>
                  <span className="wt-animal-panel__row-value wt-animal-panel__row-value--wrap">
                    🌍 {speciesData.geographicRange}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Territory & Behavior */}
          <div className="wt-animal-panel__section">
            {config.territory && (
              <div className="wt-animal-panel__row">
                <span className="wt-animal-panel__row-label">Territory</span>
                <span className="wt-animal-panel__row-value">{config.territory}</span>
              </div>
            )}
          </div>

          {/* Abilities */}
          <div className="wt-animal-panel__section">
            <div className="wt-animal-panel__section-title">Abilities</div>
            <div className="wt-animal-panel__abilities">
              {abilities.map((action) => (
                <AbilityChip
                  key={action}
                  label={action}
                  isActive={isAbilityActive(action)}
                  onClick={() => onForceAbility?.(action)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
