//CallingModal.jsx
import React from "react";
import "./CallingModal.css";

export default function CallingModal({ call, onCancel, selectedConversation }) {
  if (!call) return null;

  const callType = call.type || "voice";
  const isVideo = callType === "video";

  // ดึงชื่อจาก selectedConversation
  const displayName = selectedConversation?.type === "group"
    ? (selectedConversation?.title || selectedConversation?.name || "Group")
    : (selectedConversation?.other_user?.display_name || selectedConversation?.other_user?.username || "...");

  const isGroup = selectedConversation?.type === "group";

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="calling-overlay">
      <div className="calling-card">
        {/* Avatar with ripple */}
        <div className="calling-avatar-wrapper">
          <div className="calling-ripple" />
          <div className="calling-ripple delay1" />
          <div className="calling-ripple delay2" />
          <div className="calling-avatar">
            {isGroup ? "👥" : initials}
          </div>
        </div>

        {/* Info */}
        <div className="calling-info">
          <span className="calling-status">
            {isVideo ? "📹 Video Calling..." : "📞 Calling..."}
          </span>
          <span className="calling-name">{displayName}</span>
          <span className="calling-hint">Waiting for answer</span>
        </div>

        {/* Cancel button */}
        <button className="calling-cancel-btn" onClick={() => onCancel(call.call_id)} title="Cancel call">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
            <line x1="23" y1="1" x2="1" y2="23"/>
          </svg>
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
}
