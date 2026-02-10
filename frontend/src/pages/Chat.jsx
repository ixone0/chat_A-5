import React, { useState } from 'react';
import './Chat.css';
import { useNavigate } from "react-router-dom";

// import io from 'socket.io-client'; 

const Chat = () => {

  const navigate = useNavigate(); 
  // --- State Management ---
  const [users, setUsers] = useState([
    { id: 1, name: 'User 1', customId: 'user_01' },
    { id: 2, name: 'User 2', customId: 'user_02' },
  ]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [isAddUserPage, setIsAddUserPage] = useState(false);
  const [newUserData, setNewUserData] = useState({ name: '', id: '' });

  // 🔴 เปลี่ยน: จาก Array [] เป็น Object {} เพื่อแยกห้องคุย
  const [chatHistory, setChatHistory] = useState({}); 
  
  const [inputText, setInputText] = useState('');

  // --- Functions ---

  const handleGoToAddPage = () => {
    setIsAddUserPage(true);
    setSelectedUser(null);
  };

  const handleSelectUser = (user) => {
    setIsAddUserPage(false);
    setSelectedUser(user);
  };

  const handleSaveNewUser = (e) => {
    e.preventDefault();
    if (newUserData.name && newUserData.id) {
      const newUser = {
        id: Date.now(),
        name: newUserData.name,
        customId: newUserData.id
      };
      setUsers([...users, newUser]);
      setNewUserData({ name: '', id: '' });
      handleSelectUser(newUser); 
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser) return;
    
    const newMessage = {
      id: Date.now(),
      sender: 'me',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // 🔴 Logic ใหม่: บันทึกข้อความลงในห้องของเพื่อนคนนั้น
    const receiverId = selectedUser.customId; // ใช้ ID เพื่อนเป็น Key
    
    // ดึงประวัติเก่าของคนนี้มา (ถ้าไม่มีให้เป็น Array ว่าง)
    const currentHistory = chatHistory[receiverId] || [];

    // อัปเดต State โดยสร้าง Object ใหม่
    setChatHistory({
      ...chatHistory, // คงประวัติของคนอื่นไว้เหมือนเดิม
      [receiverId]: [...currentHistory, newMessage] // อัปเดตเฉพาะของคนนี้
    });

    setInputText('');
  };

  // 🔴 Helper: ดึงข้อความที่จะโชว์
  // ถ้าเลือกเพื่อนอยู่ ให้ดึงจาก History ของคนนั้น, ถ้าไม่มีให้เป็นค่าว่าง []
  const currentMessages = selectedUser ? (chatHistory[selectedUser.customId] || []) : [];

  return (
    <div className="chat-container">
      {/* Sidebar Strip */}
      <div className="sidebar-strip">
        <div 
          className="profile-circle"
          onClick={() => navigate("/profile")}
        >
          User
        </div>
        <div className="settings-circle">⚙️</div>
      </div>

      {/* User List Panel */}
      <div className="user-list-panel">
        <div className="add-user-section">
          <button className="add-ip-btn" onClick={handleGoToAddPage}>
            ADD USER ID
          </button>
        </div>
        <div className="user-list">
          {users.map(user => (
            <div 
              key={user.id} 
              className={`user-item ${selectedUser?.id === user.id ? 'active' : ''}`}
              onClick={() => handleSelectUser(user)}
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

      {/* Chat Area */}
      <div className="chat-area">
        
        {isAddUserPage ? (
          /* หน้า Add User Form */
          <div className="add-user-view">
             {/* (ส่วนนี้เหมือนเดิม ผมละไว้เพื่อไม่ให้รกนะครับ ก๊อปของเดิมมาใส่ได้) */}
             <div className="add-user-header">
               <div className="window-controls">
                <span>_</span><span>□</span><span>X</span>
              </div>
            </div>
            <form className="add-user-form" onSubmit={handleSaveNewUser}>
              <div className="form-avatar-circle"></div>
              <div className="form-group">
                <label>User Name :</label>
                <input 
                  type="text" 
                  className="underline-input"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({...newUserData, name: e.target.value})}
                  placeholder="Enter name"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>ID :</label>
                <input 
                  type="text" 
                  className="underline-input"
                  value={newUserData.id}
                  onChange={(e) => setNewUserData({...newUserData, id: e.target.value})}
                  placeholder="Enter ID"
                />
              </div>
              <button type="submit" className="save-user-btn">CONFIRM ADD</button>
            </form>
          </div>

        ) : (
          /* หน้า Chat ปกติ */
          <>
            <div className="chat-header">
              <span style={{fontWeight: 'bold', color: '#555'}}>
                {selectedUser ? `Chatting with: ${selectedUser.name}` : 'Select a user to chat'}
              </span>
              <div className="window-controls">
                <span className="control-btn">_</span><span className="control-btn">□</span><span className="control-btn">X</span>
              </div>
            </div>

            <div className="messages-display">
              {/* 🔴 ใช้ตัวแปร currentMessages แทน messages เดิม */}
              {selectedUser && currentMessages.map((msg) => (
                <div key={msg.id} className={`chat-row ${msg.sender === 'me' ? 'row-me' : 'row-other'}`}>
                  {msg.sender === 'other' && <div className="chat-avatar-container"><div className="chat-avatar-img">User</div></div>}
                  <div className="chat-bubble">
                    <p className="msg-text">{msg.text}</p>
                    <span className="msg-time">{msg.time}</span>
                  </div>
                  {msg.sender === 'me' && <div className="chat-avatar-container"><div className="chat-avatar-img me-avatar">Me</div></div>}
                </div>
              ))}
            </div>

            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input 
                type="text" 
                placeholder="INPUT" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={!selectedUser}
              />
            </form>
          </>
        )}

      </div>
    </div>
  );
};

export default Chat;