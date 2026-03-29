// src/pages/Register.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Register.css'; 

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // State สำหรับไอคอนรูปตา
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset input
  useEffect(() => {
    setFormData({ username: '', password: '', confirmPassword: '' });
  }, []);

  // 👂 Listener: รอฟังผลการ Register จาก Electron
  useEffect(() => {
      if (!window.electronAPI?.onRegisterResponse) return;
      
      const unsubscribe = window.electronAPI.onRegisterResponse((res) => {
          console.log("📩 Register Response:", res); // ดู Log ว่าได้อะไรมา

          // ✅ แก้จุดนี้: เช็คแบบครอบจักรวาล (ถ้าไม่มี error หรือมี id กลับมา = สำเร็จ)
          const isSuccess = 
              res.success || 
              res.status === 'success' || 
              res.status === 'ok' ||
              (!res.error && res.username); // ถ้าไม่มี error และมีชื่อกลับมา ก็ถือว่าผ่าน

          if (isSuccess) {
              setSuccessMsg("Registration Successful! Redirecting...");
              setErrorMsg(''); // ลบ error ทิ้ง
              
              // รอ 1.5 วิ แล้วเด้งไปหน้า Login
              setTimeout(() => { 
                  navigate('/'); 
              }, 1500);
          } else {
              // ถ้ามี error จริงๆ
              setErrorMsg(res.message || res.error || "Registration failed");
              setSuccessMsg('');
          }
      });
      return () => unsubscribe && unsubscribe();
  }, [navigate]);


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMsg('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Passwords do not match!");
      return;
    }

    if (!formData.username || !formData.password) {
      setErrorMsg("Please fill in all fields");
      return;
    }

    try {
      const res = await window.electronAPI.register({
        username: formData.username,
        password: formData.password
      });

      console.log("Register result:", res);

      const isSuccess =
        res.success ||
        res.status === "success" ||
        res.status === "ok" ||
        (!res.error && res.username);

      if (isSuccess) {
        setSuccessMsg("Registration Successful! Redirecting...");
        setErrorMsg("");

        setTimeout(() => {
          navigate("/");
        }, 1500);

      } else {
        setErrorMsg(res.message || res.error || "Registration failed");
        setSuccessMsg("");
      }

    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        
        <div className="register-header">
            <h2>Create Account</h2>
            <p>Join us and start chatting!</p>
        </div>

        <form onSubmit={handleRegister}>
          
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              name="username"
              value={formData.username} 
              onChange={handleChange} 
              autoFocus
              required 
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="password-input-wrapper">
                <input 
                  type={showPassword ? "text" : "password"} 
                  name="password"
                  value={formData.password} 
                  onChange={handleChange} 
                  required 
                />
                <button 
                  type="button"
                  className="toggle-password-icon"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  )}
                </button>
            </div>
          </div>

          <div className="input-group">
            <label>Confirm Password</label>
            <div className="password-input-wrapper">
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  name="confirmPassword"
                  value={formData.confirmPassword} 
                  onChange={handleChange} 
                  required 
                />
                <button 
                  type="button"
                  className="toggle-password-icon"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                >
                  {showConfirmPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  )}
                </button>
            </div>
            {errorMsg && <div className="error-text">{errorMsg}</div>}
          </div>

          <div className="button-group">
            <button type="submit" className="btn-register">
              Sign Up
            </button>
          </div>

          {successMsg && <div className="success-text">{successMsg}</div>}

          <div className="login-link-section">
            <span>Already have an account?</span>
            <span className="login-link-text" onClick={() => navigate('/')}>
              Sign In
            </span>
          </div>

        </form>
      </div>
    </div>
  );
};

export default Register;