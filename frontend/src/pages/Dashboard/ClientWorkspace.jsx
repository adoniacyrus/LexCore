import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {
  getErrorMessage,
  listMyConsultations,
} from '../../services/consultationService';
import BookConsultationModal from '../Consultations/BookConsultationModal';
import {
  formatPreferredDate,
  STATUS_LABELS,
} from '../Consultations/consultationConstants';
import '../Consultations/consultations.css';
import './clientWorkspace.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Client home — consultation requests only (live module).
 */
function ClientWorkspace() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookOpen, setBookOpen] = useState(false);
  const firstName = (user?.full_name || 'Client').split(' ')[0];

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listMyConsultations(accessToken);
      const list = Array.isArray(data) ? data : [];
      setAllItems(list);
      setItems(list.slice(0, 5));
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load consultation requests.'));
      setAllItems([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const pending = allItems.filter((item) => item.status === 'PENDING').length;
    const approved = allItems.filter((item) => item.status === 'APPROVED').length;
    return {
      total: allItems.length,
      pending,
      approved,
    };
  }, [allItems]);

  const handleSubmitted = () => {
    load();
    navigate('/dashboard/client/consultations', {
      replace: true,
      state: { success: 'Consultation request submitted successfully.' },
    });
  };

  return (
    <div className="client-home lw-fade-in">
      <header className="client-home__header">
        <div>
          <p className="section-tag-gold">Client Chambers</p>
          <h1 className="client-home__title">
            {getGreeting()}, <em>{firstName}</em>
          </h1>
          <p className="client-home__desc">
            Review and manage your consultation requests with LexCore.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setBookOpen(true)}>
          Book Consultation
        </button>
      </header>

      <section className="client-home__stats" aria-label="Consultation overview">
        {loading ? (
          <p className="lw-muted">Loading overview…</p>
        ) : (
          <>
            <article className="client-stat">
              <p className="client-stat__value">{stats.total}</p>
              <p className="client-stat__label">Total Requests</p>
            </article>
            <article className="client-stat">
              <p className="client-stat__value">{stats.pending}</p>
              <p className="client-stat__label">Pending</p>
            </article>
            <article className="client-stat">
              <p className="client-stat__value">{stats.approved}</p>
              <p className="client-stat__label">Approved</p>
            </article>
          </>
        )}
      </section>

      <section className="client-home__panel" aria-labelledby="recent-consultations-heading">
        <div className="client-home__panel-head">
          <div>
            <h2 id="recent-consultations-heading">Recent Consultations</h2>
            <p>
              {items.length
                ? 'Your most recent consultation requests.'
                : 'Submit a request to speak with our legal team.'}
            </p>
          </div>
          {items.length ? (
            <Link to="/dashboard/client/consultations" className="btn btn-ghost-dark">
              View all
            </Link>
          ) : null}
        </div>

        {loading ? (
          <p className="lw-muted client-home__panel-pad">Loading requests…</p>
        ) : error ? (
          <p className="cons-error client-home__panel-pad" role="alert">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="client-home__panel-pad">
            <EmptyState
              compact
              eyebrow="Consultations"
              title="No consultations yet"
              description="Book your first consultation to get started. Our team will review your request and follow up."
              action={
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setBookOpen(true)}
                >
                  Book your first consultation
                </button>
              }
            />
          </div>
        ) : (
          <div className="client-home__table-wrap">
            <table className="client-home__table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Mode</th>
                  <th>Practice Area</th>
                  <th>Requested Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="client-home__ref">{item.consultation_id}</td>
                    <td>{item.consultation_mode_label || item.consultation_mode || '—'}</td>
                    <td>{item.practice_area_label || '—'}</td>
                    <td>{formatPreferredDate(item.preferred_date)}</td>
                    <td>
                      <span
                        className={`cons-status is-${String(item.status).toLowerCase()}`}
                      >
                        {item.status_label || STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BookConsultationModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}

export default ClientWorkspace;
