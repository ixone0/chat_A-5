import React, { useState } from 'react';
import './CreateGroupForm.css';
import { XIcon, CheckIcon } from './Icons';

const CreateGroupForm = ({ friends, onCancel, onSuccess }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // ฟังก์ชันกดเลือก/เลิกเลือกเพื่อน
  const toggleMember = (friendId) => {
    setSelectedMembers((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Please enter a group name.');
      return;
    }
    if (selectedMembers.length === 0) {
      setError('Please select at least 1 friend to join the group.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const payload = {
        title: groupName,
        members: selectedMembers // ส่ง Array ของ ID เพื่อนไปให้ Python
      };
      
      const res = await window.electronAPI.createGroupChat(payload);
      
      if (res && res.status === 'success') {
        onSuccess(); // สร้างสำเร็จ ปิดหน้าต่างและรีเฟรช
      } else {
        setError(res.message || 'Failed to create group');
      }
    } catch (err) {
      setError('Connection failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-group-view">
      <div className="create-group-header">
        <button className="close-icon-btn" onClick={onCancel}><XIcon size={16} /></button>
      </div>

      <div className="create-group-content">
        <h2>Create New Group</h2>
        <p className="subtitle">Gather your friends in one place</p>

        <form className="create-group-form" onSubmit={handleCreateGroup}>
          <div className="form-group">
            <label>Group Name</label>
            <input
              type="text"
              className="modern-input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Create Group Name"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Select Friends ({selectedMembers.length} selected)</label>
            <div className="friends-selection-list">
              {friends.length === 0 ? (
                <p className="no-friends-text">You don't have any friends yet.</p>
              ) : (
                friends.map((friend) => (
                  <div 
                    key={friend.id} 
                    className={`friend-select-item ${selectedMembers.includes(friend.id) ? 'selected' : ''}`}
                    onClick={() => toggleMember(friend.id)}
                  >
                    <div className="friend-avatar">
                      {friend.display_name ? friend.display_name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">{friend.display_name || friend.username}</span>
                    </div>
                    <div className="checkbox">
                      {selectedMembers.includes(friend.id) && <CheckIcon size={16} color="#5865f2" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="save-user-btn" disabled={isLoading || friends.length === 0}>
            {isLoading ? 'CREATING...' : 'CREATE GROUP'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupForm;