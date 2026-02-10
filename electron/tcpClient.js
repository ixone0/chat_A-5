// electron/tcpClient.js
const net = require('net');

let client = null;
let win = null; // เก็บตัวแปรหน้าจอหลัก เพื่อส่งข้อมูลกลับไปแสดง

const TCP_CONFIG = {
    port: 8082,        // ⚠️ ต้องตรงกับ Python Server (เช็คใน server.py)
    host: '13.212.120.46'  // ถ้า Server อยู่ AWS ให้ใส่ IP เช่น '54.x.x.x'
};

function initTcpClient(mainWindow) {
    win = mainWindow;
    client = new net.Socket();

    // 1. เริ่มการเชื่อมต่อ
    client.connect(TCP_CONFIG.port, TCP_CONFIG.host, () => {
        console.log(`✅ TCP Connected to ${TCP_CONFIG.host}:${TCP_CONFIG.port}`);
    });

    // 2. เมื่อได้รับข้อมูลตอบกลับจาก Python
    client.on('data', (data) => {
        try {
            const jsonString = data.toString();
            console.log('📩 Received from Server:', jsonString);
            
            const parsedData = JSON.parse(jsonString);

            // ส่งต่อข้อมูลไปให้ React (ผ่าน preload)
            // เช็คประเภทข้อมูลนิดนึง ถ้าเป็น login_response ก็ส่งช่องนั้น
            if (parsedData.type === 'login_response' || parsedData.status) {
                win.webContents.send('login-response', parsedData);
            } else {
                // เผื่อเป็น Chat message ทั่วไป
                win.webContents.send('server-message', parsedData);
            }

        } catch (e) {
            console.error('❌ JSON Parse Error:', e);
        }
    });

    client.on('close', () => {
        console.log('⚠️ Connection closed');
        // (Optional) Reconnect logic here
    });

    client.on('error', (err) => {
        console.error('❌ Connection Error:', err.message);
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

module.exports = { initTcpClient, sendLogin };