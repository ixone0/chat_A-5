import React, { useState, useEffect } from "react";
import "./Chat.css";

import UserList from "../components/UserList";
import AddFriendForm from "../components/AddFriendForm";
import ChatWindow from "../components/ChatWindow";
import FinishAdd from "../components/FinishAdd";
import FriendRequestList from "../components/FriendRequestList";
import Profile from "./Profile";
import SettingsModal from '../components/SettingsModal';

const Chat = () => {
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  
  const [currentView, setCurrentView] = useState("chat");
  const [searchedUser, setSearchedUser] = useState(null);
  const [showRequests, setShowRequests] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ----------------------------------------
  // 1. Data Loading (รายชื่อเพื่อนและห้องแชท)
  // ----------------------------------------
  const refreshData = async () => {
    if (!window.electronAPI) return;
    try {
      const [convRes, friendRes] = await Promise.all([
        window.electronAPI.getMyConversations(),
        window.electronAPI.getFriends()
      ]);
      if (convRes?.status === "success") setConversations(convRes.data || []);
      if (friendRes?.status === "success") setFriends(friendRes.friends || friendRes.data || []);
    } catch (err) { console.error("Refresh Error:", err); }
  };

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    const username = localStorage.getItem("username");
    if (userId) setCurrentUser({ id: userId, username });
    refreshData();
  }, []);

  // ----------------------------------------
  // 2. Real-time Message (อัปเดตแค่ในหน้าแชท)
  // ----------------------------------------
  useEffect(() => {
    if (!window.electronAPI?.onReceiveMessage) return;
    const unsub = window.electronAPI.onReceiveMessage((msg) => {
      const convId = msg.conversation_id;
      setMessages(prev => ({ ...prev, [convId]: [...(prev[convId] || []), msg] }));
    });
    return () => { if (unsub) unsub(); };
  }, []);

  // ----------------------------------------
  // 3. Navigation & Interaction
  // ----------------------------------------
  const handleSelectConversation = async (conv) => {
    if (!conv) return;

    // ถ้าเลือกจากรายชื่อเพื่อนที่ยังไม่มีห้องแชท
    if (conv.isFriendOnly) {
      const friend = conv.friend;
      try {
        const res = await window.electronAPI.startDirectChat(friend.id);
        if (res?.status === "success") {
          await refreshData();
          const freshData = (await window.electronAPI.getMyConversations())?.data ?? [];
          let realConv = freshData.find(c => c.id === res.conversation_id);
          if (realConv) {
            if (!realConv.other_user) realConv.other_user = friend;
            return handleSelectConversation(realConv);
          }
        }
      } catch (err) { console.error(err); }
      return;
    }

    setSelectedConversation(conv);
    setCurrentView("chat");

    try {
      const res = await window.electronAPI.getMessages({ conversation_id: conv.id });
      if (res?.status === "success") setMessages(prev => ({ ...prev, [conv.id]: res.messages || [] }));
    } catch (err) { console.error(err); }
  };

  const handleSendMessage = (payload) => {
    if (!selectedConversation || !currentUser) return;
    const text = typeof payload === "string" ? payload : payload?.text;
    if (!text?.trim()) return;

    const convId = selectedConversation.id;
    const createdAt = new Date().toISOString();

    setMessages(prev => ({
      ...prev,
      [convId]: [...(prev[convId] || []), { id: `temp-${Date.now()}`, sender_id: currentUser.id, content: text, created_at: createdAt }]
    }));

    window.electronAPI.sendMessage({ conversation_id: convId, text, created_at: createdAt });
  };

  // ✅ Fix: แมพข้อมูลตาม server.py (ใช้ custom_id สำหรับการแอดเพื่อน)
  const handleSearchUser = async (searchId) => {
    if (!searchId.trim()) return;
    try {
      const res = await window.electronAPI.searchUser(searchId);
      if (res?.status === "success" && res.data) {
        setSearchedUser({
            user_id: res.data.user_id,
            name: res.data.display_name,
            custom_id: res.data.custom_id // ⚠️ Backend ต้องการตัวนี้
        });
        setCurrentView("add_preview");
      } else { alert(res?.message || "User not found"); }
    } catch (err) { console.error(err); }
  };

  // ----------------------------------------
  // 4. Sidebar Logic (แสดงแค่รายชื่อเพียวๆ)
  // ----------------------------------------
  const sidebarItems = (() => {
    const items = [];
    const seen = new Set();

    // เพิ่มห้องที่มีอยู่แล้ว
    conversations.forEach(c => {
      if (c.type === 'direct' && c.other_user?.id) {
        seen.add(String(c.other_user.id));
        items.push(c);
      } else if (c.type === 'group') items.push(c);
    });

    // เพิ่มเพื่อนที่ยังไม่เคยคุย
    friends.forEach(f => {
      if (!seen.has(String(f.id))) {
        items.push({
          id: `friend-${f.id}`, 
          type: "direct", 
          other_user: { ...f, display_name: f.display_name || f.username },
          isFriendOnly: true, 
          friend: f
        });
      }
    });

    return items; // สะอาดตา ไม่มีการเรียงใหม่ให้งง
  })();

  // ----------------------------------------
  // 5. Right Panel Routing
  // ----------------------------------------
  const renderRightPanel = () => {
    switch (currentView) {
      case "add_form": return <AddFriendForm onSearch={handleSearchUser} onCancel={() => setCurrentView("chat")} />;
      case "add_preview": return <FinishAdd user={searchedUser} onCancel={() => setCurrentView("add_form")} onSuccess={() => { refreshData(); setCurrentView("chat"); }} />;
      case "profile": return <Profile />;
      default: return (
        <ChatWindow 
          conversation={selectedConversation} 
          messages={selectedConversation ? messages[selectedConversation.id] || [] : []} 
          currentUserId={currentUser?.id} 
          onSendMessage={handleSendMessage} 
        />
      );
    }
  };

  return (
    <div className="chat-container">
      <div className="sidebar-strip">
        <div className="profile-circle" onClick={() => setCurrentView("profile")}>User</div>
        <div className="icon-circle" onClick={() => setShowRequests(true)} style={{ marginTop: "10px", fontSize: "20px", cursor: "pointer" }}>🔔</div>
        <div className="settings-circle" style={{ marginTop: "auto", cursor: "pointer" }} onClick={() => setShowSettings(true)}>⚙️</div>
      </div>

      <UserList
        users={sidebarItems}
        selectedUser={selectedConversation}
        onSelectUser={handleSelectConversation}
        onAddClick={() => setCurrentView("add_form")}
      />

      <div className="chat-area">{renderRightPanel()}</div>

      {showRequests && <FriendRequestList onClose={() => setShowRequests(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default Chat;