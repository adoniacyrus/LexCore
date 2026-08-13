import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NavIcon } from '../../components/dashboard/icons';
import { useAuth } from '../../context/AuthContext';
import { listCases, getErrorMessage } from '../../services/caseService';
import { listCaseTasks } from '../../services/taskService';
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
    id: 'supporting-cases',
    title: 'Supporting Cases',
    description: 'Access supporting matters & documents',
    icon: 'cases',
    to: '/dashboard/paralegal/cases',
  },
];

function ParalegalWorkspace() {
  const { accessToken, user } = useAuth();
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const firstName = (user?.full_name || 'Paralegal').split(' ')[0];
  const todayLabel = useMemo(() => formatDashboardDate(), []);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [caseData, taskData] = await Promise.all([
        listCases(accessToken),
        listCaseTasks(accessToken),
      ]);
      setCases(Array.isArray(caseData) ? caseData : []);
      setTasks(Array.isArray(taskData) ? taskData : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load paralegal workspace data.'));
      setCases([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const myTasks = tasks.filter((t) => t.assigned_to?.id === user?.id);
    const pendingTasks = myTasks.filter((t) => t.status === 'PENDING').length;
    const inProgressTasks = myTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const completedTasks = myTasks.filter((t) => t.status === 'COMPLETED').length;

    return {
      totalCases: cases.length,
      myTasksCount: myTasks.length,
      pendingTasks,
      inProgressTasks,
      completedTasks,
    };
  }, [cases, tasks, user?.id]);

  const attentionItems = useMemo(() => {
    const items = [];

    const activeTasks = tasks.filter(
      (t) => t.assigned_to?.id === user?.id && (t.status === 'PENDING' || t.status === 'IN_PROGRESS')
    );

    if (activeTasks.length > 0) {
      items.push({
        id: 'active-tasks',
        priority: 'High',
        title: 'Assigned tasks requiring work',
        description: `You have ${activeTasks.length} task${activeTasks.length === 1 ? '' : 's'} assigned requiring document uploads or status updates.`,
        actionLabel: 'View cases',
        actionTo: '/dashboard/paralegal/cases',
      });
    }

    return items;
  }, [tasks, user?.id]);

  const kpiCards = [
    {
      id: 'supporting-cases',
      icon: 'cases',
      value: stats.totalCases,
      label: 'Supporting Cases',
      secondary: 'Active matter files',
    },
    {
      id: 'my-tasks',
      icon: 'tasks',
      value: stats.myTasksCount,
      label: 'My Tasks',
      secondary: `${stats.completedTasks} completed`,
    },
    {
      id: 'pending-tasks',
      icon: 'reports',
      value: stats.pendingTasks,
      label: 'Pending Tasks',
      secondary: 'Awaiting action',
    },
    {
      id: 'in-progress-tasks',
      icon: 'edit',
      value: stats.inProgressTasks,
      label: 'In Progress Tasks',
      secondary: 'Currently working',
    },
  ];

  return (
    <div className="admin-dash lw-fade-in">
      <header className="admin-dash__header">
        <div className="admin-dash__header-main">
          <p className="section-tag-gold">Legal Support Operations</p>
          <h1 className="admin-dash__title">
            {getGreeting()}, <em>{firstName}</em>
          </h1>
          <p className="admin-dash__subtitle">
            Manage operational case tasks, organize legal documents, and support chambers litigation.
          </p>
        </div>
        <p className="admin-dash__date">{todayLabel}</p>
      </header>

      {error ? (
        <p className="admin-dash__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="admin-dash__kpis" aria-label="Paralegal summary">
        {loading ? (
          <p className="lw-muted admin-dash__loading">Loading paralegal workspace overview…</p>
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
            <p className="lw-muted">Checking operational tasks…</p>
          ) : attentionItems.length === 0 ? (
            <div className="admin-dash__clear">
              <p className="admin-dash__clear-title">All clear</p>
              <p className="admin-dash__clear-desc">
                No assigned tasks currently require your attention.
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

        <section className="admin-dash__actions" aria-labelledby="quick-actions-heading">
          <div className="admin-dash__section-head">
            <h2 id="quick-actions-heading">Quick Actions</h2>
          </div>
          <nav className="admin-action-grid" aria-label="Quick actions" style={{ gridTemplateColumns: '1fr', gridTemplateRows: 'auto' }}>
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
      </div>
    </div>
  );
}

export default ParalegalWorkspace;
