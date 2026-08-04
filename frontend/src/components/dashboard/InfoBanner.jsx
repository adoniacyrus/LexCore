import React from 'react';

function InfoBanner({ children, tone = 'neutral' }) {
  return <div className={`lw-info-banner lw-info-banner--${tone}`}>{children}</div>;
}

export default InfoBanner;
