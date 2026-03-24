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
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const scrollRef = useRef(null);

  const selected = conversation || selectedUser;

  // ✅ 1. Logic Format Messages (แก้เรื่องความซ้ำซ้อนและ Dependency แล้ว)
  const formattedMessages = useMemo(() => {
    const rawMsgs = Array.isArray(messages) ? messages : [];
    return rawMsgs
      .filter((m) => m && (m.content || m.text)) 
      .map((m, index) => {
        const id = m.id || `${m.sender_id || "temp"}-${m.created_at || Date.now()}-${index}`;
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

        const sender = String(m.sender_id) === String(currentUserId) ? "me" : "other";

        return {
          id,
          text: content,
          time,
          sender,
          msg_type: m.msg_type ?? "text",      
          attachment: m.attachment ?? null,
        };
      });
  }, [messages, currentUserId]);

  // ✅ 2. Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [formattedMessages.length]);

  // ✅ 3. Rename Group Logic
  const handleStartEdit = () => {
    if (conversation?.type === "group" && conversation?.role === "owner") {
      setTempTitle(conversation.title || "");
      setIsEditing(true);
    }
  };

  const handleSaveTitle = async () => {
    if (!tempTitle.trim() || tempTitle === conversation.title) {
      setIsEditing(false);
      return;
    }

    try {
      const res = await window.electronAPI.renameGroup({
        conversation_id: conversation.id,
        new_title: tempTitle.trim()
      });

      if (res.status === "success") {
        setIsEditing(false);
      } else {
        alert(res.message || "Failed to rename group");
      }
    } catch (err) {
      console.error("Rename Error:", err);
    }
  };

  // ✅ 4. Handle Send Message
  const handleSend = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    onSendMessage({
      text,
      created_at: new Date().toISOString(),
    });

    setInputText("");
  };

  // --- Render : No Selection ---
  if (!selected) {
    return (
      <div className="chat-window-root" style={{ justifyContent: 'center', alignItems: 'center', color: '#94B4C1' }}>
        <p>Select a user or group to chat</p>
      </div>
    );
  }

  const isGroup = conversation?.type === "group";
  const isOwner = conversation?.role === "owner";
  
  let headerName = "Unknown";
  let headerPrefix = "@";

  if (isGroup) {
    headerName = conversation?.title || "Group Chat";
    headerPrefix = "👥";
  } else {
    const otherUser = conversation?.other_user || selectedUser;
    headerName = otherUser?.display_name || otherUser?.username || otherUser?.custom_id || "Unknown";
    headerPrefix = "@";
  }

  const headerAvatarChar = headerName.charAt(0).toUpperCase();

  return (
    <div className="chat-window-root">
      
      {/* --- Header --- */}
      <div className="chat-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
          <span style={{color: '#94B4C1', fontSize: '20px', fontWeight: 'bold'}}>{headerPrefix}</span>
          
          {isEditing ? (
            <input 
              className="rename-input"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid #94B4C1',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '1.1rem',
                outline: 'none'
              }}
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              autoFocus
            />
          ) : (
            <h3 
              onClick={handleStartEdit}
              style={{ 
                cursor: (isGroup && isOwner) ? 'pointer' : 'default',
                margin: 0
              }}
              title={(isGroup && isOwner) ? "Click to rename group" : ""}
            >
              {headerName}
            </h3>
          )}

          {isGroup && isOwner && (
            <span style={{ fontSize: '10px', background: '#FFD700', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
              OWNER
            </span>
          )}
        </div>

        {/* Call Buttons */}
        {conversation && (
          <div className="call-buttons">
            <button className="call-btn" onClick={() => startCall("voice")} title="Voice Call">📞</button>
            <button className="call-btn" onClick={() => startCall("video")} title="Video Call">🎥</button>
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
            <div key={msg.id} className={`chat-row ${isMe ? "row-me" : "row-other"}`}>
              {!isMe && (
                <div className="chat-avatar-container">
                  <div className="chat-avatar-img">{headerAvatarChar}</div>
                </div>
              )}
              <div className="chat-bubble">
                {msg.msg_type === "file" && msg.attachment ? (
                  <MessageAttachment attachment={msg.attachment} />
                ) : (
                  <p className="msg-text">{msg.text}</p>
                )}
                <span className="msg-time">{msg.time}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Input Area --- */}
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
            placeholder={`Message ${headerPrefix} ${headerName}`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
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