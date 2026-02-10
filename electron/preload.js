// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ส่งข้อมูลออกไป (React -> Electron)
  login: (data) => ipcRenderer.send('login-request', data),
  
  // รอฟังผลตอบกลับ (Electron -> React)
  onLoginResponse: (callback) => 
    ipcRenderer.on('login-response', (event, ...args) => callback(...args)),

  register: (data) => ipcRenderer.send('register-request', data),
  onRegisterResponse: (callback) => ipcRenderer.on('register-response', (event, ...args) => callback(...args))
});