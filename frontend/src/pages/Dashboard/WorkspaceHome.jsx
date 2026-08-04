import React, { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActivityFeed } from '../../components/dashboard/ActivityCard';
import CaseCard from '../../components/dashboard/CaseCard';
import InfoBanner from '../../components/dashboard/InfoBanner';
import ModulePlaceholder from '../../components/dashboard/ModulePlaceholder';
import PageHeader from '../../components/dashboard/PageHeader';
import QuickActionCard from '../../components/dashboard/QuickActionCard';
import ScheduleCard from '../../components/dashboard/ScheduleCard';
import StatCard from '../../components/dashboard/StatCard';
import { AgendaTimeline } from '../../components/dashboard/TimelineCard';
import WidgetContainer from '../../components/dashboard/WidgetContainer';
import { MODULE_META } from '../../data/dashboard/navItems';
import { getRoleLabel, getWorkspaceContent } from '../../data/dashboard/roleWorkspaces';
import { useAuth } from '../../context/AuthContext';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Role-agnostic home composition.
 * Content is injected from roleWorkspaces — layout never branches on role.
 */
function WorkspaceHome({ quickActionsRef }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('module');
  const localQaRef = useRef(null);
  const qaRef = quickActionsRef || localQaRef;

  const role = user?.role || 'CLIENT';
  const content = useMemo(() => getWorkspaceContent(role), [role]);
  const firstName = (user?.full_name || 'Counsel').split(' ')[0];

  if (moduleId && MODULE_META[moduleId]) {
    const meta = MODULE_META[moduleId];
    return <ModulePlaceholder title={meta.title} summary={meta.summary} />;
  }

  const scrollToActions = () => {
    qaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="lw-workspace-home">
      <PageHeader
        eyebrow="Today's Brief"
        title={
          <>
            {getGreeting()}, <em style={{ color: 'var(--color-primary)', fontStyle: 'italic' }}>{firstName}</em>
          </>
        }
        description={`${getRoleLabel(role)} workspace · ${content.focusNote}`}
      />

      <InfoBanner tone="chambers">
        Encrypted · Confidential · Privileged — your chambers workspace for today’s hearings,
        matters, and follow-ups.
      </InfoBanner>

      <WidgetContainer title="Today's Brief" description="What needs your attention before you begin.">
        <div className="lw-brief-grid">
          {content.brief.map((item) => (
            <StatCard key={item.id} label={item.label} value={item.value} />
          ))}
        </div>
      </WidgetContainer>

      {content.nextEvent ? (
        <WidgetContainer>
          <ScheduleCard
            time={content.nextEvent.time}
            title={content.nextEvent.title}
            matter={content.nextEvent.matter}
            court={content.nextEvent.court}
            status={content.nextEvent.status}
            onOpen={scrollToActions}
          />
        </WidgetContainer>
      ) : null}

      <div className="lw-home-grid">
        <WidgetContainer title="Today's Agenda" description="A vertical timeline for the day ahead.">
          <AgendaTimeline items={content.agenda} />
        </WidgetContainer>

        <WidgetContainer title="Recent Activity" description="Latest movements across the firm.">
          <ActivityFeed items={content.activity} />
        </WidgetContainer>
      </div>

      <WidgetContainer title="Active Matters" description="Open case cards — not a dense table.">
        <div className="lw-case-grid">
          {content.matters.map((matter) => (
            <CaseCard
              key={matter.id}
              name={matter.name}
              caseNumber={matter.caseNumber}
              court={matter.court}
              status={matter.status}
              priority={matter.priority}
              team={matter.team}
              nextHearing={matter.nextHearing}
              progress={matter.progress}
              onOpen={scrollToActions}
            />
          ))}
        </div>
      </WidgetContainer>

      <div ref={qaRef}>
        <WidgetContainer title="Quick Actions" description="Start common chambers workflows.">
          <div className="lw-qa-grid">
            {content.quickActions.map((action) => (
              <QuickActionCard
                key={action.id}
                label={action.label}
                description={action.description}
                icon={action.icon}
                to={action.to}
                comingSoon={action.comingSoon}
              />
            ))}
          </div>
        </WidgetContainer>
      </div>
    </div>
  );
}

export default WorkspaceHome;
