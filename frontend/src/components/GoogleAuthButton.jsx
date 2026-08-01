import React, { useEffect, useRef, useState } from 'react';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisLoadPromise = null;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In.')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In.'));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

/**
 * Google Identity Services button.
 * intent: "login" | "register" — forwarded to parent with the ID token.
 */
function GoogleAuthButton({ intent = 'login', onCredential, onError, disabled = false, label }) {
  const hostRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState('');
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const callbackRef = useRef({ onCredential, onError });

  useEffect(() => {
    callbackRef.current = { onCredential, onError };
  }, [onCredential, onError]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!clientId) {
        setUnavailable('Google Sign-In is not configured (missing VITE_GOOGLE_CLIENT_ID).');
        return;
      }

      try {
        await loadGoogleIdentityServices();
        if (cancelled || !hostRef.current || !window.google?.accounts?.id) return;

        hostRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response?.credential) {
              callbackRef.current.onError?.('Google Sign-In was cancelled or failed.');
              return;
            }
            callbackRef.current.onCredential?.(response.credential, intent);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: intent === 'register' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          width: Math.min(hostRef.current.offsetWidth || 320, 400),
          logo_alignment: 'left',
        });

        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          setUnavailable(err?.message || 'Google Sign-In is unavailable.');
        }
      }
    }

    setup();
    return () => {
      cancelled = true;
    };
  }, [clientId, intent]);

  return (
    <div className={`auth-google ${disabled ? 'is-disabled' : ''}`}>
      <div className="auth-divider" role="separator">
        <span>{label || 'Or continue with Google'}</span>
      </div>
      {unavailable ? (
        <p className="auth-google-note" role="status">{unavailable}</p>
      ) : (
        <div
          ref={hostRef}
          className="auth-google-host"
          aria-hidden={!ready}
          style={{ pointerEvents: disabled ? 'none' : 'auto', opacity: disabled ? 0.55 : 1 }}
        />
      )}
    </div>
  );
}

export default GoogleAuthButton;
