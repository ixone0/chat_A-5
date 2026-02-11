// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset input ทุกครั้งที่เข้า Login
  useEffect(() => {
    setUsername('');
    setPassword('');
  }, []);
  const navigate = useNavigate();

  // -------------------------------------------------------
  // 👂 1. ส่วนรับฟัง (Listener): รอ Electron ตอบกลับมา
  // -------------------------------------------------------
  // Login.jsx (เฉพาะ useEffect ที่ตั้ง listener)
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribe = window.electronAPI.onLoginResponse((response) => {
      if (!response) return;

      console.log('📩 ได้รับผลจาก Electron:', response);

      setLoading(false);

      const isSuccess =
        response.success ||
        response.status === 'success' ||
        response.status === 'ok';

      if (isSuccess) {
        setErrorMsg('');

        localStorage.setItem(
          'username',
          response.username || username
        );

        localStorage.setItem('user_id', response.user_id);

        if (response.custom_id) {
          localStorage.setItem('custom_id', response.custom_id);
        }

        navigate('/chat');
      } else {
        setErrorMsg(response.message || 'Login Failed');
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };

  }, []);

  // -------------------------------------------------------
  // 📤 2. ส่วนส่งคำสั่ง (Sender): ส่งข้อมูลไปหา Electron
  // -------------------------------------------------------
  const handleLogin = (e) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);

    localStorage.clear(); // ⭐ สำคัญ

    const payload = { username, password };

    if (window.electronAPI) {
      window.electronAPI.login(payload);
    } else {
      setLoading(false);
      setErrorMsg("Electron bridge not available");
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
            {errorMsg && (
              <div className="error-text">
                {errorMsg}
              </div>
            )}

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

export default Login;