// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// 1. นำเข้า tcpClient ที่เพิ่งสร้าง
const { initTcpClient, sendLogin, sendRegister } = require('./tcpClient');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true, // ตาม Best Practice
      preload: path.join(__dirname, 'preload.js') 
    }
  });

  const isDev = !app.isPackaged; // เช็ค Environment

  if (isDev) {
    // โหลดจาก React Dev Server (Port 3000)
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools(); 
  } else {
    // โหลดไฟล์ Build (Production)
    mainWindow.loadFile(path.join(__dirname, '../frontend/build/index.html'));
  }

  // 2. เริ่มเชื่อมต่อ TCP ทันทีที่หน้าต่างเปิด
  initTcpClient(mainWindow);
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
// 3. ส่วนรับคำสั่งจาก React (ของจริง)
// ==========================================

ipcMain.on('login-request', (event, data) => {
  console.log('Ui Request Login:', data.username);
  
  // เรียกใช้ฟังก์ชันส่งข้อมูลใน tcpClient.js
  sendLogin(data.username, data.password);
});

// ✅ เพิ่ม IPC Listener สำหรับ Register
ipcMain.on('register-request', (event, data) => {
  console.log('Ui Request Register:', data.username);
  sendRegister(data.username, data.password);
});

ipcMain.on("update-user-id", async (event, data) => {

  const response = await tcpClient.send({
    type: "update_user_id",
    ...data
  });

  event.reply("update-user-id-response", response);
});
