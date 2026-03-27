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
  const [callElapsedTime, setCallElapsedTime] = useState(0); // ✅ Call duration in seconds
  const isCallerRef = useRef(false);
  const pendingCandidatesRef = useRef([]);
  const currentCallConversationRef = useRef(null); // ✅ เก็บ conversation_id ของการโทรปัจจุบัน
  const pcRef = useRef(null);
  const localVideoRef = useRef(null);      // ✅ Container for local video
  const remoteVideoRef = useRef(null);     // ✅ Container for remote video
  const callTypeRef = useRef(null);        // ✅ Track 'audio' or 'video' mode
  
  const localStreamRef = useRef(null);
  const remoteMediaRef = useRef(null); // เก็บ remote <audio> หรือ <video>
  const [isMicMuted, setIsMicMuted] = useState(false);

  const attachLocalPreview = () => {
    if (
      !localVideoRef.current ||
      !localStreamRef.current ||
      callTypeRef.current !== "video"
    ) {
      return;
    }

    const existing = localVideoRef.current.querySelector("video");
    if (existing) return;

    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = localStreamRef.current;
    video.style.cssText =
      "width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);";

    video.onloadedmetadata = () => {
      video.play().catch((err) => {
        console.warn("⚠️ Failed to auto-play local preview:", err);
      });
    };

    localVideoRef.current.innerHTML = "";
    localVideoRef.current.appendChild(video);
    console.log("✅ Local preview attached");
  };

  useEffect(() => {
    if (activeCall?.call_type === "video") {
      attachLocalPreview();
    }
  }, [activeCall]);
  
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
  
  const cleanupCall = () => {
    try {
      // ปิด local tracks จริง
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {
            console.warn("Failed to stop local track:", e);
          }
        });
        localStreamRef.current = null;
      }

      // ลบ remote media element
      if (remoteMediaRef.current) {
        try {
          remoteMediaRef.current.pause?.();
          remoteMediaRef.current.srcObject = null;
          remoteMediaRef.current.remove?.();
        } catch (e) {
          console.warn("Failed to cleanup remote media:", e);
        }
        remoteMediaRef.current = null;
      }

      // ล้าง video containers
      if (localVideoRef.current) {
        localVideoRef.current.innerHTML = "";
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.innerHTML = "";
      }

      // ปิด peer connection จริง
      if (pcRef.current) {
        try {
          pcRef.current.getSenders?.().forEach((sender) => {
            try {
              sender.track?.stop?.();
            } catch (e) {}
          });

          pcRef.current.getReceivers?.().forEach((receiver) => {
            try {
              receiver.track?.stop?.();
            } catch (e) {}
          });

          pcRef.current.getTransceivers?.().forEach((transceiver) => {
            try {
              transceiver.stop?.();
            } catch (e) {}
          });

          pcRef.current.ontrack = null;
          pcRef.current.onicecandidate = null;
          pcRef.current.close();
        } catch (e) {
          console.warn("Failed to close peer connection:", e);
        }

        pcRef.current = null;
      }

      pendingCandidatesRef.current = [];
      currentCallConversationRef.current = null;
      callTypeRef.current = null;
      setIsMicMuted(false);
    } catch (err) {
      console.error("cleanupCall error:", err);
    }
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return;

    const nextMuted = !isMicMuted;
    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsMicMuted(nextMuted);
  };

  const startWebRTC = async (call_id, conversation_id, call_type = 'audio') => {
    console.log("START WEBRTC CALLED", { call_id, call_type });
    callTypeRef.current = call_type;
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ]
    });

    pcRef.current = pc;

   pc.ontrack = (event) => {
    console.log("ONTRACK FIRED", event.streams[0]);

    if ((call_type || callTypeRef.current) === "video") {
      try {
        if (!remoteVideoRef.current) {
          console.error("❌ remoteVideoRef.current is null");
          return;
        }

        let video = remoteVideoRef.current.querySelector("video");
        if (!video) {
          video = document.createElement("video");
          video.autoplay = true;
          video.playsInline = true;
          video.muted = false;
          video.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
          remoteVideoRef.current.innerHTML = "";
          remoteVideoRef.current.appendChild(video);
        }

        if (video.srcObject !== event.streams[0]) {
          video.srcObject = event.streams[0];
        }

        video.onloadedmetadata = () => {
          video.play().catch((err) => {
            console.warn("⚠️ Failed to auto-play remote video:", err);
          });
        };

        console.log("✅ Remote video attached");
      } catch (err) {
        console.error("❌ Error creating remote video:", err);
      }
    } else {
        // 🔊 Audio call: just play audio
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = false;
        audio.srcObject = event.streams[0];
        audio.volume = 1.0;
        
        setTimeout(() => {
          audio.play().then(() => {
            console.log("✅ Audio playing successfully");
          }).catch(err => {
            console.error("❌ Audio play error:", err);
            document.addEventListener('click', () => {
              audio.play().catch(console.error);
            }, { once: true });
          });
        }, 100);
        
        document.body.appendChild(audio);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE TYPE:", event.candidate.candidate);
        window.electronAPI.sendRealtime({
          type: "ice_candidate",
          call_id,
          conversation_id,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
        });
      }
    };

    const mediaConstraints = call_type === 'video' 
      ? { audio: true, video: { width: 640, height: 480 } }
      : { audio: true };
      
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      localStreamRef.current = stream;
      setIsMicMuted(false);
    } catch (err) {
      console.error("❌ getUserMedia error (caller):", err);
      return pc;
    }
    
    // ✅ Validate stream has tracks
    const tracks = stream.getTracks();
    console.log("📊 Stream tracks (caller):", tracks.length, tracks.map(t => t.kind));
    if (tracks.length === 0) {
      console.error("❌ Stream has no tracks!");
      return pc;
    }
    
    tracks.forEach(track => pc.addTrack(track, stream));

    // ✅ Show local video if video call
    if (call_type === "video") {
      attachLocalPreview();
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("📤 SENDING OFFER TO BACKEND", { call_id, conversation_id, call_type });
      window.electronAPI.sendRealtime({
        type: "webrtc_offer",
        call_id,
        conversation_id,
        offer,
        call_type
      });
      console.log("OFFER SENT", call_id);
    } catch (err) {
      console.error("❌ Error creating/sending offer:", err);
    }
    return pc;
  };

  const handleOfferLogic = async (offer, call_id, conversation_id) => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ]
    });

    pcRef.current = pc;

    pc.ontrack = (event) => {
      console.log("ONTRACK FIRED", event.streams[0]);
      
      if (callTypeRef.current === "video") {
        attachLocalPreview();
      } else {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = false;
        audio.srcObject = event.streams[0];
        audio.volume = 1.0;

        remoteMediaRef.current = audio;

        setTimeout(() => {
          audio.play().then(() => {
            console.log("✅ Audio playing successfully");
          }).catch(err => {
            console.error("❌ Audio play error:", err);
            document.addEventListener('click', () => {
              audio.play().catch(console.error);
            }, { once: true });
          });
        }, 100);

        document.body.appendChild(audio);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE TYPE:", event.candidate.candidate);
        window.electronAPI.sendRealtime({
          type: "ice_candidate",
          call_id,
          conversation_id: currentCallConversationRef.current,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
        });
      }
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: callTypeRef.current === 'video' ? { width: 640, height: 480 } : false 
      });
      localStreamRef.current = stream;
      setIsMicMuted(false);
    } catch (err) {
      console.error("❌ getUserMedia error (callee):", err);
      alert("Cannot access camera: " + err.message);
      return pc;
    }
    
    // ✅ Validate stream has tracks
    const tracks = stream.getTracks();
    console.log("📊 Stream tracks (callee):", tracks.length, tracks.map(t => t.kind));
    if (tracks.length === 0) {
      console.error("❌ Stream has no tracks!");
      return pc;
    }
    
    tracks.forEach(track => pc.addTrack(track, stream));

    // ✅ Show local video if video call
    if (callTypeRef.current === 'video' && localVideoRef.current) {
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // Mute self
      video.srcObject = stream;
      video.style.cssText = "width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);";
      console.log("✅ Creating local video element (callee)");
      remoteMediaRef.current = video;
      // Try to play video
      video.play().catch(err => {
        console.warn("⚠️ Failed to auto-play local video (callee):", err);
      });
      
      video.onloadedmetadata = () => {
        console.log("✅ Local video metadata loaded (callee)");
      };
      
      localVideoRef.current.innerHTML = '';
      localVideoRef.current.appendChild(video);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      for (const candidate of pendingCandidatesRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("✅ Added pending candidate after remote description");
        } catch (err) {
          console.error("❌ Failed to add pending candidate:", err);
        }
      }
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log("📤 SENDING ANSWER TO BACKEND", { call_id, conversation_id: currentCallConversationRef.current });
      window.electronAPI.sendRealtime({
        type: "webrtc_answer",
        call_id,
        conversation_id: currentCallConversationRef.current,
        answer
      });
    } catch (err) {
      console.error("❌ Error creating/sending answer:", err);
    }

    return pc;
  };

  useEffect(() => {
    if (!window.electronAPI) return;

    const handleOffer = async (data) => {
      console.log("RECEIVED WEBRTC OFFER", data.call_id, { call_type: data.call_type });
      
      // ✅ Set conversation and call type from incoming offer
      currentCallConversationRef.current = data.conversation_id;
      callTypeRef.current = data.call_type || 'audio';
      
      const pc = await handleOfferLogic(data.offer, data.call_id, data.conversation_id);
      console.log("ANSWER CREATED", data.call_id);
      setActiveCall({ call_id: data.call_id, pc, call_type: data.call_type || 'audio' });
    };

    const handleAnswer = async (data) => {
      if (!pcRef.current) return;
      console.log("IS CALLER?", isCallerRef.current);
      console.log("CALL_ID:", data.call_id);
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );

      // ✅ Add pending candidates ที่สะสมไว้ระหว่างรอ answer
      for (const candidate of pendingCandidatesRef.current) {
        try {
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
          console.log("✅ Added pending candidate");
        } catch (err) {
          console.error("❌ Failed to add pending candidate:", err);
        }
      }
      pendingCandidatesRef.current = [];
    };

    const handleCandidate = async (data) => {
      if (!pcRef.current || !pcRef.current.remoteDescription) {
        pendingCandidatesRef.current.push(data.candidate);
        return;
      }

      try {
        await pcRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
        console.log("✅ Added ICE candidate");
      } catch (err) {
        console.error("❌ Failed to add ICE candidate:", err);
      }
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
  const callingRef = useRef(calling);

  useEffect(() => {
    callingRef.current = calling;
  }, [calling]);

  useEffect(() => {
    if (!window.electronAPI) return;
    
    const handleIncoming = (data) => {
      console.log("Incoming call:", data);

      // 🔥 กันเคสตัวเองได้รับ event
      if (callingRef.current && data.call_id === callingRef.current.call_id) {
        console.log("IGNORE self incoming");
        return;
      }

      setIncomingCall(data);
    };

    const handleAnswered = async (data) => {
      console.log("Call answered:", data);

      setIncomingCall(null);
      setCalling(null);

      const callType = callTypeRef.current || data.call_type || "audio";

      if (isCallerRef.current) {
        const convId =
          currentCallConversationRef.current || selectedConversation?.id;

        if (!convId) {
          console.error("❌ No conversation ID for call answered");
          return;
        }

        // ✅ render call UI ก่อน เพื่อให้ ref ถูก mount
        setActiveCall({
          call_id: data.call_id,
          call_type: callType,
        });

        // ✅ รอ 1 tick ให้ localVideoRef / remoteVideoRef พร้อม
        setTimeout(async () => {
          const pc = await startWebRTC(data.call_id, convId, callType);

          setActiveCall((prev) => ({
            ...prev,
            pc,
          }));
        }, 0);
      } else {
        setActiveCall({
          call_id: data.call_id,
          call_type: callTypeRef.current || "audio",
        });
      }
    };

    const handleEnded = () => {
      setIncomingCall(null);
      setCalling(null);
      setActiveCall(null);
      isCallerRef.current = false;
      cleanupCall();
    };
    
    const offIncoming = window.electronAPI.onIncomingCall(handleIncoming);
    const offAnswered = window.electronAPI.onCallAnswered(handleAnswered);
    const offEnded = window.electronAPI.onCallEnded(handleEnded);

    return () => {
      offIncoming?.();
      offAnswered?.();
      offEnded?.();
    };

  }, []);

  const startCall = async (type) => {
    if (!selectedConversation) return;
    isCallerRef.current = true;
    currentCallConversationRef.current = selectedConversation.id; // ✅ บันทึกตรงนี้
    callTypeRef.current = type; // ✅ Set call type ref for caller
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
      isCallerRef.current = false;
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    isCallerRef.current = false;
    // ✅ บันทึก conversation_id เมื่อ callee ตอบรับ
    currentCallConversationRef.current = incomingCall.conversation_id;
    callTypeRef.current = incomingCall.call_type || 'audio'; // ✅ Set call type from incoming call
    await window.electronAPI.answerCall(incomingCall.call_id);
    console.log("WAITING FOR OFFER...");
    // ❌ ไม่ต้อง setActiveCall ตรงนี้
    setIncomingCall(null);
  };

  const endCall = async (callId) => {
    try {
      if (callId && callId !== "temp") {
        await window.electronAPI.endCall(callId);
      }
    } catch (err) {
      console.error("endCall error:", err);
    } finally {
      cleanupCall();
      setIncomingCall(null);
      setActiveCall(null);
      setCalling(null);
      isCallerRef.current = false;
    }
  };
  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);

  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  // ✅ Call Duration Timer
  useEffect(() => {
    if (!activeCall) {
      setCallElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setCallElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

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
            refreshMessages={async () => {
              const res = await window.electronAPI.getMessages({
                conversation_id: selectedConversation.id,
              });
              if (res?.status === "success") {
                setMessages((prev) => ({
                  ...prev,
                  [String(selectedConversation.id)]: res.messages || [],
                }));
              }
            }}
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
          <div className="call-box" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <h2>📞 In Call</h2>
            
            {/* ✅ Call Duration Display */}
            <div style={{
              position: 'absolute',
              top: activeCall.call_type === 'video' ? '60px' : '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '16px',
              fontWeight: 'bold',
              zIndex: 10
            }}>
              ⏱️ {String(Math.floor(callElapsedTime / 60)).padStart(2, '0')}:{String(callElapsedTime % 60).padStart(2, '0')}
            </div>
            
            {/* ✅ Show video containers ONLY for video calls */}
            {activeCall.call_type === 'video' && (
              <>
                {/* Remote Video Container */}
                <div 
                  ref={remoteVideoRef} 
                  style={{
                    width: '100%',
                    height: '400px',
                    backgroundColor: '#000',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    overflow: 'hidden'
                  }}
                />
                
                {/* Local Video Container (Picture-in-Picture) */}
                <div 
                  ref={localVideoRef} 
                  style={{
                    position: 'absolute',
                    bottom: '100px',
                    right: '20px',
                    width: '150px',
                    height: '120px',
                    backgroundColor: '#000',
                    borderRadius: '8px',
                    border: '2px solid #fff',
                    overflow: 'hidden'
                  }}
                />
              </>
            )}
            
            <p>Call ID: {activeCall.call_id}</p>

            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '16px'
            }}>
              <button
                onClick={toggleMic}
                style={{
                  fontSize: '24px',
                  padding: '12px 16px',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer'
                }}
                title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMicMuted ? '🔇' : '🎤'}
              </button>

              <button
                onClick={() => endCall(activeCall.call_id)}
                style={{
                  fontSize: '18px',
                  padding: '12px 20px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                📞 End Call
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;