import React from 'react';
import './UserList.css';

// สร้างสี avatar จาก id เพื่อให้แต่ละกลุ่ม/คนมีสีต่างกัน
const AVATAR_COLORS = [
  '#5865f2', '#57a6a1', '#e07c4f', '#9b59b6',
  '#2ecc71', '#e74c3c', '#f39c12', '#1abc9c',
  '#3498db', '#e91e63',
];
function getAvatarColor(id) {
  if (!id) return AVATAR_COLORS[0];
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
            displayName = item.title || "Group Chat";
            displayId = item.member_count ? `${item.member_count} members` : "Group"; 
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
              <div className="user-avatar-small" style={{ backgroundColor: getAvatarColor(item.id) }}>
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