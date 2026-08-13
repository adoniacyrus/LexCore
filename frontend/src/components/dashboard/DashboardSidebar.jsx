import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import BrandMark from '../BrandMark';
import { getNavItemsForRole } from '../../data/dashboard/navItems';
import { useAuth } from '../../context/AuthContext';
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
  const { logout } = useAuth();
  const homePath = getDashboardPath(role);
  const items = getNavItemsForRole(role);

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
    navigate('/login', { replace: true });
  };

  const renderLink = (item) => {
    const isActive = activeModule === item.id;

    if (item.id === 'dashboard') {
      return (
        <NavLink
          key={item.id}
          to={homePath}
          end
          className={({ isActive: routeActive }) =>
            `lw-sidebar__link ${routeActive || isActive ? 'is-active' : ''}`
          }
          onClick={() => onNavigate?.()}
          title={collapsed ? item.label : undefined}
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      );
    }

    if (item.route) {
      return (
        <NavLink
          key={item.id}
          to={item.route}
          className={({ isActive: routeActive }) =>
            `lw-sidebar__link ${routeActive || isActive ? 'is-active' : ''}`
          }
          onClick={() => onNavigate?.()}
          title={collapsed ? item.label : undefined}
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      );
    }

    return null;
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
        {items.map((groupOrItem, index) => {
          if (groupOrItem.group && Array.isArray(groupOrItem.items)) {
            return (
              <div key={groupOrItem.group || index} className="lw-sidebar__group">
                <p className="lw-sidebar__group-title">{groupOrItem.group}</p>
                {groupOrItem.items.map((item) => renderLink(item))}
              </div>
            );
          }
          return renderLink(groupOrItem);
        })}
      </nav>

      <div className="lw-sidebar__footer">
        <button
          type="button"
          className="lw-sidebar__link lw-sidebar__logout"
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
        >
          <NavIcon name="logout" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default DashboardSidebar;
