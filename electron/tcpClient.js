// electron/tcpClient.js
const net = require('net');
const { v4: uuidv4 } = require('uuid');

let client = null;
let win = null;
let buffer = ""; // ✅ เพิ่ม buffer สำหรับ TCP framing
const pending = new Map(); // request_id => {resolve, reject, timeout}

const TCP_CONFIG = {
  host: '13.212.120.46',
  port: 8082
};

function initTcpClient(mainWindow) {
  win = mainWindow;
  client = new net.Socket();

  client.connect(TCP_CONFIG.port, TCP_CONFIG.host, () => {
    console.log(`✅ TCP Connected to ${TCP_CONFIG.host}:${TCP_CONFIG.port}`);
  });

  // ✅ แก้ใหม่ทั้งหมด (รองรับ packet แตกครึ่ง + หลาย packet ในครั้งเดียว)
  client.on('data', (data) => {
    buffer += data.toString();

    let boundary;

    while ((boundary = buffer.indexOf("\n")) !== -1) {
      const rawPacket = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 1);

      if (!rawPacket.trim()) continue;

      try {
        const parsed = JSON.parse(rawPacket);
        console.log('📩 Parsed packet:', parsed);

        // 1️⃣ ปกติ: ถ้ามี request_id
      if (parsed.request_id && pending.has(parsed.request_id)) {
        const { resolve, timeout } = pending.get(parsed.request_id);
        clearTimeout(timeout);
        pending.delete(parsed.request_id);
        resolve(parsed);
        continue;
      }

      // 2️⃣ 🔥 กรณี backend ไม่ส่ง request_id กลับมา
      // ถ้ามี pending แค่ 1 ตัว → ถือว่าเป็นตัวนี้
      /*
      if (!parsed.request_id && pending.size === 1) {
        const [request_id, { resolve, timeout }] = pending.entries().next().value;
        clearTimeout(timeout);
        pending.delete(request_id);
        resolve(parsed);
        continue;
      }
        */


        // Push event ไป renderer
        if (parsed.type === 'login_response') {
          win.webContents.send('login-response', parsed);
        } 
        else if (parsed.type === 'register_response') {
          win.webContents.send('register-response', parsed);
        } 
        else if (parsed.type === 'receive_message') {
          win.webContents.send('receive-message', parsed);
        }
        else if (parsed.type === 'incoming_call') {
          win.webContents.send('incoming-call', parsed);
        }
        else if (parsed.type === 'call_answered') {
          win.webContents.send('call-answered', parsed);
        }
        else if (parsed.type === 'call_ended') {
          win.webContents.send('call-ended', parsed);
        } 
        else if (parsed.type === 'search_user_response') {
          win.webContents.send('search-user-response', parsed);
        }
          else if (parsed.type === 'webrtc_offer') {
          win.webContents.send('webrtc-offer', parsed);
        }
        else if (parsed.type === 'webrtc_answer') {
          win.webContents.send('webrtc-answer', parsed);
        }
        else if (parsed.type === 'ice_candidate') {
          win.webContents.send('ice-candidate', parsed);
        }
        else {
          win.webContents.send('server-message', parsed);
        }

      } catch (e) {
        console.error('❌ Failed to parse TCP packet:', e);
      }
    }
  });

  client.on('close', () => {
    console.log('⚠️ TCP Connection closed');
  });

  client.on('error', (err) => {
    console.error('❌ TCP Error:', err.message);
  });
}

// ✅ send พร้อม newline delimiter
function send(packet) {
  return new Promise((resolve, reject) => {
    if (!client) return reject(new Error('TCP client not connected'));

    const request_id = uuidv4();
    const msg = JSON.stringify({ request_id, ...packet }) + "\n";

    // timeout safety
    const timeout = setTimeout(() => {
      if (pending.has(request_id)) {
        pending.delete(request_id);
        reject(new Error('TCP request timeout'));
      }
    }, 10000);

    pending.set(request_id, { resolve, reject, timeout });

    client.write(msg);
  });
}

// ---------------- API FUNCTIONS ----------------

function sendLogin(username, password) {
  return send({
    type: 'login',
    username,
    password
  });
}

function sendRegister(username, password) {
  return send({
    type: 'register',
    username,
    password
  });
}

function searchUser(customId) {
  return send({
    type: 'search_user',
    target_id: customId
  });
}

function sendFriendRequest(targetCustomId) {
  return send({
    type: 'send_friend_request',
    target_id: targetCustomId
  });
}

function getPendingRequests() {
  return send({ type: 'get_pending_requests' });
}

function acceptFriend(senderId) {
  return send({
    type: 'accept_friend',
    sender_id: senderId
  });
}

function getMyConversations() {
  return send({ type: 'get_my_conversations' });
}

const fs = require('fs');
const path = require('path');
 


/**
 * @param {string} conversationId
 * @param {string} filePath
 */
function sendFile(conversationId, filePath) {
  // 1. อ่านไฟล์เป็น Buffer แล้วแปลงเป็น base64
  const fileBuffer = fs.readFileSync(filePath);
 
  // 2. ตรวจขนาด (10 MB) ที่ฝั่ง client ก่อนส่งเลย
  const MAX_SIZE = 10 * 1024 * 1024;
  if (fileBuffer.length > MAX_SIZE) {
    return Promise.reject(new Error('File too large (max 10MB)'));
  }
 
  const base64Data = fileBuffer.toString('base64');
  const fileName   = path.basename(filePath);
 
  // 3. เดา mime type จาก extension (เบื้องต้น)
  const mimeMap = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif',  webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4',  mov: 'video/quicktime',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain', zip: 'application/zip',
    mp3: 'audio/mpeg', wav: 'audio/wav',
  };
  const ext      = fileName.split('.').pop().toLowerCase();
  const mimeType = mimeMap[ext] || 'application/octet-stream';
 
  // 4. ส่งผ่าน TCP แบบเดิม
  return send({
    type: 'send_file',
    conversation_id: conversationId,
    file_name: fileName,
    mime_type: mimeType,
    data: base64Data,
  });
}

function getMessages(conversation_id) {
  return send({ type: 'get_messages', conversation_id });
}

function startCall(conversation_id, call_type) {
  return send({
    type: "start_call",
    conversation_id,
    call_type // voice | video
  });
}

function answerCall(call_id) {
  return send({
    type: "join_call",
    call_id
  });
}

function endCall(call_id) {
  return send({
    type: "end_call",
    call_id
  });
}

module.exports = {
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
};