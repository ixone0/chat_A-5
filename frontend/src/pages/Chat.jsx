///pages/Chat.jsx
import React, { useState, useEffect, useRef } from "react";
import "./Chat.css";

import UserList from "../components/UserList";
import AddFriendForm from "../components/AddFriendForm";
import ChatWindow from "../components/ChatWindow";
import FinishAdd from "../components/FinishAdd";
import FriendRequestList from "../components/FriendRequestList";
import Profile from "./Profile";
import SettingsModal from "../components/SettingsModal";
import CallModal from "../components/CallModal";
import CallingModal from "../components/CallingModal";
import CreateGroupForm from "../components/CreateGroupForm";

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
  const selectedConvRef = useRef(selectedConversation);
  const [incomingCall, setIncomingCall] = useState(null);
  const [calling, setCalling] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  const refreshData = async () => {
    if (!window.electronAPI) return;
    try {
      const [convRes, friendRes] = await Promise.all([
        window.electronAPI.getMyConversations(),
        window.electronAPI.getFriends(),
      ]);
      if (convRes?.status === "success") setConversations(convRes.data || []);
      if (friendRes?.status === "success")
        setFriends(friendRes.friends || friendRes.data || []);
    } catch (err) {
      console.error("Refresh Error:", err);
    }
  };

  const pcRef = useRef(null);
  
  const startWebRTC = async (call_id) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ]
    });

    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    window.electronAPI.send({
      type: "webrtc_offer",
      call_id,
      offer
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        window.electronAPI.send({
          type: "ice_candidate",
          call_id,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
        });
      }
    };

    return pc;
  };

  const handleOfferLogic = async (offer, call_id) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play();
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    window.electronAPI.send({
      type: "webrtc_answer",
      call_id,
      answer
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE:", event.candidate.candidate);
        window.electronAPI.send({
          type: "ice_candidate",
          call_id,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
        });
      }
    };

    return pc;
  };

  useEffect(() => {
    if (!window.electronAPI) return;

    const handleOffer = async (data) => {
      const pc = await handleOfferLogic(data.offer, data.call_id);

      setActiveCall({
        call_id: data.call_id
      });
    };

    const handleAnswer = async (data) => {
      if (!pcRef.current) return;

      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );
    };

    const handleCandidate = async (data) => {
      if (!pcRef.current) return;

      await pcRef.current.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      );
    };

    const offOffer = window.electronAPI.onWebRTCOffer(handleOffer);
    const offAnswer = window.electronAPI.onWebRTCAnswer(handleAnswer);
    const offICE = window.electronAPI.onICECandidate(handleCandidate);

    return () => {
      offOffer();
      offAnswer();
      offICE();
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;

    const handleIncoming = (data) => {
      console.log("Incoming call:", data);

      // 🔥 กันเคสตัวเองได้รับ event
      if (calling && data.call_id === calling.call_id) {
        console.log("IGNORE self incoming");
        return;
      }

      setIncomingCall(data);
    };

    const handleAnswered = async (data) => {
      console.log("Call answered:", data);

      setIncomingCall(null);
      setCalling(null);

      const pc = await startWebRTC(data.call_id);

      setActiveCall({
        call_id: data.call_id,
        pc
      });
    };

    const handleEnded = () => {
      setIncomingCall(null);
      setCalling(null);
      setActiveCall(null);
    };
    
    window.electronAPI.onIncomingCall(handleIncoming);
    window.electronAPI.onCallAnswered(handleAnswered);
    window.electronAPI.onCallEnded(handleEnded);

  }, []);

  const startCall = async (type) => {
    if (!selectedConversation) return;

    // ✅ set ทันที
    setCalling({
      call_id: "temp",   // temporary
      type
    });

    try {
      const res = await window.electronAPI.startCall({
        conversation_id: selectedConversation.id,
        call_type: type
      });
      
      if (res.status === "ok") {
        // ✅ update call_id จริง
        setCalling({
          call_id: res.call_id,
          type
        });
      }
    } catch (err) {
      console.error(err);
      setCalling(null); // ❌ error → reset
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    await window.electronAPI.answerCall(incomingCall.call_id);
    console.log("WAITING FOR OFFER...");
    // ❌ ไม่ต้อง setActiveCall ตรงนี้
    setIncomingCall(null);
  };

  const endCall = async (callId) => {
    await window.electronAPI.endCall(callId);

    setActiveCall(null);
    setCalling(null);
  };
  
  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    const username = localStorage.getItem("username");
    if (userId) setCurrentUser({ id: userId, username });
    refreshData();
  }, []);

  // ----------------------------------------
  // 2. Real-time Listeners
  // ----------------------------------------
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubMsg = window.electronAPI.onReceiveMessage(async (msg) => {
      // Normalize conversation id to string
      const convId = String(
        msg.conversation_id ?? msg.conversationId ?? msg.conversation ?? "",
      );
      if (!convId) return; // safety

      // 1) อัปเดต messages state (กัน duplicate ตาม id)
      setMessages((prev) => {
        const key = String(convId);
        const existing = Array.isArray(prev[key]) ? prev[key] : [];

        const incomingId =
          msg.id ?? `${msg.sender_id ?? "x"}-${msg.created_at ?? ""}`;
        if (existing.some((m) => String(m.id) === String(incomingId))) {
          return prev; // duplicate -> no change
        }

        const newMsg = { ...msg, id: incomingId };
        return { ...prev, [key]: [...existing, newMsg] };
      });

      // 2) อัปเดต sidebar last_message / reorder
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (String(c.id) === convId) {
            return {
              ...c,
              last_message: msg.content ?? msg.text ?? c.last_message ?? "",
              last_message_at: msg.created_at ?? new Date().toISOString(),
            };
          }
          return c;
        });

        updated.sort(
          (a, b) =>
            new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0),
        );
        return updated;
      });

      // 3) ถ้าเป็นห้องที่เปิดอยู่ -> รีเฟรช history จาก server (เอาเวลาจริงจาก server)
      if (String(selectedConvRef.current?.id) === convId) {
        try {
          const res = await window.electronAPI.getMessages({
            conversation_id: convId,
          });
          if (res?.status === "success") {
            setMessages((prev) => ({ ...prev, [convId]: res.messages || [] }));
          }
        } catch (err) {
          console.error(
            "Failed to refresh messages for open conversation:",
            err,
          );
        }
      } else {
        // 4) ถ้าไม่ใช่ห้องที่เปิดอยู่ -> แจ้ง notification + กำหนด badge/flag
        try {
          // desktop notification (Electron supports Notification)
          if (window.Notification) {
            if (Notification.permission === "granted") {
              new Notification("New message", {
                body: `${msg.username ?? msg.sender_id ?? "Someone"}: ${msg.content ?? msg.text ?? ""}`,
              });
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then((p) => {
                if (p === "granted") {
                  new Notification("New message", {
                    body: `${msg.username ?? msg.sender_id ?? "Someone"}: ${msg.content ?? msg.text ?? ""}`,
                  });
                }
              });
            }
          }
        } catch (e) {
          console.warn("Notification failed:", e);
        }

        // ใช้ flag เพื่อแสดงจุดแจ้งเตือนใน UI (คุณอาจเพิ่ม unread map แยกต่างหาก)
        setHasNewRequest(true);
      }
    });

    // ✅ ฟังการแจ้งเตือน group ที่ได้รับการสร้างขึ้นใหม่
    const unsubGroup = window.electronAPI.onReceiveGroupNotification?.((data) => {
      console.log("📢 You were added to a new group!", data);
      refreshData(); // รีเฟรชโหลดห้องแชทใหม่ขึ้นมาทันที!
    });

    // ✅ ฟังการแจ้งเตือนเมื่อชื่อกลุ่มเปลี่ยน
    const unsubRename = window.electronAPI.onGroupRenamed?.((data) => {
      console.log("📢 Group renamed!", data);
      refreshData(); // โหลดข้อมูลใหม่เพื่อให้ชื่อกลุ่มอัปเดตทุกหน้าจอ
    });

    return () => {
      if (unsubMsg) unsubMsg();
      if (unsubGroup) unsubGroup(); // ✅ อย่าลืม clear listener
      if (unsubRename) unsubRename(); // ✅ clear rename listener
    };
  }, []);

  const handleSelectConversation = async (conv) => {
    if (!conv) return;

    // ถ้าเลือกจากรายชื่อเพื่อนที่ยังไม่มีห้องแชท
    if (conv.isFriendOnly) {
      const friend = conv.friend;
      try {
        const res = await window.electronAPI.startDirectChat(friend.id);
        if (res?.status === "success") {
          await refreshData();
          const freshData =
            (await window.electronAPI.getMyConversations())?.data ?? [];
          let realConv = freshData.find((c) => c.id === res.conversation_id);
          if (realConv) {
            if (!realConv.other_user) realConv.other_user = friend;
            return handleSelectConversation(realConv);
          }
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    setSelectedConversation(conv);
    setCurrentView("chat");

    try {
      const res = await window.electronAPI.getMessages({
        conversation_id: conv.id,
      });
      if (res?.status === "success") {
        // normalize key to string
        setMessages((prev) => ({
          ...prev,
          [String(conv.id)]: res.messages || [],
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleSendMessage = (payload) => {
    if (!selectedConversation || !currentUser) return;
    const text = typeof payload === "string" ? payload : payload?.text;
    if (!text?.trim()) return;

    const convId = String(selectedConversation.id);
    const createdAt = new Date().toISOString();

    // optimistic update — use string key
    setMessages((prev) => {
      const existing = Array.isArray(prev[convId]) ? prev[convId] : [];
      const temp = {
        id: `temp-${Date.now()}`,
        sender_id: currentUser.id,
        content: text,
        created_at: createdAt,
      };
      return { ...prev, [convId]: [...existing, temp] };
    });

    // update sidebar last_message and time
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === selectedConversation.id
          ? { ...c, last_message: text, last_message_at: createdAt }
          : c,
      );
      return updated.sort(
        (a, b) =>
          new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0),
      );
    });

    // send to backend (created_at optional — server should set authoritative time)
    window.electronAPI.sendMessage({
      conversation_id: convId,
      text,
      created_at: createdAt,
    });
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
          custom_id: res.data.custom_id,
        });
        setCurrentView("add_preview");
      } else {
        alert(res?.message || "User not found");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sidebarItems = (() => {
    const items = [];
    const seen = new Set();
    conversations.forEach((c) => {
      if (c.type === "direct" && c.other_user?.id) {
        seen.add(String(c.other_user.id));
        items.push(c);
      } else if (c.type === "group") items.push(c);
    });
    friends.forEach((f) => {
      if (!seen.has(String(f.id))) {
        items.push({
          id: `friend-${f.id}`,
          type: "direct",
          other_user: { ...f, display_name: f.display_name || f.username },
          isFriendOnly: true,
          friend: f,
        });
      }
    });
    return items;
  })();

  const renderRightPanel = () => {
    switch (currentView) {
      case "add_form":
        return (
          <AddFriendForm
            onSearch={handleSearchUser}
            onCancel={() => setCurrentView("chat")}
          />
        );
      case "add_preview":
        return (
          <FinishAdd
            user={searchedUser}
            onCancel={() => setCurrentView("add_form")}
            onSuccess={() => {
              refreshData();
              setCurrentView("chat");
            }}
          />
        );
      case "profile":
        return <Profile />;
      
      // ✅ เพิ่มหน้าสร้างกลุ่ม
      case "create_group":
        return (
          <CreateGroupForm 
            friends={friends} 
            onCancel={() => setCurrentView("chat")} 
            onSuccess={() => { 
              refreshData(); 
              setCurrentView("chat"); 
            }} 
          />
        );
        
      default:
        return (
          <ChatWindow
            conversation={selectedConversation}
            messages={
              selectedConversation
                ? messages[String(selectedConversation.id)] || []
                : []
            }
            currentUserId={currentUser?.id}
            onSendMessage={handleSendMessage}
            startCall={startCall}
          />
        );
    }
  };

  return (
    <div className="chat-container">
      <div className="sidebar-strip">
        {/* Profile Avatar */}
        <div
          className="profile-circle"
          onClick={() => setCurrentView("profile")}
        >
          {currentUser?.username?.charAt(0).toUpperCase() || "U"}
        </div>

        {/* ✅ ปุ่มสร้างกลุ่ม (SVG ไอคอนรูปคนซ้อนกัน) */}
        <div 
          className="sidebar-icon-btn" 
          onClick={() => setCurrentView("create_group")}
          title="Create Group"
          style={{ marginTop: '10px' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </div>

        {/* ✅ ปุ่มกระดิ่ง SVG พร้อมจุดแจ้งเตือน */}
        <div
          className="sidebar-icon-btn"
          onClick={() => {
            setShowRequests(true);
            setHasNewRequest(false);
          }}
          title="Notifications"
          style={{ marginTop: '10px' }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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

      {showRequests && (
        <FriendRequestList onClose={() => setShowRequests(false)} />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onLogout={handleLogout}
          currentUser={currentUser}
        />
      )}

      {incomingCall && (
        <CallModal
          call={incomingCall}
          onAccept={acceptCall}
          onReject={() => {
            window.electronAPI.endCall(incomingCall.call_id);
            setIncomingCall(null);
          }}
        />
      )}

      {calling && (
        <CallingModal
          call={calling}
          onCancel={() => endCall(calling.call_id)}
        />
      )}

      {activeCall && (
        <div className="call-modal">
          <div className="call-box">
            <h2>📞 In Call</h2>
            <p>Call ID: {activeCall.call_id}</p>

            <button onClick={() => endCall(activeCall.call_id)}>
              End Call
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;