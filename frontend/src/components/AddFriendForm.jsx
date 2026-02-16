import React, { useState } from 'react';
import './AddFriendForm.css';
import FinishAdd from './FinishAdd';

const AddFriendForm = ({ onSave }) => {
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
            // ✅ Map ข้อมูลให้ตรงกับที่ FinishAdd จะเอาไปใช้
            setFoundUser({
                name: result.data.display_name,
                custom_id: result.data.custom_id, // ใช้ snake_case ให้เหมือนกัน
                user_id: result.data.user_id
            });
            setError('');
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

  const cancelAdd = () => {
    setFoundUser(null);
    setSearchId('');
  };

  // ✅ ถ้าเจอ user ให้เปลี่ยนหน้าไปแสดง FinishAdd
  if (foundUser) {
      return (
          <FinishAdd
              user={foundUser}
              onCancel={cancelAdd} 
              onSuccess={() => {
                // เมื่อแอดสำเร็จ ให้เรียก onSave (ใน Chat.jsx) เพื่อรีโหลดรายชื่อเพื่อน
                if (typeof onSave === 'function') onSave();
                cancelAdd();
              }}
          />
      );
  }

  return (
    <div className="add-user-view">
      <div className="add-user-header">
        <div className="window-controls">
          {/* ส่ง null ไปที่ onSave เพื่อปิดหน้าต่าง */}
          <span onClick={() => onSave(null)}>✕</span>
        </div>
      </div>
      
      <form className="add-user-form" onSubmit={handleSearch}>
        <div className="form-avatar-circle">?</div>
       
        <div className="form-group">
          <label>Friend's Custom ID :</label>
          <input
            type="text"
            className="underline-input"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Ex. nh2fy1"
            autoFocus
          />
        </div>

        {error && <p style={{color: 'red', fontSize: '12px'}}>{error}</p>}

        <button type="submit" className="save-user-btn" disabled={isLoading}>
            {isLoading ? 'SEARCHING...' : 'SEARCH USER'}
        </button>
      </form>
    </div>
  );
};

export default AddFriendForm;