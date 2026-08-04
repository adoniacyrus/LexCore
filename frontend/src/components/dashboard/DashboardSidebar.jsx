import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import BrandMark from '../BrandMark';
import { PORTAL_NAV_ITEMS } from '../../data/dashboard/navItems';
import { getDashboardPath } from '../../utils/roleRoutes';
import { NavIcon } from './icons';

function DashboardSidebar({
  role,
  activeModule = 'dashboard',
  collapsed = false,
  mobileOpen = false,
  onNavigate,
}) {
  const navigate = useNavigate();
  const homePath = getDashboardPath(role);

  const handleItem = (item) => {
    onNavigate?.();

    if (item.id === 'dashboard') {
      navigate(homePath);
      return;
    }

    if (item.route && (!item.roles || item.roles.includes(role))) {
      navigate(item.route);
      return;
    }

    navigate({ pathname: homePath, search: `?module=${item.id}` });
  };

  return (
    <aside
      className={`lw-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`.trim()}
      aria-label="Portal navigation"
    >
      <Link to={homePath} className="lw-sidebar__brand" onClick={() => onNavigate?.()}>
        <BrandMark size="md" />
        <div className="lw-sidebar__brand-text">
          <p className="lw-sidebar__product">LexCore</p>
          <p className="lw-sidebar__tag">Advocates & Legal Consultants</p>
        </div>
      </Link>

      <nav className="lw-sidebar__nav">
        {PORTAL_NAV_ITEMS.map((item) => {
          const isUsersLive = item.id === 'users' && role === 'ADMIN';
          const isActive = activeModule === item.id;

          if (isUsersLive) {
            return (
              <NavLink
                key={item.id}
                to={item.route}
                className={({ isActive: routeActive }) =>
                  `lw-sidebar__link ${routeActive || activeModule === 'users' ? 'is-active' : ''}`
                }
                onClick={() => onNavigate?.()}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              className={`lw-sidebar__link ${isActive ? 'is-active' : ''}`}
              onClick={() => handleItem(item)}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default DashboardSidebar;
