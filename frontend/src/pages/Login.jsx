// src/pages/Login.jsx
import React, { useState, useEffect } from 'react'; // <--- เพิ่ม useEffect
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // -------------------------------------------------------
  // 👂 1. ส่วนรับฟัง (Listener): รอ Electron ตอบกลับมา
  // -------------------------------------------------------
  useEffect(() => {
    // เช็คว่ามีตัวเชื่อม (Bridge) อยู่จริงไหม
    if (window.electronAPI) {
      // เมื่อ Electron ตอบกลับมาว่า 'login-response'
      window.electronAPI.onLoginResponse((response) => {
        console.log('📩 ได้รับผลจาก Electron:', response);
        
        if (response.status === 'success' || response.status === 'ok') {
          
          // Login ผ่าน:
          console.log("✅ Login Passed!");
          localStorage.setItem('username', response.username);
          // Python ส่งมาเป็น user_id แต่ React รอเก็บ token (แก้ให้เก็บ user_id แทนไปก่อนได้)
          localStorage.setItem('token', response.token || response.user_id); 
          navigate('/chat');

        } else {
          // Login ไม่ผ่าน
          alert('Login Failed: ' + (response.message || 'Unknown Error'));
        }
      });
    }
  }, [navigate]); // ทำงานแค่ตอนโหลดหน้าหรือ navigate เปลี่ยน

  // -------------------------------------------------------
  // 📤 2. ส่วนส่งคำสั่ง (Sender): ส่งข้อมูลไปหา Electron
  // -------------------------------------------------------
  const handleLogin = (e) => {
    e.preventDefault();
    
    const payload = { username, password };
    console.log('📤 กำลังส่งข้อมูลไป Electron:', payload);

    if (window.electronAPI) {
      // ใช้สะพานที่สร้างไว้ใน preload.js
      window.electronAPI.login(payload);
    } else {
      // กรณีเปิดผ่าน Browser ธรรมดา (ไม่ใช่ Electron)
      alert('Error: ไม่พบ Electron API (กรุณาเปิดผ่านแอพ Electron)');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Enter Chat Room</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="login-btn">Join Chat</button>
        </form>
      </div>
    </div>
  );
};

export default Login;