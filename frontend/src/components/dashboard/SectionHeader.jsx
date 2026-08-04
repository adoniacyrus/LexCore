import React from 'react';

function SectionHeader({ title, description, action = null }) {
  return (
    <div className="lw-section-header">
      <div>
        <h2 className="lw-section-title">{title}</h2>
        {description ? <p className="lw-section-desc auth-sheet-lede">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;
