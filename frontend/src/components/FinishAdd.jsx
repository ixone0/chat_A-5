import React, { useState } from 'react';
import './AddFriendForm.css';

const FinishAdd = ({ user, onCancel, onSuccess }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const handleAddFriend = async () => {
    // ✅ แก้ไข: Backend (server.py:191) ต้องการ Custom ID (เช่น loo123)
    const targetId = user?.custom_id;

    if (!targetId) {
      setError('Technical error: Custom ID is missing.');
      return;
    }
    
    setError('');
    setIsAdding(true);

    try {
      // ✅ ส่ง Custom ID ไปให้ Backend
      const res = await window.electronAPI.sendFriendRequest(targetId);
      
      if (res.status === 'success') {
        // แอดสำเร็จ กลับไปหน้าแชทหลัก
        onSuccess(); 
      } else {
        // ❌ แสดง Error จาก Backend (เช่น User not found)
        setError(res.message || 'The server could not process this request.');
      }
    } catch (err) {
      console.error("Error sending friend request:", err);
      setError('Connection failed. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  if (!user) return null;

  return (
    <div className="add-user-view">
      <div className="add-user-header">
        <div className="window-controls">
          <span onClick={onCancel} style={{cursor: 'pointer'}}>✕</span>
        </div>
      </div>

      <div className="add-user-form">
        <div className="form-avatar-circle">
          {user.name ? user.name.charAt(0).toUpperCase() : '?'}
        </div>

        <h2>Found {user.name}!</h2>
        <p className="subtitle">Is this the person you're looking for?</p>

        <div className="user-preview-card" style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '350px',
            textAlign: 'center',
            marginBottom: '20px',
            border: `2px solid ${error ? '#f23f42' : 'rgba(84, 119, 146, 0.2)'}`
        }}>
            <h3 style={{ color: '#213448', margin: '0 0 5px 0' }}>{user.name}</h3>
            {/* แสดง Custom ID ให้ User เห็นเพื่อความมั่นใจ */}
            <p style={{ color: '#547792', margin: 0, fontSize: '0.9rem' }}>ID: {user.custom_id}</p>
        </div>

        {/* แสดงข้อความแจ้งเตือน Error บนหน้าจอ */}
        {error && (
          <div style={{
            color: '#f23f42', 
            fontWeight: 'bold', 
            marginBottom: '15px', 
            fontSize: '13px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <button 
          className="save-user-btn" 
          onClick={handleAddFriend} 
          disabled={isAdding}
        >
          {isAdding ? 'SENDING...' : 'CONFIRM & ADD FRIEND'}
        </button>
        
        <button 
            style={{ marginTop: '10px', background: 'transparent', color: '#547792', border: 'none', cursor: 'pointer' }}
            onClick={onCancel}
        >
            Not this person? Go back
        </button>
      </div>
    </div>
  );
};

export default FinishAdd;