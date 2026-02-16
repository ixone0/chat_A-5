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
      if (!parsed.request_id && pending.size === 1) {
        const [request_id, { resolve, timeout }] = pending.entries().next().value;
        clearTimeout(timeout);
        pending.delete(request_id);
        resolve(parsed);
        continue;
      }


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
        else if (parsed.type === 'search_user_response') {
          win.webContents.send('search-user-response', parsed);
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

function getMessages(conversation_id) {
  return send({ type: 'get_messages', conversation_id });
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
  getMessages
};
