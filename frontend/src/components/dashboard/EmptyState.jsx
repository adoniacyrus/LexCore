import React from 'react';

function EmptyState({
  eyebrow = '',
  title,
  description,
  action = null,
  compact = false,
}) {
  return (
    <div className={`lw-empty ${compact ? 'lw-empty--compact' : ''}`.trim()}>
      {eyebrow ? <p className="section-tag-gold">{eyebrow}</p> : null}
      <h3 className="lw-empty__title">{title}</h3>
      {description ? <p className="lw-empty__desc">{description}</p> : null}
      {action ? <div className="lw-empty__action">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
