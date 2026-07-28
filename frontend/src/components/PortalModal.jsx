import React, { useState } from 'react';
import { useModals } from '../context/ModalContext';

const roles = [
  {
    id: 'admin',
    title: 'Firm Administrator',
    desc: 'System configuration, financial logs, and staff management.',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
      </svg>
    ),
  },
  {
    id: 'senior_lawyer',
    title: 'Senior Advocate',
    desc: 'Case oversight, courtroom schedules, and advisory approval.',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
      </svg>
    ),
  },
  {
    id: 'junior_lawyer',
    title: 'Junior Advocate',
    desc: 'Case files research, legal briefs drafting, and filings review.',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H3.75m0 18.75h14.25A2.25 2.25 0 0 0 20.25 18V8.25A2.25 2.25 0 0 0 18 6H12c-.528 0-1.04.114-1.503.32a1.125 1.125 0 0 0-.617.702c-.104.3-.404.53-.743.53h-.843a1.125 1.125 0 0 1-1.125-1.125v-.61a1.125 1.125 0 0 0-.616-1c-.463-.207-.975-.32-1.503-.32H3.75A2.25 2.25 0 0 0 1.5 8.25v9.75A2.25 2.25 0 0 0 3.75 20.25Z" />
      </svg>
    ),
  },
  {
    id: 'paralegal',
    title: 'Paralegal Staff',
    desc: 'Client intake database, calendar bookings, and records archive.',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 12.408.097.015c.096.015.194.022.292.022 1.1 0 1.99-.89 1.99-1.99V12c0-1.1-.89-1.99-1.99-1.99a1.99 1.99 0 0 0-2.264 2.624L6.15 15.658a1.5 1.5 0 0 0-.35.968v.172c0 .414.336.75.75.75h1.99c.354 0 .692-.125.957-.351l.884-.75Z" />
      </svg>
    ),
  },
  {
    id: 'client',
    title: 'Registered Client',
    desc: 'Secure case tracker, digital invoice payments, and file sharing.',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
];

function PortalModal() {
  const { isPortalOpen, closePortal } = useModals();
  const [selectedRole, setSelectedRole] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [clientId, setClientId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionLog, setConnectionLog] = useState('');
  const [connected, setConnected] = useState(false);

  if (!isPortalOpen) return null;

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setConnected(false);
    setConnectionLog('');
    // Prefill mock details based on role
    if (roleId === 'client') {
      setClientId('LC-2026-9841');
      setUsername('');
    } else {
      setUsername(`${roleId}@lexcore.law`);
      setPassword('••••••••••••');
      setClientId('');
    }
  };

  const handleConnect = (e) => {
    e.preventDefault();
    setIsConnecting(true);
    setConnectionLog('Initializing connection parameters...');

    setTimeout(() => {
      setConnectionLog('Establishing 256-bit TLS Handshake...');
      setTimeout(() => {
        setConnectionLog('Verifying RSA security certificates...');
        setTimeout(() => {
          setConnectionLog('Session Authenticated. Opening Gateway...');
          setTimeout(() => {
            setIsConnecting(false);
            setConnected(true);
          }, 600);
        }, 500);
      }, 500);
    }, 400);
  };

  const handleBack = () => {
    setSelectedRole(null);
    setConnected(false);
    setConnectionLog('');
  };

  return (
    <div className={`modal-overlay ${isPortalOpen ? 'active' : ''}`} onClick={closePortal}>
      <div className="modal-container-custom" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={closePortal} aria-label="Close Portal Modal">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="modal-title-custom">Legal Practice Portal</h2>
        <p className="modal-subtitle-custom">
          Secure, encrypted access point for the LexCore internal litigation & practice management platform.
        </p>

        {!selectedRole ? (
          <>
            <div style={{ marginBottom: '1.5rem', fontWeight: 500, fontFamily: 'var(--font-sans)', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
              Select Authorized Identity
            </div>
            <div className="portal-role-grid">
              {roles.map((role) => (
                <button
                  key={role.id}
                  className={`portal-role-btn ${selectedRole === role.id ? 'selected' : ''}`}
                  onClick={() => handleRoleSelect(role.id)}
                >
                  <div className="portal-role-icon">{role.icon}</div>
                  <div className="portal-role-title">{role.title}</div>
                  <div className="portal-role-desc">{role.desc}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <button 
                onClick={handleBack} 
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Change Role
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                {roles.find((r) => r.id === selectedRole)?.title} Session
              </span>
            </div>

            {connected ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', animation: 'scaleUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto', boxShadow: '0 10px 25px rgba(107, 30, 43, 0.2)' }}>
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#FFFFFF">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <h3 style={{ fontFamily: 'var(--font-headings)', fontSize: '2rem', marginBottom: '0.75rem' }}>Encrypted Link Established</h3>
                <p style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', maxWidth: '400px', margin: '0 auto 2.5rem auto' }}>
                  Secure session authorized for {selectedRole === 'client' ? 'Client ID: ' + clientId : username}. Loading legal dashboard...
                </p>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    closePortal();
                    setTimeout(() => handleBack(), 300);
                  }}
                >
                  Enter Workspace
                </button>
              </div>
            ) : (
              <form onSubmit={handleConnect} className="booking-form">
                {selectedRole === 'client' ? (
                  <div className="form-group-custom">
                    <label htmlFor="clientId">Client Account ID</label>
                    <input
                      id="clientId"
                      type="text"
                      className="form-control-custom"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                      placeholder="e.g., LC-2026-9841"
                      disabled={isConnecting}
                    />
                  </div>
                ) : (
                  <>
                    <div className="form-group-custom">
                      <label htmlFor="portalUsername">Staff Email Address</label>
                      <input
                        id="portalUsername"
                        type="email"
                        className="form-control-custom"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        disabled={isConnecting}
                      />
                    </div>
                    <div className="form-group-custom">
                      <label htmlFor="portalPassword">Portal Password</label>
                      <input
                        id="portalPassword"
                        type="password"
                        className="form-control-custom"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isConnecting}
                      />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid var(--color-border)', padding: '1rem', marginTop: '0.5rem', backgroundColor: '#FFFFFF' }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--color-accent)">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0V10.5m-3.75 3h15.008M12 18v3m0 0H9m3 0h3m-9-3H5.25A2.25 2.25 0 0 0 3 20.25v3.5m18-3.5a2.25 2.25 0 0 0-2.25-2.25H5.25m13.5 0V14.25a2.25 2.25 0 0 0-2.25-2.25H7.5a2.25 2.25 0 0 0-2.25 2.25v3.75M12 14.25h.008v.008H12v-.008Z" />
                  </svg>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    End-to-End TLS Session active. Secure client/staff validation is audited by LexCore Compliance.
                  </span>
                </div>

                {isConnecting && (
                  <div style={{ padding: '1rem', borderLeft: '3px solid var(--color-accent)', backgroundColor: '#FFFFFF', animation: 'pulse 1.5s infinite', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: 'var(--color-accent)' }}>Portal Connection Logs</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text)', fontFamily: 'monospace', marginTop: '0.25rem' }}>{connectionLog}</div>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem', display: 'flex', justifyContent: 'center' }}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Secure Authorization'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="portal-login-footer">
          Authorized operations only. All connection attempts, IP addresses, and digital actions are logged and encrypted. For portal support, contact the system administrator.
        </div>
      </div>
    </div>
  );
}

export default PortalModal;
