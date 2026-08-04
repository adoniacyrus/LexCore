import React from 'react';

function EmptyState({ title, description, action = null }) {
  return (
    <div className="lw-empty">
      <h3 className="lw-empty__title">{title}</h3>
      {description ? <p className="lw-empty__desc">{description}</p> : null}
      {action}
    </div>
  );
}

export default EmptyState;
