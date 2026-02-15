import React, { useState, useEffect, useRef, useMemo } from "react";
import "./ChatWindow.css";

const ChatWindow = ({
  conversation = null,
  selectedUser = null,
  messages = [],
  onSendMessage = () => {},
  currentUserId = null,
}) => {
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef(null);

  const selected = conversation || selectedUser;
  const rawMsgs = Array.isArray(messages) ? messages : [];

  // ✅ format messages อย่างปลอดภัย + เวลาไทย
  const formattedMessages = useMemo(() => {
    return rawMsgs
      .filter((m) => m && (m.content || m.text)) // 🔥 กัน message เปล่า
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
        };
      });
  }, [rawMsgs, currentUserId]);

  // ✅ auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [formattedMessages.length]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    // 👉 เอาเวลาปัจจุบัน
    const now = new Date();

    // 👉 แปลงเป็นเวลาไทย +07:00
    const thaiOffset = 7 * 60; // นาที
    const localOffset = now.getTimezoneOffset(); // offset เครื่อง (นาที)

    const thaiTime = new Date(
      now.getTime() + (thaiOffset + localOffset) * 60000
    );

    // 👉 สร้าง ISO string พร้อม +07:00
    const thaiTimeISO =
      thaiTime.toISOString().replace("Z", "+07:00");

    onSendMessage({
      text,
      created_at: thaiTimeISO,
    });

    setInputText("");
  };



  if (!selected) {
    return (
      <div className="chat-header">
        <span style={{ fontWeight: "bold", color: "#555" }}>
          Select a user to chat
        </span>
      </div>
    );
  }

  const headerName =
    conversation?.other_user?.display_name || selectedUser?.name || "Unknown";

  return (
    <div className="chat-window-root">
      <div className="chat-header">
        <span style={{ fontWeight: "bold" }}>Chatting with: {headerName}</span>
      </div>

      <div className="messages-display" ref={scrollRef}>
        {formattedMessages.length === 0 && (
          <div className="no-messages-hint">No messages yet — say hi 👋</div>
        )}

        {formattedMessages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-row ${
              msg.sender === "me" ? "row-me" : "row-other"
            }`}
          >
            <div className="chat-bubble">
              <p className="msg-text">{msg.text}</p>
              <span className="msg-time">{msg.time}</span>
            </div>
          </div>
        ))}
      </div>

      <form className="chat-input-area" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default ChatWindow;
