import React from 'react';
import './cases.css';

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

export default function CaseDurationSection({
  durationData,
  loading = false,
  role = 'CLIENT',
  onRefresh,
}) {
  if (loading) {
    return (
      <div className="case-duration-container is-loading" style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b' }}>
        <div className="spinner" style={{ margin: '0 auto 0.5rem', width: '24px', height: '24px' }} />
        <span style={{ fontSize: '0.82rem' }}>Calculating factual case duration metrics...</span>
      </div>
    );
  }

  if (!durationData) {
    return null;
  }

  const {
    is_closed,
    start_date,
    current_date,
    closure_date,
    elapsed_days,
    elapsed_humanized,
    total_closed_duration_days,
    total_closed_duration_humanized,
    current_stage,
    current_stage_label,
    status,
    status_label,
    total_hearings = 0,
    completed_hearings_count = 0,
    upcoming_hearings_count = 0,
    most_recent_hearing,
    next_scheduled_hearing,
    stages_breakdown = [],
    time_in_current_stage_humanized,
    staff_metrics,
    is_client_view,
  } = durationData;

  const isClient = role === 'CLIENT' || is_client_view;

  return (
    <div className="case-duration-container" id="case-duration-analytics">
      {/* SECTION HEADER */}
      <div className="case-duration-header">
        <div className="case-duration-header__title-group">
          <div className="case-duration-icon">⏱️</div>
          <div>
            <h3 className="case-duration-title">
              {is_closed ? 'Case Duration & Resolution Summary' : 'Case Duration & Progression'}
            </h3>
            <p className="case-duration-subtitle">
              Factual timeline analytics calculated from case records
              {is_closed ? ' up to case conclusion.' : ' to date.'}
            </p>
          </div>
        </div>

        <div className="case-duration-header__actions">
          <span
            className={`case-duration-status-pill ${
              is_closed ? 'is-closed' : 'is-active'
            }`}
          >
            ● {is_closed ? 'Case Concluded' : 'Active Matter'}
          </span>
          {onRefresh && (
            <button
              type="button"
              className="btn btn-ghost-dark btn-sm"
              onClick={onRefresh}
              title="Recalculate metrics"
              style={{
                fontSize: '0.72rem',
                padding: '0.2rem 0.55rem',
                height: 'auto',
                minHeight: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              🔄 Refresh
            </button>
          )}
        </div>
      </div>

      {/* CORE FACTUAL METRIC CARDS */}
      <div className="case-duration-cards-grid">
        {/* 1. STARTED */}
        <div className="case-duration-card">
          <span className="case-duration-card__label">Started</span>
          <div className="case-duration-card__value">
            {formatDate(start_date)}
          </div>
          <span className="case-duration-card__meta">
            {start_date ? 'Formal intake date' : 'Not recorded'}
          </span>
        </div>

        {/* 2. DURATION / ELAPSED */}
        {is_closed ? (
          <>
            <div className="case-duration-card">
              <span className="case-duration-card__label">Closed</span>
              <div className="case-duration-card__value">
                {formatDate(closure_date)}
              </div>
              <span className="case-duration-card__meta">
                Resolution milestone
              </span>
            </div>
            <div className="case-duration-card case-duration-card--highlight">
              <span className="case-duration-card__label">Total Duration</span>
              <div className="case-duration-card__value">
                {total_closed_duration_humanized || (total_closed_duration_days !== null ? `${total_closed_duration_days} days` : '—')}
              </div>
              <span className="case-duration-card__meta">
                Start to formal closure
              </span>
            </div>
          </>
        ) : (
          <div className="case-duration-card case-duration-card--highlight">
            <span className="case-duration-card__label">Elapsed Time</span>
            <div className="case-duration-card__value">
              {elapsed_humanized || (elapsed_days !== null ? `${elapsed_days} days` : '—')}
            </div>
            <span className="case-duration-card__meta">
              Running since {formatDate(start_date)}
            </span>
          </div>
        )}

        {/* 3. CURRENT STAGE */}
        <div className="case-duration-card">
          <span className="case-duration-card__label">Current Stage</span>
          <div className="case-duration-card__value case-duration-card__value--truncate" title={current_stage_label || current_stage}>
            {current_stage_label || current_stage || '—'}
          </div>
          <span className="case-duration-card__meta">
            Status: {status_label || status}
          </span>
        </div>

        {/* 4. LAST HEARING */}
        <div className="case-duration-card">
          <span className="case-duration-card__label">Last Hearing</span>
          {most_recent_hearing ? (
            <>
              <div className="case-duration-card__value">
                {formatDate(most_recent_hearing.date)}
              </div>
              <span className="case-duration-card__meta">
                {most_recent_hearing.days_ago === 0
                  ? 'Conducted today'
                  : `${most_recent_hearing.days_ago} day${most_recent_hearing.days_ago === 1 ? '' : 's'} ago`}
                {most_recent_hearing.outcome ? ` • ${most_recent_hearing.outcome}` : ''}
              </span>
            </>
          ) : (
            <>
              <div className="case-duration-card__value" style={{ color: '#94a3b8' }}>
                None
              </div>
              <span className="case-duration-card__meta">
                No past hearings held
              </span>
            </>
          )}
        </div>

        {/* 5. NEXT HEARING (for active cases) OR TOTAL HEARINGS (for closed cases) */}
        {!is_closed ? (
          <div className="case-duration-card">
            <span className="case-duration-card__label">Next Hearing</span>
            {next_scheduled_hearing ? (
              <>
                <div className="case-duration-card__value" style={{ color: 'var(--color-primary)' }}>
                  {formatDate(next_scheduled_hearing.date)}
                </div>
                <span className="case-duration-card__meta">
                  {next_scheduled_hearing.days_until === 0
                    ? 'Listed today'
                    : `In ${next_scheduled_hearing.days_until} day${next_scheduled_hearing.days_until === 1 ? '' : 's'}`}
                  {next_scheduled_hearing.court ? ` • ${next_scheduled_hearing.court}` : ''}
                </span>
              </>
            ) : (
              <>
                <div className="case-duration-card__value" style={{ color: '#94a3b8' }}>
                  None Scheduled
                </div>
                <span className="case-duration-card__meta">
                  Awaiting court listing
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="case-duration-card">
            <span className="case-duration-card__label">Hearings Held</span>
            <div className="case-duration-card__value">
              {total_hearings}
            </div>
            <span className="case-duration-card__meta">
              Total court hearings
            </span>
          </div>
        )}
      </div>

      {/* STAGE PROGRESSION & TIME SPENT IN STAGES */}
      {stages_breakdown && stages_breakdown.length > 0 && (
        <div className="case-duration-stages-panel">
          <div className="case-duration-stages-panel__head">
            <span className="case-duration-stages-title">
              📊 Stage Duration Breakdown
            </span>
            <span className="case-duration-stages-sub">
              Time spent in each procedural stage
            </span>
          </div>

          <div className="case-duration-stages-list">
            {stages_breakdown.map((stg, idx) => (
              <div
                key={`${stg.stage}-${idx}`}
                className={`case-duration-stage-pill ${stg.is_current ? 'is-current' : 'is-completed'}`}
              >
                <div className="case-duration-stage-pill__info">
                  <span className="case-duration-stage-pill__name">
                    {stg.stage_label || stg.stage}
                  </span>
                  <span className="case-duration-stage-pill__dates">
                    {formatDate(stg.start_date)}
                    {stg.end_date && stg.end_date !== stg.start_date ? ` → ${formatDate(stg.end_date)}` : ''}
                  </span>
                </div>
                <div className="case-duration-stage-pill__duration">
                  <span className="case-duration-stage-pill__days">
                    {stg.duration_days !== null && stg.duration_days !== undefined
                      ? `${stg.duration_days}d`
                      : '—'}
                  </span>
                  {stg.is_current && (
                    <span className="case-duration-stage-pill__curr-tag">
                      Current
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LAWYER / STAFF LITIGATION ANALYTICS (Non-Client Only) */}
      {!isClient && staff_metrics && (
        <div className="case-duration-staff-panel">
          <div className="case-duration-staff-header">
            <span className="case-duration-staff-title">
              ⚖️ Litigation Team Metrics
            </span>
            <span className="case-duration-staff-badge">
              Lawyer / Staff Authorization
            </span>
          </div>

          <div className="case-duration-staff-grid">
            <div className="case-duration-staff-item">
              <span className="case-duration-staff-item__label">Hearing Frequency</span>
              <span className="case-duration-staff-item__value">
                {staff_metrics.hearing_frequency_description || (total_hearings < 2 ? 'Need ≥ 2 hearings' : '—')}
              </span>
            </div>

            <div className="case-duration-staff-item">
              <span className="case-duration-staff-item__label">Time in Current Stage</span>
              <span className="case-duration-staff-item__value">
                {time_in_current_stage_humanized || '—'}
              </span>
            </div>

            <div className="case-duration-staff-item">
              <span className="case-duration-staff-item__label">Lead Advocate</span>
              <span className="case-duration-staff-item__value">
                {staff_metrics.responsible_lawyer_name || 'Unassigned'}
              </span>
            </div>

            {staff_metrics.supervising_lawyer_name && (
              <div className="case-duration-staff-item">
                <span className="case-duration-staff-item__label">Supervising Counsel</span>
                <span className="case-duration-staff-item__value">
                  {staff_metrics.supervising_lawyer_name}
                </span>
              </div>
            )}

            {staff_metrics.supporting_paralegal_name && (
              <div className="case-duration-staff-item">
                <span className="case-duration-staff-item__label">Supporting Paralegal</span>
                <span className="case-duration-staff-item__value">
                  {staff_metrics.supporting_paralegal_name}
                </span>
              </div>
            )}

            {(staff_metrics.cnr_number || staff_metrics.filing_number) && (
              <div className="case-duration-staff-item">
                <span className="case-duration-staff-item__label">Court Reference</span>
                <span className="case-duration-staff-item__value">
                  {staff_metrics.cnr_number || staff_metrics.filing_number}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FACTUAL TIMELINE NOTICE */}
      <div className="case-duration-notice">
        ℹ️ Factual case duration computed from verified matter records and court listings.
        Legal proceedings vary based on judicial schedules; LexCore does not generate predictive or unsupported completion dates.
      </div>
    </div>
  );
}
