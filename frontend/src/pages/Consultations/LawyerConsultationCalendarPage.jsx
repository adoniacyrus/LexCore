import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import {
  fetchLawyerConsultationCalendar,
  getErrorMessage,
  updateAssignedConsultationStatus,
} from '../../services/consultationService';
import LawyerConsultationDetailModal from './LawyerConsultationDetailModal';
import { formatPreferredDate, formatPreferredTime, practiceAreaLabel } from './consultationConstants';
import '../Calendar/calendar.css';
import './consultations.css';

function LawyerConsultationCalendarPage() {
  const { accessToken, user } = useAuth();
  const role = user?.role || 'SENIOR_LAWYER';
  const navigate = useNavigate();

  const [calendarData, setCalendarData] = useState({
    consultations: [],
    time_blocks: [],
    date_overrides: [],
    weekly_schedules: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('WEEK'); // 'AGENDA' | 'WEEK' | 'MONTH'
  const [activeDate, setActiveDate] = useState(() => new Date());

  // Modal State
  const [selectedConsultation, setSelectedConsultation] = useState(null);

  const availabilityPath =
    role === 'JUNIOR_LAWYER' ? '/dashboard/junior/availability' : '/dashboard/senior/availability';

  const formatDateKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const activeMonthYear = `${activeDate.getFullYear()}-${activeDate.getMonth()}`;

  const loadCalendar = useCallback(async (targetDate = activeDate) => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month + 2, 0);

      const formatDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dt = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dt}`;
      };

      const data = await fetchLawyerConsultationCalendar(accessToken, {
        start_date: formatDateStr(start),
        end_date: formatDateStr(end),
      });
      setCalendarData(data || {});
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load consultation calendar.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeMonthYear]);

  useEffect(() => {
    loadCalendar(activeDate);
  }, [loadCalendar]);

  const handlePrev = useCallback(() => {
    if (viewMode === 'WEEK') {
      setActiveDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    } else if (viewMode === 'MONTH') {
      setActiveDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === 'WEEK') {
      setActiveDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    } else if (viewMode === 'MONTH') {
      setActiveDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setActiveDate(new Date());
  }, []);

  // Combine consultations and blocks into day groups for Agenda View
  const agendaGroups = useMemo(() => {
    const map = {};

    (calendarData.consultations || []).forEach((c) => {
      const d = c.preferred_date;
      if (!map[d]) map[d] = { date: d, items: [] };
      map[d].items.push({
        type: 'CONSULTATION',
        time: c.preferred_time,
        data: c,
      });
    });

    (calendarData.time_blocks || []).forEach((b) => {
      const d = b.date;
      if (!map[d]) map[d] = { date: d, items: [] };
      map[d].items.push({
        type: 'BLOCK',
        time: b.start_time,
        data: b,
      });
    });

    // Sort dates ascending
    const sortedDates = Object.keys(map).sort();
    return sortedDates.map((dateKey) => {
      const group = map[dateKey];
      group.items.sort((a, b) => a.time.localeCompare(b.time));
      return group;
    });
  }, [calendarData]);

  // Week days for Week View
  const weekDays = useMemo(() => {
    const base = new Date(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate());
    const day = base.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday as first day
    const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const key = formatDateKey(d);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

      const dayCons = (calendarData.consultations || []).filter((c) => c.preferred_date === key);
      const dayBlocks = (calendarData.time_blocks || []).filter((b) => b.date === key);

      days.push({
        key,
        label,
        date: d,
        consultations: dayCons,
        blocks: dayBlocks,
      });
    }
    return days;
  }, [activeDate, calendarData]);

  const weekLabel = useMemo(() => {
    if (!weekDays.length) return '';
    const first = weekDays[0].date;
    const last = weekDays[6].date;
    const sameMonth = first.getMonth() === last.getMonth();
    const sameYear = first.getFullYear() === last.getFullYear();

    if (sameMonth && sameYear) {
      return `${first.getDate()} – ${last.getDate()} ${first.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
    }
    if (sameYear) {
      return `${first.getDate()} ${first.toLocaleDateString('en-IN', { month: 'short' })} – ${last.getDate()} ${last.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
    }
    return `${first.getDate()} ${first.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} – ${last.getDate()} ${last.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
  }, [weekDays]);

  // Month days for Month View
  const monthDays = useMemo(() => {
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();

    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ empty: true });
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const key = formatDateKey(d);
      const dayCons = (calendarData.consultations || []).filter((c) => c.preferred_date === key);
      const dayBlocks = (calendarData.time_blocks || []).filter((b) => b.date === key);

      cells.push({
        dayNumber: day,
        key,
        consultations: dayCons,
        blocks: dayBlocks,
      });
    }
    return cells;
  }, [activeDate, calendarData]);

  const monthLabel = useMemo(() => {
    return activeDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [activeDate]);

  return (
    <DashboardLayout showContext={false} activeModule="consultation-calendar" fillHeight>
      <div className="cons-page cons-page--fill lw-fade-in" style={{ padding: '0.8rem 1.2rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.6rem' }}>
          <PageHeader
            eyebrow="Advocate Workspace"
            title="Consultation Calendar"
            description="Manage your booked client consultations, appointments, and schedule commitments."
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-ghost-dark"
              onClick={() => navigate(availabilityPath)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
            >
              ⚙ Manage Availability
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(availabilityPath)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
            >
              + Block Time
            </button>
          </div>
        </div>

        {/* CONTROLS HEADER */}
        <div className="cal-controls-bar">
          <div className="cal-controls-left">
            <div className="cal-view-switcher">
              {[
                { id: 'AGENDA', label: 'Agenda' },
                { id: 'WEEK', label: 'Week View' },
                { id: 'MONTH', label: 'Month View' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewMode(tab.id)}
                  className={`cal-view-btn ${viewMode === tab.id ? 'is-active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {viewMode !== 'AGENDA' && (
              <div className="cal-nav-group">
                <button
                  type="button"
                  className="cal-nav-btn cal-nav-btn--today"
                  onClick={handleToday}
                  title="Jump to current week / month"
                >
                  Today
                </button>
                <button
                  type="button"
                  className="cal-nav-btn"
                  onClick={handlePrev}
                  aria-label={viewMode === 'WEEK' ? 'Previous week' : 'Previous month'}
                  title={viewMode === 'WEEK' ? 'Previous week' : 'Previous month'}
                >
                  ‹ {viewMode === 'WEEK' ? 'Prev Week' : 'Prev Month'}
                </button>
                <button
                  type="button"
                  className="cal-nav-btn"
                  onClick={handleNext}
                  aria-label={viewMode === 'WEEK' ? 'Next week' : 'Next month'}
                  title={viewMode === 'WEEK' ? 'Next week' : 'Next month'}
                >
                  {viewMode === 'WEEK' ? 'Next Week' : 'Next Month'} ›
                </button>
                <span className="cal-nav-label">
                  {viewMode === 'WEEK' ? weekLabel : monthLabel}
                </span>
              </div>
            )}
          </div>

          <div className="cal-controls-right">
            Duration: <strong style={{ color: 'var(--color-primary)' }}>{calendarData.consultation_duration || 30} mins</strong> · {calendarData.consultations?.length || 0} scheduled consultations
          </div>
        </div>

        {error ? <p className="cons-error" role="alert">{error}</p> : null}

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>
            Loading your consultation schedule…
          </div>
        ) : (
          <div className="calendar-views-container">
            {/* AGENDA VIEW */}
            {viewMode === 'AGENDA' && (
              <div className="agenda-list">
                {agendaGroups.length === 0 ? (
                  <div style={{ padding: '2.5rem', background: '#fcfaf6', border: '1px dashed #e0d8cc', borderRadius: '6px', textAlign: 'center', color: '#777', fontSize: '0.82rem' }}>
                    No upcoming consultations or blocked periods scheduled on your calendar.
                  </div>
                ) : (
                  agendaGroups.map((group) => (
                    <div key={group.date} className="agenda-day-group">
                      <header className="agenda-day-header">
                        {new Date(`${group.date}T00:00:00`).toLocaleDateString('en-IN', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </header>
                      <ul className="agenda-items-list">
                        {group.items.map((item, idx) => {
                          if (item.type === 'CONSULTATION') {
                            const c = item.data;
                            return (
                              <li
                                key={`cons-${c.id}`}
                                className="agenda-item-row"
                                onClick={() => setSelectedConsultation(c)}
                                style={{ cursor: 'pointer' }}
                              >
                                <div className="agenda-item-main">
                                  <div className="agenda-item-title-row">
                                    <span className="agenda-item-ref">{c.consultation_id}</span>
                                    <span className="agenda-item-title">{c.subject}</span>
                                    {c.case_reference && (
                                      <span style={{ fontSize: '0.72rem', color: '#777' }}>({c.case_reference})</span>
                                    )}
                                  </div>
                                  <div className="agenda-item-details">
                                    Client: <strong>{c.client_name || c.client?.full_name || '—'}</strong> · Mode: {c.consultation_mode_label || c.consultation_mode || '—'} · {practiceAreaLabel(c)}
                                  </div>
                                </div>
                                <div className="agenda-item-meta">
                                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--color-primary)' }}>
                                    {formatPreferredTime(c.preferred_time)} {c.end_time ? `– ${formatPreferredTime(c.end_time)}` : ''}
                                  </span>
                                  <span className={`cons-status is-${String(c.status).toLowerCase()}`}>
                                    {c.status_label || c.status}
                                  </span>
                                </div>
                              </li>
                            );
                          } else {
                            const b = item.data;
                            return (
                              <li
                                key={`block-${b.id}`}
                                className="agenda-item-row"
                                style={{ background: '#fdf7f7', borderLeft: '3px solid #b23b3b' }}
                              >
                                <div className="agenda-item-main">
                                  <div className="agenda-item-title-row">
                                    <span style={{ fontWeight: 700, fontSize: '0.76rem', color: '#b23b3b', textTransform: 'uppercase' }}>
                                      Blocked: {b.reason_label || b.reason}
                                    </span>
                                  </div>
                                  <div className="agenda-item-details" style={{ color: '#777' }}>
                                    {b.notes || 'Schedule blocked — unavailable for booking'}
                                  </div>
                                </div>
                                <div className="agenda-item-meta">
                                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#b23b3b' }}>
                                    {b.start_time?.substring(0, 5)} – {b.end_time?.substring(0, 5)}
                                  </span>
                                </div>
                              </li>
                            );
                          }
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* WEEK VIEW */}
            {viewMode === 'WEEK' && (
              <div className="week-grid">
                {weekDays.map((day) => {
                  const todayKey = formatDateKey(new Date());
                  const isToday = day.key === todayKey;
                  return (
                    <div key={day.key} className="week-column">
                      <header className={`week-column-header ${isToday ? 'is-today' : ''}`}>
                        {day.label}
                      </header>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {day.blocks.map((b) => (
                          <div
                            key={b.id}
                            style={{
                              padding: '0.35rem 0.5rem',
                              background: '#fff2f2',
                              border: '1px solid #f6cfcf',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              color: '#900',
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>Blocked: {b.reason_label || b.reason}</div>
                            <div>{b.start_time?.substring(0, 5)} – {b.end_time?.substring(0, 5)}</div>
                          </div>
                        ))}
                        {day.consultations.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => setSelectedConsultation(c)}
                            className="week-hearing-card"
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="week-hearing-ref">{c.consultation_id}</div>
                            <div className="week-hearing-title">{c.client_name}</div>
                            <div className="week-hearing-court" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                              {c.preferred_time?.substring(0, 5)} ({c.duration_minutes || 30}m)
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MONTH VIEW */}
            {viewMode === 'MONTH' && (
              <div className="month-grid">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="month-header-cell">{d}</div>
                ))}
                {monthDays.map((cell, idx) => {
                  const todayKey = formatDateKey(new Date());
                  const isToday = cell.key === todayKey;
                  if (cell.empty) {
                    return <div key={`empty-${idx}`} className="month-day-cell is-empty" />;
                  }
                  return (
                    <div
                      key={cell.key}
                      className={`month-day-cell ${isToday ? 'is-today' : ''}`}
                    >
                      <span className="month-day-number">{cell.dayNumber}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem' }}>
                        {cell.blocks.length > 0 && (
                          <div style={{ fontSize: '0.62rem', background: '#ffecec', color: '#b23b3b', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 600 }}>
                            {cell.blocks.length} blocked
                          </div>
                        )}
                        {cell.consultations.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => setSelectedConsultation(c)}
                            style={{
                              fontSize: '0.64rem',
                              padding: '0.15rem 0.3rem',
                              background: '#f9f2f4',
                              border: '1px solid #ebd5da',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              color: 'var(--color-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontWeight: 600,
                            }}
                            title={`${c.consultation_id} — ${c.client_name} (${c.preferred_time})`}
                          >
                            {c.preferred_time?.substring(0, 5)} {c.client_name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* DETAIL MODAL */}
        {selectedConsultation && (
          <LawyerConsultationDetailModal
            open={Boolean(selectedConsultation)}
            consultation={selectedConsultation}
            userRole={user?.role}
            accessToken={accessToken}
            onClose={() => setSelectedConsultation(null)}
            onUpdated={(updated) => {
              setSelectedConsultation(updated);
              loadCalendar();
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

export default LawyerConsultationCalendarPage;
