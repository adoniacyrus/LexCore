import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/dashboard/PageHeader';
import { NavIcon } from '../../components/dashboard/icons';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getMatterBoardSummary, getErrorMessage } from '../../services/caseService';
import { getDashboardPath } from '../../utils/roleRoutes';
import './cases.css';

function MatterBoardPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const result = await getMatterBoardSummary(accessToken);
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load Matter Board workspace summaries.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const role = user?.role || 'CLIENT';
  const dashboardPath = getDashboardPath(role);

  const handleCategoryClick = (categoryCode) => {
    navigate(`${dashboardPath}/cases?category=${categoryCode}`);
  };

  const summary = data?.summary || { total: 0, open: 0, closed: 0, archived: 0 };
  const categories = data?.categories || [];

  const kpiCards = [
    {
      id: 'total',
      icon: 'cases',
      value: summary.total,
      label: 'Total Matters',
      secondary: 'All recorded matters',
      color: 'var(--color-primary)'
    },
    {
      id: 'open',
      icon: 'consultations',
      value: summary.open,
      label: 'Open Matters',
      secondary: 'Active cases in progress',
      color: '#27ae60'
    },
    {
      id: 'closed',
      icon: 'check',
      value: summary.closed,
      label: 'Closed Matters',
      secondary: 'Successfully resolved files',
      color: '#888'
    },
    {
      id: 'archived',
      icon: 'reports',
      value: summary.archived,
      label: 'Archived Matters',
      secondary: 'Historical case records',
      color: '#2c3e50'
    }
  ];

  return (
    <DashboardLayout showContext={false} activeModule="matter-board">
      <div className="cases-page matter-board-page lw-fade-in">
        <PageHeader
          title="Matter Board"
          description="Categorized dashboard to monitor legal matters and case lifecycle stages."
        />

        {error ? (
          <p className="cases-error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="matter-board__loading">
            Loading Matter Board aggregates…
          </div>
        ) : (
          <div className="matter-board">
            <section className="admin-dash__kpis matter-board__kpis" aria-label="Matter statistics summary">
              {kpiCards.map((card) => (
                <article key={card.id} className="admin-kpi matter-board__kpi">
                  <span className="admin-kpi__icon matter-board__kpi-icon">
                    <NavIcon name={card.icon} />
                  </span>
                  <div className="admin-kpi__body">
                    <p className="admin-kpi__value matter-board__kpi-value">{card.value}</p>
                    <p className="admin-kpi__label matter-board__kpi-label">{card.label}</p>
                    <p className="admin-kpi__secondary matter-board__kpi-secondary">{card.secondary}</p>
                  </div>
                </article>
              ))}
            </section>

            <section className="matter-board__categories" aria-label="Matter Categories Board">
              <h2 className="case-section__title matter-board__section-title">Matters By Category</h2>
              <div className="matter-board__grid">
                {categories.map((cat) => (
                  <article
                    key={cat.category}
                    className="matter-board-card"
                    onClick={() => handleCategoryClick(cat.category)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCategoryClick(cat.category);
                      }
                    }}
                  >
                    <h3 className="matter-board-card__title">{cat.category_label}</h3>
                    <div className="matter-board-card__stats">
                      <div className="matter-board-card__stat-item">
                        <span className="matter-board-card__stat-value">{cat.total}</span>
                        <span className="matter-board-card__stat-label">Total</span>
                      </div>
                      <div className="matter-board-card__stat-item">
                        <span className="matter-board-card__stat-value" style={{ color: '#27ae60' }}>{cat.open}</span>
                        <span className="matter-board-card__stat-label">Open</span>
                      </div>
                      <div className="matter-board-card__stat-item">
                        <span className="matter-board-card__stat-value" style={{ color: '#c0392b' }}>{cat.closed}</span>
                        <span className="matter-board-card__stat-label">Closed</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default MatterBoardPage;
