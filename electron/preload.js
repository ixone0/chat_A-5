// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  login: (data) => ipcRenderer.send('login-request', data),

  // onLoginResponse จะคืนฟังก์ชัน unsubscribe
  onLoginResponse: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('login-response', listener);
    // คืนฟังก์ชันสำหรับถอด listener
    return () => ipcRenderer.removeListener('login-response', listener);
  },

  register: (data) => ipcRenderer.send('register-request', data),
  onRegisterResponse: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('register-response', listener);
    return () => ipcRenderer.removeListener('register-response', listener);
  },

  onUpdateUserIdResponse: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('update-user-id-response', listener);
    return () => ipcRenderer.removeListener('update-user-id-response', listener);
  }


});
