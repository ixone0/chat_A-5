import React, { useState, useEffect, useRef, useMemo } from "react";
import "./ChatWindow.css";
import MessageAttachment from "./MessageAttachment";
import FilePreview from "./FilePreview";
import { AlertCircleIcon, MessageCircleIcon } from "./Icons";
import { useToast } from "./Toast";
import { EmptyChat } from "./EmptyState";

const ChatWindow = ({
  conversation = null,
  selectedUser = null,
  messages = [],
  onSendMessage = () => {},
  currentUserId = null,
  startCall = () => {},
  refreshMessages = () => {},
  onShowMembers = null,
  isTyping = false,
  activeCall = null,
  callParticipants = [],
  acceptCall = () => {},
}) => {
  const toast = useToast();
  const [inputText, setInputText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [uploadState, setUploadState] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
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
        const inferredMsgType = m.msg_type === "system" ? "system" : (isS3Url ? "file" : (m.msg_type ?? "text"));

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

        const id = m.id || `${m.sender_id || "temp"}-${m.created_at || Date.now()}-${index}`;
        const createdRaw = m.created_at ?? m.time ?? null;
        let time = "";
        let dateStr = "";
        if (createdRaw) {
          const dateObj = new Date(createdRaw);
          time = dateObj.toLocaleTimeString("th-TH", {
            timeZone: "Asia/Bangkok",
            hour: "2-digit",
            minute: "2-digit",
          });
          dateStr = dateObj.toLocaleDateString("en-US", {
            timeZone: "Asia/Bangkok",
            weekday: "long",
            month: "short",
            day: "numeric",
          });
        }

        return {
          id,
          text: content,
          time,
          dateStr,
          sender: m.msg_type === "system" ? "system" : (String(m.sender_id) === String(currentUserId) ? "me" : "other"),
          msg_type: inferredMsgType,  
          attachment,                  
        };
      });
  }, [messages, currentUserId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [formattedMessages.length]);

  // Clear upload state เมื่อเปลี่ยน conversation
  useEffect(() => {
    setUploadState(null);
    setPreviewData(null);
    setShowPinned(false);
    setContextMenu(null);
    // Fetch pinned messages
    if (selected?.id && window.electronAPI?.getPinnedMessages) {
      window.electronAPI.getPinnedMessages(selected.id).then(res => {
        if (res?.status === 'success') setPinnedMessages(res.messages || []);
        else setPinnedMessages([]);
      }).catch(() => setPinnedMessages([]));
    }
  }, [selected?.id]);

  const handleStartEdit = () => {
    if (conversation?.type === "group" && (conversation?.role === "owner" || String(conversation?.owner_id) === String(currentUserId))) {
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
        toast.error(res.message || "Failed to rename group");
      }
    } catch (err) {
      console.error("Rename Error:", err);
    }
  };

  const handlePinMessage = async (messageId) => {
    try {
      const res = await window.electronAPI.pinMessage({ conversation_id: selected.id, message_id: messageId });
      if (res?.status === 'success') {
        const pinRes = await window.electronAPI.getPinnedMessages(selected.id);
        if (pinRes?.status === 'success') setPinnedMessages(pinRes.messages || []);
      }
    } catch (err) { console.error(err); }
    setContextMenu(null);
  };

  const handleUnpinMessage = async (messageId) => {
    try {
      const res = await window.electronAPI.unpinMessage({ conversation_id: selected.id, message_id: messageId });
      if (res?.status === 'success') {
        setPinnedMessages(prev => prev.filter(p => p.id !== messageId));
      }
    } catch (err) { console.error(err); }
    setContextMenu(null);
  };

  const handleContextMenu = (e, msgId) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, messageId: msgId });
  };

  // Close context menu + reaction picker on click anywhere
  useEffect(() => {
    const close = () => { setContextMenu(null); setActiveReactionMsgId(null); };
    if (contextMenu || activeReactionMsgId) window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu, activeReactionMsgId]);

  const REACTIONS = ['\u2764\uFE0F', '\uD83D\uDC4D', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDD25'];

  const [reactions, setReactions] = useState({});

  // Listen for reaction updates from other users
  useEffect(() => {
    if (!window.electronAPI?.onReactionUpdate) return;
    const unsub = window.electronAPI.onReactionUpdate((data) => {
      if (String(data.conversation_id) !== String(selected?.id)) return;
      setReactions(prev => {
        const msgReactions = [...(prev[data.message_id] || [])];
        const existing = msgReactions.find(r => r.reaction === data.reaction);
        if (data.action === 'added') {
          if (existing) {
            existing.count += 1;
            existing.users = [...existing.users, data.user_id];
          } else {
            msgReactions.push({ reaction: data.reaction, count: 1, users: [data.user_id] });
          }
        } else if (data.action === 'removed' && existing) {
          existing.count -= 1;
          existing.users = existing.users.filter(u => u !== data.user_id);
          if (existing.count <= 0) return { ...prev, [data.message_id]: msgReactions.filter(r => r.reaction !== data.reaction) };
        }
        return { ...prev, [data.message_id]: msgReactions };
      });
    });
    return () => unsub?.();
  }, [selected?.id]);

  const handleReaction = async (messageId, reaction) => {
    if (!selected?.id) return;
    try {
      await window.electronAPI.toggleReaction({ message_id: messageId, reaction, conversation_id: selected.id });
      // Optimistic update
      setReactions(prev => {
        const msgReactions = [...(prev[messageId] || [])];
        const existing = msgReactions.find(r => r.reaction === reaction);
        if (existing) {
          const hasMe = existing.users.includes(String(currentUserId));
          if (hasMe) {
            existing.count -= 1;
            existing.users = existing.users.filter(u => u !== String(currentUserId));
            if (existing.count <= 0) return { ...prev, [messageId]: msgReactions.filter(r => r.reaction !== reaction) };
          } else {
            existing.count += 1;
            existing.users = [...existing.users, String(currentUserId)];
          }
        } else {
          msgReactions.push({ reaction, count: 1, users: [String(currentUserId)] });
        }
        return { ...prev, [messageId]: msgReactions };
      });
    } catch (err) { console.error(err); }
  };

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

  if (!selected) {
    return (
      <div className="chat-window-root" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <EmptyChat />
      </div>
    );
  }

  const isGroup = conversation?.type === "group";
  // ✅ Fallback: ถ้า role undefined ให้เช็ค owner_id แทน
  const isOwner = conversation?.role === "owner" || 
                  String(conversation?.owner_id) === String(currentUserId);
  
  let headerName = "Unknown";
  let headerIcon = null; 
  let placeholderText = ""; 

  if (isGroup) {
    headerName = conversation?.title || "Group Chat";
    headerIcon = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" style={{ color: '#94B4C1' }}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
    placeholderText = `Message ${headerName}`; 
  } else {
    const otherUser = conversation?.other_user || selectedUser;
    headerName = otherUser?.display_name || otherUser?.username || otherUser?.custom_id || "Unknown";
    headerIcon = <span style={{color: '#94B4C1', fontSize: '20px', fontWeight: 'bold'}}>@</span>;
    placeholderText = `Message @${headerName}`; 
  }

  const headerAvatarChar = headerName.charAt(0).toUpperCase();

  return (
    <div className="chat-window-root">
      
      {/* --- Header --- */}
      <div className="chat-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {headerIcon}
          </div>
          
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
           <span style={{ 
              fontSize: '10px', 
              backgroundColor: 'rgba(88, 101, 242, 0.15)', 
              color: '#a5b0f5', 
              border: '1px solid rgba(88, 101, 242, 0.3)',
              padding: '2px 8px', 
              borderRadius: '12px', 
              fontWeight: '600', 
              marginLeft: '8px',
              letterSpacing: '0.5px'
            }}>
              Owner
            </span>
          )}
        </div>

        {/* Call Buttons + Members */}
        {conversation && (
          <>
            {/* ✅ Show participants info and Join button if group call is active */}
            {activeCall && activeCall.is_group && callParticipants.length > 0 && (
              <div style={{
                backgroundColor: 'rgba(88, 101, 242, 0.1)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '8px',
                fontSize: '12px',
                color: '#a5b0f5',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>
                  👥 {callParticipants.length} {callParticipants.length === 1 ? 'person' : 'people'} in call{': '}
                  {callParticipants.slice(0, 3).map(p => p.username || `User ${p.user_id}`).join(', ')}
                  {callParticipants.length > 3 && ` +${callParticipants.length - 3}`}
                </span>
                {/* Join Call Button */}
                <button 
                  onClick={acceptCall}
                  style={{
                    backgroundColor: '#5865f2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginLeft: '8px',
                    whiteSpace: 'nowrap'
                  }}
                  title="Join the active group call"
                >
                  Join Call
                </button>
              </div>
            )}
            
            <div className="call-buttons">

            {isGroup && (
              <button className="call-btn" onClick={() => onShowMembers && onShowMembers()} title="View Members">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </button>
            )}

            {pinnedMessages.length > 0 && (
              <button className="call-btn" onClick={() => setShowPinned(!showPinned)} title={`${pinnedMessages.length} pinned message(s)`}>
                <svg viewBox="0 0 24 24" fill="none" stroke={showPinned ? "#ffc107" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <path d="M12 2L12 12" /><path d="M18 6L18 12" /><path d="M6 6L6 12" />
                  <path d="M2 12h20" /><path d="M12 12v10" />
                </svg>
              </button>
            )}
            
            <button className="call-btn" onClick={() => startCall("voice")} title="Voice Call">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </button>

            <button className="call-btn" onClick={() => startCall("video")} title="Video Call">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            </button>

          </div>
          </>
        )}
      </div>

      {/* Pinned messages bar */}
      {showPinned && pinnedMessages.length > 0 && (
        <div className="pinned-bar">
          <div className="pinned-bar-header">
            <span className="pinned-bar-title">Pinned Messages ({pinnedMessages.length})</span>
            <button className="pinned-bar-close" onClick={() => setShowPinned(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {pinnedMessages.map(pm => (
            <div key={pm.id} className="pinned-item">
              <div className="pinned-item-content">
                <span className="pinned-item-author">{pm.display_name || pm.username || 'System'}</span>
                <span className="pinned-item-text">{pm.content?.length > 80 ? pm.content.slice(0, 80) + '...' : pm.content}</span>
              </div>
              {isOwner && (
                <button className="pinned-unpin-btn" onClick={() => handleUnpinMessage(pm.id)} title="Unpin">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --- Messages Area --- */}
      <div className="messages-display" ref={scrollRef}>
        {formattedMessages.length === 0 && (
          <div style={{textAlign: 'center', color: '#94B4C1', marginTop: '20px', opacity: 0.7}}>
            No messages yet — say hi
            <MessageCircleIcon size={18} color="#94B4C1" style={{ marginLeft: 6, verticalAlign: 'middle' }} />
          </div>
        )}

        {formattedMessages.map((msg, idx) => {
          // Date separator
          const prevDate = idx > 0 ? formattedMessages[idx - 1].dateStr : null;
          const showDateSep = msg.dateStr && msg.dateStr !== prevDate;

          return (
            <React.Fragment key={msg.id}>
              {showDateSep && (
                <div className="date-separator">
                  <span>{msg.dateStr}</span>
                </div>
              )}

              {/* System message */}
              {msg.sender === "system" ? (
                <div className="chat-row row-system">
                  <div className="system-message"><span>{msg.text}</span></div>
                </div>
              ) : (() => {
                const isMe = msg.sender === "me";
                return (
                  <div className={`chat-row ${isMe ? "row-me" : "row-other"}`}>
                    {!isMe && (
                      <div className="chat-avatar-container">
                        <div className="chat-avatar-img">{headerAvatarChar}</div>
                      </div>
                    )}
                    <div className="chat-bubble"
                      onContextMenu={(e) => handleContextMenu(e, msg.id)}
                      onDoubleClick={() => setActiveReactionMsgId(prev => prev === msg.id ? null : msg.id)}>
                      {msg.msg_type === "file" && msg.attachment ? (
                        <MessageAttachment attachment={msg.attachment} />
                      ) : (
                        <p className="msg-text">{msg.text}</p>
                      )}
                      <span className="msg-time">{msg.time}</span>
                      {/* Reaction display */}
                      {reactions[msg.id]?.length > 0 && (
                        <div className="reaction-display">
                          {reactions[msg.id].map(r => (
                            <span key={r.reaction} className="reaction-chip" onClick={() => handleReaction(msg.id, r.reaction)}
                              title={`${r.count} reaction(s)`}>
                              {r.reaction} {r.count > 1 ? r.count : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Reaction picker on double-click */}
                      {activeReactionMsgId === msg.id && (
                        <div className="reaction-picker reaction-picker-visible">
                          {REACTIONS.map(r => (
                            <button key={r} className="reaction-pick-btn" onClick={() => { handleReaction(msg.id, r); setActiveReactionMsgId(null); }}>{r}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </React.Fragment>
          );
        })}
      </div>

      {/* --- Upload Progress Indicator --- */}
      {uploadState?.status === 'uploading' && (
        <div className="upload-progress-indicator">
          <div className="upload-spinner" />
          <span>กำลังส่ง {uploadState.fileName}...</span>
        </div>
      )}
      {uploadState?.status === 'error' && (
        <div className="upload-error-indicator">
          <span><AlertCircleIcon size={14} color="#ff6b7a" style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Send file {uploadState.fileName} failed: {uploadState.error}</span>
          <button
            className="upload-retry-btn"
            onClick={async () => {
              if (!uploadState.retryData) return;
              const { filePath, conversationId } = uploadState.retryData;
              setUploadState({ status: 'uploading', fileName: uploadState.fileName });
              try {
                const res = await window.electronAPI.confirmSendFile({ filePath, conversationId });
                if (res?.status === 'error') {
                  setUploadState({
                    status: 'error',
                    fileName: uploadState.fileName,
                    error: res.message || 'เกิดข้อผิดพลาด',
                    retryData: { filePath, conversationId },
                  });
                } else {
                  setUploadState(null);
                  await refreshMessages();
                }
              } catch (err) {
                setUploadState({
                  status: 'error',
                  fileName: uploadState.fileName,
                  error: err.message || 'เกิดข้อผิดพลาด',
                  retryData: { filePath, conversationId },
                });
              }
            }}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* --- File Preview --- */}
      {previewData && (
        <FilePreview
          preview={previewData}
          onCancel={() => setPreviewData(null)}
          onConfirm={async () => {
            const { filePath, conversationId, name } = previewData;
            setPreviewData(null);
            setUploadState({ status: 'uploading', fileName: name });
            try {
              const res = await window.electronAPI.confirmSendFile({ filePath, conversationId });
              if (res?.status === 'error') {
                setUploadState({
                  status: 'error',
                  fileName: name,
                  error: res.message || 'เกิดข้อผิดพลาด',
                  retryData: { filePath, conversationId },
                });
              } else {
                setUploadState(null);
                await refreshMessages();
              }
            } catch (err) {
              setUploadState({
                status: 'error',
                fileName: name,
                error: err.message || 'เกิดข้อผิดพลาด',
                retryData: { filePath, conversationId },
              });
            }
          }}
        />
      )}

      {/* Typing indicator */}
      {isTyping && (
        <div className="typing-indicator">
          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          <span className="typing-text">typing...</span>
        </div>
      )}

      {/* --- Input Area --- */}
      <form className="chat-input-area" onSubmit={handleSend}>
        <div className="input-wrapper">
            <button
              type="button"
              className="icon-attach-btn"
              style={uploadState?.status === 'uploading' ? { opacity: 0.4, pointerEvents: 'none' } : {}}
              onClick={async () => {
                const response = await window.electronAPI.sendFile(selected?.id);
                
                if (!response || response.status === 'cancelled') return;
                if (response.status === 'error') {
                  toast.error(response.message);
                  return;
                }

                if (response.status === 'preview') {
                  setPreviewData(response.preview);
                }
              }}
              title="แนบไฟล์ (สูงสุด 25 MB)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>
            <input
              type="text"
              placeholder={placeholderText}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (e.target.value && conversation?.id) {
                  window.electronAPI?.sendTyping?.(conversation.id);
                }
              }}
            />
            
            <button type="submit" className="icon-send-btn" disabled={!inputText.trim()}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                </svg>
            </button>
        </div>
      </form>

      {/* Context menu for pin */}
      {contextMenu && (
        <div className="msg-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {pinnedMessages.some(p => p.id === contextMenu.messageId) ? (
            <button onClick={() => handleUnpinMessage(contextMenu.messageId)}>Unpin message</button>
          ) : (
            <button onClick={() => handlePinMessage(contextMenu.messageId)}>Pin message</button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWindow;