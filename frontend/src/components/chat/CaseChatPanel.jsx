import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useCaseChat } from '../../hooks/useCaseChat';
import { getAvailableChats, CONVERSATION_TYPES } from '../../utils/chatHelpers';

function formatChatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return isoString;
  }
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(type, name) {
  if (type && type.startsWith('image/')) return true;
  if (name) {
    const ext = name.toLowerCase().split('.').pop();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
  }
  return false;
}

function isPdfAttachment(type, name) {
  if (type === 'application/pdf') return true;
  if (name && name.toLowerCase().endsWith('.pdf')) return true;
  return false;
}

function getRoleBadge(role, conversationType) {
  if (conversationType === CONVERSATION_TYPES.CLIENT_LAWYER) {
    if (role === 'CLIENT') {
      return { label: 'Client', bg: '#f3f4f6', color: '#374151' };
    }
    return { label: 'Lead Counsel', bg: '#fef3c7', color: '#92400e' };
  }

  // Inside Team Chat:
  switch (role) {
    case 'ADMIN':
      return { label: 'Admin', bg: '#fee2e2', color: '#991b1b' };
    case 'SENIOR_LAWYER':
      return { label: 'Lead / Supervising Counsel', bg: '#fef3c7', color: '#92400e' };
    case 'JUNIOR_LAWYER':
      return { label: 'Advocate', bg: '#fef3c7', color: '#92400e' };
    case 'PARALEGAL':
      return { label: 'Paralegal', bg: '#e0e7ff', color: '#3730a3' };
    default:
      return { label: role || 'Team Member', bg: '#f3f4f6', color: '#4b5563' };
  }
}

export function resolveMediaUrl(url) {
  if (!url) return '';
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/media/')) {
        return parsed.pathname;
      }
    }
  } catch {
    // ignore
  }
  return url;
}

function AttachmentPreviewModal({ preview, accessToken, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blobUrl, setBlobUrl] = useState(null);

  const isPdf = isPdfAttachment(preview?.type, preview?.name);
  const isImg = isImageAttachment(preview?.type, preview?.name);

  // Keyboard close handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load binary blob securely (bypasses cross-origin/X-Frame-Options in iframes)
  useEffect(() => {
    let active = true;
    let localBlobUrl = null;

    if (!preview?.url) {
      setLoading(false);
      return;
    }

    if (!isPdf && !isImg) {
      setLoading(false);
      return;
    }

    const loadAttachmentBlob = async () => {
      setLoading(true);
      setError('');
      try {
        const fetchUrl = resolveMediaUrl(preview.url);
        const headers = {};
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
        const res = await fetch(fetchUrl, { headers });
        if (!res.ok) {
          throw new Error(`Failed to load document (${res.status} ${res.statusText})`);
        }
        const blobData = await res.blob();
        if (!active) return;

        let mimeType = preview.type;
        if (isPdf) {
          mimeType = 'application/pdf';
        } else if (isImg && (!mimeType || mimeType === 'file')) {
          mimeType = blobData.type || 'image/png';
        }

        const typedBlob = mimeType ? new Blob([blobData], { type: mimeType }) : blobData;
        localBlobUrl = URL.createObjectURL(typedBlob);
        setBlobUrl(localBlobUrl);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load attachment blob:', err);
        setError('Direct in-browser preview could not be loaded. You can still download the file below.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadAttachmentBlob();

    return () => {
      active = false;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [preview, accessToken, isPdf, isImg]);

  const handleDownload = async () => {
    try {
      let downloadHref = blobUrl;
      let cleanup = false;
      if (!downloadHref) {
        const fetchUrl = resolveMediaUrl(preview.url);
        const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        const res = await fetch(fetchUrl, { headers });
        const blobData = await res.blob();
        downloadHref = URL.createObjectURL(blobData);
        cleanup = true;
      }
      const a = document.createElement('a');
      a.href = downloadHref;
      a.download = preview.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (cleanup) {
        setTimeout(() => URL.revokeObjectURL(downloadHref), 1000);
      }
    } catch {
      const a = document.createElement('a');
      a.href = resolveMediaUrl(preview.url);
      a.download = preview.name || 'download';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenInNewTab = () => {
    const targetUrl = blobUrl || resolveMediaUrl(preview.url);
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'lexcoreFadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '860px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
            <h3
              id="preview-modal-title"
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#0f172a',
                wordBreak: 'break-all',
                lineHeight: 1.35,
              }}
            >
              {preview.name || 'Attachment'}
            </h3>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#64748b',
                marginTop: '0.2rem',
                fontWeight: 500,
              }}
            >
              {preview.type || 'file'}
              {preview.size ? ` · ${formatFileSize(preview.size)}` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {blobUrl && isPdf && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                title="Open in new browser tab"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              >
                <span>New Tab</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.35rem',
                lineHeight: 1,
                color: '#64748b',
                cursor: 'pointer',
                padding: '0.2rem 0.4rem',
                borderRadius: '6px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0f172a')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body Preview Area */}
        <div
          style={{
            flex: 1,
            minHeight: '280px',
            maxHeight: '68vh',
            overflow: 'auto',
            padding: '1.25rem',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <div style={{ padding: '3.5rem 2rem', textAlign: 'center', margin: 'auto' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  border: '3px solid rgba(107,30,43,0.15)',
                  borderTopColor: '#6b1e2b',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem',
                }}
              />
              <div style={{ fontWeight: 600, color: '#6b1e2b', fontSize: '0.92rem' }}>
                Loading document preview…
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
                Rendering file securely
              </div>
            </div>
          ) : isImg && (blobUrl || preview.url) ? (
            <img
              src={blobUrl || resolveMediaUrl(preview.url)}
              alt={preview.name || 'Attachment'}
              style={{
                maxWidth: '100%',
                maxHeight: '64vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
                background: '#ffffff',
              }}
            />
          ) : isPdf && blobUrl ? (
            <iframe
              src={`${blobUrl}#view=FitH`}
              title={preview.name || 'Document'}
              style={{
                width: '100%',
                height: '64vh',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
              }}
            />
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1.75rem',
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                maxWidth: '440px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                margin: 'auto',
              }}
            >
              <div style={{ fontSize: '3.5rem', marginBottom: '0.8rem' }}>📎</div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '1rem',
                  color: '#1e293b',
                  wordBreak: 'break-all',
                  marginBottom: '0.4rem',
                }}
              >
                {preview.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
                {preview.type || 'file'} {preview.size ? `· ${formatFileSize(preview.size)}` : ''}
              </div>
              <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 1.25rem' }}>
                {error || 'Direct in-browser preview is not available for this file type. Click Download below to open.'}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  padding: '0.55rem 1.4rem',
                  backgroundColor: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)',
                }}
              >
                Download File
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          {blobUrl && isPdf && (
            <button
              type="button"
              onClick={handleOpenInNewTab}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.15rem',
                borderRadius: '6px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                fontWeight: 600,
                fontSize: '0.86rem',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            >
              <span>Open in New Tab</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.35rem',
              borderRadius: '6px',
              backgroundColor: '#7c3aed',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(124, 58, 237, 0.25)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#6d28d9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#7c3aed')}
          >
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1.35rem',
              borderRadius: '6px',
              backgroundColor: '#475569',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#475569')}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CaseChatPanel({ caseData, caseReference, accessToken, currentUser }) {
  const caseRef = caseData?.case_reference || caseReference;

  // Determine authorized chats for the authenticated user on this case
  const availableChats = useMemo(() => {
    return getAvailableChats(caseData, currentUser);
  }, [caseData, currentUser]);

  // Which chat is currently opened in the floating window (null = minimized)
  const [activeChat, setActiveChat] = useState(null);

  // Attachment preview modal state ({ url, name, size, type })
  const [previewModal, setPreviewModal] = useState(null);

  // Staged file attachment for the next message
  const [selectedFile, setSelectedFile] = useState(null);

  const fileInputRef = useRef(null);

  // If activeChat is open but role loses access, ensure valid selection
  useEffect(() => {
    if (activeChat && !availableChats.includes(activeChat)) {
      setActiveChat(null);
    }
  }, [availableChats, activeChat]);

  // Hook connection for the active chat channel
  const conversationSlug = activeChat === CONVERSATION_TYPES.TEAM ? 'team' : 'client';
  const { messages, loading, error, connectionStatus, sendMessage } = useCaseChat(
    caseRef,
    accessToken,
    activeChat ? conversationSlug : null
  );

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeChat) {
      scrollToBottom();
    }
  }, [messages, activeChat]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const content = inputText.trim();
    if ((!content && !selectedFile) || sending) return;

    setSending(true);
    try {
      await sendMessage(content, selectedFile);
      setInputText('');
      handleRemoveFile();
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

  const handleDownloadFile = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'downloaded-file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'downloaded-file';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // If user cannot access any chat, render nothing
  if (!availableChats || availableChats.length === 0) {
    return null;
  }

  // Header and subheader details
  const respLawyerName =
    caseData?.responsible_lawyer?.full_name ||
    caseData?.responsible_lawyer_name ||
    'Lead Counsel';

  const isClientChat = activeChat === CONVERSATION_TYPES.CLIENT_LAWYER;
  const isTeamChat = activeChat === CONVERSATION_TYPES.TEAM;

  const headerTitle = isClientChat ? 'Client Chat' : 'Team Chat';
  const headerSubtitle = isClientChat
    ? `${respLawyerName} · Lead Counsel`
    : 'Internal case discussion';

  const hasBothChats =
    availableChats.includes(CONVERSATION_TYPES.CLIENT_LAWYER) &&
    availableChats.includes(CONVERSATION_TYPES.TEAM);

  const getStatusDot = () => {
    if (connectionStatus === 'connected') {
      return (
        <span
          title="Connected (Live)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.7rem',
            color: '#a7f3d0',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)',
            }}
          />
          Live
        </span>
      );
    }
    if (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') {
      return (
        <span
          title="Connecting"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.7rem',
            color: '#fef08a',
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
          Connecting
        </span>
      );
    }
    return (
      <span
        title="Offline"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.7rem',
          color: '#cbd5e1',
        }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: '#94a3b8',
          }}
        />
        Offline
      </span>
    );
  };

  return (
    <>
      {/* =========================================================================
          ATTACHMENT PREVIEW / DOWNLOAD MODAL (Matches user reference design)
      ========================================================================= */}
      {previewModal && (
        <AttachmentPreviewModal
          preview={previewModal}
          accessToken={accessToken}
          onClose={() => setPreviewModal(null)}
        />
      )}

      {/* =========================================================================
          FLOATING CHAT CONTAINER
      ========================================================================= */}
      <div
        className="lexcore-floating-chat-container"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '28px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '10px',
          pointerEvents: 'none',
        }}
      >
        {/* 1. FLOATING CHAT WINDOW (Shown when activeChat is selected) */}
        {activeChat && (
          <div
            className="lexcore-chat-window"
            role="region"
            aria-label={`${headerTitle} Panel`}
            style={{
              pointerEvents: 'auto',
              width: '385px',
              maxWidth: 'calc(100vw - 32px)',
              height: '520px',
              maxHeight: 'calc(100vh - 120px)',
              background: '#ffffff',
              borderRadius: '14px',
              boxShadow: '0 16px 38px -6px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(107, 30, 43, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: 0,
              margin: 0,
              marginBottom: '4px',
              animation: 'lexcoreChatPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #6b1e2b 0%, #521620 100%)',
                color: '#ffffff',
                padding: '0.75rem 0.95rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                borderBottom: '1px solid rgba(197, 155, 39, 0.3)',
                flexShrink: 0,
              }}
            >
              {/* Top Row: Title, Live Status, Close */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '0.94rem',
                      fontWeight: 700,
                      letterSpacing: '0.01em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>{isClientChat ? '💬' : '👥'}</span>
                    <span>{headerTitle}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: '#f3e8ea',
                      marginTop: '2px',
                      fontWeight: 500,
                    }}
                  >
                    {headerSubtitle}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getStatusDot()}
                  <button
                    type="button"
                    onClick={() => setActiveChat(null)}
                    title="Minimize chat"
                    aria-label="Minimize chat"
                    style={{
                      background: 'rgba(255, 255, 255, 0.16)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '6px',
                      width: '28px',
                      height: '28px',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      lineHeight: 1,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.32)';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Quick Switch Tabs for Responsible Lawyer who has BOTH chats */}
              {hasBothChats && (
                <div
                  style={{
                    display: 'flex',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '6px',
                    padding: '2px',
                    gap: '2px',
                    marginTop: '2px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveChat(CONVERSATION_TYPES.CLIENT_LAWYER)}
                    style={{
                      flex: 1,
                      padding: '0.28rem 0.5rem',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: isClientChat ? 700 : 500,
                      cursor: 'pointer',
                      background: isClientChat ? '#ffffff' : 'transparent',
                      color: isClientChat ? '#6b1e2b' : '#f5e8ea',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    💬 Client Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChat(CONVERSATION_TYPES.TEAM)}
                    style={{
                      flex: 1,
                      padding: '0.28rem 0.5rem',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: isTeamChat ? 700 : 500,
                      cursor: 'pointer',
                      background: isTeamChat ? '#ffffff' : 'transparent',
                      color: isTeamChat ? '#6b1e2b' : '#f5e8ea',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    👥 Team Chat
                  </button>
                </div>
              )}
            </div>

            {/* Error Banner */}
            {error && (
              <div
                style={{
                  padding: '0.4rem 0.8rem',
                  backgroundColor: '#fef2f2',
                  color: '#991b1b',
                  fontSize: '0.74rem',
                  borderBottom: '1px solid #fee2e2',
                }}
              >
                {error}
              </div>
            )}

            {/* Messages Scroll Area */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '0.85rem 0.95rem',
                backgroundColor: '#fdfcfb',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              {loading ? (
                <div
                  style={{
                    margin: 'auto',
                    textAlign: 'center',
                    color: '#888280',
                    fontSize: '0.8rem',
                  }}
                >
                  Loading conversation…
                </div>
              ) : messages.length === 0 ? (
                <div
                  style={{
                    margin: 'auto',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '0.8rem',
                    maxWidth: '260px',
                    lineHeight: 1.45,
                  }}
                >
                  {isClientChat ? (
                    <>
                      No client messages recorded yet.
                      <br />
                      Direct dialogue between lead counsel and client.
                    </>
                  ) : (
                    <>
                      No internal team discussions recorded yet.
                      <br />
                      Internal collaboration between case team members.
                    </>
                  )}
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelf = currentUser && msg.sender_id === currentUser.id;
                  const badge = getRoleBadge(msg.sender_role, activeChat);
                  const hasImage = isImageAttachment(msg.attachment_type, msg.attachment_name);
                  const hasAttachment = Boolean(msg.attachment_url || msg.attachment);

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
                      {/* Sender meta */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          marginBottom: '0.2rem',
                          fontSize: '0.68rem',
                          color: '#6b7280',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: isSelf ? 'var(--color-primary, #6b1e2b)' : '#374151',
                          }}
                        >
                          {isSelf ? 'You' : msg.sender_name}
                        </span>
                        {badge && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 600,
                              backgroundColor: badge.bg,
                              color: badge.color,
                              padding: '0.02rem 0.32rem',
                              borderRadius: '3px',
                            }}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>

                      {/* Chat Bubble / Image Card */}
                      {hasAttachment && hasImage ? (
                        // Image Thumbnail Bubble (styled with sleek border and preview click)
                        <div
                          style={{
                            maxWidth: '85%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            alignItems: isSelf ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div
                            onClick={() =>
                              setPreviewModal({
                                url: msg.attachment_url || msg.attachment,
                                name: msg.attachment_name,
                                size: msg.attachment_size,
                                type: msg.attachment_type,
                              })
                            }
                            title="Click to view and download"
                            style={{
                              padding: '4px',
                              borderRadius: '12px',
                              border: isSelf ? '3px solid #6b1e2b' : '2px solid #e2e8f0',
                              backgroundColor: '#ffffff',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.02)';
                              e.currentTarget.style.boxShadow = '0 6px 16px rgba(107, 30, 43, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                            }}
                          >
                            <img
                              src={resolveMediaUrl(msg.attachment_url || msg.attachment)}
                              alt={msg.attachment_name || 'Attachment'}
                              style={{
                                display: 'block',
                                maxWidth: '240px',
                                maxHeight: '160px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                              }}
                            />
                          </div>

                          {/* Accompanying text if any */}
                          {msg.content && (
                            <div
                              style={{
                                padding: '0.45rem 0.75rem',
                                borderRadius: isSelf ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                                backgroundColor: isSelf ? 'var(--color-primary, #6b1e2b)' : '#ffffff',
                                color: isSelf ? '#ffffff' : '#1f2937',
                                border: isSelf ? '1px solid var(--color-primary, #6b1e2b)' : '1px solid #e5e7eb',
                                fontSize: '0.82rem',
                                lineHeight: 1.4,
                              }}
                            >
                              {msg.content}
                            </div>
                          )}
                        </div>
                      ) : hasAttachment ? (
                        // Document / File Card Bubble
                        <div
                          style={{
                            maxWidth: '85%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.3rem',
                            alignItems: isSelf ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <div
                            onClick={() =>
                              setPreviewModal({
                                url: msg.attachment_url || msg.attachment,
                                name: msg.attachment_name,
                                size: msg.attachment_size,
                                type: msg.attachment_type,
                              })
                            }
                            title="Click to view file"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.6rem',
                              padding: '0.55rem 0.8rem',
                              borderRadius: isSelf ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              backgroundColor: isSelf ? 'var(--color-primary, #6b1e2b)' : '#ffffff',
                              color: isSelf ? '#ffffff' : '#1f2937',
                              border: isSelf ? '1px solid #521620' : '1px solid #e2e8f0',
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                              transition: 'transform 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                          >
                            <span style={{ fontSize: '1.4rem' }}>📄</span>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '180px',
                                }}
                              >
                                {msg.attachment_name || 'Document'}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.68rem',
                                  color: isSelf ? '#f3e8ea' : '#64748b',
                                }}
                              >
                                {formatFileSize(msg.attachment_size)}
                              </div>
                            </div>
                          </div>

                          {/* Accompanying text */}
                          {msg.content && (
                            <div
                              style={{
                                padding: '0.45rem 0.75rem',
                                borderRadius: isSelf ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                                backgroundColor: isSelf ? 'var(--color-primary, #6b1e2b)' : '#ffffff',
                                color: isSelf ? '#ffffff' : '#1f2937',
                                border: isSelf ? '1px solid var(--color-primary, #6b1e2b)' : '1px solid #e5e7eb',
                                fontSize: '0.82rem',
                                lineHeight: 1.4,
                              }}
                            >
                              {msg.content}
                            </div>
                          )}
                        </div>
                      ) : (
                        // Standard Text Bubble
                        <div
                          style={{
                            maxWidth: '85%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: isSelf ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            backgroundColor: isSelf ? 'var(--color-primary, #6b1e2b)' : '#ffffff',
                            color: isSelf ? '#ffffff' : '#1f2937',
                            border: isSelf ? '1px solid var(--color-primary, #6b1e2b)' : '1px solid #e5e7eb',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            fontSize: '0.82rem',
                            lineHeight: 1.45,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {msg.content}
                        </div>
                      )}

                      {/* Timestamp */}
                      <span
                        style={{
                          fontSize: '0.62rem',
                          color: '#9ca3af',
                          marginTop: '0.2rem',
                        }}
                      >
                        {formatChatTimestamp(msg.created_at)}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Staged File Pill (Shown when a file is picked) */}
            {selectedFile && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.35rem 0.75rem',
                  backgroundColor: '#f1f5f9',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '0.74rem',
                  color: '#334155',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                  <span>📎</span>
                  <span
                    style={{
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '230px',
                    }}
                  >
                    {selectedFile.name}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.68rem' }}>
                    ({formatFileSize(selectedFile.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  title="Remove attachment"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    lineHeight: 1,
                    padding: '2px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input Bar with Paperclip & Send Button */}
            <form
              onSubmit={handleSend}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.65rem 0.75rem',
                borderTop: '1px solid #edebe8',
                backgroundColor: '#ffffff',
                flexShrink: 0,
                margin: 0,
              }}
            >
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                style={{ display: 'none' }}
              />

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Write a message…"
                disabled={sending}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.82rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '20px',
                  backgroundColor: '#f8fafc',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary, #6b1e2b)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
              />

              {/* Paperclip Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Attach file or image"
                aria-label="Attach file or image"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: selectedFile ? '#ede9fe' : 'transparent',
                  color: selectedFile ? '#7c3aed' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  fontSize: '1.05rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!selectedFile) e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  if (!selectedFile) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                📎
              </button>

              {/* Send Button (Purple/Burgundy circular icon button) */}
              <button
                type="submit"
                disabled={sending || (!inputText.trim() && !selectedFile)}
                title="Send message"
                aria-label="Send message"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: sending || (!inputText.trim() && !selectedFile)
                    ? '#cbd5e1'
                    : '#7c3aed',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: sending || (!inputText.trim() && !selectedFile) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease, transform 0.1s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!sending && (inputText.trim() || selectedFile)) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {sending ? (
                  <span style={{ fontSize: '0.65rem' }}>…</span>
                ) : (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style={{ transform: 'rotate(0deg)', marginLeft: '1px' }}
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        )}

        {/* 2. FLOATING STACKED CHAT BUTTONS (Only shown when chat window is minimized) */}
        {!activeChat && (
          <div
            className="lexcore-chat-launcher-stack"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'flex-end',
            }}
          >
            {/* CLIENT CHAT BUTTON (If authorized) */}
            {availableChats.includes(CONVERSATION_TYPES.CLIENT_LAWYER) && (
              <button
                type="button"
                id="btn-client-chat"
                onClick={() =>
                  setActiveChat((prev) =>
                    prev === CONVERSATION_TYPES.CLIENT_LAWYER ? null : CONVERSATION_TYPES.CLIENT_LAWYER
                  )
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '24px',
                  border: activeChat === CONVERSATION_TYPES.CLIENT_LAWYER
                    ? '1.5px solid #c59b27'
                    : '1px solid rgba(107, 30, 43, 0.25)',
                  backgroundColor: activeChat === CONVERSATION_TYPES.CLIENT_LAWYER
                    ? '#521620'
                    : 'var(--color-primary, #6b1e2b)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(107, 30, 43, 0.24)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <span style={{ fontSize: '1rem' }}>💬</span>
                <span>Client Chat</span>
                {activeChat === CONVERSATION_TYPES.CLIENT_LAWYER && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(255, 255, 255, 0.2)',
                      padding: '1px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    Open
                  </span>
                )}
              </button>
            )}

            {/* TEAM CHAT BUTTON (If authorized) */}
            {availableChats.includes(CONVERSATION_TYPES.TEAM) && (
              <button
                type="button"
                id="btn-team-chat"
                onClick={() =>
                  setActiveChat((prev) =>
                    prev === CONVERSATION_TYPES.TEAM ? null : CONVERSATION_TYPES.TEAM
                  )
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '24px',
                  border: activeChat === CONVERSATION_TYPES.TEAM
                    ? '1.5px solid #c59b27'
                    : '1px solid rgba(107, 30, 43, 0.25)',
                  backgroundColor: activeChat === CONVERSATION_TYPES.TEAM
                    ? '#521620'
                    : 'var(--color-primary, #6b1e2b)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(107, 30, 43, 0.24)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <span style={{ fontSize: '1rem' }}>👥</span>
                <span>Team Chat</span>
                {activeChat === CONVERSATION_TYPES.TEAM && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(255, 255, 255, 0.2)',
                      padding: '1px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    Open
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
