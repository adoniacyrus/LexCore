import React from 'react';

function PageHeader({ eyebrow, title, description, actions = null }) {
  return (
    <header className="lw-page-header">
      <div className="lw-page-header__copy">
        {eyebrow ? <p className="section-tag-gold">{eyebrow}</p> : null}
        <h1 className="lw-page-title section-headline">{title}</h1>
        {description ? <p className="lw-page-desc auth-sheet-lede">{description}</p> : null}
      </div>
      {actions ? <div className="lw-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
