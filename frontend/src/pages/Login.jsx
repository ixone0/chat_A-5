import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // สำหรับเปลี่ยนหน้า
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // ฟังก์ชันนี้จะทำงานเมื่อกดปุ่ม Login
  const handleLogin = async (e) => {
    e.preventDefault(); // ป้องกันหน้าเว็บ Refresh (Network Concept: Single Page Application)

    // 1. Data Serialization: เตรียมข้อมูลเป็น JSON
    const payload = {
      username: username,
      password: password
    };

    try {
      // 2. Network Request: ส่ง HTTP POST ไปยัง Server
      // หมายเหตุ: ตอนนี้เรา Mock URL ไว้ก่อน ถ้า Backend เสร็จค่อยเปลี่ยนเป็น URL จริง
      console.log('Sending Payload:', payload); 

      // จำลองการยิง API (เพราะ Backend ยังไม่เสร็จ)
      // ในสถานการณ์จริงเราจะใช้: 
      // const response = await fetch('http://localhost:3000/api/login', { ... })
      
      const mockResponse = { ok: true, token: 'mock-token-123' }; // สมมติว่า Server ตอบกลับมา

      if (mockResponse.ok) {
        // 3. Response Handling: เก็บ Token ไว้ใช้ยืนยันตัวตน (Session Management)
        localStorage.setItem('chatToken', mockResponse.token);
        localStorage.setItem('username', username);
        
        // เปลี่ยนหน้าไปห้องแชท
        navigate('/chat');
      } else {
        alert('Login Failed: Unauthorized');
      }

    } catch (error) {
      console.error('Network Error:', error);
      alert('Cannot connect to server');
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