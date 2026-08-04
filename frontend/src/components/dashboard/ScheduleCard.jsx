import React from 'react';

function ScheduleCard({ time, title, matter, court, status, onOpen }) {
  return (
    <article className="lw-schedule">
      <div className="lw-schedule__time">
        <span className="lw-schedule__time-label">Next Event</span>
        <p className="lw-schedule__clock">{time}</p>
      </div>
      <div className="lw-schedule__body">
        <h3 className="lw-schedule__title">{title}</h3>
        <p className="lw-schedule__matter">{matter}</p>
        <p className="lw-schedule__court">{court}</p>
        <div className="lw-schedule__footer">
          <span className="lw-pill">{status}</span>
          <button type="button" className="btn btn-primary lw-schedule__cta" onClick={onOpen}>
            Open Workspace
          </button>
        </div>
      </div>
    </article>
  );
}

export default ScheduleCard;
