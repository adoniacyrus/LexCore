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
  const [viewMode, setViewMode] = useState('AGENDA'); // 'AGENDA' | 'WEEK' | 'MONTH'

  // Modal State
  const [selectedConsultation, setSelectedConsultation] = useState(null);

  const availabilityPath =
    role === 'JUNIOR_LAWYER' ? '/dashboard/junior/availability' : '/dashboard/senior/availability';

  const loadCalendar = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);

      const formatDateStr = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
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
  }, [accessToken]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

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
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(today.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

      const dayCons = (calendarData.consultations || []).filter((c) => c.preferred_date === key);
      const dayBlocks = (calendarData.time_blocks || []).filter((b) => b.date === key);

      days.push({
        key,
        label,
        consultations: dayCons,
        blocks: dayBlocks,
      });
    }
    return days;
  }, [calendarData]);

  // Month days for Month View
  const monthDays = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ empty: true });
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
  }, [calendarData]);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.6rem 0 0.8rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {['AGENDA', 'WEEK', 'MONTH'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  background: viewMode === mode ? 'var(--color-primary)' : '#fff',
                  color: viewMode === mode ? '#fff' : '#444',
                  fontWeight: viewMode === mode ? 600 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {mode === 'AGENDA' ? 'Agenda' : mode === 'WEEK' ? 'Week View' : 'Month View'}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '0.75rem', color: '#666' }}>
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
                  const todayKey = new Date().toISOString().split('T')[0];
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
                  const todayKey = new Date().toISOString().split('T')[0];
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
