//ChatWindows.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import "./ChatWindow.css";
import MessageAttachment from "./MessageAttachment";

const ChatWindow = ({
  conversation = null,
  selectedUser = null,
  messages = [],
  onSendMessage = () => {},
  currentUserId = null,
  startCall = () => {},
}) => {
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef(null);

  const selected = conversation || selectedUser;
  const rawMsgs = Array.isArray(messages) ? messages : [];

  // ✅ 1. Logic Format Messages (คงเดิม ห้ามแก้)
  const formattedMessages = useMemo(() => {
    return rawMsgs
      .filter((m) => m && (m.content || m.text)) // กัน message เปล่า
      .map((m, index) => {
        const id =
          m.id ||
          `${m.sender_id || "temp"}-${m.created_at || Date.now()}-${index}`;

        const content = m.content ?? m.text ?? "";
        const createdRaw = m.created_at ?? m.time ?? null;
        let time = "";

        if (createdRaw) {
          const dateObj = new Date(createdRaw);
          time = dateObj.toLocaleTimeString("th-TH", {
            timeZone: "Asia/Bangkok",
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        const sender =
          String(m.sender_id) === String(currentUserId) ? "me" : "other";

        return {
          id,
          text: content,
          time,
          sender,
          msg_type: m.msg_type ?? "text",       
          attachment: m.attachment ?? null,
        };
      });
  }, [rawMsgs, currentUserId]);

  // ✅ 2. Auto Scroll (คงเดิม)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [formattedMessages.length]);

  // ✅ 3. Handle Send (คงเดิม)
  const handleSend = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    onSendMessage({
      text,
      created_at: new Date().toISOString(), // ส่ง UTC ตรงๆ
    });

    setInputText("");
  };

  // --- Render : No Selection ---
  if (!selected) {
    return (
      <div className="chat-window-root" style={{ justifyContent: 'center', alignItems: 'center', color: '#94B4C1' }}>
        <p>Select a user to chat</p>
      </div>
    );
  }

  // ✅ 4. แก้ชื่อ Header (เพิ่ม Fallback กัน Unknown)
  const otherUser = conversation?.other_user || selectedUser;
  const headerName = 
    otherUser?.display_name || 
    otherUser?.username || 
    otherUser?.custom_id || 
    "Unknown";

  const headerAvatarChar = headerName.charAt(0).toUpperCase();

  return (
    <div className="chat-window-root">
      
      {/* --- Header --- */}
      <div className="chat-header">

        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
          <span style={{color: '#94B4C1', fontSize: '20px', fontWeight: 'bold'}}>@</span>
          <h3>{headerName}</h3>
        </div>

        {/* ⭐ Call Buttons */}
        {conversation && (
          <div className="call-buttons">

            <button
              className="call-btn"
              onClick={() => startCall("voice")}
              title="Voice Call"
            >
              📞
            </button>

            <button
              className="call-btn"
              onClick={() => startCall("video")}
              title="Video Call"
            >
              🎥
            </button>

          </div>
        )}

      </div>

      {/* --- Messages Area --- */}
      <div className="messages-display" ref={scrollRef}>
        {formattedMessages.length === 0 && (
          <div style={{textAlign: 'center', color: '#94B4C1', marginTop: '20px', opacity: 0.7}}>
            No messages yet — say hi 👋
          </div>
        )}

        {formattedMessages.map((msg) => {
          const isMe = msg.sender === "me";
          return (
            <div
              key={msg.id}
              className={`chat-row ${isMe ? "row-me" : "row-other"}`}
            >
              {/* Show Avatar if Other */}
              {!isMe && (
                <div className="chat-avatar-container">
                  <div className="chat-avatar-img">
                    {headerAvatarChar}
                  </div>
                </div>
              )}

              <div className="chat-bubble">
                <p className="msg-text">{msg.text}</p>
                {msg.attachment && <MessageAttachment attachment={msg.attachment} />}
                <span className="msg-time">{msg.time}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Input Area (Modern Style) --- */}
      <form className="chat-input-area" onSubmit={handleSend}>
        <div className="input-wrapper">
            <button
                type="button"
                className="icon-attach-btn"
                onClick={() => window.electronAPI.sendFile(selected?.id)}
                title="Attach file"
              >
                📎
              </button>
            <input
              type="text"
              placeholder={`Message @${headerName}`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            
            {/* ปุ่ม Send ไอคอนจรวด (ใช้ button type=submit เพื่อให้กด Enter ส่งได้เหมือนเดิม) */}
            <button type="submit" className="icon-send-btn" disabled={!inputText.trim()}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                </svg>
            </button>
        </div>
      </form>

    </div>
  );
};

export default ChatWindow;