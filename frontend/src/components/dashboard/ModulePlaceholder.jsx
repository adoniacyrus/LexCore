import React from 'react';
import PageHeader from './PageHeader';
import WorkspaceCard from './WorkspaceCard';

function ModulePlaceholder({ title, summary }) {
  return (
    <div className="lw-module-soon lw-fade-in">
      <PageHeader
        eyebrow="LexCore Chambers"
        title={title}
        description={summary}
      />
      <WorkspaceCard className="lw-module-soon__card">
        <p className="section-tag-gold">Module Coming Soon</p>
        <h2>This workspace module is being prepared.</h2>
        <p className="auth-sheet-lede">
          The navigation item is reserved so future {title.toLowerCase()} capabilities
          can plug into the same shell without a redesign — cases, filings, and
          chambers workflows will appear here.
        </p>
      </WorkspaceCard>
    </div>
  );
}

export default ModulePlaceholder;
