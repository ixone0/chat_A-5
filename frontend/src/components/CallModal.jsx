//CallModal.jsx
import React from "react";
import "./CallModal.css";

export default function CallModal({ call, onAccept, onReject }) {
  if (!call) return null;

  return (
    <div className="call-modal">
      <div className="call-box">

        <h2>📲 Incoming Call</h2>

        <p>{call.caller_name || "Someone"} is calling...</p>

        <div className="call-actions">

          <button className="accept" onClick={onAccept}>
            Accept
          </button>

          <button className="reject" onClick={onReject}>
            Reject
          </button>

        </div>

      </div>
    </div>
  );
}