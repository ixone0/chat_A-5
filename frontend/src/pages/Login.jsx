import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  // Reset Input
  useEffect(() => {
    setUsername('');
    setPassword('');
  }, []);

  // Listener รับค่าจาก Electron
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubscribe = window.electronAPI.onLoginResponse((response) => {
       if(!response) return;
       setLoading(false);
       if (response.success || response.status === 'success') {
          // Save Data
          localStorage.setItem('username', response.username || username);
          localStorage.setItem('user_id', response.user_id);
          if (response.custom_id) localStorage.setItem('custom_id', response.custom_id);
          
          navigate('/chat');
       } else {
          setErrorMsg(response.message || 'Incorrect username or password');
       }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [navigate, username]); // dependencies

  const handleLogin = (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    localStorage.clear();
    setErrorMsg('');

    if(!username || !password) {
        setLoading(false);
        setErrorMsg("Please fill in all fields");
        return;
    }

    const payload = { username, password };
    if (window.electronAPI) {
      window.electronAPI.login(payload);
    } else {
      // สำหรับ Test ใน Browser ธรรมดา
      setTimeout(() => {
        setLoading(false);
        setErrorMsg("Electron API not found (Browser Mode)");
      }, 1000);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        
        {/* Header ส่วนหัว */}
        <div className="login-header">
          <h2>Login</h2>
          <p>Please sign in to continue</p>
        </div>

        <form onSubmit={handleLogin}>
          
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              placeholder="Enter your username"
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              autoFocus
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
            {/* Error Message */}
            {errorMsg && (
              <div className="error-text">
                ⚠ {errorMsg}
              </div>
            )}
          </div>

          <div className="button-group">
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          <div className="register-section">
            <span>Don't have an account?</span>
            <span 
              className="register-link-text"
              onClick={() => navigate('/register')}
            >
              Create Account
            </span>
          </div>

        </form>
      </div>
    </div>
  );
};

export default Login;