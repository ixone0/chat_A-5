import React, { useState } from 'react';
import './AddFriendForm.css';

const AddFriendForm = ({ onSave }) => {
  const [formData, setFormData] = useState({ name: '', id: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.id) {
      onSave(formData);
      setFormData({ name: '', id: '' });
    }
  };

  return (
    <div className="add-user-view">
      <div className="add-user-header">
        <div className="window-controls">
          <span>_</span><span>□</span><span>X</span>
        </div>
      </div>
      <form className="add-user-form" onSubmit={handleSubmit}>
        <div className="form-avatar-circle"></div>
        <div className="form-group">
          <label>User Name :</label>
          <input 
            type="text" 
            className="underline-input"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Enter name"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>ID :</label>
          <input 
            type="text" 
            className="underline-input"
            value={formData.id}
            onChange={(e) => setFormData({...formData, id: e.target.value})}
            placeholder="Enter ID"
          />
        </div>
        <button type="submit" className="save-user-btn">CONFIRM ADD</button>
      </form>
    </div>
  );
};

export default AddFriendForm;