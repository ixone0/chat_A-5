//CallModal.jsx
import React from "react";
import "./CallModal.css";

export default function CallModal({ call, onAccept, onReject }) {
  if (!call) return null;

  const callerName = call.caller_name || "Someone";
  const isGroup = call.is_group;
  const groupName = call.group_name || "Group";
  const isVideo = call.call_type === "video";

  // สร้าง initials จากชื่อ
  const initials = callerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-card">
        {/* Pulse ring animation */}
        <div className="incoming-avatar-wrapper">
          <div className="incoming-pulse-ring" />
          <div className="incoming-pulse-ring delay" />
          <div className="incoming-avatar">
            {isGroup ? "👥" : initials}
          </div>
        </div>

        {/* Call info */}
        <div className="incoming-call-info">
          <span className="incoming-call-label">
            {isGroup ? "Group Call" : "Incoming Call"}
          </span>
          <span className="incoming-caller-name">
            {isGroup ? groupName : callerName}
          </span>
          {isGroup && (
            <span className="incoming-call-subtitle">
              {callerName} กำลังโทร{isVideo ? "วิดีโอ" : ""}
            </span>
          )}
          <span className="incoming-call-type">
            {isVideo ? "📹 Video Call" : "📞 Voice Call"}
          </span>
        </div>

        {/* Action buttons */}
        <div className="incoming-call-actions">
          <button className="incoming-btn reject" onClick={onReject} title="Reject">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
              <line x1="23" y1="1" x2="1" y2="23"/>
            </svg>
            <span>Reject</span>
          </button>
          <button className="incoming-btn accept" onClick={onAccept} title="Accept">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
