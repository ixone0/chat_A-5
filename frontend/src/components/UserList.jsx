import React from 'react';
import './UserList.css';

const AVATAR_COLORS = [
  '#5865f2', '#57a6a1', '#e07c4f', '#9b59b6',
  '#2ecc71', '#e74c3c', '#f39c12', '#1abc9c',
  '#3498db', '#e91e63',
];

function getAvatarColor(id) {
  if (!id) return AVATAR_COLORS[0];
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function truncate(str, max = 30) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

const UserList = ({ users, selectedUser, onSelectUser, onAddClick, unreadMap = {}, searchQuery = '', onSearchChange }) => {
  const filtered = searchQuery.trim()
    ? users.filter(item => {
        const name = item.type === 'group'
          ? (item.title || '')
          : (item.other_user?.display_name || item.other_user?.username || item.display_name || item.username || '');
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : users;

  return (
    <div className="user-list-panel">
      <div className="add-user-section">
        <input
          className="sidebar-search"
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
        />
        <button className="add-ip-btn" onClick={onAddClick}>ADD USER ID</button>
      </div>

      <div className="user-list">
        {filtered.map(item => {
          const isGroup = item.type === "group";
          let displayName = "Unknown";
          let subtitle = "";

          if (isGroup) {
            displayName = item.title || "Group Chat";
            subtitle = item.last_message ? truncate(item.last_message) : `${item.member_count || 0} members`;
          } else {
            const friend = item.other_user || item;
            displayName = friend.display_name || friend.username || friend.name || "Unknown";
            subtitle = item.last_message ? truncate(item.last_message) : `ID: ${friend.custom_id || "No ID"}`;
          }

          const avatarChar = displayName.charAt(0).toUpperCase();
          const unreadCount = unreadMap[String(item.id)] || 0;

          return (
            <div
              key={item.id}
              className={`user-item ${selectedUser?.id === item.id ? 'active' : ''}`}
              onClick={() => onSelectUser(item)}
            >
              <div className="user-avatar-wrapper">
                <div className="user-avatar-small" style={{ backgroundColor: getAvatarColor(item.id) }}>
                  {avatarChar}
                </div>
                {!isGroup && item.other_user?.is_online && (
                  <div className="online-dot" />
                )}
              </div>
              <div className="user-info">
                <span className="user-name">{displayName}</span>
                <span className="user-id-label">{subtitle}</span>
              </div>
              {unreadCount > 0 && (
                <div className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#547792', fontSize: '0.85rem' }}>
            {searchQuery ? 'No results found' : 'No friends or groups found.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserList;
