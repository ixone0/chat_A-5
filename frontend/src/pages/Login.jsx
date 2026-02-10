// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Reset input ทุกครั้งที่เข้า Login
  useEffect(() => {
    setUsername('');
    setPassword('');
  }, []);
  const navigate = useNavigate();

  // -------------------------------------------------------
  // 👂 1. ส่วนรับฟัง (Listener): รอ Electron ตอบกลับมา
  // -------------------------------------------------------
  useEffect(() => {
    // เช็คว่ามีตัวเชื่อม (Bridge) อยู่จริงไหม
    if (window.electronAPI) {
      // เมื่อ Electron ตอบกลับมาว่า 'login-response'
      // เราใช้ .once หรือตรวจสอบเพื่อป้องกันการทำงานซ้ำซ้อนได้ แต่เบื้องต้นใช้แบบนี้ตาม Flow เดิม
      window.electronAPI.onLoginResponse((response) => {
        console.log('📩 ได้รับผลจาก Electron:', response);
        
        // เช็คผลลัพธ์ (รองรับทั้งแบบ Mock เดิม และแบบ Python Server ในอนาคต)
        const isSuccess = response.success || response.status === 'success' || response.status === 'ok';

        if (isSuccess) {
          // --- Login ผ่าน ---
          console.log("✅ Login Passed!");
          
          // เก็บข้อมูลลงเครื่อง
          localStorage.setItem('username', response.username || username);
          // เก็บ Token หรือ User ID
          localStorage.setItem('token', response.token || response.user_id || 'dummy-token'); 
          
          // เปลี่ยนไปหน้า Chat
          navigate('/chat');

        } else {
          // --- Login ไม่ผ่าน ---
          alert('Login Failed: ' + (response.message || 'Unknown Error'));
        }
      });
    }
  }, [navigate, username]); // เพิ่ม dependencies เพื่อความชัวร์

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
        <h2>LogIn</h2>
        <form onSubmit={handleLogin}>
          
          {/* ช่อง Username */}
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>

          {/* ช่อง Password */}
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          {/* กลุ่มปุ่มกด (Login + Register) */}
          <div className="button-group">
            <button type="submit" className="login-btn">
              Login
            </button>
            
            <button 
              type="button" 
              className="register-link-btn"
              onClick={() => navigate('/register')}
            >
              Register
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  // Reset input ทุกครั้งที่เข้า Register
  useEffect(() => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: ''
    });
  }, []);

  // เพิ่ม useEffect นี้
  useEffect(() => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: ''
    });
  }, []);

  const handleRegister = (e) => {
    e.preventDefault();
    
    const payload = { 
      username: formData.username, 
      password: formData.password, 
      confirmPassword: formData.confirmPassword 
    };
    console.log('📤 กำลังส่งข้อมูลไป Electron:', payload);

    if (window.electronAPI) {
      // ใช้สะพานที่สร้างไว้ใน preload.js
      window.electronAPI.register(payload);
    } else {
      // กรณีเปิดผ่าน Browser ธรรมดา (ไม่ใช่ Electron)
      alert('Error: ไม่พบ Electron API (กรุณาเปิดผ่านแอพ Electron)');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Enter Chat Room</h2>
        <form onSubmit={handleRegister}>
          
          {/* ช่อง Username */}
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              value={formData.username} 
              onChange={(e) => setFormData({...formData, username: e.target.value})} 
              required 
            />
          </div>

          {/* ช่อง Password */}
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              value={formData.password} 
              onChange={(e) => setFormData({...formData, password: e.target.value})} 
              required 
            />
          </div>

          {/* ช่องยืนยันรหัสผ่าน */}
          <div className="input-group">
            <label>Confirm Password</label>
            <input 
              type="password" 
              value={formData.confirmPassword} 
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
              required 
            />
          </div>

          {/* กลุ่มปุ่มกด (Login + Register) */}
          <div className="button-group">
            <button type="submit" className="login-btn">
              Register
            </button>
            
            <button 
              type="button" 
              className="register-link-btn"
              onClick={() => navigate('/login')}
            >
              Login
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default Login;