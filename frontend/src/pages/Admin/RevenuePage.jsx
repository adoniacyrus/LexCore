import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/dashboard/PageHeader';
import EmptyState from '../../components/dashboard/EmptyState';
import { NavIcon } from '../../components/dashboard/icons';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getAdminRevenue, getErrorMessage } from '../../services/paymentService';
import { listActiveLawyers } from '../../services/caseService';
import './revenue.css';

function RevenueCard({ title, amount, subtitle, icon, highlight = false, isDanger = false, isWarning = false, isCurrency = true }) {
  return (
    <div className={`rev-metric-card ${highlight ? 'is-highlight' : ''} ${isDanger ? 'is-danger' : ''} ${isWarning ? 'is-warning' : ''}`}>
      <div className="rev-metric-card__header">
        <span className="rev-metric-card__label">{title}</span>
        {icon && <span className="rev-metric-card__icon" aria-hidden="true"><NavIcon name={icon} /></span>}
      </div>
      <div className="rev-metric-card__amount">
        {typeof amount === 'number'
          ? (isCurrency ? `₹${amount.toLocaleString('en-IN')}` : amount.toLocaleString('en-IN'))
          : amount}
      </div>
      {subtitle && <div className="rev-metric-card__sub">{subtitle}</div>}
    </div>
  );
}

function RevenuePage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState(null);
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [consType, setConsType] = useState('ALL');
  const [selectedLawyer, setSelectedLawyer] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('ALL');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (consType && consType !== 'ALL') params.consultation_type = consType;
      if (selectedLawyer) params.lawyer_id = selectedLawyer;
      if (paymentStatus && paymentStatus !== 'ALL') params.payment_status = paymentStatus;

      const [revData, lawyersData] = await Promise.all([
        getAdminRevenue(accessToken, params),
        listActiveLawyers(accessToken).catch(() => []),
      ]);

      setData(revData);
      setLawyers(Array.isArray(lawyersData) ? lawyersData : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load revenue data.'));
    } finally {
      setLoading(false);
    }
  }, [accessToken, fromDate, toDate, consType, selectedLawyer, paymentStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResetFilters = () => {
    setFromDate('');
    setToDate('');
    setConsType('ALL');
    setSelectedLawyer('');
    setPaymentStatus('ALL');
  };

  const metrics = data?.metrics || {
    total_revenue: 0,
    new_matter_revenue: 0,
    existing_case_revenue: 0,
    paid_consultations_count: 0,
    new_matter_count: 0,
    existing_case_count: 0,
    pending_payments_count: 0,
    failed_payments_count: 0,
  };

  const transactions = data?.transactions || [];
  const revenueByLawyer = data?.revenue_by_lawyer || [];
  const revenueByPracticeArea = data?.revenue_by_practice_area || [];
  const revenueByMonth = data?.revenue_by_month || [];

  return (
    <DashboardLayout showContext={false} activeModule="revenue">
      <div className="revenue-page lw-fade-in">
        <PageHeader
          eyebrow="Financial Operations"
          title="Consultation & Appointment Revenue"
          description="Audited practice revenue generated from captured client consultations and case appointments."
        />

        {error ? (
          <p className="rev-error" role="alert">
            {error}
          </p>
        ) : null}

        {/* PRIMARY METRICS ROW */}
        <section className="rev-metrics-grid" aria-label="Revenue summary">
          <RevenueCard
            title="Total Verified Revenue"
            amount={Number(metrics.total_revenue)}
            subtitle={`${metrics.paid_consultations_count} paid bookings`}
            icon="billing"
            highlight
          />
          <RevenueCard
            title="New Matter Intake"
            amount={Number(metrics.new_matter_revenue)}
            subtitle={`${metrics.new_matter_count} intake consultations`}
            icon="consultations"
          />
          <RevenueCard
            title="Existing Case Appointments"
            amount={Number(metrics.existing_case_revenue)}
            subtitle={`${metrics.existing_case_count} case appointments`}
            icon="cases"
          />
          <RevenueCard
            title="Pending Checkouts"
            amount={metrics.pending_payments_count}
            subtitle="Awaiting client payment"
            icon="billing"
            isWarning={metrics.pending_payments_count > 0}
            isCurrency={false}
          />
          <RevenueCard
            title="Failed Transactions"
            amount={metrics.failed_payments_count}
            subtitle="Unsuccessful checkout attempts"
            icon="billing"
            isDanger={metrics.failed_payments_count > 0}
            isCurrency={false}
          />
        </section>

        {/* FILTERS TOOLBAR */}
        <section className="rev-filters-toolbar" aria-label="Filter revenue reports">
          <div className="rev-filter-group">
            <label htmlFor="rev-from-date">From Date</label>
            <input
              id="rev-from-date"
              type="date"
              className="rev-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="rev-filter-group">
            <label htmlFor="rev-to-date">To Date</label>
            <input
              id="rev-to-date"
              type="date"
              className="rev-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="rev-filter-group">
            <label htmlFor="rev-type">Booking Type</label>
            <select
              id="rev-type"
              className="rev-select"
              value={consType}
              onChange={(e) => setConsType(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="NEW_MATTER">New Legal Matter</option>
              <option value="EXISTING_CASE">Existing Case Appointment</option>
            </select>
          </div>

          <div className="rev-filter-group">
            <label htmlFor="rev-lawyer">Counsel</label>
            <select
              id="rev-lawyer"
              className="rev-select"
              value={selectedLawyer}
              onChange={(e) => setSelectedLawyer(e.target.value)}
            >
              <option value="">All Advocates</option>
              {lawyers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name} ({l.role === 'SENIOR_LAWYER' ? 'Senior' : 'Junior'})
                </option>
              ))}
            </select>
          </div>

          <div className="rev-filter-group">
            <label htmlFor="rev-status">Payment Status</label>
            <select
              id="rev-status"
              className="rev-select"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
            >
              <option value="ALL">All Payments</option>
              <option value="CAPTURED">Captured / Paid Only</option>
              <option value="PENDING">Pending Only</option>
              <option value="FAILED">Failed Only</option>
            </select>
          </div>

          {(fromDate || toDate || consType !== 'ALL' || selectedLawyer || paymentStatus !== 'ALL') && (
            <button
              type="button"
              className="btn btn-ghost-dark rev-reset-btn"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          )}
        </section>

        {/* BREAKDOWNS SECTION */}
        <div className="rev-breakdowns-grid">
          {/* LAWYER BREAKDOWN */}
          <div className="rev-breakdown-card">
            <h3 className="rev-breakdown-title">Revenue by Advocate</h3>
            {revenueByLawyer.length === 0 ? (
              <p className="rev-empty-text">No verified payments found for selected criteria.</p>
            ) : (
              <div className="rev-breakdown-list">
                {revenueByLawyer.map((item, idx) => (
                  <div key={item.id || idx} className="rev-breakdown-item">
                    <div className="rev-breakdown-name">
                      <strong>{item.name}</strong>
                      <span>{item.count} booking{item.count === 1 ? '' : 's'}</span>
                    </div>
                    <div className="rev-breakdown-amount">
                      ₹{Number(item.revenue).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PRACTICE AREA BREAKDOWN */}
          <div className="rev-breakdown-card">
            <h3 className="rev-breakdown-title">Revenue by Practice Area</h3>
            {revenueByPracticeArea.length === 0 ? (
              <p className="rev-empty-text">No verified payments found for selected criteria.</p>
            ) : (
              <div className="rev-breakdown-list">
                {revenueByPracticeArea.map((item, idx) => (
                  <div key={item.id || idx} className="rev-breakdown-item">
                    <div className="rev-breakdown-name">
                      <strong>{item.name}</strong>
                      <span>{item.count} booking{item.count === 1 ? '' : 's'}</span>
                    </div>
                    <div className="rev-breakdown-amount">
                      ₹{Number(item.revenue).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MONTHLY BREAKDOWN */}
          <div className="rev-breakdown-card">
            <h3 className="rev-breakdown-title">Monthly Timeline</h3>
            {revenueByMonth.length === 0 ? (
              <p className="rev-empty-text">No verified payments found for selected criteria.</p>
            ) : (
              <div className="rev-breakdown-list">
                {revenueByMonth.map((item) => (
                  <div key={item.month} className="rev-breakdown-item">
                    <div className="rev-breakdown-name">
                      <strong>{item.label}</strong>
                      <span>{item.count} booking{item.count === 1 ? '' : 's'}</span>
                    </div>
                    <div className="rev-breakdown-amount">
                      ₹{Number(item.revenue).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECENT TRANSACTIONS TABLE */}
        <section className="rev-transactions-section" aria-labelledby="rev-tx-title">
          <div className="rev-section-head">
            <h2 id="rev-tx-title" className="rev-section-title">Transactions &amp; Payment Audit</h2>
            <span className="rev-section-count">{transactions.length} record{transactions.length === 1 ? '' : 's'}</span>
          </div>

          {loading ? (
            <div className="rev-loading">Loading transaction records…</div>
          ) : transactions.length === 0 ? (
            <EmptyState
              eyebrow="Transactions"
              title="No transactions found"
              description="No payment records match your selected filter criteria."
            />
          ) : (
            <div className="rev-table-wrap">
              <table className="rev-table">
                <thead>
                  <tr>
                    <th>Ref &amp; Category</th>
                    <th>Linked Case</th>
                    <th>Client</th>
                    <th>Assigned Counsel</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Payment Reference</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isPaid = tx.status === 'CAPTURED';
                    const isFailed = tx.status === 'FAILED';
                    const isExistingCase = tx.consultation_type === 'EXISTING_CASE';

                    return (
                      <tr key={tx.id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                              {tx.consultation_id}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: isExistingCase ? '#855b1b' : '#2c4a6f',
                                fontWeight: 600,
                              }}
                            >
                              {tx.consultation_type_label || (isExistingCase ? 'Existing Case' : 'New Matter')}
                            </span>
                          </div>
                        </td>
                        <td>
                          {tx.case_reference ? (
                            <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.82rem' }}>
                              {tx.case_reference}
                            </span>
                          ) : (
                            <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.8rem' }}>None</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{tx.client_name}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem' }}>{tx.lawyer_name}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                            ₹{Number(tx.amount_rupees).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td>
                          <span className={`cons-status ${isPaid ? 'is-approved' : isFailed ? 'is-rejected' : 'is-pending'}`}>
                            {tx.status_label || tx.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#444' }}>
                              {tx.razorpay_payment_id || '—'}
                            </span>
                            {tx.razorpay_order_id && (
                              <span style={{ fontSize: '0.7rem', color: '#888' }}>
                                {tx.razorpay_order_id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: '#666', whiteSpace: 'nowrap' }}>
                            {tx.paid_at || tx.created_at
                              ? new Date(tx.paid_at || tx.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

export default RevenuePage;
