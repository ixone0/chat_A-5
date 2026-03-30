import React from 'react';
import './Skeleton.css';

export function SkeletonChatItem() {
  return (
    <div className="skeleton-chat-item">
      <div className="skeleton-avatar skeleton-pulse" />
      <div className="skeleton-lines">
        <div className="skeleton-line skeleton-line-name skeleton-pulse" />
        <div className="skeleton-line skeleton-line-msg skeleton-pulse" />
      </div>
    </div>
  );
}

export function SkeletonMessage({ align = 'left' }) {
  return (
    <div className={`skeleton-msg-row skeleton-msg-${align}`}>
      {align === 'left' && <div className="skeleton-avatar-sm skeleton-pulse" />}
      <div className="skeleton-bubble skeleton-pulse" style={{ width: `${40 + Math.random() * 30}%` }} />
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <>
      {[1,2,3,4,5].map(i => <SkeletonChatItem key={i} />)}
    </>
  );
}

export function MessagesSkeleton() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SkeletonMessage align="left" />
      <SkeletonMessage align="right" />
      <SkeletonMessage align="left" />
      <SkeletonMessage align="right" />
      <SkeletonMessage align="left" />
    </div>
  );
}
