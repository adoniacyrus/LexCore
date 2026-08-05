import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import { useAuth } from '../context/AuthContext';
import './dashboardLayout.css';

function resolveActiveModule(pathname) {
  if (pathname.includes('/employees')) return 'users';
  if (pathname.includes('/practice-areas')) return 'practice-areas';
  if (pathname.includes('/senior/consultations') || pathname.includes('/junior/consultations')) {
    return 'assigned-consultations';
  }
  if (pathname.includes('/consultations')) return 'consultations';
  if (pathname.includes('/account')) return 'account';
  return 'dashboard';
}

/**
 * Authenticated legal workspace shell.
 * Context rail and mock notifications are off until those modules exist.
 */
function DashboardLayout({
  children,
  showContext = false,
  activeModule: activeModuleProp,
  onQuickActions,
  fillHeight = false,
}) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const role = user?.role || 'CLIENT';
  const activeModule =
    activeModuleProp || resolveActiveModule(location.pathname);

  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.classList.toggle('lw-nav-lock', mobileNav);
    return () => document.body.classList.remove('lw-nav-lock');
  }, [mobileNav]);

  useEffect(() => {
    document.body.classList.toggle('lw-shell-fill-lock', fillHeight);
    return () => document.body.classList.remove('lw-shell-fill-lock');
  }, [fillHeight]);

  const handleMenuToggle = () => {
    if (window.matchMedia('(max-width: 960px)').matches) {
      setMobileNav((v) => !v);
    } else {
      setSidebarCollapsed((v) => !v);
    }
  };

  return (
    <div
      className={`lw-shell ${sidebarCollapsed ? 'lw-shell--collapsed' : ''} ${fillHeight ? 'lw-shell--fill' : ''}`.trim()}
    >
      <DashboardSidebar
        role={role}
        activeModule={activeModule}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNav}
        onNavigate={() => setMobileNav(false)}
      />

      {mobileNav ? (
        <button
          type="button"
          className="lw-shell__scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      ) : null}

      <div className="lw-shell__main">
        <DashboardHeader
          notifications={[]}
          onMenuToggle={handleMenuToggle}
          onQuickActions={onQuickActions}
          showQuickActions={typeof onQuickActions === 'function'}
          showSearch={false}
          showNotifications={false}
        />

        <div className={`lw-shell__body ${showContext ? 'has-context' : ''}`.trim()}>
          <main className="lw-shell__workspace" id="workspace-main">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
