import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ContextPanel from '../components/dashboard/ContextPanel';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import { useAuth } from '../context/AuthContext';
import { getWorkspaceContent } from '../data/dashboard/roleWorkspaces';
import './dashboardLayout.css';

function resolveActiveModule(pathname, search) {
  if (pathname.includes('/employees')) return 'users';
  const params = new URLSearchParams(search);
  return params.get('module') || 'dashboard';
}

/**
 * Authenticated legal workspace shell.
 * Pages opt in by wrapping content — AppRouter paths stay unchanged.
 */
function DashboardLayout({
  children,
  showContext = true,
  contextOverride = null,
  activeModule: activeModuleProp,
  onQuickActions,
  fillHeight = false,
}) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const role = user?.role || 'CLIENT';
  const workspace = useMemo(() => getWorkspaceContent(role), [role]);
  const activeModule =
    activeModuleProp || resolveActiveModule(location.pathname, location.search);
  const context = contextOverride || workspace.context;

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
          notifications={context.notifications}
          onMenuToggle={handleMenuToggle}
          onQuickActions={onQuickActions}
          showQuickActions={typeof onQuickActions === 'function'}
        />

        <div className={`lw-shell__body ${showContext ? 'has-context' : ''}`.trim()}>
          <main className="lw-shell__workspace" id="workspace-main">
            {children}
          </main>

          {showContext ? (
            <ContextPanel
              hearings={context.hearings}
              deadlines={context.deadlines}
              notifications={context.notifications}
              pinned={context.pinned}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
