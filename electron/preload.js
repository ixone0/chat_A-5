// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  login: (data) => ipcRenderer.send('login-request', data),
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

  // ฟังก์ชันส่งออเดอร์ update
  updateUserId: (data) => ipcRenderer.send("update-user-id", data),

  // listener สำหรับผลลัพธ์
  onUpdateUserIdResponse: (cb) => {
    const l = (e, ...args) => cb(...args);
    ipcRenderer.on('update-user-id-response', l);
    return () => ipcRenderer.removeListener('update-user-id-response', l);
  },

  searchUser: (customId) => ipcRenderer.invoke('search-user', customId),
  sendFriendRequest: (targetCustomId) => ipcRenderer.invoke('send-friend-request', targetCustomId)
});
