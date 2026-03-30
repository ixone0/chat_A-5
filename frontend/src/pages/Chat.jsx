///pages/Chat.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
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
import GroupMembersModal from "../components/GroupMembersModal";
import { PhoneIcon } from "../components/Icons";
import { useToast } from "../components/Toast";

const Chat = () => {
  const toast = useToast();
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
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [typingUserId, setTypingUserId] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [callElapsedTime, setCallElapsedTime] = useState(0); // ✅ Call duration in seconds
  const callElapsedTimeRef = useRef(0);
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
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Group call: map of userId -> RTCPeerConnection
  const pcsRef = useRef({});
  // Group call: map of userId -> remote stream
  const [remoteStreams, setRemoteStreams] = useState({});
  const [callParticipants, setCallParticipants] = useState([]); // ✅ List of participants in current call
  const isGroupCallRef = useRef(false);

  const attachLocalPreview = useCallback(() => {
    if (!localVideoRef.current || !localStreamRef.current || callTypeRef.current !== "video") return;
    // Group call: localVideoRef เป็น <video> element โดยตรง
    if (activeCall?.is_group) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      return;
    }
    // Direct call: append video element เหมือนเดิม
    const existing = localVideoRef.current.querySelector("video");
    if (existing) return;
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = localStreamRef.current;
    video.style.cssText = "width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);";
    video.onloadedmetadata = () => { video.play().catch(() => {}); };
    localVideoRef.current.innerHTML = "";
    localVideoRef.current.appendChild(video);
  });

  useEffect(() => {
    if (activeCall?.call_type === "video") {
      attachLocalPreview();
    }
  }, [activeCall, attachLocalPreview]);
  
  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

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
    } finally {
      setSidebarLoading(false);
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
      setIsCameraOff(false);

      // cleanup group call peers
      Object.values(pcsRef.current).forEach((pc) => {
        try { pc.close(); } catch (e) {}
      });
      pcsRef.current = {};
      setRemoteStreams({});
      setCallParticipants([]); // ✅ Clear participants list
      isGroupCallRef.current = false;
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

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (!videoTracks.length) return;
    const nextOff = !isCameraOff;
    videoTracks.forEach((track) => {
      track.enabled = !nextOff;
    });
    setIsCameraOff(nextOff);
  };

  // ===== Group Call: สร้าง peer connection กับ user คนหนึ่ง =====
  const createPeerForUser = async (targetUserId, call_id, call_type, isInitiator) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" }
        ]
      });

      pcsRef.current[targetUserId] = pc;

      // เพิ่ม local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      }

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        setRemoteStreams(prev => ({ ...prev, [targetUserId]: stream }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          window.electronAPI.sendRealtime({
            type: "ice_candidate",
            call_id,
            conversation_id: currentCallConversationRef.current,
            target_user_id: targetUserId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            }
          });
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        window.electronAPI.sendRealtime({
          type: "webrtc_offer",
          call_id,
          conversation_id: currentCallConversationRef.current,
          target_user_id: targetUserId,
          offer,
          call_type
        });
      }

      return pc;
    } catch (err) {
      console.error("❌ createPeerForUser error:", err);
      toast.error("Failed to create peer connection: " + (err?.message || "Unknown error"));
      throw err; // Re-throw so caller knows this failed
    }
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
              console.warn("⚠️ Failed to auto-play remote video (callee):", err);
            });
          };

          console.log("✅ Remote video attached (callee)");
        } catch (err) {
          console.error("❌ Error creating remote video (callee):", err);
        }
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
      toast.error("Cannot access camera: " + err.message);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleOffer = async (data) => {
      try {
        const fromUser = data.from_user || data.sender_id;
        currentCallConversationRef.current = data.conversation_id;
        callTypeRef.current = data.call_type || 'audio';

        if (isGroupCallRef.current && fromUser) {
          // Group: สร้าง peer กับคนที่ส่ง offer มา (ไม่ใช่ initiator)
          if (!localStreamRef.current) {
            const constraints = callTypeRef.current === 'video'
              ? { audio: true, video: { width: 640, height: 480 } }
              : { audio: true };
            localStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
          }
          const pc = pcsRef.current[fromUser] || await createPeerForUser(fromUser, data.call_id, callTypeRef.current, false);
          pcsRef.current[fromUser] = pc;
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          window.electronAPI.sendRealtime({
            type: "webrtc_answer",
            call_id: data.call_id,
            conversation_id: data.conversation_id,
            target_user_id: fromUser,
            answer
          });
        } else {
          // Direct: flow เดิม
          const pc = await handleOfferLogic(data.offer, data.call_id, data.conversation_id);
          setActiveCall({ call_id: data.call_id, pc, call_type: data.call_type || 'audio', is_group: false });
        }
      } catch (err) {
        console.error("❌ handleOffer error:", err);
        toast.error("Error handling call offer: " + (err?.message || "Unknown error"));
      }
    };

    const handleAnswer = async (data) => {
      try {
        const fromUser = data.from_user || data.sender_id;

        // ✅ GROUP CALL ONLY
        if (isGroupCallRef.current) {
          if (!fromUser) return;

          const pc = pcsRef.current[fromUser];
          if (!pc) {
            console.warn("❌ No PC for user:", fromUser);
            return;
          }

          // 🔥 กัน set ซ้ำ
          if (pc.signalingState === "stable") {
            console.warn("⚠️ Skip duplicate answer (already stable)");
            return;
          }

          await pc.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        } 
        
        // ✅ DIRECT CALL ONLY
        else {
          if (!pcRef.current) return;

          // 🔥 กัน set ซ้ำ
          if (pcRef.current.signalingState === "stable") {
            console.warn("⚠️ Skip duplicate answer (direct)");
            return;
          }

          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );

          for (const candidate of pendingCandidatesRef.current) {
            try {
              await pcRef.current.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            } catch (e) {}
          }
          pendingCandidatesRef.current = [];
        }
      } catch (err) {
        console.error("❌ handleAnswer error:", err);
      }
    };

    const handleCandidate = async (data) => {
      const fromUser = data.from_user || data.sender_id;
      if (isGroupCallRef.current && fromUser) {
        const pc = pcsRef.current[fromUser];
        if (!pc || !pc.remoteDescription) return;
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
      } else {
        if (!pcRef.current || !pcRef.current.remoteDescription) {
          pendingCandidatesRef.current.push(data.candidate);
          return;
        }
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const callingRef = useRef(calling);

  useEffect(() => {
    callingRef.current = calling;
  }, [calling]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!window.electronAPI) return;
    
    const handleIncoming = (data) => {
      console.log("Incoming call:", data);

      if (callingRef.current && data.call_id === callingRef.current.call_id) {
        console.log("IGNORE self incoming");
        return;
      }

      // ✅ สำคัญมาก
      isGroupCallRef.current = Boolean(
        data.is_group ?? data.conversation_type === "group"
      );

      setIncomingCall(data);
    };

    const handleAnswered = async (data) => {
      setIncomingCall(null);
      setCalling(null);

      const callType = callTypeRef.current || data.call_type || "audio";
      const isGroup = Boolean(
        data.is_group ??
        incomingCall?.is_group ??
        isGroupCallRef.current
      );

      if (isCallerRef.current) {
        const convId = currentCallConversationRef.current || selectedConversation?.id;
        if (!convId) return;

        setActiveCall({
          call_id: data.call_id,
          call_type: callType,
          is_group: isGroup
        });

        if (data.participants) {
          setCallParticipants(data.participants);
        }

        setTimeout(async () => {
          try {
            if (isGroup) {
              const newParticipant = data.new_participant;
              if (newParticipant && !pcsRef.current[newParticipant]) {
                if (!localStreamRef.current) {
                  const constraints = callType === "video"
                    ? { audio: true, video: { width: 640, height: 480 } }
                    : { audio: true };

                  localStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
                }

                await createPeerForUser(newParticipant, data.call_id, callType, true);
              }
            } else {
              const pc = await startWebRTC(data.call_id, convId, callType);
              setActiveCall(prev => ({ ...prev, pc }));
            }
          } catch (err) {
            console.error("❌ handleAnswered setTimeout error:", err);
            toast.error("Call setup failed: " + (err?.message || "Unknown error"));
          }
        }, 0);
      } else {
        // ✅ Callee: ใช้ logic เดียวกับ caller
        setActiveCall({
          call_id: data.call_id,
          call_type: callType,
          is_group: isGroup
        });

        if (data.participants) {
          setCallParticipants(data.participants);
        }

        if (isGroup && data.existing_participants?.length > 0) {
          try {
            const constraints = callType === "video"
              ? { audio: true, video: { width: 640, height: 480 } }
              : { audio: true };

            if (!localStreamRef.current) {
              localStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
            }
            // รอ offer จากคนที่อยู่ในสายแล้ว
          } catch (err) {
            console.error("❌ Callee media setup error:", err);
            toast.error("Failed to access microphone/camera: " + (err?.message || "Unknown error"));
          }
        }
      }
    };

    const handleEnded = () => {
      const convId = currentCallConversationRef.current;
      setIncomingCall(null);
      setCalling(null);
      setActiveCall(null);
      isCallerRef.current = false;
      cleanupCall();

      if (convId) {
        setTimeout(async () => {
          try {
            const res = await window.electronAPI.getMessages({ conversation_id: String(convId) });
            if (res?.status === "success") {
              setMessages((prev) => ({ ...prev, [String(convId)]: res.messages || [] }));
            }
          } catch (e) {
            console.error("Failed to refresh messages after call ended:", e);
          }
        }, 500);
      }
    };
    
    const offIncoming = window.electronAPI.onIncomingCall(handleIncoming);
    const offAnswered = window.electronAPI.onCallAnswered(handleAnswered);
    const offEnded = window.electronAPI.onCallEnded(handleEnded);

    // ✅ Listen for participant list updates (อัพเดท real-time เมื่อมีคนเข้า/ออก)
    const handleParticipantsUpdate = (data) => {
      console.log("📍 Participants update:", data);
      // ✅ Filter out stale participants (those who have left)
      const activeParticipants = data.participants?.filter(p => !p.left_at) || [];
      setCallParticipants(activeParticipants);
      console.log("📍 Active participants now:", activeParticipants);
    };
    const offParticipants = window.electronAPI.onCallParticipantsUpdate?.(handleParticipantsUpdate);

    return () => {
      offIncoming?.();
      offAnswered?.();
      offEnded?.();
      offParticipants?.();
    };

  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startCall = async (type) => {
    if (!selectedConversation) return;

    // เช็คจำนวนสมาชิกถ้าเป็นกลุ่ม
    if (selectedConversation.type === "group") {
      const memberCount = selectedConversation.member_count || 0;
      if (memberCount > 4) {
        toast.error("กลุ่มมีสมาชิกเกิน 4 คน ไม่สามารถโทรได้");
        return;
      }
    }

    isCallerRef.current = true;
    isGroupCallRef.current = selectedConversation.type === "group";
    currentCallConversationRef.current = selectedConversation.id;
    callTypeRef.current = type;
    setCalling({ call_id: "temp", type });

    try {
      const res = await window.electronAPI.startCall({
        conversation_id: selectedConversation.id,
        call_type: type
      });

      if (res.status === "ok") {
        setCalling({ call_id: res.call_id, type });
      } else {
        toast.error(res.message || "ไม่สามารถโทรได้");
        setCalling(null);
        isCallerRef.current = false;
      }
    } catch (err) {
      console.error(err);
      setCalling(null);
      isCallerRef.current = false;
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    try {
      isCallerRef.current = false;

      // ✅ สำคัญมาก
      isGroupCallRef.current = Boolean(
        incomingCall.is_group ?? incomingCall.conversation_type === "group"
      );

      currentCallConversationRef.current = incomingCall.conversation_id;
      callTypeRef.current = incomingCall.call_type || "audio";

      await window.electronAPI.answerCall(incomingCall.call_id);
      console.log("WAITING FOR OFFER...");
      setIncomingCall(null);
    } catch (err) {
      console.error("❌ acceptCall error:", err);
      toast.error("Failed to accept call: " + (err?.message || "Unknown error"));
      setIncomingCall(null);
    }
  };

  // ✅ Leave call (for group calls) - just leave, don't end for everyone
  const leaveCall = async (callId) => {
    const convId = currentCallConversationRef.current;
    try {
      if (callId && callId !== "temp") {
        await window.electronAPI.leaveCall(callId);
      }
    } catch (err) {
      console.error("leaveCall error:", err);
    } finally {
      cleanupCall();
      setIncomingCall(null);
      setActiveCall(null);
      setCalling(null);
      isCallerRef.current = false;

      if (convId) {
        setTimeout(async () => {
          try {
            const res = await window.electronAPI.getMessages({ conversation_id: String(convId) });
            if (res?.status === "success") {
              setMessages((prev) => ({ ...prev, [String(convId)]: res.messages || [] }));
            }
          } catch (e) {
            console.error("Failed to refresh messages after leaving call:", e);
          }
        }, 500);
      }
    }
  };

  // End call (for direct calls) - ends call for everyone
  const endCall = async (callId) => {
    const duration = callElapsedTimeRef.current;
    const convId = currentCallConversationRef.current;
    try {
      if (callId && callId !== "temp") {
        await window.electronAPI.endCall(callId, duration);
      }
    } catch (err) {
      console.error("endCall error:", err);
    } finally {
      cleanupCall();
      setIncomingCall(null);
      setActiveCall(null);
      setCalling(null);
      isCallerRef.current = false;

      if (convId) {
        setTimeout(async () => {
          try {
            const res = await window.electronAPI.getMessages({ conversation_id: String(convId) });
            if (res?.status === "success") {
              setMessages((prev) => ({ ...prev, [String(convId)]: res.messages || [] }));
            }
          } catch (e) {
            console.error("Failed to refresh messages after call:", e);
          }
        }, 500);
      }
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
      callElapsedTimeRef.current = 0;
      return;
    }

    const interval = setInterval(() => {
      setCallElapsedTime(prev => {
        callElapsedTimeRef.current = prev + 1;
        return prev + 1;
      });
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

        // ใช้ unread map เพื่อแสดง badge ใน sidebar (ไม่นับข้อความที่ส่งเอง)
        const senderId = String(msg.sender_id ?? msg.message?.sender_id ?? '');
        const myId = localStorage.getItem("user_id");
        if (senderId && senderId !== String(myId)) {
          setUnreadMap(prev => ({
            ...prev,
            [convId]: (prev[convId] || 0) + 1
          }));
        }
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
      refreshData();
    });

    // ✅ ฟังการแจ้งเตือนเมื่อมีคนถูกเพิ่มเข้ากลุ่ม
    const unsubMemberAdded = window.electronAPI.onMemberAdded?.((data) => {
      console.log("📢 Member added!", data);
      refreshData();
    });

    // ✅ ฟังการแจ้งเตือนเมื่อมีคนถูกเตะออกจากกลุ่ม
    const unsubMemberKicked = window.electronAPI.onMemberKicked?.((data) => {
      console.log("📢 Member kicked!", data);
      const myId = localStorage.getItem("user_id");
      if (String(data.kicked_user_id) === String(myId)) {
        if (String(selectedConvRef.current?.id) === String(data.conversation_id)) {
          setSelectedConversation(null);
        }
      }
      refreshData();
    });

    const unsubMemberLeft = window.electronAPI.onMemberLeft?.((data) => {
      console.log("📢 Member left!", data);
      refreshData();
    });

    const unsubGroupDeleted = window.electronAPI.onGroupDeleted?.((data) => {
      console.log("📢 Group deleted!", data);
      if (String(selectedConvRef.current?.id) === String(data.conversation_id)) {
        setSelectedConversation(null);
      }
      refreshData();
    });

    const unsubOwnershipTransferred = window.electronAPI.onOwnershipTransferred?.((data) => {
      console.log("Ownership transferred!", data);
      refreshData();
    });

    // Typing indicator
    let typingTimeout = null;
    const unsubTyping = window.electronAPI.onTypingIndicator?.((data) => {
      if (String(data.conversation_id) === String(selectedConvRef.current?.id)) {
        setTypingUserId(data.user_id);
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => setTypingUserId(null), 3000);
      }
    });

    return () => {
      if (unsubMsg) unsubMsg();
      if (unsubGroup) unsubGroup();
      if (unsubRename) unsubRename();
      if (unsubMemberAdded) unsubMemberAdded();
      if (unsubMemberKicked) unsubMemberKicked();
      if (unsubMemberLeft) unsubMemberLeft();
      if (unsubGroupDeleted) unsubGroupDeleted();
      if (unsubOwnershipTransferred) unsubOwnershipTransferred();
      if (unsubTyping) unsubTyping();
      if (typingTimeout) clearTimeout(typingTimeout);
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
    // Clear unread badge for this conversation
    setUnreadMap(prev => { const next = { ...prev }; delete next[String(conv.id)]; return next; });

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
        toast.error(res?.message || "User not found");
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
    // Friends without a conversation — treat as newest so they appear at top
    friends.forEach((f) => {
      if (!seen.has(String(f.id))) {
        items.push({
          id: `friend-${f.id}`,
          type: "direct",
          other_user: { ...f, display_name: f.display_name || f.username },
          isFriendOnly: true,
          friend: f,
          created_at: new Date().toISOString(),
        });
      }
    });
    // Sort everything by last message time (most recent first)
    items.sort((a, b) => {
      const timeA = a.last_message_at || a.created_at || '';
      const timeB = b.last_message_at || b.created_at || '';
      return new Date(timeB) - new Date(timeA);
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
            onShowMembers={() => setShowMembersModal(true)}
            isTyping={!!typingUserId}
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
            activeCall={activeCall}
            callParticipants={callParticipants}
            acceptCall={acceptCall}
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
        unreadMap={unreadMap}
        searchQuery={sidebarSearch}
        onSearchChange={setSidebarSearch}
        loading={sidebarLoading}
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
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      {showMembersModal && selectedConversation?.type === 'group' && (
        <GroupMembersModal
          conversationId={selectedConversation.id}
          isOwner={
            selectedConversation.role === 'owner' ||
            String(selectedConversation.owner_id) === String(currentUser?.id)
          }
          currentUserId={currentUser?.id}
          friends={friends}
          onClose={() => setShowMembersModal(false)}
          onRefresh={refreshData}
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
          <div className="active-call-box">
            <h2><PhoneIcon size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />In Call</h2>
            
            {/* ✅ Participants Info with Better Layout */}
            {activeCall.is_group && callParticipants.length > 0 && (
              <div className="participants-info">
                <div className="participants-info-header">
                  👥 In Call ({callParticipants.length} {callParticipants.length === 1 ? 'participant' : 'participants'})
                </div>
                <div className="participants-list">
                  {callParticipants.map((p) => (
                    <div
                      key={p.user_id}
                      className={`participant-badge ${String(p.user_id) === String(currentUser?.id) ? 'current-user' : ''}`}
                    >
                      <span style={{ fontSize: '14px' }}>📹</span>
                      <span>{p.display_name || p.username || `User ${p.user_id}`}</span>
                      {String(p.user_id) === String(currentUser?.id) && (
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>(You)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* ✅ Call Duration Display */}
            <div className="call-timer">
              ⏱️ {String(Math.floor(callElapsedTime / 60)).padStart(2, '0')}:{String(callElapsedTime % 60).padStart(2, '0')}
            </div>
            
            {/* ✅ Show video containers ONLY for video calls */}
            {activeCall.call_type === 'video' && (
              <>
                {activeCall.is_group ? (
                  /* Group video call: grid layout */
                  <div className={`video-grid ${
                    Object.keys(remoteStreams).length === 0 ? 'one-video' :
                    Object.keys(remoteStreams).length === 1 ? 'two-videos' :
                    'multi-video'
                  }`}>
                    {/* Local video */}
                    <div className="video-container">
                      <video
                        ref={localVideoRef}
                        autoPlay playsInline muted
                        onLoadedMetadata={e => e.target.play().catch(() => {})}
                        style={{ transform: 'scaleX(-1)' }}
                      />
                      <div className="video-label">
                        👤 {currentUser?.username || 'You'} (คุณ)
                      </div>
                    </div>
                    {/* Remote videos */}
                    {Object.entries(remoteStreams).map(([uid, stream]) => {
                      const participant = callParticipants.find(p => String(p.user_id) === String(uid));
                      return (
                        <div key={uid} className="video-container">
                          <video
                            autoPlay playsInline
                            ref={el => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
                          />
                          <div className="video-label">
                            📹 {participant?.display_name || participant?.username || `User ${uid}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Direct video call: layout เดิม */
                  <>
                    <div ref={remoteVideoRef} style={{ width: '100%', height: '400px', backgroundColor: '#000', borderRadius: '8px', marginBottom: '10px', overflow: 'hidden' }} />
                    <div ref={localVideoRef} style={{ position: 'absolute', bottom: '100px', right: '20px', width: '150px', height: '120px', backgroundColor: '#000', borderRadius: '8px', border: '2px solid #fff', overflow: 'hidden' }} />
                  </>
                )}
              </>
            )}
            
            <div className="call-id-display">Call ID: {activeCall.call_id}</div>

            <div className="call-controls">
              {/* Mic toggle */}
              <button
                onClick={toggleMic}
                className={`call-control-btn ${isMicMuted ? 'mic-muted' : 'mic-active'}`}
                title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMicMuted ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23"/>
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>

              {/* Camera toggle (video call only) */}
              {activeCall.call_type === 'video' && (
                <button
                  onClick={toggleCamera}
                  className={`call-control-btn ${isCameraOff ? 'camera-off' : 'camera-active'}`}
                  title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
                >
                  {isCameraOff ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23"/>
                      <path d="M21 7l-5 3.5"/>
                      <path d="M16 16V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11"/>
                      <path d="M23 7v10"/>
                    </svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 7l-7 5 7 5V7z"/>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  )}
                </button>
              )}

              {/* End/Leave call */}
              <button
                onClick={() => activeCall.is_group ? leaveCall(activeCall.call_id) : endCall(activeCall.call_id)}
                className="call-control-btn end-call"
                title={activeCall.is_group ? "Leave call" : "End call"}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
                  <line x1="23" y1="1" x2="1" y2="23"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;