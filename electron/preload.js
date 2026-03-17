// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (data) => ipcRenderer.send("tcp-send", data),
  login: (data) => ipcRenderer.invoke('login-request', data),

  register: (data) => ipcRenderer.invoke('register-request', data),

  searchUser: (customId) => ipcRenderer.invoke('search-user', customId),

  sendFriendRequest: (targetCustomId) =>
    ipcRenderer.invoke('send-friend-request', targetCustomId),

  getPendingRequests: () =>
    ipcRenderer.invoke('get-pending-requests'),

  acceptFriend: (senderId) =>
    ipcRenderer.invoke('accept-friend', senderId),

  sendMessage: (data) =>
    ipcRenderer.invoke("send-message", data),

  getMyConversations: () =>
    ipcRenderer.invoke('get-my-conversations'),

  getMessages: (payload) =>
    ipcRenderer.invoke('get-messages', payload),

  onReceiveMessage: (callback) => {
    const listener = (_, msg) => callback(msg);
    ipcRenderer.on("receive-message", listener);
    return () => ipcRenderer.removeListener("receive-message", listener);
  },

  getFriends: () =>
    ipcRenderer.invoke("get-friends"),

  startDirectChat: (friendId) =>
    ipcRenderer.invoke("start-direct-chat", friendId),

  updateUserId: (data) =>
    ipcRenderer.invoke("update-user-id", data),

  startCall: (data) =>
    ipcRenderer.invoke("start-call", data),

  answerCall: (callId) =>
    ipcRenderer.invoke("answer-call", callId),

  endCall: (callId) =>
    ipcRenderer.invoke("end-call", callId),
  
  onIncomingCall: (callback) => {
    ipcRenderer.on("incoming-call", (_, data) => callback(data));
  },

  onCallAnswered: (callback) => {
    ipcRenderer.on("call-answered", (_, data) => callback(data));
  },

  onCallEnded: (callback) => {
    ipcRenderer.on("call-ended", (_, data) => callback(data));
  },
  // 🔥 WebRTC signaling listeners
  onWebRTCOffer: (callback) => {
    ipcRenderer.on("webrtc-offer", (_, data) => callback(data));
  },

  onWebRTCAnswer: (callback) => {
    ipcRenderer.on("webrtc-answer", (_, data) => callback(data));
  },

  onICECandidate: (callback) => {
    ipcRenderer.on("ice-candidate", (_, data) => callback(data));
  },
});
