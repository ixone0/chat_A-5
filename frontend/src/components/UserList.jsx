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
        {users.map(item => {
          // ดึงข้อมูลเพื่อน: ถ้าเป็นห้องแชทใช้ other_user ถ้าเป็นเพื่อนเฉยๆ ใช้ item
          const friend = item.other_user || item;
          
          // ข้อมูลที่จะแสดง (ชื่อ และ ID)
          const displayName = friend.display_name || friend.username || friend.name || "Unknown";
          const displayId = friend.custom_id || "No ID";
          
          // ตัวอักษรย่อสำหรับ Avatar
          const avatarChar = displayName.charAt(0).toUpperCase();

          return (
            <div 
              key={item.id} 
              className={`user-item ${selectedUser?.id === item.id ? 'active' : ''}`}
              onClick={() => onSelectUser(item)}
            >
              {/* Avatar วงกลมแบบคลีน */}
              <div className="user-avatar-small">
                {avatarChar}
              </div>

              {/* ข้อมูลชื่อและ ID (ตัดข้อความล่าสุดและเลขแจ้งเตือนออกแล้ว) */}
              <div className="user-info">
                <span className="user-name">{displayName}</span>
                <span className="user-id-label">ID: {displayId}</span> 
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#547792', fontSize: '0.85rem' }}>
            No friends found.
          </div>
        )}
      </div>
    </div>
  );
};

export default UserList;