import React from 'react';

function LoadingState({ label = 'Loading workspace…' }) {
  return (
    <div className="lw-loading" role="status" aria-live="polite">
      <span className="lw-loading__pulse" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export default LoadingState;
