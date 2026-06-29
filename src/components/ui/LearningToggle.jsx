/**
 * LearningToggle — 📚 button to enable/disable Learning Mode.
 * When enabled, the AnimalPanel shows educational encyclopedia content.
 */
export default function LearningToggle({ active, onToggle }) {
  return (
    <button
      className={`wt-learning-toggle ${active ? 'wt-learning-toggle--active' : ''}`}
      onClick={onToggle}
      title={active ? 'Disable Learning Mode' : 'Enable Learning Mode'}
      aria-label="Toggle Learning Mode"
    >
      <span className="wt-learning-toggle__icon">📚</span>
      {active && <span className="wt-learning-toggle__label">Learn</span>}
    </button>
  );
}
