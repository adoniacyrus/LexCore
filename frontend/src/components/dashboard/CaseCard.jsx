import React from 'react';

function CaseCard({
  name,
  caseNumber,
  court,
  status,
  priority,
  team = [],
  nextHearing,
  progress = 0,
  onOpen,
}) {
  return (
    <article className="lw-case">
      <div className="lw-case__top">
        <div>
          <h3 className="lw-case__name">{name}</h3>
          <p className="lw-case__number">{caseNumber}</p>
        </div>
        <span className={`lw-priority lw-priority--${String(priority).toLowerCase()}`}>
          {priority}
        </span>
      </div>

      <dl className="lw-case__meta">
        <div>
          <dt>Court</dt>
          <dd>{court}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
        <div>
          <dt>Next Hearing</dt>
          <dd>{nextHearing}</dd>
        </div>
      </dl>

      <div className="lw-case__team">
        <span className="lw-case__team-label">Assigned Team</span>
        <p>{team.join(' · ') || '—'}</p>
      </div>

      <div className="lw-case__progress" aria-label={`Progress ${progress}%`}>
        <div className="lw-case__progress-track">
          <div className="lw-case__progress-bar" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <span>{progress}%</span>
      </div>

      <button type="button" className="btn btn-ghost-dark lw-case__open" onClick={onOpen}>
        Open Matter
      </button>
    </article>
  );
}

export default CaseCard;
