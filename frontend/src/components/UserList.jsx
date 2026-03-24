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
          // ✅ เช็คว่าเป็นแชทกลุ่ม หรือ แชทเดี่ยว
          const isGroup = item.type === "group";
          
          let displayName = "Unknown";
          let displayId = "No ID";

          if (isGroup) {
            // ถ้าเป็นกลุ่ม ให้ใช้ title เป็นชื่อ
            displayName = item.title || "Group Chat";
            displayId = "Group"; 
          } else {
            // ถ้าเป็นแชทเดี่ยว ดึงข้อมูลจาก other_user
            const friend = item.other_user || item;
            displayName = friend.display_name || friend.username || friend.name || "Unknown";
            displayId = friend.custom_id || "No ID";
          }
          
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

              {/* ข้อมูลชื่อและ ID */}
              <div className="user-info">
                <span className="user-name">{displayName}</span>
                <span className="user-id-label">
                  {/* ถ้าเป็นกลุ่มให้โชว์คำว่า Group เฉยๆ แต่ถ้าเป็นเดี่ยวให้โชว์ ID: ... */}
                  {isGroup ? displayId : `ID: ${displayId}`}
                </span> 
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#547792', fontSize: '0.85rem' }}>
            No friends or groups found.
          </div>
        )}
      </div>
    </div>
  );
};

export default UserList;