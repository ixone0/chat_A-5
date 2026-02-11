// electron/main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// 1. นำเข้า tcpClient ที่เพิ่งสร้าง
const tcpClient = require('./tcpClient');
const { initTcpClient, sendLogin, sendRegister, send, searchUser } = tcpClient;



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
  try {
    // ส่ง packet แบบ request/response
    const response = await send({
      type: "update_user_id",
      user_id: data.user_id,
      new_id: data.new_id
    });

    // ส่งกลับไปยัง renderer (preload listener จะรับ)
    event.reply("update-user-id-response", response);
  } catch (err) {
    console.error("update-user-id error:", err);
    event.reply("update-user-id-response", { success: false, message: err.message });
  }
});

ipcMain.handle('search-user', async (event, customId) => {
  console.log('UI Request Search User:', customId);
  try {
    // เรียกใช้ฟังก์ชัน searchUser ที่เราเขียนเพิ่มใน tcpClient.js
    const response = await searchUser(customId);
    return response;
  } catch (err) {
    console.error("Search error:", err);
    return { status: 'error', message: err.message };
  }
});
