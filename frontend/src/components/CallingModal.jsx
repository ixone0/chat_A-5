//CallingModal.jsx
import React from "react";
import "./CallingModal.css";

export default function CallingModal({ call, onCancel }) {

  if (!call) return null;

  return (
    <div className="call-modal">
      <div className="call-box">

        <h2>📞 Calling...</h2>

        <p>Waiting for answer...</p>

        <button onClick={() => onCancel(call.call_id)}>
          Cancel
        </button>

      </div>
    </div>
  );
}