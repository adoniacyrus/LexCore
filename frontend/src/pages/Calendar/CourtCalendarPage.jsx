import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { NavIcon } from '../../components/dashboard/icons';
import { listHearings, getHearingStatistics } from '../../services/hearingService';
import { listActiveLawyers } from '../../services/caseService';
import { listPracticeAreas } from '../../services/consultationService';
import HearingDetailModal from './HearingDetailModal';
import '../Cases/cases.css';
import './calendar.css';

function CourtCalendarPage() {
  const { accessToken, user } = useAuth();
  const role = user?.role || 'CLIENT';
  const isAdmin = role === 'ADMIN';

  // State Management
  const [hearings, setHearings] = useState([]);
  const [stats, setStats] = useState({ today: 0, tomorrow: 0, this_week: 0, missed: 0, completed: 0 });
  const [lawyersList, setLawyersList] = useState([]);
  const [practiceAreasList, setPracticeAreasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');

  // Calendar Views: 'AGENDA', 'WEEK', 'MONTH'
  const [viewMode, setViewMode] = useState('AGENDA');

  // Filters State
  const [dateRangePreset, setDateRangePreset] = useState('THIS_WEEK'); // 'TODAY', 'TOMORROW', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCourt, setSelectedCourt] = useState('');
  const [selectedPracticeArea, setSelectedPracticeArea] = useState('');
  const [selectedLawyer, setSelectedLawyer] = useState('');

  // Modal State
  const [selectedHearing, setSelectedHearing] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Date Helpers
  const getPresetDates = useCallback((preset) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start = new Date(today);
    let end = new Date(today);

    switch (preset) {
      case 'TODAY':
        break;
      case 'TOMORROW':
        start.setDate(today.getDate() + 1);
        end.setDate(today.getDate() + 1);
        break;
      case 'THIS_WEEK':
        // Start of week (Monday)
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        end.setDate(diff + 6);
        break;
      case 'THIS_MONTH':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      default:
        return { start: null, end: null };
    }

    const formatDateStr = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${date}`;
    };

    return { start: formatDateStr(start), end: formatDateStr(end) };
  }, []);

  // Load Filters & Metadata
  useEffect(() => {
    async function loadMetadata() {
      if (!accessToken) return;
      try {
        const [paData, lawData] = await Promise.all([
          listPracticeAreas(accessToken),
          isAdmin ? listActiveLawyers(accessToken) : Promise.resolve([]),
        ]);
        setPracticeAreasList(paData || []);
        setLawyersList(lawData || []);
      } catch (err) {
        console.error('Failed to load calendar metadata', err);
      }
    }
    loadMetadata();
  }, [accessToken, isAdmin]);

  // Load Data
  const loadHearings = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');

    try {
      const params = {};
      if (selectedCourt) params.court = selectedCourt;
      if (selectedPracticeArea) params.practice_area = selectedPracticeArea;
      if (selectedLawyer && isAdmin) params.lawyer = selectedLawyer;

      if (dateRangePreset !== 'CUSTOM') {
        const { start, end } = getPresetDates(dateRangePreset);
        if (start && end) {
          params.start_date = start;
          params.end_date = end;
        }
      } else {
        if (customStartDate) params.start_date = customStartDate;
        if (customEndDate) params.end_date = customEndDate;
      }

      const data = await listHearings(accessToken, params);
      setHearings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve hearing list.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedCourt, selectedPracticeArea, selectedLawyer, dateRangePreset, customStartDate, customEndDate, isAdmin, getPresetDates]);

  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    setStatsLoading(true);
    try {
      const data = await getHearingStatistics(accessToken);
      setStats(data);
    } catch (err) {
      console.error('Failed to load statistics', err);
    } finally {
      setStatsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadHearings();
  }, [loadHearings]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Agenda list grouping
  const agendaGroups = useMemo(() => {
    const groups = {};
    hearings.forEach((h) => {
      const dateKey = h.next_hearing_date;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(h);
    });

    // Sort dates ascending
    return Object.keys(groups)
      .sort()
      .map((date) => ({
        date,
        items: groups[date],
      }));
  }, [hearings]);

  // Week list grouping
  const weekDays = useMemo(() => {
    const dates = [];
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(today.setDate(diff));

    for (let i = 0; i < 7; i++) {
      const current = new Date(startOfWeek);
      current.setDate(startOfWeek.getDate() + i);
      const key = current.toISOString().split('T')[0];
      dates.push({
        key,
        label: current.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
        items: hearings.filter((h) => h.next_hearing_date === key),
      });
    }
    return dates;
  }, [hearings]);

  // Month list grouping
  const monthDays = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // Day of week (0-6)
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Offset for empty cells
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Align to Monday start
    for (let i = 0; i < offset; i++) {
      days.push({ empty: true });
    }

    for (let d = 1; d <= totalDays; d++) {
      const currentKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const items = hearings.filter((h) => h.next_hearing_date === currentKey);
      days.push({
        dayNum: d,
        key: currentKey,
        items,
      });
    }
    return days;
  }, [hearings]);

  const handleHearingClick = (hearing) => {
    setSelectedHearing(hearing);
    setShowDetailModal(true);
  };

  const getStatusClass = (status) => {
    if (status === 'UPCOMING') return 'counsel-badge is-lead';
    if (status === 'TODAY') return 'counsel-badge is-supervising';
    return 'counsel-badge is-assistant';
  };

  return (
    <DashboardLayout showContext={false} activeModule="calendar">
      <div className="cases-page calendar-page lw-fade-in">
        <PageHeader
          eyebrow="Calendar Overview"
          title="Court Hearing Calendar"
          description="Direct and coordinate courtroom commitments, review dates, and oversee hearing statuses."
        />

        {/* STATISTICS SUMMARY BAR */}
        <section className="calendar-stats">
          <div className="calendar-stat-card is-today">
            <div className="calendar-stat-num">{stats.today}</div>
            <div className="calendar-stat-label">Hearings Today</div>
          </div>
          <div className="calendar-stat-card is-tomorrow">
            <div className="calendar-stat-num">{stats.tomorrow}</div>
            <div className="calendar-stat-label">Tomorrow</div>
          </div>
          <div className="calendar-stat-card is-week">
            <div className="calendar-stat-num">{stats.this_week}</div>
            <div className="calendar-stat-label">This Week</div>
          </div>
          <div className="calendar-stat-card is-missed">
            <div className="calendar-stat-num is-missed">{stats.missed}</div>
            <div className="calendar-stat-label">Missed Hearings</div>
          </div>
          <div className="calendar-stat-card is-completed">
            <div className="calendar-stat-num is-completed">{stats.completed}</div>
            <div className="calendar-stat-label">Completed</div>
          </div>
        </section>

        {/* FILTERS PANEL */}
        <section className="calendar-filters-card">
          <div className="calendar-view-header">
            <h3 className="calendar-view-title">Filter Hearings</h3>
            <div className="calendar-view-toggle-group">
              <button
                type="button"
                className={`btn ${viewMode === 'AGENDA' ? 'btn-primary' : 'btn-ghost-dark'}`}
                onClick={() => setViewMode('AGENDA')}
              >
                Agenda View
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'WEEK' ? 'btn-primary' : 'btn-ghost-dark'}`}
                onClick={() => setViewMode('WEEK')}
              >
                Week View
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'MONTH' ? 'btn-primary' : 'btn-ghost-dark'}`}
                onClick={() => setViewMode('MONTH')}
              >
                Month View
              </button>
            </div>
          </div>

          <div className="calendar-filters-grid">
            <label className="auth-field">
              <span>Date Range Preset</span>
              <select value={dateRangePreset} onChange={(e) => setDateRangePreset(e.target.value)}>
                <option value="TODAY">Today</option>
                <option value="TOMORROW">Tomorrow</option>
                <option value="THIS_WEEK">This Week</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
            </label>

            {dateRangePreset === 'CUSTOM' && (
              <>
                <label className="auth-field">
                  <span>Start Date</span>
                  <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                </label>
                <label className="auth-field">
                  <span>End Date</span>
                  <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                </label>
              </>
            )}

            <label className="auth-field">
              <span>Court / Forum</span>
              <select value={selectedCourt} onChange={(e) => setSelectedCourt(e.target.value)}>
                <option value="">All Courts</option>
                <option value="District Court">District Court</option>
                <option value="Family Court">Family Court</option>
                <option value="Consumer Forum">Consumer Forum</option>
                <option value="High Court">High Court</option>
              </select>
            </label>

            <label className="auth-field">
              <span>Practice Area</span>
              <select value={selectedPracticeArea} onChange={(e) => setSelectedPracticeArea(e.target.value)}>
                <option value="">All Practice Areas</option>
                {practiceAreasList.map((pa) => (
                  <option key={pa.id} value={pa.id}>{pa.name}</option>
                ))}
              </select>
            </label>

            {isAdmin && (
              <label className="auth-field">
                <span>Lawyer (Admin only)</span>
                <select value={selectedLawyer} onChange={(e) => setSelectedLawyer(e.target.value)}>
                  <option value="">All Lawyers</option>
                  {lawyersList.map((l) => (
                    <option key={l.id} value={l.id}>{l.full_name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        {/* CALENDAR VIEWS CONTAINER */}
        <section className="calendar-views-container">
          {loading ? (
            <div className="calendar-loading-state">Loading court hearings calendar…</div>
          ) : error ? (
            <p className="admin-dash__error" role="alert">{error}</p>
          ) : hearings.length === 0 ? (
            <div className="calendar-empty-state">
              <p>No hearings found matching these filters.</p>
            </div>
          ) : (
            <>
              {/* AGENDA VIEW */}
              {viewMode === 'AGENDA' && (
                <div className="agenda-list">
                  {agendaGroups.map((group) => (
                    <div key={group.date} className="agenda-day-group">
                      <header className="agenda-day-header">
                        {new Date(group.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </header>
                      <ul className="agenda-items-list">
                        {group.items.map((item) => (
                          <li
                            key={item.id}
                            className="agenda-item-row"
                            onClick={() => handleHearingClick(item)}
                          >
                            <div className="agenda-item-main">
                              <div className="agenda-item-title-row">
                                <span className="agenda-item-ref">{item.case_reference}</span>
                                <span className="agenda-item-title">{item.case_title}</span>
                              </div>
                              <div className="agenda-item-details">
                                Court: {item.court_name} {item.bench && `| Bench: ${item.bench}`}
                              </div>
                            </div>
                            <div className="agenda-item-meta">
                              <span className="agenda-item-lawyer">
                                Lawyer: {item.responsible_lawyer_name}
                              </span>
                              <span className={getStatusClass(item.hearing_status)}>
                                {item.hearing_status}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {day.items.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleHearingClick(item)}
                              className="week-hearing-card"
                            >
                              <div className="week-hearing-ref">{item.case_reference}</div>
                              <div className="week-hearing-title">{item.case_title}</div>
                              <div className="week-hearing-court">{item.court_name}</div>
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
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="month-header-cell">
                      {day}
                    </div>
                  ))}
                  {monthDays.map((day, idx) => {
                    const todayKey = new Date().toISOString().split('T')[0];
                    const isToday = day.key === todayKey;
                    return (
                      <div
                        key={day.key || `empty-${idx}`}
                        className={`month-day-cell ${day.empty ? 'is-empty' : ''} ${isToday ? 'is-today' : ''}`}
                      >
                        {!day.empty ? (
                          <>
                            <span className="month-day-num">{day.dayNum}</span>
                            {day.items.length > 0 && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewMode('AGENDA');
                                  setDateRangePreset('CUSTOM');
                                  setCustomStartDate(day.key);
                                  setCustomEndDate(day.key);
                                }}
                                className="month-hearing-badge"
                              >
                                {day.items.length} {day.items.length === 1 ? 'Hearing' : 'Hearings'}
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <HearingDetailModal
        open={showDetailModal}
        hearing={selectedHearing}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedHearing(null);
        }}
      />
    </DashboardLayout>
  );
}

export default CourtCalendarPage;
