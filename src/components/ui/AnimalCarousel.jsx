import { useRef, useCallback, useMemo, useState, memo } from 'react';
import StatBar from './StatBar';
import {
  SPECIES_EMOJIS,
  getBehaviorDisplay,
  getHealthStatus,
} from '../../config/designTokens';

/**
 * AnimalCarousel — Bottom-center scrollable animal dock.
 *
 * Features:
 *  - Collapsed cards: emoji + name + health dot + behavior
 *  - Selected card: glow, larger, elevated
 *  - Species grouping toggle
 *  - Horizontal scroll with smooth momentum
 */
function AnimalCarousel({
  animals = [],
  stats = {},
  behaviors = {},
  selectedId,
  onSelect,
  isMobile = false,
  expanded = false,
  onToggleExpanded,
}) {
  const scrollRef = useRef(null);
  const [grouped, setGrouped] = useState(false);

  // Scroll selected card into view
  const scrollToSelected = useCallback((id) => {
    if (!scrollRef.current) return;
    const card = scrollRef.current.querySelector(`[data-animal-id="${id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  const handleSelect = useCallback((id) => {
    onSelect?.(id);
    // Small delay so the card renders selected state before scrolling
    setTimeout(() => scrollToSelected(id), 50);
  }, [onSelect, scrollToSelected]);

  // Group animals by species
  const speciesGroups = useMemo(() => {
    const groups = {};
    for (const cfg of animals) {
      const sp = cfg.species || cfg.id;
      if (!groups[sp]) groups[sp] = [];
      groups[sp].push(cfg);
    }
    return groups;
  }, [animals]);

  const visibleAnimals = useMemo(() => {
    if (grouped || animals.length <= 36) return animals;
    const selectedIndex = Math.max(0, animals.findIndex((cfg) => cfg.id === selectedId));
    const windowSize = isMobile ? 18 : 28;
    const half = Math.floor(windowSize / 2);
    const start = Math.max(0, Math.min(selectedIndex - half, animals.length - windowSize));
    return animals.slice(start, start + windowSize);
  }, [animals, grouped, isMobile, selectedId]);

  return (
    <div className={`wt-carousel ${isMobile ? 'wt-carousel--mobile' : ''} ${expanded ? 'wt-carousel--expanded' : ''}`}>
      {isMobile && (
        <button
          className="wt-carousel__mobile-stack"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-label={expanded ? 'Close animal selection' : 'Choose an animal'}
        >
          <span>{SPECIES_EMOJIS[animals.find((animal) => animal.id === selectedId)?.species] || '🐾'}</span>
          <small>{animals.length}</small>
        </button>
      )}

      {(!isMobile || expanded) && (
      <>
      {/* Grouping toggle */}
      {!isMobile && <button
        className="wt-carousel__group-toggle"
        onClick={() => setGrouped((g) => !g)}
        title={grouped ? 'Show all animals' : 'Group by species'}
      >
        {grouped ? '👤' : '👥'}
      </button>}

      <div className="wt-carousel__track" ref={scrollRef}>
        {grouped ? (
          /* ── Species Group Cards ── */
          Object.entries(speciesGroups).map(([species, members]) => {
            const emoji = SPECIES_EMOJIS[species] || '🐾';
            const hasSelected = members.some((m) => m.id === selectedId);

            return (
              <div
                key={species}
                className={`wt-carousel__group ${hasSelected ? 'wt-carousel__group--active' : ''}`}
              >
                <button
                  className="wt-carousel__group-header"
                  onClick={() => handleSelect(members[0].id)}
                >
                  <span className="wt-carousel__emoji">{emoji}</span>
                  <span className="wt-carousel__group-count">×{members.length}</span>
                </button>
                {hasSelected && (
                  <div className="wt-carousel__group-expanded">
                    {members.map((cfg) => (
                      <AnimalCard
                        key={cfg.id}
                        config={cfg}
                        stats={stats[cfg.id]}
                        behavior={behaviors[cfg.id]}
                        isSelected={selectedId === cfg.id}
                        onSelect={() => handleSelect(cfg.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* ── Individual Cards ── */
          visibleAnimals.map((cfg) => (
            <AnimalCard
              key={cfg.id}
              config={cfg}
              stats={stats[cfg.id]}
              behavior={behaviors[cfg.id]}
              isSelected={selectedId === cfg.id}
              onSelect={handleSelect}
              isMobile={isMobile}
            />
          ))
        )}
      </div>
      </>
      )}
    </div>
  );
}

/* ── Single Animal Card ── */
const AnimalCard = memo(function AnimalCard({ config, stats, behavior, isSelected, onSelect, isMobile }) {
  const species = config.species || config.id;
  const emoji = SPECIES_EMOJIS[species] || '🐾';
  const behaviorInfo = getBehaviorDisplay(behavior);
  const healthInfo = getHealthStatus(stats);
  const handleClick = useCallback(() => onSelect?.(config.id), [config.id, onSelect]);

  return (
    <button
      className={`wt-carousel__card ${isSelected ? 'wt-carousel__card--selected' : ''}`}
      data-animal-id={config.id}
      onClick={handleClick}
      aria-pressed={isSelected}
      title={`${config.displayName || config.name} — ${behaviorInfo.label}`}
    >
      <span className="wt-carousel__card-emoji">{emoji}</span>
      <span className="wt-carousel__card-name">
        {isMobile && !isSelected ? '' : config.displayName || config.name}
      </span>
      <div className="wt-carousel__card-bars">
        <StatBar stat="energy"    value={stats?.energy ?? 100}    compact />
        <StatBar stat="hydration" value={stats?.hydration ?? 100} compact />
        <StatBar stat="hunger"    value={stats?.hunger ?? 100}    compact />
      </div>
      <span className="wt-carousel__card-behavior" style={{ color: behaviorInfo.color }}>
        {behaviorInfo.icon} {behaviorInfo.label}
      </span>
      {/* Health dot */}
      <span
        className="wt-carousel__card-health-dot"
        style={{ backgroundColor: healthInfo.color }}
      />
    </button>
  );
});

export default memo(AnimalCarousel);
