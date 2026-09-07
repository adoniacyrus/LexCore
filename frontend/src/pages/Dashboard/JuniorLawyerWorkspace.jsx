import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NavIcon } from '../../components/dashboard/icons';
import { useAuth } from '../../context/AuthContext';
import { listAssignedConsultations, getErrorMessage } from '../../services/consultationService';
import { listCases } from '../../services/caseService';
import { listCaseTasks } from '../../services/taskService';
import { listHearings } from '../../services/hearingService';
import './adminWorkspace.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDashboardDate(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const QUICK_ACTIONS = [
  {
    id: 'view-consultations',
    title: 'Assigned Consultations',
    description: 'Review assigned client requests',
    icon: 'consultations',
    to: '/dashboard/junior/consultations',
  },
  {
    id: 'my-cases',
    title: 'My Cases',
    description: 'Access matter files and work items',
    icon: 'cases',
    to: '/dashboard/junior/cases',
  },
];

function JuniorLawyerWorkspace() {
  const { accessToken, user } = useAuth();
  const [consultations, setConsultations] = useState([]);
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const firstName = (user?.full_name || 'Counsel').split(' ')[0];
  const todayLabel = useMemo(() => formatDashboardDate(), []);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [consData, caseData, taskData, hearingsData] = await Promise.all([
        listAssignedConsultations(accessToken),
        listCases(accessToken),
        listCaseTasks(accessToken),
        listHearings(accessToken),
      ]);
      setConsultations(Array.isArray(consData) ? consData : []);
      setCases(Array.isArray(caseData) ? caseData : []);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setHearings(Array.isArray(hearingsData) ? hearingsData : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load workspace data.'));
      setConsultations([]);
      setCases([]);
      setTasks([]);
      setHearings([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const pendingCons = consultations.filter(
      (c) => c.status === 'ACCEPTED' || c.status === 'PENDING' || c.status === 'UNDER_REVIEW'
    ).length;
    const myTasks = tasks.filter((t) => t.assigned_to?.id === user?.id).length;
    const inProgressTasks = tasks.filter(
      (t) => t.assigned_to?.id === user?.id && t.status === 'IN_PROGRESS'
    ).length;
    const pendingTasks = tasks.filter(
      (t) => t.assigned_to?.id === user?.id && t.status === 'PENDING'
    ).length;

    return {
      totalCons: consultations.length,
      pendingCons,
      totalCases: cases.length,
      myTasks,
      inProgressTasks,
      pendingTasks,
    };
  }, [consultations, cases, tasks, user?.id]);

  const attentionItems = useMemo(() => {
    const items = [];

    const reviewQueue = consultations.filter(
      (c) => c.status === 'ACCEPTED' || c.status === 'PENDING' || c.status === 'UNDER_REVIEW'
    );
    if (reviewQueue.length > 0) {
      items.push({
        id: 'review-cons',
        priority: 'High',
        title: 'Assigned consultations awaiting action',
        description: `${reviewQueue.length} consultation${reviewQueue.length === 1 ? '' : 's'} assigned to you require review.`,
        actionLabel: 'Review queue',
        actionTo: '/dashboard/junior/consultations',
      });
    }

    const myActiveTasks = tasks.filter(
      (t) => t.assigned_to?.id === user?.id && (t.status === 'PENDING' || t.status === 'IN_PROGRESS')
    );
    if (myActiveTasks.length > 0) {
      items.push({
        id: 'my-tasks',
        priority: 'High',
        title: 'Work tasks assigned to you',
        description: `You have ${myActiveTasks.length} task${myActiveTasks.length === 1 ? '' : 's'} assigned requiring work or status updates.`,
        actionLabel: 'View tasks',
        actionTo: '/dashboard/junior/cases',
      });
    }

    return items;
  }, [consultations, tasks, cases, user?.id]);

  const upcomingHearingsGrouped = useMemo(() => {
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

    const tomorrowItems = hearings.filter(h => h.next_hearing_date === tomorrowStr);
    const otherUpcoming = hearings.filter(h => h.next_hearing_date > tomorrowStr).slice(0, 3);

    return { tomorrowItems, otherUpcoming };
  }, [hearings]);

  const kpiCards = [
    {
      id: 'consultations',
      icon: 'consultations',
      value: stats.totalCons,
      label: 'Assigned Consultations',
      secondary: `${stats.pendingCons} active`,
    },
    {
      id: 'cases',
      icon: 'cases',
      value: stats.totalCases,
      label: 'My Cases',
      secondary: 'Assigned matters',
    },
    {
      id: 'my-tasks',
      icon: 'tasks',
      value: stats.myTasks,
      label: 'My Tasks',
      secondary: `${stats.inProgressTasks} in progress`,
    },
    {
      id: 'pending-tasks',
      icon: 'reports',
      value: stats.pendingTasks,
      label: 'Pending Tasks',
      secondary: 'Awaiting action',
    },
  ];

  return (
    <div className="admin-dash lw-fade-in">
      <header className="admin-dash__header">
        <div className="admin-dash__header-main">
          <p className="section-tag-gold">Chambers Associate Counsel</p>
          <h1 className="admin-dash__title">
            {getGreeting()}, <em>{firstName}</em>
          </h1>
          <p className="admin-dash__subtitle">
            Track assigned legal consultations, update matter tasks, and perform legal research.
          </p>
        </div>
        <p className="admin-dash__date">{todayLabel}</p>
      </header>

      {error ? (
        <p className="admin-dash__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="admin-dash__kpis" aria-label="Junior Lawyer summary">
        {loading ? (
          <p className="lw-muted admin-dash__loading">Loading workspace overview…</p>
        ) : (
          kpiCards.map((card) => (
            <article key={card.id} className="admin-kpi">
              <span className="admin-kpi__icon" aria-hidden="true">
                <NavIcon name={card.icon} />
              </span>
              <div className="admin-kpi__body">
                <p className="admin-kpi__value">{card.value}</p>
                <p className="admin-kpi__label">{card.label}</p>
                <p className="admin-kpi__secondary">{card.secondary}</p>
              </div>
            </article>
          ))
        )}
      </section>

      <div className="admin-dash__columns">
        <section className="admin-dash__attention" aria-labelledby="attention-heading">
          <div className="admin-dash__section-head">
            <h2 id="attention-heading">Attention Required</h2>
            {!loading && attentionItems.length > 0 ? (
              <span className="admin-dash__count">{attentionItems.length}</span>
            ) : null}
          </div>

          {loading ? (
            <p className="lw-muted">Checking assigned work…</p>
          ) : attentionItems.length === 0 ? (
            <div className="admin-dash__clear">
              <p className="admin-dash__clear-title">All clear</p>
              <p className="admin-dash__clear-desc">
                No pending consultations or tasks require your attention.
              </p>
            </div>
          ) : (
            <ul className="admin-work">
              {attentionItems.map((item) => (
                <li key={item.id} className="admin-work__card">
                  <div className="admin-work__copy">
                    <span className={`admin-work__priority is-${item.priority.toLowerCase()}`}>
                      {item.priority}
                    </span>
                    <h3 className="admin-work__title">{item.title}</h3>
                    <p className="admin-work__desc">{item.description}</p>
                  </div>
                  <Link to={item.actionTo} className="btn btn-primary admin-work__action">
                    {item.actionLabel}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: 0, overflow: 'hidden' }}>
          <section className="admin-dash__actions" aria-labelledby="quick-actions-heading" style={{ flex: 1, minHeight: 0 }}>
            <div className="admin-dash__section-head">
              <h2 id="quick-actions-heading">Quick Actions</h2>
            </div>
            <nav className="admin-action-grid" aria-label="Quick actions">
              {QUICK_ACTIONS.map((action) => (
                <Link key={action.id} to={action.to} className="admin-action">
                  <span className="admin-action__icon" aria-hidden="true">
                    <NavIcon name={action.icon} />
                  </span>
                  <span className="admin-action__copy">
                    <span className="admin-action__title">{action.title}</span>
                    <span className="admin-action__desc">{action.description}</span>
                  </span>
                </Link>
              ))}
            </nav>
          </section>

          {/* CALENDAR STATS WIDGET */}
          <section className="admin-dash__actions" aria-labelledby="hearings-widget-heading" style={{ flex: 1, minHeight: 0 }}>
            <div className="admin-dash__section-head">
              <h2 id="hearings-widget-heading">Upcoming Hearings</h2>
              <Link to="/dashboard/junior/calendar" className="btn btn-ghost-dark" style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem' }}>View Calendar</Link>
            </div>
            <div className="admin-work__card" style={{ padding: '1rem', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {upcomingHearingsGrouped.tomorrowItems.length === 0 && upcomingHearingsGrouped.otherUpcoming.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#888280', fontStyle: 'italic' }}>No upcoming hearings scheduled.</p>
              ) : (
                <>
                  {upcomingHearingsGrouped.tomorrowItems.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.78rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tomorrow</h4>
                      {upcomingHearingsGrouped.tomorrowItems.map(h => (
                        <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: 600 }}>{h.case_title}</span>
                          <span style={{ color: '#888280' }}>{h.court_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {upcomingHearingsGrouped.otherUpcoming.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0.5rem 0 0.4rem 0', fontSize: '0.78rem', color: '#888280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming</h4>
                      {upcomingHearingsGrouped.otherUpcoming.map(h => {
                        const dateObj = new Date(h.next_hearing_date);
                        const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                        return (
                          <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: 500 }}>{h.case_title} <span style={{ fontSize: '0.75rem', color: '#888280' }}>({h.court_name})</span></span>
                            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formattedDate}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default JuniorLawyerWorkspace;
