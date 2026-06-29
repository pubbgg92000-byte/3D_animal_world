import { useMemo } from 'react';
import { SPECIES_EMOJIS } from '../../config/designTokens';
import { SPECIES_DATA, CONSERVATION_COLORS } from '../../config/speciesEncyclopedia';
import { getDiscoveredSpecies } from './DiscoveryPopup';

const ALL_SPECIES = Object.keys(SPECIES_DATA);

/**
 * EncyclopediaOverlay — Full-screen wildlife encyclopedia.
 * Shows all discovered species with detailed educational info.
 * Undiscovered species appear as locked silhouettes.
 */
export default function EncyclopediaOverlay({ open, onClose }) {
  const discovered = useMemo(() => getDiscoveredSpecies(), [open]);
  const totalFacts = ALL_SPECIES.reduce(
    (sum, sp) => sum + (SPECIES_DATA[sp]?.funFacts?.length || 0),
    0
  );

  if (!open) return null;

  return (
    <div className="wt-encyclopedia-overlay" onClick={onClose}>
      <div className="wt-encyclopedia-overlay__panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wt-encyclopedia-overlay__header">
          <h2 className="wt-encyclopedia-overlay__title">📖 Wildlife Encyclopedia</h2>
          <button className="wt-encyclopedia-overlay__close" onClick={onClose}>✕</button>
        </div>

        {/* Progress */}
        <div className="wt-encyclopedia-overlay__progress">
          <div className="wt-encyclopedia-overlay__stat">
            <span className="wt-encyclopedia-overlay__stat-value">
              {discovered.length} / {ALL_SPECIES.length}
            </span>
            <span className="wt-encyclopedia-overlay__stat-label">Species Discovered</span>
          </div>
          <div className="wt-encyclopedia-overlay__stat">
            <span className="wt-encyclopedia-overlay__stat-value">
              {Math.round((discovered.length / ALL_SPECIES.length) * 100)}%
            </span>
            <span className="wt-encyclopedia-overlay__stat-label">Completion</span>
          </div>
          <div className="wt-encyclopedia-overlay__stat">
            <span className="wt-encyclopedia-overlay__stat-value">{totalFacts}</span>
            <span className="wt-encyclopedia-overlay__stat-label">Fun Facts</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="wt-encyclopedia-overlay__progress-bar">
          <div
            className="wt-encyclopedia-overlay__progress-fill"
            style={{ width: `${(discovered.length / ALL_SPECIES.length) * 100}%` }}
          />
        </div>

        {/* Species Grid */}
        <div className="wt-encyclopedia-overlay__grid">
          {ALL_SPECIES.map((speciesId) => {
            const isDiscovered = discovered.includes(speciesId);
            const data = SPECIES_DATA[speciesId];
            const emoji = SPECIES_EMOJIS[speciesId] || '🐾';
            const conserveColor = CONSERVATION_COLORS[data.conservationStatus] || '#4ADE80';

            return (
              <div
                key={speciesId}
                className={`wt-encyclopedia-card ${isDiscovered ? '' : 'wt-encyclopedia-card--locked'}`}
              >
                {isDiscovered ? (
                  <>
                    <div className="wt-encyclopedia-card__header">
                      <span className="wt-encyclopedia-card__emoji">{emoji}</span>
                      <div>
                        <div className="wt-encyclopedia-card__name">{data.commonName}</div>
                        <div className="wt-encyclopedia-card__sci">{data.scientificName}</div>
                      </div>
                    </div>

                    <div className="wt-encyclopedia-card__info-grid">
                      <InfoItem label="Weight" value={data.approximateWeight} />
                      <InfoItem label="Height" value={data.approximateHeight} />
                      <InfoItem label="Speed" value={data.topSpeed} />
                      <InfoItem label="Lifespan" value={data.averageLifespan} />
                    </div>

                    <p className="wt-encyclopedia-card__diet-desc">{data.dietDescription}</p>

                    <div className="wt-encyclopedia-card__tags">
                      {data.diet.slice(0, 4).map((d) => (
                        <span key={d} className="wt-encyclopedia-card__tag">{d}</span>
                      ))}
                    </div>

                    <div className="wt-encyclopedia-card__footer">
                      <span
                        className="wt-encyclopedia-card__badge"
                        style={{ backgroundColor: conserveColor }}
                      >
                        {data.conservationStatus}
                      </span>
                      <span className="wt-encyclopedia-card__range">🌍 {data.geographicRange}</span>
                    </div>

                    <div className="wt-encyclopedia-card__fact">
                      💡 {data.funFacts[0]}
                    </div>
                  </>
                ) : (
                  <div className="wt-encyclopedia-card__locked-content">
                    <span className="wt-encyclopedia-card__locked-icon">❓</span>
                    <span className="wt-encyclopedia-card__locked-text">
                      Undiscovered Species
                    </span>
                    <span className="wt-encyclopedia-card__locked-hint">
                      Select this animal in the world to discover it
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="wt-encyclopedia-card__info-item">
      <span className="wt-encyclopedia-card__info-label">{label}</span>
      <span className="wt-encyclopedia-card__info-value">{value}</span>
    </div>
  );
}
