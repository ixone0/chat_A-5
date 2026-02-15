import React, { useState, useEffect } from "react";
import "./Chat.css";

import UserList from "../components/UserList";
import AddFriendForm from "../components/AddFriendForm";
import ChatWindow from "../components/ChatWindow";
import FinishAdd from "../components/FinishAdd";
import FriendRequestList from "../components/FriendRequestList";
import Profile from "./Profile";

const Chat = () => {
  const [conversations, setConversations] = useState([]); // existing rooms
  const [friends, setFriends] = useState([]); // friend list
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const [currentView, setCurrentView] = useState("chat");
  const [searchedUser, setSearchedUser] = useState(null);
  const [showRequests, setShowRequests] = useState(false);
  const [loading, setLoading] = useState(false);

  // ----------------------------------------
  // helper: refresh conversations from backend
  // ----------------------------------------
  const loadConversations = async () => {
    if (!window.electronAPI?.getMyConversations) return;
    try {
      const res = await window.electronAPI.getMyConversations();
      if (res?.status === "success" && Array.isArray(res.data)) {
        setConversations(res.data || []);
      } else {
        console.error("Failed to load conversations:", res);
        setConversations([]);
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
      setConversations([]);
    }
  };

  // ----------------------------------------
  // helper: load friend list from backend
  // ----------------------------------------
  const loadFriends = async () => {
    if (!window.electronAPI?.getFriends) return;
    try {
      const res = await window.electronAPI.getFriends();
      // backend may return { status, friends } or { status, data } — handle both
      if (res?.status === "success") {
        const list = res.friends ?? res.data ?? [];
        setFriends(Array.isArray(list) ? list : []);
      } else {
        console.error("Failed to load friends:", res);
        setFriends([]);
      }
    } catch (err) {
      console.error("Error loading friends:", err);
      setFriends([]);
    }
  };

  // ----------------------------------------
  // initial load: conversations + friends
  // ----------------------------------------
  useEffect(() => {
    setLoading(true);
    Promise.all([loadConversations(), loadFriends()])
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  // ==========================================
  // realtime receive message (existing)
  // ==========================================
  useEffect(() => {
    if (!window.electronAPI?.onReceiveMessage) return;

    const unsub = window.electronAPI.onReceiveMessage((msg) => {
      const convId = msg.conversation_id;

      // add message to messages state
      setMessages((prev) => ({
        ...prev,
        [convId]: [...(prev[convId] || []), msg],
      }));

      // update sidebar last_message and reorder
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === convId
            ? { ...c, last_message: msg.content, last_message_at: msg.created_at }
            : c
        );

        return updated.sort(
          (a, b) =>
            new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
        );
      });
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // ==========================================
  // handle selecting an existing conversation
  // ==========================================
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

  // ==========================================
// ส่งข้อความ
// ==========================================
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

  // update sidebar last message
  setConversations((prev) =>
    prev
      .map((c) =>
        c.id === convId
          ? {
              ...c,
              last_message: text,
              last_message_at: new Date().toISOString(),
            }
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


  // ==========================================
  // If user clicks a friend item (not yet a conversation)
  // -> start or get direct chat, then refresh conversations + open it
  // ==========================================
  const handleStartDirectChat = async (friend) => {
    if (!window.electronAPI?.startDirectChat) {
      alert("startDirectChat not available");
      return;
    }

    try {
      // call electron -> server to create or get direct conversation
      const res = await window.electronAPI.startDirectChat(friend.id || friend.user_id || friend.uuid || friend.friend_id);

      if (res?.status === "success") {
        // expected response contains conversation_id OR conversation object
        const convId = res.conversation_id ?? res.conversation?.id ?? null;

        // refresh the conversations list to get full metadata
        await loadConversations();

        if (convId) {
          // find the new/existing conversation and open it
          const conv = (await (async () => {
            // after loadConversations the state is updated; read from current state
            // but setConversations is async; so fetch fresh via getMyConversations again for guaranteed up-to-date
            try {
              const resp = await window.electronAPI.getMyConversations();
              if (resp?.status === "success" && Array.isArray(resp.data)) {
                return resp.data.find((c) => c.id === convId) || null;
              }
            } catch (e) { /* ignore */ }
            return null;
          })()) || conversations.find((c) => c.id === convId);

          if (conv) {
            handleSelectConversation(conv);
          } else {
            // As fallback, create a minimal conversation object and select it
            const fallback = {
              id: convId,
              type: "direct",
              title: null,
              other_user: {
                id: friend.id,
                display_name: friend.display_name,
                custom_id: friend.custom_id
              },
              last_message: null
            };
            // add to state and select
            setConversations(prev => [fallback, ...prev]);
            handleSelectConversation(fallback);
          }
        } else {
          // if server didn't return conv id, just refresh UI
          await loadConversations();
        }
      } else {
        console.error("startDirectChat failed:", res);
        alert(res?.message || "Cannot start chat");
      }
    } catch (err) {
      console.error("startDirectChat error:", err);
      alert("Failed to start chat");
    }
  };

  // ==========================================
  // unified click handler for sidebar items
  // each sidebar item can be:
  // - a conversation object (existing room) OR
  // - a friend-only placeholder { isFriendOnly: true, friend: {...} }
  // ==========================================
  const handleSidebarSelect = async (item) => {
    if (!item) return;

    // if it's a conversation (has id and type)
    if (item.id && item.type) {
      return handleSelectConversation(item);
    }

    // otherwise treat as friend-only placeholder
    if (item.isFriendOnly && item.friend) {
      return handleStartDirectChat(item.friend);
    }

    // fallback: if item.other_user exists, try to find conversation that matches
    if (item.other_user && item.other_user.id) {
      const conv = conversations.find(
        (c) => c.type === "direct" && c.other_user && c.other_user.id === item.other_user.id
      );
      if (conv) return handleSelectConversation(conv);
      // else start direct chat
      return handleStartDirectChat(item.other_user);
    }
  };

  // ==========================================
  // Build sidebar items: prefer showing friends,
  // but annotate those who already have conversation.
  // Output: array that UserList can map over.
  // ==========================================
  const sidebarItems = (() => {
    // start with conversations mapped normally
    const convMap = new Map();
    conversations.forEach((c) => convMap.set(c.id, c));

    // map friends -> if have conversation with that friend (direct) use conversation,
    // otherwise create friend-only placeholder
    const friendPlaceholders = friends.map((f) => {
      // try to find existing direct conversation with this friend
      const conv = conversations.find(
        (c) => c.type === "direct" && c.other_user && String(c.other_user.id) === String(f.id)
      );

      if (conv) return conv;

      // otherwise create friend-only item (id is temporary so UserList.map works)
      return {
        id: `friend-${f.id}`, // unique id for list rendering (not conversation id)
        type: "direct",
        title: null,
        other_user: {
          id: f.id,
          display_name: f.display_name,
          custom_id: f.custom_id,
          last_seen: f.last_seen
        },
        last_message: null,
        isFriendOnly: true,
        friend: f
      };
    });

    // if you prefer showing friends first, uncomment next line:
    // return [...friendPlaceholders, ...conversations.filter(c => !friendPlaceholders.some(fp => fp.id === c.id))];

    // default: show conversations first, then friends without conversations
    const convIds = new Set(conversations.map((c) => c.id));
    const onlyFriends = friendPlaceholders.filter((p) => {
      // filter out those placeholders that actually correspond to conversation objects (already returned)
      return !(p.id && p.id.startsWith("friend-") === false && convIds.has(p.id));
    }).filter(p => p.isFriendOnly);

    return [...conversations, ...onlyFriends];
  })();

  // ===================================================
  // Search User (same as before)
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
  // Render right panel (same as before)
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
            // when FinishAdd actually completes adding friend, you should call loadFriends()
            // e.g. FinishAdd can accept a prop onAdded={() => { loadFriends(); loadConversations(); }}
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
        users={sidebarItems}
        selectedUser={selectedConversation}
        onSelectUser={handleSidebarSelect}
        onAddClick={() => setCurrentView("add_form")}
      />

      <div className="chat-area">{renderRightPanel()}</div>

      {showRequests && (
        <FriendRequestList
          onClose={() => setShowRequests(false)}
          // consider passing a callback to refresh friends after accept
        />
      )}
    </div>
  );
};

export default Chat;
