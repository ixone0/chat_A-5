// electron/tcpClient.js
const net = require('net');
const { v4: uuidv4 } = require('uuid');

let client = null;
let win = null;
const pending = new Map(); // request_id => {resolve, reject, timeout}

const TCP_CONFIG = {
  host: '13.212.120.46', // ของคุณ '13.212.120.46
  port: 8082
};

function initTcpClient(mainWindow) {
  win = mainWindow;
  client = new net.Socket();

  client.connect(TCP_CONFIG.port, TCP_CONFIG.host, () => {
    console.log(`✅ TCP Connected to ${TCP_CONFIG.host}:${TCP_CONFIG.port}`);
  });

  client.on('data', (data) => {
    try {
      const jsonString = data.toString();
      console.log('📩 Received from server:', jsonString);
      const parsed = JSON.parse(jsonString);

      // ถ้ามี request_id แล้วมี pending, resolve
      if (parsed.request_id && pending.has(parsed.request_id)) {
        const { resolve, timeout } = pending.get(parsed.request_id);
        clearTimeout(timeout);
        pending.delete(parsed.request_id);
        resolve(parsed);
        return;
      }

      // ถ้าไม่ใช่ response ที่รอ ให้ส่งต่อเป็น generic events ไป renderer
      if (parsed.type === 'login_response') {
        win.webContents.send('login-response', parsed);
      } else if (parsed.type === 'register_response') {
        win.webContents.send('register-response', parsed);
      } else {
        // ส่ง generic server-message
        win.webContents.send('server-message', parsed);
      }
    } catch (e) {
      console.error('Failed to parse data from TCP server:', e);
    }
  });

  client.on('close', () => {
    console.log('⚠️ TCP Connection closed');
    // (Optional) reconnect logic...
  });

  client.on('error', (err) => {
    console.error('❌ TCP Error:', err.message);
  });
}

// send a packet and wait for response (using request_id)
function send(packet) {
  return new Promise((resolve, reject) => {
    if (!client) return reject(new Error('TCP client not connected'));

    const request_id = uuidv4();
    const msg = JSON.stringify({ request_id, ...packet });

    // write
    client.write(msg);

    // timeout safety
    const timeout = setTimeout(() => {
      if (pending.has(request_id)) {
        pending.delete(request_id);
        reject(new Error('TCP request timeout'));
      }
    }, 10000); // 10s

    pending.set(request_id, { resolve, reject, timeout });
  });
}


// ฟังก์ชันส่งข้อมูล Login
function sendLogin(username, password) {
    if (!client) return;

    // จัด Format ให้ตรงกับที่ Python Server ต้องการ
    const packet = JSON.stringify({
        type: 'login',
        username: username,
        password: password
    });

    client.write(packet);
    console.log('📤 Sent Login Packet:', packet);
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


module.exports = {
  initTcpClient,
  sendLogin,
  sendRegister,
  send,
  searchUser
};
