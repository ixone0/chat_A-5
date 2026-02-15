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
  const [messages, setMessages] = useState({}); // key = conversation_id

  const [currentView, setCurrentView] = useState("chat");
  const [searchedUser, setSearchedUser] = useState(null);
  const [showRequests, setShowRequests] = useState(false);

  // ===============================
  // โหลด conversation list ตอนเปิดหน้า
  // ===============================
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.getMyConversations();

    const unsub = window.electronAPI.onMyConversations((res) => {
      if (res?.status === "success") {
        setConversations(res.data); // [{id,title,type,last_message}]
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // ===============================
  // เลือกห้อง
  // ===============================
  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    setCurrentView("chat");

    window.electronAPI.getMessages({
      conversation_id: conv.id,
    });
  };

  // ===============================
  // รับ message history จาก backend
  // ===============================
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsub = window.electronAPI.onMessagesLoaded((res) => {
      if (res?.status === "success") {
        const { conversation_id, messages: msgList } = res;

        setMessages((prev) => ({
          ...prev,
          [conversation_id]: msgList,
        }));
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // ===============================
  // ส่งข้อความ
  // ===============================
  const handleSendMessage = (text) => {
    if (!selectedConversation || !text.trim()) return;

    const tempMessage = {
      id: Date.now(),
      sender: "me",
      content: text,
      created_at: new Date().toISOString(),
    };

    const convId = selectedConversation.id;

    setMessages((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), tempMessage],
    }));

    window.electronAPI.sendMessage({
      conversation_id: convId,
      text: text
    });

  };

  // ===============================
  // รับ message realtime
  // ===============================
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsub = window.electronAPI.onReceiveMessage((msg) => {
      const convId = msg.conversation_id;

      setMessages((prev) => ({
        ...prev,
        [convId]: [...(prev[convId] || []), msg],
      }));
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // ===============================
  // Search User (Add Friend)
  // ===============================
  const handleSearchUser = (searchId) => {
    if (!searchId.trim()) {
      alert("กรอก ID ก่อนครับ");
      return;
    }

    window.electronAPI.searchUser(searchId);

  };

  useEffect(() => {
    if (!window.electronAPI) return;

    const unsub = window.electronAPI.onSearchUserResponse((res) => {
      if (res?.status === "success") {
        setSearchedUser(res.data);
        setCurrentView("add_preview");
      } else {
        alert(res?.message || "User not found");
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // ===============================
  // Render
  // ===============================
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
        <div className="profile-circle" onClick={() => setCurrentView("profile")}>
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
