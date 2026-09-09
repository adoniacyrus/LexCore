import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NavIcon } from '../../components/dashboard/icons';
import { useAuth } from '../../context/AuthContext';
import { listClients } from '../../services/clientService';
import {
  getErrorMessage,
  listAdminConsultations,
} from '../../services/consultationService';
import { listEmployees } from '../../services/employeeService';
import { getHearingStatistics } from '../../services/hearingService';
import { getAdminRevenue } from '../../services/paymentService';
import './adminWorkspace.css';

const NEW_CLIENT_DAYS = 7;

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

function daysAgo(dateValue, days) {
  if (!dateValue) return false;
  const created = new Date(dateValue).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= days * 24 * 60 * 60 * 1000;
}

const QUICK_ACTIONS = [
  {
    id: 'register-staff',
    title: 'Register Staff',
    description: 'Add a chambers account',
    icon: 'users',
    to: '/dashboard/admin/employees',
  },
  {
    id: 'register-client',
    title: 'Register Client',
    description: 'Create a client login',
    icon: 'clients',
    to: '/dashboard/admin/clients',
  },
  {
    id: 'view-consultations',
    title: 'View Consultations',
    description: 'Open the firm queue',
    icon: 'consultations',
    to: '/dashboard/admin/consultations',
  },
  {
    id: 'manage-staff',
    title: 'Manage Staff',
    description: 'Roles & specializations',
    icon: 'users',
    to: '/dashboard/admin/employees',
  },
];

/**
 * Admin home — executive operational dashboard from live modules only.
 */
