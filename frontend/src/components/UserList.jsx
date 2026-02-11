import React from 'react';
import './UserList.css';

const UserList = ({ users, selectedUser, onSelectUser, onAddClick }) => {
  return (
    <div className="user-list-panel">
      <div className="add-user-section">
        <button className="add-ip-btn" onClick={onAddClick}>
          ADD USER ID
        </button>
      </div>
      <div className="user-list">
        {users.map(user => (
          <div 
            key={user.id} 
            className={`user-item ${selectedUser?.id === user.id ? 'active' : ''}`}
            onClick={() => onSelectUser(user)}
          >
            <div className="user-avatar-small"></div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-ip">ID: {user.customId}</span> 
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;