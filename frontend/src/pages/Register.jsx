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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------
  // 👂 รอฟังผลจาก Server
  // -------------------------------------------------------
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubscribe = window.electronAPI.onRegisterResponse((response) => {
      console.log("📩 Register Response:", response);

      setLoading(false);

      if (response.status === 'ok' || response.status === 'success') {
        setErrorMsg('');
        setSuccessMsg('Register Success! Redirecting to login...');

        setTimeout(() => {
          navigate('/');
        }, 1200);
      } else {
        setSuccessMsg('');
        setErrorMsg(response.message || 'Register failed');
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [navigate]);

  // -------------------------------------------------------
  // handle input
  // -------------------------------------------------------
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });

    // เคลียร์ข้อความ error/success เมื่อพิมพ์ใหม่
    setErrorMsg('');
    setSuccessMsg('');
  };

  // -------------------------------------------------------
  // submit register
  // -------------------------------------------------------
  const handleRegister = (e) => {
    e.preventDefault();

    if (loading) return;

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setLoading(true);

    if (window.electronAPI) {
      window.electronAPI.register({
        username: formData.username,
        password: formData.password
      });
    }
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

          {/* ✅ Error Message */}
          {errorMsg && (
            <div className="error-text">
              {errorMsg}
            </div>
          )}

          {/* ✅ Success Message */}
          {successMsg && (
            <div className="success-text">
              {successMsg}
            </div>
          )}

          {/* Buttons */}
          <div className="button-group">
            <button
              type="submit"
              className="btn-register"
              disabled={loading}
            >
              {loading ? 'Registering...' : 'REGISTER'}
            </button>

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
