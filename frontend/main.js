// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

// เช็คว่าเป็นโหมด Dev หรือไม่
const isDev = !app.isPackaged; 

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true, 
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Load App
  if (isDev) {
    // ✅ แก้จุดที่ 1: เปลี่ยนเป็น Port 3000 (สำหรับ react-scripts)
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools(); 
  } else {
    // ✅ แก้จุดที่ 2: เปลี่ยนจาก 'dist' เป็น 'build' (เพราะ react-scripts สร้างโฟลเดอร์ชื่อ build)
    win.loadFile(path.join(__dirname, 'build', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});