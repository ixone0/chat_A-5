// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

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
  sendFile: (conversationId) =>
    ipcRenderer.invoke('send-file', conversationId),
  
  onFileSent: (callback) => {
  const listener = (_, data) => callback(data);
  ipcRenderer.on('file-sent', listener);
  return () => ipcRenderer.removeListener('file-sent', listener);
},

  // ✅ เพิ่มตรงนี้: รับแจ้งเตือนเมื่อถูกดึงเข้ากลุ่มใหม่
  onReceiveGroupNotification: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("new-group-notification", listener);
    return () => ipcRenderer.removeListener("new-group-notification", listener);
  },

  getFriends: () =>
    ipcRenderer.invoke("get-friends"),

  startDirectChat: (friendId) =>
    ipcRenderer.invoke("start-direct-chat", friendId),

  // ✅ เพิ่มตรงนี้: ส่งคำสั่งสร้างกลุ่มแชทไปที่ Main Process
  createGroupChat: (payload) => 
    ipcRenderer.invoke("create-group-chat", payload),

  // ✅ ส่งคำสั่งเปลี่ยนชื่อ
  renameGroup: (payload) => ipcRenderer.invoke("rename-group", payload),

  // ✅ ฟังการแจ้งเตือนเมื่อชื่อกลุ่มเปลี่ยน
  onGroupRenamed: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("group-renamed-notification", listener);
    return () => ipcRenderer.removeListener("group-renamed-notification", listener);
  },

  updateUserId: (data) =>
    ipcRenderer.invoke("update-user-id", data),

  startCall: (data) =>
    ipcRenderer.invoke("start-call", data),

  answerCall: (callId) =>
    ipcRenderer.invoke("answer-call", callId),

  endCall: (callId) =>
    ipcRenderer.invoke("end-call", callId),
  
  sendRealtime: (data) => ipcRenderer.send("tcp-send", data),

  onIncomingCall: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("incoming-call", listener);
    return () => ipcRenderer.removeListener("incoming-call", listener);
  },

  onCallAnswered: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("call-answered", listener);
    return () => ipcRenderer.removeListener("call-answered", listener);
  },

  onCallEnded: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("call-ended", listener);
    return () => ipcRenderer.removeListener("call-ended", listener);
  },
  
  onWebRTCOffer: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("webrtc-offer", listener);
    return () => ipcRenderer.removeListener("webrtc-offer", listener);
  },

  onWebRTCAnswer: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("webrtc-answer", listener);
    return () => ipcRenderer.removeListener("webrtc-answer", listener);
  },

  onICECandidate: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on("ice-candidate", listener);
    return () => ipcRenderer.removeListener("ice-candidate", listener);
  },
});