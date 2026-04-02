// components/ActiveCallOverlay.jsx
// Renders the in-call UI for both voice and video calls (direct + group)
import React from "react";

const MicOnIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const MicOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);
const CamOnIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);
const CamOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/><path d="M21 7l-5 3.5"/>
    <path d="M16 16V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11"/><path d="M23 7v10"/>
  </svg>
);
const EndCallIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
    <line x1="23" y1="1" x2="1" y2="23"/>
  </svg>
);
const PhoneIcon16 = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const GroupIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const formatTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;


// ===== Video Call Overlay =====
export function VideoCallOverlay({
  activeCall, callElapsedTime, callParticipants, remoteStreams,
  localVideoRef, remoteVideoRef, currentUser,
  isMicMuted, isCameraOff, toggleMic, toggleCamera,
  endCall, leaveCall,
}) {
  const gridClass = Object.keys(remoteStreams).length === 0 ? "one-video"
    : Object.keys(remoteStreams).length === 1 ? "two-videos" : "multi-video";

  return (
    <div className="active-call-overlay">
      <div className="ac-video-box">
        <div className="ac-header">
          <div className="ac-timer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {formatTime(callElapsedTime)}
          </div>
          <div className="ac-type-badge">
            <CamOnIcon /> Video{activeCall.is_group ? ` · ${callParticipants.length}` : ""}
          </div>
        </div>

        {activeCall.is_group ? (
          <div className={`video-grid ${gridClass}`}>
            <div className="video-container">
              <video ref={localVideoRef} autoPlay playsInline muted
                onLoadedMetadata={(e) => e.target.play().catch(() => {})}
                style={{ transform: "scaleX(-1)" }} />
              <div className="video-label">{currentUser?.username || "You"}</div>
            </div>
            {Object.entries(remoteStreams).map(([uid, stream]) => {
              const p = callParticipants.find((x) => String(x.user_id) === String(uid));
              return (
                <div key={uid} className="video-container">
                  <video autoPlay playsInline ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }} />
                  <div className="video-label">{p?.display_name || p?.username || "User"}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ac-direct-video">
            <div className="ac-remote-video" ref={remoteVideoRef} />
            <div className="ac-local-video" ref={localVideoRef} />
          </div>
        )}

        <div className="ac-controls">
          <button onClick={toggleMic} className={`ac-ctrl-btn ${isMicMuted ? "active-danger" : ""}`} title={isMicMuted ? "Unmute" : "Mute"}>
            {isMicMuted ? <MicOffIcon /> : <MicOnIcon />}
          </button>
          <button onClick={toggleCamera} className={`ac-ctrl-btn ${isCameraOff ? "active-danger" : ""}`} title={isCameraOff ? "Camera on" : "Camera off"}>
            {isCameraOff ? <CamOffIcon /> : <CamOnIcon />}
          </button>
          <button onClick={() => activeCall.is_group ? leaveCall(activeCall.call_id) : endCall(activeCall.call_id)}
            className="ac-ctrl-btn end-call" title={activeCall.is_group ? "Leave" : "End"}>
            <EndCallIcon />
          </button>
        </div>
      </div>
    </div>
  );
}


// ===== Voice Call Bar =====
export function VoiceCallBar({
  activeCall, callElapsedTime, callParticipants, remoteStreams,
  currentUser, isMicMuted, toggleMic, endCall, leaveCall,
  voiceBarExpanded, setVoiceBarExpanded,
}) {
  return (
    <div className={`ac-voice-bar ${voiceBarExpanded ? "expanded" : ""}`}>
      <div className="ac-voice-bar-top" onClick={() => setVoiceBarExpanded(!voiceBarExpanded)} style={{ cursor: "pointer" }}>
        <div className="ac-voice-left">
          <div className="ac-voice-indicator" />
          <PhoneIcon16 />
          <span className="ac-voice-timer">{formatTime(callElapsedTime)}</span>
          {activeCall.is_group && callParticipants.length > 0 && (
            <span className="ac-voice-count"><GroupIcon /> {callParticipants.length}</span>
          )}
        </div>
        <div className="ac-voice-controls">
          <button onClick={(e) => { e.stopPropagation(); toggleMic(); }}
            className={`ac-voice-btn ${isMicMuted ? "danger" : ""}`} title={isMicMuted ? "Unmute" : "Mute"}>
            {isMicMuted ? <MicOffIcon /> : <MicOnIcon />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); activeCall.is_group ? leaveCall(activeCall.call_id) : endCall(activeCall.call_id); }}
            className="ac-voice-btn danger" title={activeCall.is_group ? "Leave" : "End"}>
            <EndCallIcon />
          </button>
          <svg className="ac-voice-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={voiceBarExpanded ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
          </svg>
        </div>
      </div>

      {voiceBarExpanded && (
        <div className="ac-voice-panel">
          <div className="ac-voice-panel-title">In this call</div>
          {callParticipants.map((p) => (
            <div key={p.user_id} className="ac-voice-member">
              <div className="ac-voice-member-avatar"><UserIcon /></div>
              <span>{p.display_name || p.username || "User"}</span>
              {String(p.user_id) === String(currentUser?.id) && <span className="ac-voice-you">You</span>}
            </div>
          ))}
          {callParticipants.length === 0 && <div className="ac-voice-empty">No participants yet</div>}
        </div>
      )}

      {/* Hidden audio elements for group voice call */}
      {activeCall.is_group && Object.entries(remoteStreams).map(([uid, stream]) => (
        <audio key={uid} autoPlay playsInline ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }} />
      ))}
    </div>
  );
}

// ===== Calling Minimized Bar =====
export function CallingMinimizedBar({ calling, endCall, onExpand }) {
  return (
    <div className="ac-voice-bar" onClick={onExpand} style={{ cursor: "pointer" }}>
      <div className="ac-voice-left">
        <div className="ac-voice-indicator" style={{ background: "#f0ad4e" }} />
        <PhoneIcon16 />
        <span className="ac-voice-timer">Calling...</span>
      </div>
      <div className="ac-voice-controls">
        <button onClick={(e) => { e.stopPropagation(); endCall(calling.call_id); }} className="ac-voice-btn danger" title="Cancel">
          <EndCallIcon />
        </button>
      </div>
    </div>
  );
}

export default { VideoCallOverlay, VoiceCallBar, CallingMinimizedBar };
