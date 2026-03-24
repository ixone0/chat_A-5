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
  refreshMessages = () => {},
}) => {
  const [inputText, setInputText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const scrollRef = useRef(null);

  const selected = conversation || selectedUser;

const rawMsgs = Array.isArray(messages) ? messages : [];
const S3_REGEX = /https?:\/\/.*\.s3\.amazonaws\.com\/.+/;

const formattedMessages = useMemo(() => {
  return rawMsgs
    .filter((m) => m && (m.content || m.text))
    .map((m, index) => {
      const content = m.content ?? m.text ?? "";
      
      // ✅ ตรวจว่า content เป็น S3 URL ไหม
      const isS3Url = S3_REGEX.test(content);
      const inferredMsgType = isS3Url ? "file" : (m.msg_type ?? "text");

      // ✅ สร้าง attachment object จาก URL ถ้าไม่มี
      let attachment = m.attachment ?? null;
      if (isS3Url && !attachment) {
        const fileName = decodeURIComponent(content.split("/").pop().replace(/^[^_]+_/, ""));
        const ext = fileName.split(".").pop().toLowerCase();
        const mimeMap = {
          png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
          gif: "image/gif", webp: "image/webp",
          mp4: "video/mp4", mov: "video/quicktime",
          pdf: "application/pdf",
        };
        attachment = {
          file_url: content,
          file_name: fileName,
          mime_type: mimeMap[ext] ?? "application/octet-stream",
          file_size: 0,
        };
      }

      // ... ส่วนที่เหลือเหมือนเดิม
      const id = m.id || `${m.sender_id || "temp"}-${m.created_at || Date.now()}-${index}`;
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

      return {
        id,
        text: content,
        time,
        sender: String(m.sender_id) === String(currentUserId) ? "me" : "other",
        msg_type: inferredMsgType,  // ✅
        attachment,                  // ✅
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
  // ✅ Fallback: ถ้า role undefined ให้เช็ค owner_id แทน
  const isOwner = conversation?.role === "owner" || 
                  String(conversation?.owner_id) === String(currentUserId);
  
  // 🔍 DEBUG: ตรวจสอบค่า
  console.log("🔍 ChatWindow Debug:", {
    conversation_id: conversation?.id,
    conversation_type: conversation?.type,
    conversation_role: conversation?.role,
    conversation_owner_id: conversation?.owner_id,
    currentUserId,
    isGroup,
    isOwner,
    conversation
  });
  
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
              onClick={async () => {
                const response = await window.electronAPI.sendFile(selected?.id);
                
                if (!response || response.status === 'cancelled' || response.status === 'error') return;
                await refreshMessages();
                const msg = response.message;
                if (!msg) return;

                onSendMessage({
                  id: msg.id,
                  content: msg.content,
                  msg_type: msg.msg_type,
                  created_at: msg.created_at,
                  conversation_id: msg.conversation_id,
                  sender_id: currentUserId,
                  attachment: msg.attachment,
                });
              }}
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