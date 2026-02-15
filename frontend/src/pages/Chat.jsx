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
  const [currentUser, setCurrentUser] = useState(null);
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
    // ✅ ดึง user จาก localStorage
    const userId = localStorage.getItem("user_id");
    const username = localStorage.getItem("username");

    if (userId) {
      setCurrentUser({
        id: userId,
        username: username,
      });
    }

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
            ? {
                ...c,
                last_message: msg.content,
                last_message_at: msg.created_at,
              }
            : c,
        );

        return updated.sort(
          (a, b) =>
            new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0),
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
  // ===================================================
  // เลือกห้อง (ปรับให้รองรับ friend-placeholder)
  // ===================================================
  const handleSelectConversation = async (conv) => {
    if (!conv) return;

    // หากเป็น placeholder ของเพื่อน (สร้าง id ชั่วคราว เช่น 'friend-<uuid>')
    const isFriendPlaceholder =
      conv.isFriendOnly ||
      (typeof conv.id === "string" && conv.id.startsWith("friend-"));

    if (isFriendPlaceholder) {
      // ดึง friend object (เราเก็บไว้ใน conv.friend ตามโค้ดก่อนหน้า)
      const friend = conv.friend ?? conv.other_user ?? null;
      // ถ้าไม่มี friend object ให้ลองดึง id จากชื่อ placeholder
      const friendId = friend?.id ?? String(conv.id).replace(/^friend-/, "");

      // เรียก startDirectChat เพื่อสร้างหรือดึง conversation จริง
      try {
        const res = await window.electronAPI.startDirectChat(friendId);
        if (res?.status === "success") {
          const convId = res.conversation_id ?? res.conversation?.id ?? null;
          // รีเฟรช conversation list แล้วเปิดห้องที่ได้
          await loadConversations();

          if (convId) {
            // หา conversation ตัวจริงจาก state (รีเฟรชแล้ว)
            const fresh =
              (await window.electronAPI.getMyConversations())?.data ?? [];
            const realConv =
              fresh.find((c) => c.id === convId) ||
              conversations.find((c) => c.id === convId);

            if (realConv) {
              // เปิด conversation จริง
              return handleSelectConversation(realConv);
            } else {
              // fallback: สร้าง object แบบชั่วคราวแล้วเปิด (จะเรียก getMessages แต่ conv.id เป็น UUID)
              const fallback = {
                id: convId,
                type: "direct",
                other_user: {
                  id: friendId,
                  display_name:
                    friend?.display_name ?? friend?.custom_id ?? "Friend",
                  custom_id: friend?.custom_id ?? null,
                },
                last_message: null,
              };
              setConversations((prev) => [fallback, ...prev]);
              return handleSelectConversation(fallback);
            }
          } else {
            // ถ้า server ไม่ได้คืน id — รีเฟรชเฉย ๆ
            await loadConversations();
            return;
          }
        } else {
          console.error("startDirectChat failed:", res);
          alert(res?.message || "ไม่สามารถเริ่มแชทได้");
          return;
        }
      } catch (err) {
        console.error("startDirectChat error:", err);
        alert("เกิดข้อผิดพลาดขณะเริ่มแชท");
        return;
      }
    }

    // ถ้าเป็น conversation จริง → ดึงข้อความปกติ
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
      } else {
        console.error("getMessages failed:", res);
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  // ==========================================
  // ส่งข้อความ
  // ==========================================
  const handleSendMessage = (payload) => {
    if (!selectedConversation) return;

    // รองรับทั้ง string และ object
    const text =
      typeof payload === "string" ? payload : payload?.text;

    if (!text || !text.trim()) return;

    if (!currentUser || !currentUser.id) {
      console.error("currentUser not ready");
      return;
    }

    const convId = selectedConversation.id;

    const createdAt =
      typeof payload === "object" && payload.created_at
        ? payload.created_at
        : new Date().toISOString();

    const tempMessage = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.id,
      content: text,
      created_at: createdAt,
    };

    // optimistic update
    setMessages((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), tempMessage],
    }));

    // update sidebar
    setConversations((prev) =>
      prev
        .map((c) =>
          c.id === convId
            ? {
                ...c,
                last_message: text,
                last_message_at: createdAt,
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
        created_at: createdAt,
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
      const res = await window.electronAPI.startDirectChat(
        friend.id || friend.user_id || friend.uuid || friend.friend_id,
      );

      if (res?.status === "success") {
        const convId = res.conversation_id;

        // สร้าง object conversation ตรง ๆ แล้วเปิดเลย
        const newConv = {
          id: convId,
          type: "direct",
          title: null,
          other_user: {
            id: friend.id,
            display_name: friend.display_name,
            custom_id: friend.custom_id,
          },
          last_message: null,
        };

        setConversations((prev) => {
          // ถ้ามีอยู่แล้วไม่ต้องเพิ่ม
          if (prev.find((c) => c.id === convId)) return prev;
          return [newConv, ...prev];
        });

        // 🔥 เปิดห้องทันที
        setSelectedConversation(newConv);
        setCurrentView("chat");

        // โหลดข้อความ
        const msgRes = await window.electronAPI.getMessages({
          conversation_id: convId,
        });

        if (msgRes?.status === "success") {
          setMessages((prev) => ({
            ...prev,
            [convId]: msgRes.messages || [],
          }));
        }

        return;
      }
      else {
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
        (c) =>
          c.type === "direct" &&
          c.other_user &&
          c.other_user.id === item.other_user.id,
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
        (c) =>
          c.type === "direct" &&
          c.other_user &&
          String(c.other_user.id) === String(f.id),
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
          last_seen: f.last_seen,
        },
        last_message: null,
        isFriendOnly: true,
        friend: f,
      };
    });

    // if you prefer showing friends first, uncomment next line:
    // return [...friendPlaceholders, ...conversations.filter(c => !friendPlaceholders.some(fp => fp.id === c.id))];

    // default: show conversations first, then friends without conversations
    const convIds = new Set(conversations.map((c) => c.id));
    const onlyFriends = friendPlaceholders
      .filter((p) => {
        // filter out those placeholders that actually correspond to conversation objects (already returned)
        return !(
          p.id &&
          p.id.startsWith("friend-") === false &&
          convIds.has(p.id)
        );
      })
      .filter((p) => p.isFriendOnly);

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
            currentUserId={currentUser?.id}
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
