import React from 'react';
import './SettingsModal.css';
import { XIcon, LogOutIcon } from './Icons';

const SettingsModal = ({ onClose, onLogout, currentUser, theme, onToggleTheme }) => {
  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="close-btn" onClick={onClose}><XIcon size={16} /></button>
        </div>

        <div className="settings-body">
          <div className="user-info-section">
            <div className="user-avatar-placeholder">
              {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-details">
              <h4>{currentUser?.username || 'User'}</h4>
              <p>ID: {localStorage.getItem("custom_id") || 'Not set'}</p>
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-section">
            <h4 className="settings-section-title">Appearance</h4>
            <div className="settings-row" onClick={onToggleTheme}>
              <span className="settings-row-label">
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
              <div className={`settings-toggle ${theme === 'light' ? 'settings-toggle-on' : ''}`}>
                <div className="settings-toggle-knob" />
              </div>
            </div>
          </div>

          <div className="settings-divider" />

          <button className="logout-btn" onClick={onLogout}>
            <LogOutIcon size={18} />
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