function AdminWorkspace() {
  const { accessToken, user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [hearingStats, setHearingStats] = useState({ today: 0, this_week: 0, missed: 0 });
  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const firstName = (user?.full_name || 'Administrator').split(' ')[0];
  const todayLabel = useMemo(() => formatDashboardDate(), []);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [staffData, clientData, consData, statsData, revData] = await Promise.all([
        listEmployees(accessToken),
        listClients(accessToken),
        listAdminConsultations(accessToken),
        getHearingStatistics(accessToken),
        getAdminRevenue(accessToken).catch(() => null),
      ]);
      setEmployees(Array.isArray(staffData) ? staffData : []);
      setClients(Array.isArray(clientData) ? clientData : []);
      setConsultations(Array.isArray(consData) ? consData : []);
      setHearingStats(statsData || { today: 0, this_week: 0, missed: 0 });
      setRevenueData(revData);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load firm overview.'));
      setEmployees([]);
      setClients([]);
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);



  const stats = useMemo(() => {
    const activeStaff = employees.filter((e) => e.is_active).length;
    const activeClients = clients.filter((c) => c.is_active).length;
    const awaitingReview = consultations.filter(
      (c) => c.status === 'PENDING' || c.status === 'UNDER_REVIEW'
    ).length;
    const awaitingLawyer = consultations.filter((c) => !c.assigned_lawyer).length;
    return {
      staff: employees.length,
      activeStaff,
      clients: clients.length,
      activeClients,
      consultations: consultations.length,
      awaitingReview,
      awaitingLawyer,
    };
  }, [employees, clients, consultations]);

  const attentionItems = useMemo(() => {
    const items = [];

    const reviewQueue = consultations.filter(
      (c) => c.status === 'PENDING' || c.status === 'UNDER_REVIEW'
    );
    if (reviewQueue.length > 0) {
      items.push({
        id: 'review',
        priority: 'High',
        title: 'Consultations awaiting review',
        description: `${reviewQueue.length} request${reviewQueue.length === 1 ? '' : 's'} ready for firm review.`,
        actionLabel: 'Review queue',
        actionTo: '/dashboard/admin/consultations',
      });
    }

    const unassigned = consultations.filter((c) => !c.assigned_lawyer);
    if (unassigned.length > 0) {
      items.push({
        id: 'assign',
        priority: 'High',
        title: 'Consultations awaiting lawyer assignment',
        description: `${unassigned.length} consultation${unassigned.length === 1 ? '' : 's'} still need an advocate.`,
        actionLabel: 'Assign lawyer',
        actionTo: '/dashboard/admin/consultations',
      });
    }

    const newClients = clients.filter((c) => daysAgo(c.created_at, NEW_CLIENT_DAYS));
    if (newClients.length > 0) {
      items.push({
        id: 'new-clients',
        priority: 'Medium',
        title: 'Newly registered clients',
        description: `${newClients.length} client${newClients.length === 1 ? '' : 's'} registered in the last ${NEW_CLIENT_DAYS} days.`,
        actionLabel: 'View clients',
        actionTo: '/dashboard/admin/clients',
      });
    }

    return items;
  }, [consultations, clients]);

  const kpiCards = [
    {
      id: 'staff',
      icon: 'users',
      value: stats.staff,
      label: 'Staff',
      secondary: `${stats.activeStaff} active`,
    },
    {
      id: 'clients',
      icon: 'clients',
      value: stats.clients,
      label: 'Clients',
      secondary: `${stats.activeClients} active`,
    },
    {
      id: 'consultations',
      icon: 'consultations',
      value: stats.consultations,
      label: 'Consultations',
      secondary: `${stats.awaitingReview} pending review`,
    },
    {
      id: 'unassigned',
      icon: 'cases',
      value: stats.awaitingLawyer,
      label: 'Unassigned',
      secondary: 'Awaiting lawyer',
    },
    {
      id: 'revenue',
      icon: 'billing',
      value: revenueData?.metrics?.total_revenue !== undefined
        ? `₹${Number(revenueData.metrics.total_revenue).toLocaleString('en-IN')}`
        : '₹0',
      label: 'Consultation Revenue',
      secondary: `${revenueData?.metrics?.paid_consultations_count || 0} paid bookings`,
      linkTo: '/dashboard/admin/revenue',
    },
  ];

  return (
    <div className="admin-dash lw-fade-in">
      <header className="admin-dash__header">
        <div className="admin-dash__header-main">
          <p className="section-tag-gold">Firm Administration</p>
          <h1 className="admin-dash__title">
            {getGreeting()}, <em>{firstName}</em>
          </h1>
          <p className="admin-dash__subtitle">
            Monitor firm operations and manage today&apos;s workload.
          </p>
        </div>
        <p className="admin-dash__date">{todayLabel}</p>
      </header>

      {error ? (
        <p className="admin-dash__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="admin-dash__kpis" aria-label="Firm summary">
        {loading ? (
          <p className="lw-muted admin-dash__loading">Loading overview…</p>
        ) : (
          kpiCards.map((card) => {
            const cardInner = (
              <>
                <span className="admin-kpi__icon" aria-hidden="true">
                  <NavIcon name={card.icon} />
                </span>
                <div className="admin-kpi__body">
                  <p className="admin-kpi__value">{card.value}</p>
                  <p className="admin-kpi__label">{card.label}</p>
                  <p className="admin-kpi__secondary">{card.secondary}</p>
                </div>
              </>
            );

            return card.linkTo ? (
              <Link
                key={card.id}
                to={card.linkTo}
                className="admin-kpi admin-kpi--link"
                style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
              >
                {cardInner}
              </Link>
            ) : (
              <article key={card.id} className="admin-kpi">
                {cardInner}
              </article>
            );
          })
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
            <p className="lw-muted">Checking firm queue…</p>
          ) : attentionItems.length === 0 ? (
            <div className="admin-dash__clear">
              <p className="admin-dash__clear-title">All clear</p>
              <p className="admin-dash__clear-desc">
                No consultations or new client registrations need attention right now.
              </p>
            </div>
          ) : (
            <ul className="admin-work">
              {attentionItems.map((item) => (
                <li key={item.id} className="admin-work__card">
                  <div className="admin-work__copy">
                    <span
                      className={`admin-work__priority is-${item.priority.toLowerCase()}`}
                    >
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

      {/* UPCOMING HEARINGS — placed directly below Attention Required & Quick Actions */}
      <section className="admin-dash__hearings" aria-labelledby="hearings-widget-heading">
        <div className="admin-dash__section-head">
          <h2 id="hearings-widget-heading">Upcoming Hearings</h2>
          <Link to="/dashboard/admin/calendar" className="btn btn-ghost-dark admin-dash__view-cal">
            View Calendar
          </Link>
        </div>
        <div className="admin-hearings-card">
          <div className="admin-hearings-stat">
            <p className="admin-hearings-stat__value">{hearingStats.today}</p>
            <p className="admin-hearings-stat__label">Today</p>
          </div>
          <div className="admin-hearings-stat">
            <p className="admin-hearings-stat__value">{hearingStats.this_week}</p>
            <p className="admin-hearings-stat__label">This Week</p>
          </div>
          <div className="admin-hearings-stat">
            <p className="admin-hearings-stat__value admin-hearings-stat__value--alert">{hearingStats.missed}</p>
            <p className="admin-hearings-stat__label">Missed</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminWorkspace;
