/**
 * AbilityChip — Action button with ripple effect and active state.
 */
export default function AbilityChip({ label, isActive = false, onClick }) {
  const handleClick = (e) => {
    // Create ripple effect
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'wt-chip-ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);

    onClick?.(label);
  };

  return (
    <button
      className={`wt-ability-chip ${isActive ? 'wt-ability-chip--active' : ''}`}
      onClick={handleClick}
      aria-pressed={isActive}
      title={`Force ${label}`}
    >
      {label}
    </button>
  );
}
