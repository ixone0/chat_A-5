import React, { useState } from 'react';
import './ChatWindow.css';

const ChatWindow = ({ selectedUser, messages, onSendMessage }) => {
  const [inputText, setInputText] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    // ส่งข้อความกลับไปให้ตัวแม่จัดการ
    onSendMessage(inputText);
    setInputText('');
  };

  if (!selectedUser) {
    return (
        <div className="chat-header">
             <span style={{fontWeight: 'bold', color: '#555'}}>Select a user to chat</span>
        </div>
    );
  }

  return (
    <>
      <div className="chat-header">
        <span style={{fontWeight: 'bold', color: '#555'}}>
          Chatting with: {selectedUser.name}
        </span>
        <div className="window-controls">
          <span className="control-btn">_</span><span className="control-btn">□</span><span className="control-btn">X</span>
        </div>
      </div>

      <div className="messages-display">
        {messages.map((msg) => (
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

      <form className="chat-input-area" onSubmit={handleSend}>
        <input 
          type="text" 
          placeholder="INPUT" 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
      </form>
    </>
  );
};

export default ChatWindow;