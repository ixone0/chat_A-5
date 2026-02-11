// src/pages/Chat.jsx
import React, { useState } from 'react';
import './Chat.css'; 
import UserList from '../components/UserList';
import AddFriendForm from '../components/AddFriendForm';
import ChatWindow from '../components/ChatWindow';
const Chat = () => {
 
 const [users, setUsers] = useState([
   { id: 1, name: 'User 1', customId: 'user_01' },
   { id: 2, name: 'User 2', customId: 'user_02' },
 ]);
 const [selectedUser, setSelectedUser] = useState(null);
 const [isAddUserPage, setIsAddUserPage] = useState(false);
 const [chatHistory, setChatHistory] = useState({});
 
 const handleGoToAddPage = () => {
   setIsAddUserPage(true);
   setSelectedUser(null);
 };
 const handleSelectUser = (user) => {
   setIsAddUserPage(false);
   setSelectedUser(user);
 };
 const handleAddUser = (newUserData) => {
   const newUser = {
     id: Date.now(),
     name: newUserData.name,
     customId: newUserData.id
   };
   setUsers([...users, newUser]);
   handleSelectUser(newUser);
 };
 const handleSendMessage = (text) => {
   if (!selectedUser) return;
   const newMessage = {
     id: Date.now(),
     sender: 'me',
     text: text,
     time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
   };
   const receiverId = selectedUser.customId;
   const currentHistory = chatHistory[receiverId] || [];
   setChatHistory({
     ...chatHistory,
     [receiverId]: [...currentHistory, newMessage]
   });
 };
 const currentMessages = selectedUser ? (chatHistory[selectedUser.customId] || []) : [];
 return (
<div className="chat-container">
     {/* Sidebar Strip */}
<div className="sidebar-strip">
<div className="profile-circle">User</div>
<div className="settings-circle">⚙️</div>
</div>
     {/* เรียกใช้ User List Component */}
<UserList
       users={users}
       selectedUser={selectedUser}
       onSelectUser={handleSelectUser}
       onAddClick={handleGoToAddPage}
     />
     {/* Area ขวา */}
<div className="chat-area">
       {isAddUserPage ? (
<AddFriendForm onSave={handleAddUser} />
       ) : (
<ChatWindow
           selectedUser={selectedUser}
           messages={currentMessages}
           onSendMessage={handleSendMessage}
         />
       )}
</div>
</div>
 );
};
export default Chat;