import React from 'react';

/** Compact brief metric — not an analytics KPI chart */
function StatCard({ label, value }) {
  return (
    <article className="lw-stat">
      <p className="lw-stat__value">{value}</p>
      <p className="lw-stat__label">{label}</p>
    </article>
  );
}

export default StatCard;
