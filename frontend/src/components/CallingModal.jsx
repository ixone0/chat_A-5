//CallingModal.jsx
import React from "react";
import "./CallingModal.css";

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const GroupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const PhoneOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
    <line x1="23" y1="1" x2="1" y2="23"/>
  </svg>
);

export default function CallingModal({ call, onCancel, selectedConversation }) {
  if (!call) return null;

  const callType = call.type || "voice";
  const isVideo = callType === "video";

  const displayName = selectedConversation?.type === "group"
    ? (selectedConversation?.title || selectedConversation?.name || "Group")
    : (selectedConversation?.other_user?.display_name || selectedConversation?.other_user?.username || "...");

  const isGroup = selectedConversation?.type === "group";

  return (
    <div className="calling-overlay">
      <div className="calling-card">
        <div className="calling-avatar-wrapper">
          <div className="calling-ripple" />
          <div className="calling-ripple delay1" />
          <div className="calling-ripple delay2" />
          <div className="calling-avatar">
            {isGroup ? <GroupIcon /> : <UserIcon />}
          </div>
        </div>

        <div className="calling-info">
          <span className="calling-status">
            {isVideo ? <VideoIcon /> : <PhoneIcon />}
            Calling
            <span className="calling-dots">
              <span /><span /><span />
            </span>
          </span>
          <span className="calling-name">{displayName}</span>
          <span className="calling-hint">Waiting for answer</span>
        </div>

        <button className="calling-cancel-btn" onClick={() => onCancel(call.call_id)} title="Cancel call">
          <div className="btn-icon"><PhoneOffIcon /></div>
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
}
