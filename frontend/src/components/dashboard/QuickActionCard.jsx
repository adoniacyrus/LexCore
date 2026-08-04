import React from 'react';
import { Link } from 'react-router-dom';
import { NavIcon } from './icons';

function QuickActionCard({ label, description, icon, to, comingSoon = false, onClick }) {
  const inner = (
    <>
      <span className="lw-qa__icon">
        <NavIcon name={icon} />
      </span>
      <span className="lw-qa__copy">
        <span className="lw-qa__label">{label}</span>
        <span className="lw-qa__desc">{description}</span>
      </span>
      {comingSoon ? <span className="lw-badge">Coming Soon</span> : null}
    </>
  );

  if (to && !comingSoon) {
    return (
      <Link to={to} className="lw-qa">
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`lw-qa ${comingSoon ? 'is-soon' : ''}`.trim()}
      onClick={onClick}
      disabled={comingSoon}
      aria-disabled={comingSoon || undefined}
    >
      {inner}
    </button>
  );
}

export default QuickActionCard;
