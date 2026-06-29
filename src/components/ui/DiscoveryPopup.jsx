import { useState, useEffect, useRef } from 'react';
import { SPECIES_EMOJIS } from '../../config/designTokens';
import { getSpeciesData } from '../../config/speciesEncyclopedia';

const DISCOVERED_KEY = 'wild-trails:discovered-species';

function getDiscoveredSpecies() {
  try {
    const data = localStorage.getItem(DISCOVERED_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveDiscoveredSpecies(list) {
  try {
    localStorage.setItem(DISCOVERED_KEY, JSON.stringify(list));
  } catch { /* silent */ }
}

/**
 * DiscoveryPopup — Shows a brief "You discovered X!" notification
 * when an animal species is selected for the first time.
 */
export default function DiscoveryPopup({ selectedAnimalId }) {
  const [popup, setPopup] = useState(null);
  const discoveredRef = useRef(getDiscoveredSpecies());
  const hideTimer = useRef(null);

  useEffect(() => {
    if (!selectedAnimalId) return;
    const baseSpecies = selectedAnimalId.replace(/-\d+$/, '');
    
    if (discoveredRef.current.includes(baseSpecies)) return;
    
    // New species discovered!
    discoveredRef.current.push(baseSpecies);
    saveDiscoveredSpecies(discoveredRef.current);

    const speciesData = getSpeciesData(selectedAnimalId);
    const emoji = SPECIES_EMOJIS[baseSpecies] || '🐾';
    const name = speciesData?.commonName || baseSpecies;

    setPopup({ emoji, name, key: Date.now() });

    // Auto-dismiss after 4s
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPopup(null), 4000);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [selectedAnimalId]);

  if (!popup) return null;

  return (
    <div className="wt-discovery-popup" key={popup.key}>
      <div className="wt-discovery-popup__content">
        <span className="wt-discovery-popup__emoji">{popup.emoji}</span>
        <div className="wt-discovery-popup__text">
          <span className="wt-discovery-popup__title">New Discovery!</span>
          <span className="wt-discovery-popup__name">You discovered the {popup.name}!</span>
        </div>
      </div>
    </div>
  );
}

export { getDiscoveredSpecies };
