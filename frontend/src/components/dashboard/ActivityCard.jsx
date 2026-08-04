import React from 'react';

function ActivityCard({ title, detail, time, type = 'default' }) {
  return (
    <li className={`lw-activity lw-activity--${type}`}>
      <span className="lw-activity__mark" aria-hidden="true" />
      <div className="lw-activity__body">
        <div className="lw-activity__row">
          <p className="lw-activity__title">{title}</p>
          <time className="lw-activity__time">{time}</time>
        </div>
        {detail ? <p className="lw-activity__detail">{detail}</p> : null}
      </div>
    </li>
  );
}

export function ActivityFeed({ items = [] }) {
  if (!items.length) {
    return <p className="lw-muted">No recent activity.</p>;
  }

  return (
    <ul className="lw-activity-list">
      {items.map((item) => (
        <ActivityCard
          key={item.id}
          title={item.title}
          detail={item.detail}
          time={item.time}
          type={item.type}
        />
      ))}
    </ul>
  );
}

export default ActivityCard;
