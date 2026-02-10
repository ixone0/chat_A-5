import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  
  // State เก็บข้อมูล
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  // State สำหรับลูกตาสลับดูรหัสผ่าน
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    console.log("Registering:", formData);
    // TODO: ตรงนี้เดี๋ยวเราค่อยมาใส่โค้ดส่งข้อมูลไปหา Electron ทีหลัง
    // window.electronAPI.register(formData);
    
    alert("Register Mock Success! Redirecting to login...");
    navigate('/'); // กลับไปหน้า Login
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <h2 className="register-title">Register</h2>
        
        <form onSubmit={handleRegister}>
          {/* Username */}
          <div className="input-group">
            <label>User name</label>
            <input 
              type="text" 
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          {/* Password */}
          <div className="input-group">
            <label>Password</label>
            <div className="password-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <span 
                className="eye-icon" 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </span>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="input-group">
            <label>Confirm Password</label>
            <div className="password-wrapper">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
              <span 
                className="eye-icon" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                 {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
              </span>
            </div>
          </div>

          {/* Buttons Area */}
          <div className="button-group">
            <button type="submit" className="btn-register">REGISTER</button>
            <button 
              type="button" 
              className="btn-login" 
              onClick={() => navigate('/')}
            >
              LOG IN
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default Register;