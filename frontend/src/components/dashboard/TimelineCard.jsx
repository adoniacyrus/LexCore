import React from 'react';

/** Single agenda row — reusable for hearing schedules later */
function TimelineCard({ time, title, meta, type = 'default' }) {
  return (
    <li className={`lw-timeline-item lw-timeline-item--${type}`}>
      <div className="lw-timeline-item__rail" aria-hidden="true">
        <span className="lw-timeline-item__dot" />
      </div>
      <div className="lw-timeline-item__time">{time}</div>
      <div className="lw-timeline-item__content">
        <p className="lw-timeline-item__title">{title}</p>
        {meta ? <p className="lw-timeline-item__meta">{meta}</p> : null}
      </div>
    </li>
  );
}

export function AgendaTimeline({ items = [] }) {
  if (!items.length) {
    return <p className="lw-muted">No events scheduled for today.</p>;
  }

  return (
    <ol className="lw-timeline">
      {items.map((item) => (
        <TimelineCard
          key={item.id}
          time={item.time}
          title={item.title}
          meta={item.meta}
          type={item.type}
        />
      ))}
    </ol>
  );
}

export default TimelineCard;
