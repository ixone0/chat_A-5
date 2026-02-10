// electron/main.js
// 1. ⚠️ ต้องเพิ่ม ipcMain เข้ามาด้วย (ไม่งั้นรับข้อมูลไม่ได้)
const { app, BrowserWindow, ipcMain } = require('electron'); 
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true, 
      preload: path.join(__dirname, 'preload.js') 
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools(); 
  } else {
    // ถอยหลังไปหา frontend/build
    win.loadFile(path.join(__dirname, '../frontend/build/index.html'));
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

// ==========================================
// 2. ⚠️ ส่วนที่หายไป: ต้องเพิ่มส่วนรับคำสั่ง Login
// ==========================================

ipcMain.on('login-request', (event, data) => {
  console.log('📨 Electron ได้รับข้อมูล Login:', data); 

  // จำลองว่า Login ผ่าน (Mock Logic)
  const isSuccess = true;

  // ตอบกลับไปหา React
  event.reply('login-response', { 
    success: isSuccess, 
    username: data.username,
    token: 'dev-token-999'
  });
});