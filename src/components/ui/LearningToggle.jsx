import { GraduationCap } from 'lucide-react';

/**
 * LearningToggle — enables/disables Learning Mode.
 * When enabled, the AnimalPanel shows educational encyclopedia content.
 */
export default function LearningToggle({ active, onToggle }) {
  return (
    <button
      className={`wt-learning-toggle ${active ? 'wt-learning-toggle--active' : ''}`}
      onClick={onToggle}
      title={active ? 'Disable Learning Mode' : 'Enable Learning Mode'}
      aria-label="Toggle Learning Mode"
      data-tooltip="Show educational facts and species details"
    >
      <span className="wt-learning-toggle__icon"><GraduationCap aria-hidden="true" /></span>
      {active && <span className="wt-learning-toggle__label">Learn</span>}
    </button>
  );
}
