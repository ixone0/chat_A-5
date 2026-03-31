//CallModal.jsx
import React from "react";
import "./CallModal.css";
import { PhoneIncomingIcon } from "./Icons";

export default function CallModal({ call, onAccept, onReject }) {
  if (!call) return null;

  const callerName = call.caller_name || "Someone";
  const isGroup = call.is_group;
  const groupName = call.group_name || "Group";
  const callTypeLabel = call.call_type === "video" ? "Video Call" : "Voice Call";

  return (
    <div className="call-modal">
      <div className="call-box">

        <h2><PhoneIncomingIcon size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          {isGroup ? "Group Call" : "Incoming Call"}
        </h2>

        <p>
          {isGroup
            ? `${callerName} กำลังโทร${call.call_type === "video" ? "วิดีโอ" : ""}กลุ่ม "${groupName}"`
            : `${callerName} is calling...`
          }
        </p>
        <p style={{ fontSize: '13px', opacity: 0.7 }}>{callTypeLabel}</p>

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