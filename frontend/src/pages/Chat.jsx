import React, { useState, useEffect } from "react";
import "./Chat.css";

import UserList from "../components/UserList";
import AddFriendForm from "../components/AddFriendForm";
import ChatWindow from "../components/ChatWindow";
import FinishAdd from "../components/FinishAdd";
import FriendRequestList from "../components/FriendRequestList";
import Profile from "./Profile";

const Chat = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const [currentView, setCurrentView] = useState("chat");
  const [searchedUser, setSearchedUser] = useState(null);
  const [showRequests, setShowRequests] = useState(false);

  // ===================================================
  // ✅ โหลด conversation list ตอนเปิดหน้า
  // ===================================================
  useEffect(() => {
    if (!window.electronAPI?.getMyConversations) return;

    const loadConversations = async () => {
      try {
        const res = await window.electronAPI.getMyConversations();

        if (res?.status === "success") {
          setConversations(res.data || []);
        } else {
          console.error("Failed to load conversations:", res);
        }
      } catch (err) {
        console.error("Error loading conversations:", err);
      }
    };

    loadConversations();
  }, []);

  // ===================================================
  // ✅ รับ realtime message
  // ===================================================
  useEffect(() => {
    if (!window.electronAPI?.onReceiveMessage) return;

    const unsub = window.electronAPI.onReceiveMessage((msg) => {
      const convId = msg.conversation_id;

      // เพิ่มข้อความเข้า state
      setMessages((prev) => ({
        ...prev,
        [convId]: [...(prev[convId] || []), msg],
      }));

      // อัปเดต sidebar ให้เลื่อนขึ้นบนสุด
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === convId
            ? { ...c, last_message: msg.content, last_message_at: msg.created_at }
            : c
        );

        return updated.sort(
          (a, b) =>
            new Date(b.last_message_at || 0) -
            new Date(a.last_message_at || 0)
        );
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // ===================================================
  // ✅ เลือกห้อง
  // ===================================================
  const handleSelectConversation = async (conv) => {
    setSelectedConversation(conv);
    setCurrentView("chat");

    if (!window.electronAPI?.getMessages) return;

    try {
      const res = await window.electronAPI.getMessages({
        conversation_id: conv.id,
      });

      if (res?.status === "success") {
        setMessages((prev) => ({
          ...prev,
          [conv.id]: res.messages || [],
        }));
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  // ===================================================
  // ✅ ส่งข้อความ
  // ===================================================
  const handleSendMessage = (text) => {
    if (!selectedConversation || !text.trim()) return;

    const convId = selectedConversation.id;

    const tempMessage = {
      id: Date.now(),
      sender_id: "me",
      content: text,
      created_at: new Date().toISOString(),
    };

    // optimistic update
    setMessages((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), tempMessage],
    }));

    // อัปเดต sidebar
    setConversations((prev) =>
      prev
        .map((c) =>
          c.id === convId
            ? { ...c, last_message: text, last_message_at: new Date().toISOString() }
            : c
        )
        .sort(
          (a, b) =>
            new Date(b.last_message_at || 0) -
            new Date(a.last_message_at || 0)
        )
    );

    if (window.electronAPI?.sendMessage) {
      window.electronAPI.sendMessage({
        conversation_id: convId,
        text: text,
      });
    }
  };

  // ===================================================
  // Search User
  // ===================================================
  const handleSearchUser = async (searchId) => {
    if (!searchId.trim()) {
      alert("กรอก ID ก่อนครับ");
      return;
    }

    if (!window.electronAPI?.searchUser) return;

    try {
      const res = await window.electronAPI.searchUser(searchId);

      if (res?.status === "success") {
        setSearchedUser(res.data);
        setCurrentView("add_preview");
      } else {
        alert(res?.message || "User not found");
      }
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  // ===================================================
  // Render
  // ===================================================
  const renderRightPanel = () => {
    switch (currentView) {
      case "add_form":
        return <AddFriendForm onSearch={handleSearchUser} />;

      case "add_preview":
        return (
          <FinishAdd
            user={searchedUser}
            onCancel={() => setCurrentView("add_form")}
          />
        );

      case "profile":
        return <Profile />;

      default:
        return (
          <ChatWindow
            conversation={selectedConversation}
            messages={
              selectedConversation
                ? messages[selectedConversation.id] || []
                : []
            }
            onSendMessage={handleSendMessage}
          />
        );
    }
  };

  return (
    <div className="chat-container">
      <div className="sidebar-strip">
        <div
          className="profile-circle"
          onClick={() => setCurrentView("profile")}
        >
          User
        </div>

        <div
          className="icon-circle"
          onClick={() => setShowRequests(true)}
          style={{ marginTop: "10px", cursor: "pointer", fontSize: "20px" }}
        >
          🔔
        </div>

        <div className="settings-circle" style={{ marginTop: "auto" }}>
          ⚙️
        </div>
      </div>

      <UserList
        users={conversations}
        selectedUser={selectedConversation}
        onSelectUser={handleSelectConversation}
        onAddClick={() => setCurrentView("add_form")}
      />

      <div className="chat-area">{renderRightPanel()}</div>

      {showRequests && (
        <FriendRequestList onClose={() => setShowRequests(false)} />
      )}
    </div>
  );
};

export default Chat;
