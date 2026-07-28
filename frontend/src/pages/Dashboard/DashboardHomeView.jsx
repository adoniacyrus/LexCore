import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './dashboardHome.css';

function DashboardHomeView({ userName, roleLabel }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const displayName = user?.full_name || userName || 'User';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dash-home">
      <div className="dash-home-inner">
        <p className="dash-home-eyebrow">LexCore Chambers Portal</p>
        <h1 className="dash-home-title">
          Welcome, <em>{displayName}</em>
        </h1>
        {roleLabel ? (
          <p className="dash-home-role">
            <span className="dash-home-role-mark" aria-hidden="true" />
            <span className="dash-home-role-text">{roleLabel}</span>
          </p>
        ) : null}
        <p style={{ marginTop: '1.75rem' }}>
          <button type="button" className="btn btn-ghost-dark" onClick={handleLogout}>
            Logout
          </button>
        </p>
      </div>
    </div>
  );
}

export default DashboardHomeView;
