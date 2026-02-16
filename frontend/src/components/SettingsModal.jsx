import React from 'react';
import './SettingsModal.css';

const SettingsModal = ({ onClose, onLogout }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Settings</h3>
          <span className="close-btn" onClick={onClose}>✕</span>
        </div>

        <div className="modal-content">
          <div className="settings-section">
            <h4>Account</h4>
            <p>Manage your account settings here.</p>
          </div>

          <hr className="divider" />

          {/* ✅ ปุ่ม Logout */}
          <button className="logout-button-red" onClick={onLogout}>
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;