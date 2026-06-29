import { useState, useCallback, useRef, useMemo } from 'react';
import { SPECIES_EMOJIS, getBehaviorDisplay } from '../../config/designTokens';

/**
 * SearchOverlay — Spotlight-style animal search.
 *
 * Improvements:
 *  - High contrast text (white names, light grey species, green status)
 *  - Species filter chips at top
 *  - Reduced backdrop blur (more world visible)
 *  - Keyboard navigation (arrow keys + Enter)
 */

function getUniqueSpecies(animals) {
  const set = new Set();
  animals.forEach((a) => set.add(a.species || a.id));
  return ['all', ...Array.from(set)];
}

export default function SearchOverlay({
  animals = [],
  behaviors = {},
  open = false,
  onClose,
  onSelect,
}) {
  const [query, setQuery] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const speciesList = useMemo(() => getUniqueSpecies(animals), [animals]);

  // Focus input on open
  const handleRef = useCallback((node) => {
    inputRef.current = node;
    if (node && open) {
      setTimeout(() => node.focus(), 100);
    }
  }, [open]);

  const results = useMemo(() => {
    let filtered = animals;

    // Species filter
    if (speciesFilter !== 'all') {
      filtered = filtered.filter((cfg) => (cfg.species || cfg.id) === speciesFilter);
    }

    // Text query
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter((cfg) => {
        const name = (cfg.displayName || cfg.name).toLowerCase();
        const species = (cfg.species || cfg.id).toLowerCase();
        const behavior = (behaviors[cfg.id] || 'idle').toLowerCase();
        return name.includes(q) || species.includes(q) || behavior.includes(q);
      });
    }

    return filtered.slice(0, 10);
  }, [query, speciesFilter, animals, behaviors]);

  const handleSelect = useCallback((id) => {
    onSelect?.(id);
    setQuery('');
    setSpeciesFilter('all');
    setActiveIndex(0);
    onClose?.();
  }, [onSelect, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setQuery('');
      setSpeciesFilter('all');
      setActiveIndex(0);
      onClose?.();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && results[activeIndex]) {
      handleSelect(results[activeIndex].id);
    }
  }, [onClose, results, activeIndex, handleSelect]);

  if (!open) return null;

  return (
    <div className="wt-search-overlay" onClick={onClose}>
      <div className="wt-search" onClick={(e) => e.stopPropagation()}>
        {/* Input row */}
        <div className="wt-search__input-row">
          <span className="wt-search__icon">🔍</span>
          <input
            ref={handleRef}
            className="wt-search__input"
            type="text"
            placeholder="Search animals…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="wt-search__kbd">ESC</kbd>
        </div>

        {/* Species filter chips */}
        <div className="wt-search__filters">
          {speciesList.map((sp) => {
            const emoji = sp === 'all' ? '🌍' : (SPECIES_EMOJIS[sp] || '🐾');
            const label = sp === 'all' ? 'All' : sp.charAt(0).toUpperCase() + sp.slice(1);
            return (
              <button
                key={sp}
                className={`wt-search__filter-chip ${speciesFilter === sp ? 'wt-search__filter-chip--active' : ''}`}
                onClick={() => { setSpeciesFilter(sp); setActiveIndex(0); }}
              >
                {emoji} {label}
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div className="wt-search__results">
          {results.map((cfg, i) => {
            const species = cfg.species || cfg.id;
            const emoji = SPECIES_EMOJIS[species] || '🐾';
            const behaviorInfo = getBehaviorDisplay(behaviors[cfg.id]);
            const isActive = i === activeIndex;
            return (
              <button
                key={cfg.id}
                className={`wt-search__result ${isActive ? 'wt-search__result--active' : ''}`}
                onClick={() => handleSelect(cfg.id)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="wt-search__result-emoji">{emoji}</span>
                <div className="wt-search__result-info">
                  <span className="wt-search__result-name">
                    {cfg.displayName || cfg.name}
                  </span>
                  <span className="wt-search__result-species">
                    {species.charAt(0).toUpperCase() + species.slice(1)}
                  </span>
                </div>
                <span
                  className="wt-search__result-status"
                  style={{ color: behaviorInfo.color }}
                >
                  {behaviorInfo.icon} {behaviorInfo.label}
                </span>
              </button>
            );
          })}
          {results.length === 0 && (
            <div className="wt-search__empty">No animals found</div>
          )}
        </div>
      </div>
    </div>
  );
}
