import React, { useState, useRef, useEffect } from 'react';
import { useCaseChat } from '../../hooks/useCaseChat';

function formatChatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${timeStr} · ${dateStr}`;
  } catch {
    return isoString;
  }
}

function getRoleBadge(role) {
  switch (role) {
    case 'ADMIN':
      return { label: 'Admin', bg: '#fee2e2', color: '#991b1b' };
    case 'SENIOR_LAWYER':
      return { label: 'Lead Counsel', bg: '#fef3c7', color: '#92400e' };
    case 'JUNIOR_LAWYER':
      return { label: 'Advocate', bg: '#fef3c7', color: '#92400e' };
    case 'PARALEGAL':
      return { label: 'Paralegal', bg: '#e0e7ff', color: '#3730a3' };
    case 'CLIENT':
      return { label: 'Client', bg: '#f3f4f6', color: '#374151' };
    default:
      return { label: role || 'Member', bg: '#f3f4f6', color: '#4b5563' };
  }
}

export default function CaseChatPanel({ caseReference, accessToken, currentUser }) {
  const { messages, loading, error, connectionStatus, sendMessage } = useCaseChat(
    caseReference,
    accessToken
  );
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const content = inputText.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      await sendMessage(content);
      setInputText('');
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.72rem',
              color: '#047857',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)',
              }}
            />
            Live
          </span>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.72rem',
              color: '#b45309',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
              }}
            />
            {connectionStatus === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.72rem',
              color: '#6b7280',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#9ca3af',
              }}
            />
            Offline
          </span>
        );
    }
  };

  return (
    <section
      className="case-section"
      aria-labelledby="section-case-chat"
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '1.25rem',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--border-radius-sm)',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: '#faf9f6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h2
            id="section-case-chat"
            className="case-section__title"
            style={{ margin: 0, fontSize: '0.95rem' }}
          >
            Case Communications
          </h2>
          <span
            style={{
              fontSize: '0.68rem',
              color: '#6b7280',
              background: '#edebe8',
              padding: '0.1rem 0.45rem',
              borderRadius: '10px',
              fontWeight: 500,
            }}
          >
            Authorized Participants
          </span>
        </div>
        <div>{getStatusIndicator()}</div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div
          style={{
            padding: '0.45rem 0.85rem',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            fontSize: '0.76rem',
            borderBottom: '1px solid #fee2e2',
          }}
        >
          {error}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        style={{
          height: '320px',
          maxHeight: '320px',
          overflowY: 'auto',
          padding: '0.85rem 1rem',
          backgroundColor: '#fdfcfb',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        {loading ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: '#888280',
              fontSize: '0.82rem',
            }}
          >
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '0.82rem',
              maxWidth: '320px',
              lineHeight: 1.4,
            }}
          >
            No communications recorded yet for this case. Start the discussion between assigned counsel
            and client below.
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = currentUser && msg.sender_id === currentUser.id;
            const badge = getRoleBadge(msg.sender_role);

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isSelf ? 'flex-end' : 'flex-start',
                  maxWidth: '100%',
                }}
              >
                {/* Sender info */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginBottom: '0.2rem',
                    fontSize: '0.72rem',
                    color: '#6b7280',
                  }}
                >
                  <span style={{ fontWeight: 600, color: isSelf ? 'var(--color-primary)' : '#374151' }}>
                    {isSelf ? 'You' : msg.sender_name}
                  </span>
                  {badge && (
                    <span
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 600,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        padding: '0.05rem 0.35rem',
                        borderRadius: '4px',
                      }}
                    >
                      {badge.label}
                    </span>
                  )}
                  <span style={{ fontSize: '0.66rem', color: '#9ca3af' }}>
                    {formatChatTimestamp(msg.created_at)}
                  </span>
                </div>

                {/* Bubble */}
                <div
                  style={{
                    maxWidth: '82%',
                    padding: '0.55rem 0.85rem',
                    borderRadius: isSelf ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    backgroundColor: isSelf ? 'var(--color-primary)' : '#ffffff',
                    color: isSelf ? '#ffffff' : '#1f2937',
                    border: isSelf ? '1px solid var(--color-primary)' : '1px solid #e5e7eb',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    fontSize: '0.84rem',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 0.85rem',
          borderTop: '1px solid var(--color-border)',
          backgroundColor: '#faf9f6',
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a case update or message… (Enter to send)"
          disabled={sending}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            fontSize: '0.84rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: '#fff',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || !inputText.trim()}
          style={{
            fontSize: '0.82rem',
            padding: '0.5rem 1rem',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          {sending ? (
            'Sending…'
          ) : (
            <>
              Send
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </>
          )}
        </button>
      </form>
    </section>
  );
}
