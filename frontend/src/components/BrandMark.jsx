import React from 'react';

/** Shared LexCore scale mark — same path as landing Navbar and AuthLayout */
export const LEXCORE_MARK_PATH =
  'M12 2a1 1 0 0 1 1 1v1.075c3.541.25 6.368 3.077 6.618 6.618H21a1 1 0 1 1 0 2h-1.382c-.25 3.541-3.077 6.368-6.618 6.618V21a1 1 0 1 1-2 0v-2.69c-3.541-.25-6.368-3.077-6.618-6.618H3a1 1 0 1 1 0-2h1.382c.25-3.541 3.077-6.368 6.618-6.618V3a1 1 0 0 1 1-1zm0 4.09c-2.458.243-4.42 2.204-4.662 4.662h9.324c-.243-2.458-2.204-4.42-4.662-4.662zm-4.662 6.662c.243 2.458 2.204 4.42 4.662 4.662v-4.662H7.338zm6.662 4.662c2.458-.243 4.42-2.204 4.662-4.662h-4.662v4.662z';

function BrandMark({ className = '', size = 'md' }) {
  return (
    <span className={`lex-brand-mark lex-brand-mark--${size} ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={LEXCORE_MARK_PATH} />
      </svg>
    </span>
  );
}

export default BrandMark;
