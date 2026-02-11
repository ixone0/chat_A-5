//FinishAdd.jsx
import React from 'react';
import './FinishAdd.css'; // เดี๋ยวสร้างไฟล์ CSS นี้ต่อ
const FinishAdd = ({ user, onConfirm, onCancel }) => {
 if (!user) return null;
 return (
<div className="finish-add-view">
<div className="window-controls">
<span>_</span><span>□</span><span>X</span>
</div>
<div className="profile-preview-card">
<div className="large-avatar"></div>
<h2 className="preview-name">{user.name}</h2>
<p className="preview-id">ID: {user.customId}</p>
<div className="action-buttons">
<button className="confirm-btn" onClick={onConfirm}>
           Add Friend
</button>
<button className="cancel-btn" onClick={onCancel}>
           Cancel
</button>
</div>
</div>
</div>
 );
};
export default FinishAdd;