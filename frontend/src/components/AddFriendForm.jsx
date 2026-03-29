import React, { useState } from 'react';
import './AddFriendForm.css';
import FinishAdd from './FinishAdd';
import { XIcon } from './Icons';

const AddFriendForm = ({ onSearch, onCancel }) => { // ปรับ Prop ให้สื่อความหมาย
  const [searchId, setSearchId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundUser, setFoundUser] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setError('');
    setIsLoading(true);

    try {
        const result = await window.electronAPI.searchUser(searchId);
        
        if (result && result.status === 'success') {
            setFoundUser({
                name: result.data.display_name,
                custom_id: result.data.custom_id,
                user_id: result.data.user_id
            });
        } else {
            setError(result.message || 'User not found');
            setFoundUser(null);
        }
    } catch (err) {
        setError('Connection failed');
    } finally {
        setIsLoading(false);
    }
  };

  if (foundUser) {
      return (
          <FinishAdd
              user={foundUser}
              onCancel={() => setFoundUser(null)} 
              onSuccess={() => {
                onCancel(); // ปิดหน้าต่างเมื่อแอดสำเร็จ
              }}
          />
      );
  }

  return (
    <div className="add-user-view">
      <div className="add-user-header">
        <button className="close-icon-btn" onClick={onCancel}><XIcon size={16} /></button>
      </div>
      
      <div className="add-user-content">
        <div className="form-avatar-circle">?</div>
        <h2>Add Friend</h2>
        <p className="subtitle">Enter your friend's ID to start chatting</p>

        <form className="add-user-form" onSubmit={handleSearch}>
          <div className="form-group">
            <label>Friend's ID</label>
            <input
              type="text"
              className="modern-input" // ✅ แก้ให้ตรงกับ CSS
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Ex. nh2fy1"
              autoFocus
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="save-user-btn" disabled={isLoading}>
              {isLoading ? 'SEARCHING...' : 'FIND USER'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddFriendForm;