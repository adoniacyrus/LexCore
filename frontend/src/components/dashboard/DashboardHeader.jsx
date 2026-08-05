import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../data/dashboard/roleWorkspaces';
import NotificationPanel from './NotificationPanel';
import { NavIcon } from './icons';

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatLongDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function DashboardHeader({
  notifications = [],
  onMenuToggle,
  onQuickActions,
  showQuickActions = false,
  showSearch = false,
  showNotifications = false,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const name = user?.full_name || 'Counsel';
  const roleLabel = getRoleLabel(user?.role);
  const unread = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    const onDoc = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="lw-header">
      <div className="lw-header__left">
        <button
          type="button"
          className="lw-icon-btn lw-header__menu"
          onClick={onMenuToggle}
          aria-label="Toggle navigation"
        >
          <NavIcon name="menu" />
        </button>
        <div className="lw-header__greeting">
          <p className="lw-header__hello">
            {getGreeting()}, <em>{name.split(' ')[0]}</em>
          </p>
          <p className="lw-header__date section-tag-gold" style={{ marginBottom: 0 }}>
            {formatLongDate()}
          </p>
        </div>
      </div>

      {showSearch ? (
        <div className="lw-header__search">
          <NavIcon name="search" />
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Global search"
          />
        </div>
      ) : (
        <div className="lw-header__spacer" aria-hidden="true" />
      )}

      <div className="lw-header__right">
        {showQuickActions ? (
          <button type="button" className="btn btn-primary lw-header__qa" onClick={onQuickActions}>
            Quick Actions
          </button>
        ) : null}

        {showNotifications ? (
          <div className="lw-header__notif" ref={notifRef}>
            <button
              type="button"
              className="lw-icon-btn"
              aria-label="Notifications"
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileOpen(false);
              }}
            >
              <NavIcon name="bell" />
              {unread > 0 ? <span className="lw-header__dot">{unread}</span> : null}
            </button>
            {notifOpen ? (
              <NotificationPanel items={notifications} onClose={() => setNotifOpen(false)} />
            ) : null}
          </div>
        ) : null}

        <div className="lw-header__profile" ref={profileRef}>
          <button
            type="button"
            className="lw-profile-btn"
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotifOpen(false);
            }}
            aria-expanded={profileOpen}
          >
            <span className="lw-avatar" aria-hidden="true">
              {name.charAt(0)}
            </span>
            <span className="lw-profile-btn__meta">
              <span className="lw-profile-btn__name">{name}</span>
              <span className="lw-profile-btn__role">{roleLabel}</span>
            </span>
          </button>
          {profileOpen ? (
            <div className="lw-profile-menu" role="menu">
              <p className="lw-profile-menu__email">{user?.email}</p>
              <button type="button" role="menuitem" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;
