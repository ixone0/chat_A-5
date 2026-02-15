// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  login: (data) => ipcRenderer.invoke('login-request', data),

  onLoginResponse: (cb) => {
    const l = (e, ...args) => cb(...args);
    ipcRenderer.on('login-response', l);
    return () => ipcRenderer.removeListener('login-response', l);
  },

  register: (data) => ipcRenderer.send('register-request', data),

  onRegisterResponse: (cb) => {
    const l = (e, ...args) => cb(...args);
    ipcRenderer.on('register-response', l);
    return () => ipcRenderer.removeListener('register-response', l);
  },

  updateUserId: (data) => ipcRenderer.send("update-user-id", data),

  onUpdateUserIdResponse: (cb) => {
    const l = (e, ...args) => cb(...args);
    ipcRenderer.on('update-user-id-response', l);
    return () => ipcRenderer.removeListener('update-user-id-response', l);
  },

  searchUser: (customId) => ipcRenderer.invoke('search-user', customId),

  sendFriendRequest: (targetCustomId) =>
    ipcRenderer.invoke('send-friend-request', targetCustomId),

  getPendingRequests: () =>
    ipcRenderer.invoke('get-pending-requests'),

  acceptFriend: (senderId) =>
    ipcRenderer.invoke('accept-friend', senderId),

  sendMessage: (data) =>
    ipcRenderer.invoke("send-message", data),

  onReceiveMessage: (callback) =>
    ipcRenderer.on("receive-message", (_, msg) => callback(msg)),

  onSearchUserResponse: (cb) => {
    const l = (e, ...args) => cb(...args);
    ipcRenderer.on("search-user-response", l);
    return () => ipcRenderer.removeListener("search-user-response", l);
  },

});
