import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NavIcon } from '../../components/dashboard/icons';
import { useAuth } from '../../context/AuthContext';
import { listMyConsultations, getErrorMessage } from '../../services/consultationService';
import { listCases } from '../../services/caseService';
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
    id: 'book-consultation',
    title: 'Book Consultation',
    description: 'Schedule a legal consultation',
    icon: 'edit',
    to: '/dashboard/client/consultations/book',
  },
  {
    id: 'my-consultations',
    title: 'My Consultations',
    description: 'View consultation history & status',
    icon: 'consultations',
    to: '/dashboard/client/consultations',
  },
  {
    id: 'my-cases',
    title: 'My Cases',
    description: 'Track active matter progress',
    icon: 'cases',
    to: '/dashboard/client/cases',
  },
  {
    id: 'my-account',
    title: 'My Account',
    description: 'View portal account profile',
    icon: 'clients',
    to: '/dashboard/client/account',
  },
];

function ClientWorkspace() {
  const { accessToken, user } = useAuth();
  const [consultations, setConsultations] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const firstName = (user?.full_name || 'Client').split(' ')[0];
  const todayLabel = useMemo(() => formatDashboardDate(), []);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [consData, caseData] = await Promise.all([
        listMyConsultations(accessToken),
        listCases(accessToken),
      ]);
      setConsultations(Array.isArray(consData) ? consData : []);
      setCases(Array.isArray(caseData) ? caseData : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load client portal overview.'));
      setConsultations([]);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const pendingCons = consultations.filter(
      (c) => c.status === 'PENDING' || c.status === 'UNDER_REVIEW' || c.status === 'ACCEPTED'
    ).length;
    const completedCons = consultations.filter(
      (c) => c.status === 'COMPLETED' || c.status === 'CONVERTED_TO_CASE'
    ).length;

    return {
      totalCons: consultations.length,
      pendingCons,
      completedCons,
      totalCases: cases.length,
    };
  }, [consultations, cases]);

  const attentionItems = useMemo(() => {
    const items = [];

    const reviewQueue = consultations.filter(
      (c) => c.status === 'PENDING' || c.status === 'UNDER_REVIEW'
    );
    if (reviewQueue.length > 0) {
      items.push({
        id: 'review-cons',
        priority: 'High',
        title: 'Consultation awaiting review',
        description: `Your consultation request (${reviewQueue[0].consultation_id}) is currently under review by our legal team.`,
        actionLabel: 'View consultations',
        actionTo: '/dashboard/client/consultations',
      });
    }

    const acceptedCons = consultations.filter((c) => c.status === 'ACCEPTED');
    if (acceptedCons.length > 0) {
      items.push({
        id: 'accepted-cons',
        priority: 'High',
        title: 'Consultation confirmed',
        description: `${acceptedCons.length} consultation request${acceptedCons.length === 1 ? '' : 's'} accepted by advocate.`,
        actionLabel: 'View details',
        actionTo: '/dashboard/client/consultations',
      });
    }

    if (cases.length > 0) {
      items.push({
        id: 'active-cases',
        priority: 'Medium',
        title: 'Active legal matters',
        description: `You have ${cases.length} active case matter${cases.length === 1 ? '' : 's'} managed by LexCore Chambers.`,
        actionLabel: 'View cases',
        actionTo: '/dashboard/client/cases',
      });
    }

    return items;
  }, [consultations, cases]);

  const kpiCards = [
    {
      id: 'consultations',
      icon: 'consultations',
      value: stats.totalCons,
      label: 'My Consultations',
      secondary: `${stats.pendingCons} pending review`,
    },
    {
      id: 'cases',
      icon: 'cases',
      value: stats.totalCases,
      label: 'Active Cases',
      secondary: 'Ongoing legal matters',
    },
    {
      id: 'completed',
      icon: 'reports',
      value: stats.completedCons,
      label: 'Completed Consultations',
      secondary: 'Historical reviews',
    },
  ];

  return (
    <div className="admin-dash lw-fade-in">
      <header className="admin-dash__header">
        <div className="admin-dash__header-main">
          <p className="section-tag-gold">LexCore Client Portal</p>
          <h1 className="admin-dash__title">
            {getGreeting()}, <em>{firstName}</em>
          </h1>
          <p className="admin-dash__subtitle">
            Book consultations, track matter updates, and review case communications with your legal team.
          </p>
        </div>
        <p className="admin-dash__date">{todayLabel}</p>
      </header>

      {error ? (
        <p className="admin-dash__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="admin-dash__kpis admin-dash__kpis--3" aria-label="Client portal summary">
        {loading ? (
          <p className="lw-muted admin-dash__loading">Loading client portal overview…</p>
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
            <p className="lw-muted">Checking account updates…</p>
          ) : attentionItems.length === 0 ? (
            <div className="admin-dash__clear">
              <p className="admin-dash__clear-title">You&apos;re all caught up</p>
              <p className="admin-dash__clear-desc">
                No consultation or case action requires your attention right now.
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
      </div>
    </div>
  );
}

export default ClientWorkspace;
