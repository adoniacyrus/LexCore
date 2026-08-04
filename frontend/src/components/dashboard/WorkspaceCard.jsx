import React from 'react';

function WorkspaceCard({
  children,
  className = '',
  padding = 'md',
  as: Tag = 'section',
  ...rest
}) {
  return (
    <Tag className={`lw-card lw-card--pad-${padding} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

export default WorkspaceCard;
