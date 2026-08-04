import React from 'react';

function NotificationPanel({ items = [], onClose }) {
  return (
    <div className="lw-notif-panel" role="dialog" aria-label="Notifications">
      <div className="lw-notif-panel__head">
        <h3>Notifications</h3>
        {onClose ? (
          <button type="button" className="lw-icon-btn" onClick={onClose} aria-label="Close notifications">
            ×
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="lw-muted lw-notif-panel__empty">You are caught up.</p>
      ) : (
        <ul className="lw-notif-panel__list">
          {items.map((item) => (
            <li key={item.id} className={item.unread ? 'is-unread' : ''}>
              <p className="lw-notif-panel__title">{item.title}</p>
              <p className="lw-notif-panel__body">{item.body}</p>
              <time>{item.time}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default NotificationPanel;
