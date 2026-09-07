import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import EmptyState from '../../components/dashboard/EmptyState';
import PageHeader from '../../components/dashboard/PageHeader';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getErrorMessage, listMyConsultations } from '../../services/consultationService';
import BookConsultationModal from './BookConsultationModal';
import ConsultationDetailModal from './ConsultationDetailModal';
import {
  assignedLawyerLabel,
  formatPreferredDate,
  formatPreferredTime,
  paymentStatusLabel,
  practiceAreaLabel,
  STATUS_LABELS,
} from './consultationConstants';
import './consultations.css';

function MyConsultationsPage() {
  const { accessToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.success || '');
  const [selected, setSelected] = useState(null);
  const [bookOpen, setBookOpen] = useState(
    searchParams.get('book') === '1' || Boolean(location.state?.openBook)
  );

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await listMyConsultations(accessToken);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load your consultation requests.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!success) return undefined;
    const id = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(id);
  }, [success]);

  useEffect(() => {
    if (searchParams.get('book') === '1') {
      setBookOpen(true);
    }
  }, [searchParams]);

  const openBook = () => {
    setBookOpen(true);
    setSearchParams({ book: '1' }, { replace: true });
  };

  const closeBook = () => {
    setBookOpen(false);
    if (searchParams.get('book')) {
      setSearchParams({}, { replace: true });
    }
    if (location.state?.openBook) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  };

  const handleSubmitted = () => {
    setSuccess('Consultation request submitted successfully.');
    load();
  };

  return (
    <DashboardLayout showContext={false} activeModule="consultations" fillHeight>
      <div className="cons-page cons-page--fill lw-fade-in">
        <PageHeader
          eyebrow="Client Chambers"
          title="My Consultations"
          description="Track consultation requests you have submitted to LexCore. Select a row to view full details."
          actions={
            <button type="button" className="btn btn-primary" onClick={openBook}>
              Book Consultation
            </button>
          }
        />

        {success ? (
          <p className="cons-hint" role="status" style={{ borderLeftColor: 'var(--color-primary)' }}>
            {success}
          </p>
        ) : null}

        {error ? <p className="cons-error" role="alert">{error}</p> : null}

        <div className="cons-table-wrap">
          {loading ? (
            <div className="cons-empty">Loading consultations…</div>
          ) : items.length === 0 ? (
            <EmptyState
              eyebrow="Consultations"
              title="No consultations yet"
              description="Book your first consultation to speak with our legal team. Your requests will appear here with a reference number and status."
              action={
                <button type="button" className="btn btn-primary" onClick={openBook}>
                  Book your first consultation
                </button>
              }
            />
          ) : (
            <table className="cons-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Subject</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Requested Date</th>
                  <th>Time</th>
                  <th>Practice Area</th>
                  <th>Assigned Lawyer</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cons-table__row-clickable"
                    tabIndex={0}
                    onClick={() => setSelected(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(item);
                      }
                    }}
                  >
                    <td className="cons-ref">{item.consultation_id}</td>
                    <td>{item.subject}</td>
                    <td>{item.consultation_mode_label || item.consultation_mode || '—'}</td>
                    <td>
                      <span className={`cons-status is-${String(item.status).toLowerCase()}`}>
                        {item.status_label || STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`cons-status ${
                          item.payment_status === 'PAID'
                            ? 'is-approved'
                            : item.payment_status === 'FAILED'
                            ? 'is-rejected'
                            : 'is-pending'
                        }`}
                      >
                        {paymentStatusLabel(item)}
                      </span>
                    </td>
                    <td>{formatPreferredDate(item.preferred_date)}</td>
                    <td>{formatPreferredTime(item.preferred_time)}</td>
                    <td>{practiceAreaLabel(item)}</td>
                    <td>{assignedLawyerLabel(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <BookConsultationModal
        open={bookOpen}
        onClose={closeBook}
        onSubmitted={handleSubmitted}
      />

      <ConsultationDetailModal
        open={Boolean(selected)}
        consultation={selected}
        onClose={() => setSelected(null)}
        onUpdated={() => load()}
      />
    </DashboardLayout>
  );
}

export default MyConsultationsPage;
