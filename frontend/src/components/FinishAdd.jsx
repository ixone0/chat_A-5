import React, { useState } from 'react';
import './AddFriendForm.css';
import { XIcon } from './Icons';

const FinishAdd = ({ user, onCancel, onSuccess }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  const handleAddFriend = async () => {
    const targetId = user?.custom_id;
    if (!targetId) {
      setError('Technical error: Custom ID is missing.');
      return;
    }
    
    setError('');
    setIsAdding(true);

    try {
      const res = await window.electronAPI.sendFriendRequest(targetId);
      if (res.status === 'success') {
        onSuccess(); 
      } else {
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
        <button className="close-icon-btn" onClick={onCancel}><XIcon size={16} /></button>
      </div>

      <div className="add-user-content">
        <div className="form-avatar-circle">
          {user.name ? user.name.charAt(0).toUpperCase() : '?'}
        </div>

        <h2>Found User!</h2>
        <p className="subtitle">Is this the person you're looking for?</p>

        {/* Card แสดงพรีวิวผู้ใช้ */}
        <div className="user-preview-card">
            <h3 className="user-preview-name">{user.name}</h3>
            <p className="user-preview-id">ID: {user.custom_id}</p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button 
          className="save-user-btn" 
          onClick={handleAddFriend} 
          disabled={isAdding}
        >
          {isAdding ? 'SENDING...' : 'CONFIRM & ADD FRIEND'}
        </button>
        
        <button className="go-back-link" onClick={onCancel}>
            Not this person? Go back
        </button>
      </div>
    </div>
  );
};

export default FinishAdd;