// AddFriendForm.jsx
import React, { useState } from 'react';
import './AddFriendForm.css';

const AddFriendForm = ({ onSave }) => {
  const [searchId, setSearchId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearchAndAdd = async (e) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setError('');
    setIsLoading(true);

    try {
        // ✅ เรียกใช้ผ่าน electronAPI ที่เราเพิ่งแก้ใน preload.js
        console.log("Searching for:", searchId);
        const result = await window.electronAPI.searchUser(searchId);
        
        console.log("Search result:", result);

        if (result && result.status === 'success') {
            // เจอเพื่อน! ส่งข้อมูลกลับไปบันทึก
            onSave({
                name: result.data.display_name, // หรือ username แล้วแต่จะแสดง
                id: result.data.custom_id,
                user_id: result.data.user_id
            });
            setSearchId('');
            // อาจจะเพิ่ม alert หรือ notification ว่าเพิ่มสำเร็จ
        } else {
            setError(result.message || 'User not found');
        }
    } catch (err) {
        console.error("Error searching user:", err);
        setError('Connection failed');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="add-user-view">
      <div className="add-user-header">
        <div className="window-controls">
          <span>_</span><span>□</span><span onClick={() => onSave(null)}>X</span>
        </div>
      </div>
      
      <form className="add-user-form" onSubmit={handleSearchAndAdd}>
        <div className="form-avatar-circle">?</div>
        
        {/* ลบช่อง Name ออก เพราะเราจะค้นหาจาก ID อย่างเดียว */}
        
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
            {isLoading ? 'SEARCHING...' : 'SEARCH & ADD'}
        </button>
      </form>
    </div>
  );
};

export default AddFriendForm;