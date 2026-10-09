import React, { useState } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function CaseTimeline({
  timelineData,
  loading,
  onRefresh,
  role,
  compact = false,
  onOpenDetailed,
}) {
  const [filterType, setFilterType] = useState('ALL');

  if (loading) {
    return (
      <div className="case-timeline-loading" style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
        <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
        <p style={{ fontSize: '0.85rem' }}>Loading case progression & timeline...</p>
      </div>
    );
  }

  if (!timelineData) {
    return null;
  }

  const { pipeline = [], events = [], current_stage_label, status_label, matter_category_label } = timelineData;

  const filteredEvents = events.filter((ev) => {
    if (filterType === 'HEARINGS') {
      return ev.event_type === 'HEARING' || ev.event_type === 'UPCOMING_HEARING' || ev.event_type === 'PROCEEDING';
    }
    if (filterType === 'STAGES') {
      return ev.event_type === 'STAGE_CHANGED' || ev.event_type === 'STATUS_CHANGED' || ev.event_type === 'CASE_CLOSED';
    }
    return true;
  });

  const getStatusBadge = (state) => {
    switch (state) {
      case 'CURRENT':
        return (
          <span
            className="timeline-badge timeline-badge--current"
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.12rem 0.5rem',
              borderRadius: '10px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fde68a',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            ● Current
          </span>
        );
      case 'UPCOMING':
        return (
          <span
            className="timeline-badge timeline-badge--upcoming"
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.12rem 0.5rem',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #dbeafe',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Upcoming
          </span>
        );
      case 'COMPLETED':
      default:
        return (
          <span
            className="timeline-badge timeline-badge--completed"
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '0.12rem 0.5rem',
              borderRadius: '10px',
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
            }}
          >
            ✓ Completed
          </span>
        );
    }
  };

  const getEventTypeIcon = (type) => {
    switch (type) {
      case 'CONSULTATION':
        return '💬';
      case 'CASE_CREATED':
        return '📁';
      case 'COURT_FILING':
        return '⚖️';
      case 'STAGE_CHANGED':
      case 'STATUS_CHANGED':
        return '🔄';
      case 'HEARING':
        return '🏛️';
      case 'UPCOMING_HEARING':
        return '📅';
      case 'CASE_CLOSED':
        return '🏁';
      case 'INTERNAL_ACTIVITY':
        return '👥';
      default:
        return '📌';
    }
  };

  return (
    <div className="case-timeline-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. VISUAL PROGRESS TRACKER (COMPACT STAGE STEPPER) */}
      <div
        className="case-stage-tracker-card"
        style={{
          background: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-sm)',
          padding: '1rem 1.15rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              Case Progression Tracker
            </h3>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Current Standing: <strong style={{ color: '#1e293b' }}>{current_stage_label || 'In Progress'}</strong>
              {matter_category_label ? ` • ${matter_category_label}` : ''}
              {status_label ? ` (${status_label})` : ''}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost-dark btn-sm"
            onClick={onRefresh}
            title="Refresh timeline data"
            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div
          className="stage-stepper-wrap"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflowX: 'auto',
            padding: '0.4rem 0.2rem 0.6rem',
            gap: '0.25rem',
          }}
        >
          {pipeline.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isCurrent = step.is_current;
            const isUpcoming = step.status === 'upcoming';

            return (
              <React.Fragment key={step.key || idx}>
                <div
                  className={`stage-step ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-completed' : ''}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '95px',
                    textAlign: 'center',
                    flex: '1 1 0',
                    zIndex: 2,
                  }}
                >
                  {/* Step Bubble */}
                  <div
                    style={{
                      width: isCurrent ? '30px' : '26px',
                      height: isCurrent ? '30px' : '26px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      marginBottom: '0.35rem',
                      transition: 'all 0.2s ease',
                      backgroundColor: isCurrent
                        ? '#fef3c7'
                        : isCompleted
                        ? '#f4ecee'
                        : '#f8fafc',
                      color: isCurrent
                        ? '#92400e'
                        : isCompleted
                        ? 'var(--color-primary)'
                        : '#94a3b8',
                      border: isCurrent
                        ? '2px solid #b45309'
                        : isCompleted
                        ? '2px solid var(--color-primary)'
                        : '1px solid #cbd5e1',
                      boxShadow: isCurrent ? '0 0 0 3px rgba(180, 83, 9, 0.15)' : 'none',
                    }}
                  >
                    {isCompleted ? '✓' : step.step_number || idx + 1}
                  </div>

                  {/* Step Label */}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: isCurrent ? 700 : isCompleted ? 600 : 500,
                      color: isCurrent
                        ? '#92400e'
                        : isCompleted
                        ? '#1e293b'
                        : '#94a3b8',
                      lineHeight: 1.25,
                      maxWidth: '110px',
                    }}
                  >
                    {step.label}
                  </span>

                  {isCurrent && (
                    <span
                      style={{
                        marginTop: '0.2rem',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        color: '#b45309',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Active Stage
                    </span>
                  )}
                </div>

                {/* Connecting Line between steps */}
                {idx < pipeline.length - 1 && (
                  <div
                    style={{
                      flex: '1 1 auto',
                      height: '2px',
                      marginBottom: '1.4rem',
                      backgroundColor: isCompleted ? 'var(--color-primary)' : '#e2e8f0',
                      minWidth: '16px',
                      zIndex: 1,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 2. CHRONOLOGICAL CASE TIMELINE */}
      {!compact && (
        <div
          className="case-events-timeline-card"
        style={{
          background: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-sm)',
          padding: '1.15rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Header with Filters */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '0.65rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#1e293b' }}>
              Chronological Case Events
            </h3>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.1rem 0.45rem',
                borderRadius: '8px',
                background: '#f1f5f9',
                color: '#475569',
              }}
            >
              {filteredEvents.length} events
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: 'All Events' },
              { key: 'HEARINGS', label: 'Hearings & Filings' },
              { key: 'STAGES', label: 'Stages & Status' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterType(tab.key)}
                style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  border: filterType === tab.key ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  backgroundColor: filterType === tab.key ? '#f6eff1' : '#fff',
                  color: filterType === tab.key ? 'var(--color-primary)' : '#64748b',
                  fontWeight: filterType === tab.key ? 600 : 500,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Events List */}
        {filteredEvents.length === 0 ? (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              backgroundColor: '#faf9f6',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
            }}
          >
            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
              No timeline events found matching the selected filter.
            </p>
          </div>
        ) : (
          <div
            className="timeline-vertical-tree"
            style={{
              position: 'relative',
              paddingLeft: '1.75rem',
              borderLeft: '2px solid #ebdada',
              marginLeft: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {filteredEvents.map((ev, index) => {
              const isCurrent = ev.state === 'CURRENT';
              const isUpcoming = ev.state === 'UPCOMING';

              return (
                <div
                  key={ev.id || index}
                  className="timeline-event-item"
                  style={{
                    position: 'relative',
                    background: isCurrent ? '#fefdfa' : isUpcoming ? '#fbfcfe' : '#ffffff',
                    border: isCurrent
                      ? '1px solid #fde68a'
                      : isUpcoming
                      ? '1px solid #dbeafe'
                      : '1px solid var(--color-border)',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '0.75rem 0.95rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {/* Timeline Dot on the vertical line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-2.35rem',
                      top: '0.9rem',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: isCurrent ? '#b45309' : isUpcoming ? '#3b82f6' : 'var(--color-primary)',
                      border: '2px solid #fff',
                      boxShadow: '0 0 0 2px rgba(88, 28, 38, 0.15)',
                    }}
                  />

                  {/* Header Row: Date, State, Icon, Type */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.35rem',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '0.9rem' }}>{getEventTypeIcon(ev.event_type)}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                        {formatDate(ev.date)}
                      </span>
                      {getStatusBadge(ev.state)}
                    </div>

                    {ev.court && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: '#475569',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 500,
                        }}
                      >
                        🏛️ {ev.court}
                      </span>
                    )}
                  </div>

                  {/* Event Title */}
                  <h4
                    style={{
                      margin: '0 0 0.3rem 0',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      color: isCurrent ? '#92400e' : 'var(--color-dark)',
                    }}
                  >
                    {ev.title}
                  </h4>

                  {/* Event Description */}
                  {ev.description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        color: '#4b5563',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                      }}
                    >
                      {ev.description}
                    </p>
                  )}

                  {/* Metadata Chips (e.g. Next hearing date, hearing id) */}
                  {ev.metadata && (ev.metadata.next_hearing_date || ev.metadata.hearing_id || ev.metadata.filing_number) && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.4rem',
                        marginTop: '0.45rem',
                        paddingTop: '0.35rem',
                        borderTop: '1px dashed #f1f5f9',
                        flexWrap: 'wrap',
                      }}
                    >
                      {ev.metadata.hearing_id && (
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          Ref: <strong>{ev.metadata.hearing_id}</strong>
                        </span>
                      )}
                      {ev.metadata.next_hearing_date && (
                        <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 600 }}>
                          📅 Next Date: {formatDate(ev.metadata.next_hearing_date)}
                        </span>
                      )}
                      {ev.metadata.filing_number && (
                        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          Filing: <strong>{ev.metadata.filing_number}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Informative Note for Clients / Lawyers regarding real records */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: '#faf8f5',
            border: '1px solid #ebdada',
            borderRadius: '4px',
            fontSize: '0.74rem',
            color: '#71717a',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>ℹ️</span>
          <span>
            This timeline reflects actual recorded case milestones, official court filings, and hearing entries.
            {role === 'CLIENT'
              ? ' You are viewing the client-verified progression of your legal matter.'
              : ' Official legal audit trail synchronized with LexCore Court Calendar and Hearing Records.'}
          </span>
        </div>
      </div>
      )}
    </div>
  );
}
