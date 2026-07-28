import React from 'react';
import './dashboardHome.css';

function DashboardHomeView({ userName, roleLabel }) {
  return (
    <div className="dash-home">
      <div className="dash-home-inner">
        <p className="dash-home-eyebrow">LexCore Chambers Portal</p>
        <h1 className="dash-home-title">
          Welcome, <em>{userName}</em>
        </h1>
        {roleLabel ? (
          <p className="dash-home-role">
            <span className="dash-home-role-mark" aria-hidden="true" />
            <span className="dash-home-role-text">{roleLabel}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default DashboardHomeView;
