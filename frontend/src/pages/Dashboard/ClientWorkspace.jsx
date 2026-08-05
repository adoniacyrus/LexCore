import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyState from '../../components/dashboard/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {
  getErrorMessage,
  listMyConsultations,
} from '../../services/consultationService';
import BookConsultationModal from '../Consultations/BookConsultationModal';
import ConsultationDetailModal from '../Consultations/ConsultationDetailModal';
import {
  assignedLawyerLabel,
  formatPreferredDate,
  formatPreferredTime,
  practiceAreaLabel,
  STATUS_LABELS,
} from '../Consultations/consultationConstants';
import '../Consultations/consultations.css';
import './clientWorkspace.css';

/**
 * Client home — full-width consultation overview (live module only).
 */
function ClientWorkspace() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookOpen, setBookOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listMyConsultations(accessToken);
      const list = Array.isArray(data) ? data : [];
      setAllItems(list);
      setItems(list.slice(0, 6));
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
    const accepted = allItems.filter(
      (item) => item.status === 'APPROVED' || item.status === 'ACCEPTED'
    ).length;
    const completed = allItems.filter((item) => item.status === 'COMPLETED').length;
    return {
      total: allItems.length,
      pending,
      accepted,
      completed,
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
          <h1 className="client-home__title">Consultation Overview</h1>
        </div>
        <div className="client-home__actions">
          <Link to="/dashboard/client/consultations" className="btn btn-ghost-dark">
            My Consultations
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => setBookOpen(true)}>
            Book Consultation
          </button>
        </div>
      </header>

      <section className="client-home__stats" aria-label="Consultation overview">
        {loading ? (
          <p className="lw-muted client-home__stats-loading">Loading overview…</p>
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
              <p className="client-stat__value">{stats.accepted}</p>
              <p className="client-stat__label">Accepted</p>
            </article>
            <article className="client-stat">
              <p className="client-stat__value">{stats.completed}</p>
              <p className="client-stat__label">Completed</p>
            </article>
          </>
        )}
      </section>

      <section className="client-home__panel" aria-labelledby="recent-consultations-heading">
        <div className="client-home__panel-head">
          <div>
            <h2 id="recent-consultations-heading">Recent Consultations</h2>
            <p>Select a row to view full booking details.</p>
          </div>
          {items.length ? (
            <Link to="/dashboard/client/consultations" className="btn btn-ghost-dark">
              View all
            </Link>
          ) : null}
        </div>

        <div className="client-home__panel-body">
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
                description="Book your first consultation to get started."
                action={
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setBookOpen(true)}
                  >
                    Book Consultation
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
                    <th>Status</th>
                    <th>Lawyer</th>
                    <th>Practice Area</th>
                    <th>Mode</th>
                    <th>Date</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="client-home__row"
                      tabIndex={0}
                      onClick={() => setSelected(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelected(item);
                        }
                      }}
                    >
                      <td className="client-home__ref">{item.consultation_id}</td>
                      <td>
                        <span className={`cons-status is-${String(item.status).toLowerCase()}`}>
                          {item.status_label || STATUS_LABELS[item.status] || item.status}
                        </span>
                      </td>
                      <td>{assignedLawyerLabel(item)}</td>
                      <td>{practiceAreaLabel(item)}</td>
                      <td>{item.consultation_mode_label || item.consultation_mode || '—'}</td>
                      <td>{formatPreferredDate(item.preferred_date)}</td>
                      <td>{formatPreferredTime(item.preferred_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <BookConsultationModal
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        onSubmitted={handleSubmitted}
      />

      <ConsultationDetailModal
        open={Boolean(selected)}
        consultation={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

export default ClientWorkspace;
