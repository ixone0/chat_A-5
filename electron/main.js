// electron/main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
// 1. นำเข้า tcpClient ที่เพิ่งสร้าง
const tcpClient = require('./tcpClient');
const {
  initTcpClient,
  sendLogin,
  sendRegister,
  send,
  searchUser,
  sendFriendRequest,
  getPendingRequests,
  acceptFriend,
  getMyConversations,
  getMessages,
  startCall,
  answerCall,
  endCall,
  sendFile
} = tcpClient;


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

ipcMain.handle('login-request', async (event, data) => {
  console.log('UI Request Login:', data.username);

  try {
    const response = await sendLogin(data.username, data.password);
    return response;
  } catch (err) {
    return { status: "error", message: err.message };
  }
});

ipcMain.handle('create-group-chat', async (event, payload) => {
  try {
    console.log("Main: Creating Group Chat ->", payload.title);
    // ใช้ฟังก์ชัน send ที่ดึงมาจาก tcpClient.js
    const response = await send({
      type: "create_group_chat",
      title: payload.title,
      members: payload.members // array ของ friend_id
    });
    return response;
  } catch (err) {
    console.error("Create Group Error:", err);
    return { status: "error", message: err.message };
  }
});

ipcMain.handle('rename-group', async (event, payload) => {
  try {
    return await send({
      type: "rename_group",
      conversation_id: payload.conversation_id,
      new_title: payload.new_title
    });
  } catch (err) {
    return { status: "error", message: err.message };
  }
});

// ✅ เพิ่ม IPC Listener สำหรับ Register
ipcMain.handle('register-request', async (event, data) => {
  console.log('UI Request Register:', data.username);

  try {
    const response = await sendRegister(data.username, data.password);
    return response;
  } catch (err) {
    return { status: "error", message: err.message };
  }
});


ipcMain.handle("update-user-id", async (event, data) => {
  try {
    return await send({
      type: "update_user_id",
      user_id: data.user_id,
      new_id: data.new_id
    });
  } catch (err) {
    return { success: false, message: err.message };
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

ipcMain.handle('send-friend-request', async (event, targetCustomId) => {
    try {
        console.log("Main: Sending Friend Request to:", targetCustomId);
        const response = await sendFriendRequest(targetCustomId);
        return response;
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('get-pending-requests', async (event) => {
  try {
    console.log("Main: Getting Pending Requests...");
    const response = await getPendingRequests(); // เรียกฟังก์ชันที่ import มา
    return response;
  } catch (error) {
    console.error("Get Pending Error:", error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle('accept-friend', async (event, senderId) => {
  try {
    console.log("Main: Accepting Friend:", senderId);
    const response = await acceptFriend(senderId); // เรียกฟังก์ชันที่ import มา
    return response;
  } catch (error) {
    console.error("Accept Friend Error:", error);
    return { status: 'error', message: error.message };
  }
});

ipcMain.handle("send-message", async (event, data) => {
  try {
    const response = await send({
      type: "send_message",
      conversation_id: data.conversation_id,
      text: data.text
    });

    return response;
  } catch (err) {
    return {
      status: "error",
      message: err.message
    };
  }
});

ipcMain.handle('send-file', async (event, conversationId) => {
  // 1. เปิด file picker
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select file to send',
    properties: ['openFile'],
    // ไม่ filter → รับทุกประเภท
  });
 
  if (canceled || filePaths.length === 0) {
    return { status: 'cancelled' };
  }
 
  try {
    // 2. ส่งไฟล์ผ่าน TCP
    const response = await sendFile(conversationId, filePaths[0]);
     if (response?.status === 'ok' || response?.message) {
      mainWindow.webContents.send('file-sent', response.message ?? response);
    }
    return response;
  } catch (err) {
    console.error('send-file error:', err);
    return { status: 'error', message: err.message };
  }
});

// หน้าเรียกเพื่อดึงรายการ conversation ของผู้ใช้
ipcMain.handle('get-my-conversations', async () => {
  try {
    return await getMyConversations();
  } catch (err) {
    console.error("get-my-conversations error:", err);
    return { status: 'error', message: err.message };
  }
});


// ดึงข้อความในห้อง (history)
ipcMain.handle('get-messages', async (event, payload) => {
  try {
    return await getMessages(payload.conversation_id);
  } catch (err) {
    console.error("get-messages error:", err);
    return { status: 'error', message: err.message };
  }
});

ipcMain.handle('get-friends', async () => {
  try {
    return await send({ type: "get_friends" });
  } catch (err) {
    return { status: "error", message: err.message };
  }
});

ipcMain.handle('start-direct-chat', async (event, friendId) => {
  try {
    return await send({
      type: "start_direct_chat",
      friend_id: friendId
    });
  } catch (err) {
    return { status: "error", message: err.message };
  }
});

// ================= CALL =================

ipcMain.handle("start-call", async (event, data) => {
  try {
    return await startCall(data.conversation_id, data.call_type);
  } catch (err) {
    return { status: "error", message: err.message };
  }
});

ipcMain.handle("answer-call", async (event, callId) => {
  try {
    return await answerCall(callId);
  } catch (err) {
    return { status: "error", message: err.message };
  }
});

ipcMain.handle("end-call", async (event, callId) => {
  try {
    return await endCall(callId);
  } catch (err) {
    return { status: "error", message: err.message };
  }
});

ipcMain.on("tcp-send", async (_, data) => {
  try {
    await send(data); // ใช้ tcpClient.send()
  } catch (err) {
    console.error("TCP send error:", err);
  }
});