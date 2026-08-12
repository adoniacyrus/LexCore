import React from 'react';

/** Minimal line icons for the legal workspace shell */
export function NavIcon({ name, className = '' }) {
  // Stroke weight / caps match auth back-chevron and practice panel icons
  const props = {
    className: `lw-icon ${className}`.trim(),
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3.5" />
          <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35" />
          <path d="M16.5 3.7a3.5 3.5 0 0 1 0 6.6" />
        </svg>
      );
    case 'clients':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'cases':
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="13" rx="1.5" />
          <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
        </svg>
      );
    case 'hearings':
      return (
        <svg {...props}>
          <path d="M12 3v18" />
          <path d="M5 8h14" />
          <path d="M7 8v4a5 5 0 0 0 10 0V8" />
        </svg>
      );
    case 'consultations':
      return (
        <svg {...props}>
          <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H4l2.2-3.1A8.5 8.5 0 1 1 21 12Z" />
        </svg>
      );
    case 'documents':
      return (
        <svg {...props}>
          <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path d="M14 3v5h5" />
        </svg>
      );
    case 'tasks':
      return (
        <svg {...props}>
          <path d="M9 11.5 11 13.5 15.5 9" />
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
          <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...props}>
          <path d="M5 19V10M12 19V5M19 19v-7" />
        </svg>
      );
    case 'billing':
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="12" rx="1.5" />
          <path d="M3 10h18" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2.2M12 18.3v2.2M4.7 7.2l1.6 1.5M17.7 15.3l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.7 16.8l1.6-1.5M17.7 8.7l1.6-1.5" />
        </svg>
      );
    case 'messages':
      return (
        <svg {...props}>
          <path d="M4 6h16v10H8l-4 3V6Z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...props}>
          <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5Z" />
          <path d="M10 18.5a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...props}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case 'close':
      return (
        <svg {...props}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...props}>
          <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" />
          <path d="M14 12H8" />
          <path d="M16 8l4 4-4 4" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...props}>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...props}>
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
  }
}
