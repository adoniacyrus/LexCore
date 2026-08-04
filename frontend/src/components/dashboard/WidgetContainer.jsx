import React from 'react';

function WidgetContainer({ title, description, action = null, children, className = '' }) {
  return (
    <section className={`lw-widget ${className}`.trim()}>
      {(title || action) && (
        <div className="lw-widget__head">
          <div>
            {title ? <h2 className="lw-section-title">{title}</h2> : null}
            {description ? <p className="lw-section-desc">{description}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="lw-widget__body">{children}</div>
    </section>
  );
}

export default WidgetContainer;
