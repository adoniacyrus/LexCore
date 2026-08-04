import React from 'react';
import WorkspaceCard from './WorkspaceCard';

/**
 * Reusable right-rail context for hearings, deadlines, notifications, pins.
 * Pass any subset of sections — layout stays stable as modules grow.
 */
function ContextPanel({
  hearings = [],
  deadlines = [],
  notifications = [],
  pinned = [],
  className = '',
}) {
  return (
    <aside className={`lw-context ${className}`.trim()} aria-label="Workspace context">
      <WorkspaceCard className="lw-context__block" padding="sm">
        <h3 className="lw-context__title">Upcoming Hearings</h3>
        <ul className="lw-context__list">
          {hearings.map((h) => (
            <li key={h.id}>
              <span className="lw-context__time">{h.time}</span>
              <span className="lw-context__main">{h.matter}</span>
              <span className="lw-context__sub">{h.court}</span>
            </li>
          ))}
        </ul>
      </WorkspaceCard>

      <WorkspaceCard className="lw-context__block" padding="sm">
        <h3 className="lw-context__title">Deadlines</h3>
        <ul className="lw-context__list">
          {deadlines.map((d) => (
            <li key={d.id}>
              <span className="lw-context__main">{d.label}</span>
              <span className="lw-context__sub">{d.matter}</span>
              <span className="lw-pill lw-pill--subtle">{d.due}</span>
            </li>
          ))}
        </ul>
      </WorkspaceCard>

      <WorkspaceCard className="lw-context__block" padding="sm">
        <h3 className="lw-context__title">Recent Notifications</h3>
        <ul className="lw-context__list">
          {notifications.slice(0, 3).map((n) => (
            <li key={n.id}>
              <span className="lw-context__main">{n.title}</span>
              <span className="lw-context__sub">{n.body}</span>
              <time className="lw-context__time">{n.time}</time>
            </li>
          ))}
        </ul>
      </WorkspaceCard>

      <WorkspaceCard className="lw-context__block" padding="sm">
        <h3 className="lw-context__title">Pinned Matters</h3>
        <ul className="lw-context__list">
          {pinned.map((p) => (
            <li key={p.id}>
              <span className="lw-context__main">{p.name}</span>
              <span className="lw-context__sub">{p.meta}</span>
            </li>
          ))}
        </ul>
      </WorkspaceCard>
    </aside>
  );
}

export default ContextPanel;
