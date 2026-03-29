import React from 'react';
import './SettingsModal.css';
import { XIcon } from './Icons';

const SettingsModal = ({ onClose, onLogout, currentUser }) => {
  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header ส่วนหัว */}
        <div className="settings-header">
          <h3>
            Settings
          </h3>
          <button className="close-btn" onClick={onClose}><XIcon size={16} /></button>
        </div>

        <div className="settings-body">
          {/* ส่วนโชว์ข้อมูล User (Optional ตาม CSS ของคุณ) */}
          <div className="user-info-section">
            <div className="user-avatar-placeholder">
              {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-details">
              <h4>{currentUser?.username || 'User'}</h4>
              <p>ID: {localStorage.getItem("custom_id") || 'Not set'}</p>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #2b2d31', margin: '10px 0' }} />

          {/* ปุ่ม Logout ที่ใช้ Class ตาม CSS เป๊ะๆ */}
          <button className="logout-btn" onClick={onLogout}>
            {/* ไอคอน Logout แบบ SVG (ถ้าต้องการ) หรือใส่ Emoji แทนก็ได้ครับ */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            LOGOUT
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;