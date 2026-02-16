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
  const [hasNewRequest, setHasNewRequest] = useState(false);

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

  useEffect(() => {
    if (!window.electronAPI?.onReceiveMessage) return;
    const unsub = window.electronAPI.onReceiveMessage((data) => {
      const convId = data.conversation_id;
      const incomingMsg = data.message;
      if (convId && incomingMsg) {
        setMessages((prev) => ({
          ...prev,
          [convId]: [...(prev[convId] || []), incomingMsg],
        }));
      }
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const handleSelectConversation = async (conv) => {
    if (!conv) return;
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
      if (res?.status === "success") {
        setMessages(prev => ({ ...prev, [conv.id]: res.messages || [] }));
      }
    } catch (err) { console.error(err); }
  };

  const handleSendMessage = (payload) => {
    if (!selectedConversation || !currentUser) return;
    const text = typeof payload === "string" ? payload : payload?.text;
    if (!text?.trim()) return;
    const convId = selectedConversation.id;
    const createdAt = new Date().toISOString();
    const myMsg = { 
      id: `temp-${Date.now()}`, 
      sender_id: currentUser.id, 
      content: text, 
      created_at: createdAt 
    };
    setMessages(prev => ({
      ...prev,
      [convId]: [...(prev[convId] || []), myMsg]
    }));
    window.electronAPI.sendMessage({ conversation_id: convId, text, created_at: createdAt });
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const handleSearchUser = async (searchId) => {
    if (!searchId.trim()) return;
    try {
      const res = await window.electronAPI.searchUser(searchId);
      if (res?.status === "success" && res.data) {
        setSearchedUser({
            user_id: res.data.user_id,
            name: res.data.display_name,
            custom_id: res.data.custom_id
        });
        setCurrentView("add_preview");
      } else { alert(res?.message || "User not found"); }
    } catch (err) { console.error(err); }
  };

  const sidebarItems = (() => {
    const items = [];
    const seen = new Set();
    conversations.forEach(c => {
      if (c.type === 'direct' && c.other_user?.id) {
        seen.add(String(c.other_user.id));
        items.push(c);
      } else if (c.type === 'group') items.push(c);
    });
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
    return items;
  })();

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
        {/* Profile Avatar */}
        <div className="profile-circle" onClick={() => setCurrentView("profile")}>
           {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
        </div>
        
        {/* ✅ ปุ่มกระดิ่ง SVG พร้อมจุดแจ้งเตือน */}
        <div 
          className="sidebar-icon-btn" 
          onClick={() => { setShowRequests(true); setHasNewRequest(false); }}
          title="Notifications"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          {hasNewRequest && <div className="noti-dot" />}
        </div>

        {/* ✅ ปุ่มฟันเฟือง SVG */}
        <div 
          className="sidebar-icon-btn settings-gear" 
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </div>
      </div>

      <UserList
        users={sidebarItems}
        selectedUser={selectedConversation}
        onSelectUser={handleSelectConversation}
        onAddClick={() => setCurrentView("add_form")}
      />

      <div className="chat-area">{renderRightPanel()}</div>

      {showRequests && <FriendRequestList onClose={() => setShowRequests(false)} />}
      
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          onLogout={handleLogout}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default Chat;