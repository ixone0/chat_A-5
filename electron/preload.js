// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  login: (data) => ipcRenderer.invoke('login-request', data),

  register: (data) => ipcRenderer.send('register-request', data),

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
  }
});
