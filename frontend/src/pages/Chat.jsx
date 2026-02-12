import React, { useState } from 'react';
import './Chat.css';
// Import Components จากโฟลเดอร์ components
import UserList from '../components/UserList';
import AddFriendForm from '../components/AddFriendForm';
import ChatWindow from '../components/ChatWindow';
import FinishAdd from '../components/FinishAdd';
import FriendRequestList from '../components/FriendRequestList';
// Import Page Profile (สมมติว่าไฟล์นี้วางอยู่ข้างๆ Chat.jsx ในโฟลเดอร์ pages)
import Profile from './Profile';
const Chat = () => {
 // --- 1. Data & State ---
 const MOCK_DATABASE = [
   { id: 101, name: 'Elon Musk', customId: 'elon' },
   { id: 102, name: 'Mark Zuk', customId: 'mark' },
   { id: 103, name: 'Lisa Blackpink', customId: 'lisa' },
 ];
 const [users, setUsers] = useState([
   { id: 1, name: 'User 1', customId: 'user_01' },
   { id: 2, name: 'User 2', customId: 'user_02' },
 ]);
 const [selectedUser, setSelectedUser] = useState(null);
 const [chatHistory, setChatHistory] = useState({});
 // State คุมหน้าจอขวามือ
 // ค่าที่เป็นไปได้: 'chat' | 'add_form' | 'add_preview' | 'profile'
 const [currentView, setCurrentView] = useState('chat');
 // เก็บข้อมูลคนที่ค้นหาเจอ (สำหรับหน้า Add Friend)
 const [searchedUser, setSearchedUser] = useState(null);
 const [showRequests, setShowRequests] = useState(false);

 // --- 2. Handlers (ฟังก์ชันจัดการเหตุการณ์ต่างๆ) ---
 // ไปหน้า Profile (เมื่อกดปุ่ม User ใน Sidebar)
 const handleGoToProfile = () => {
   setCurrentView('profile');
   setSelectedUser(null);
 };
 // ไปหน้าเพิ่มเพื่อน (เมื่อกดปุ่ม ADD USER ID)
 const handleGoToAddPage = () => {
   setCurrentView('add_form');
   setSelectedUser(null);
 };
 // เลือกเพื่อนเพื่อคุย (เมื่อกดรายชื่อเพื่อน)
 const handleSelectUser = (user) => {
   setCurrentView('chat');
   setSelectedUser(user);
 };
 // ค้นหาเพื่อน (จากหน้า AddFriendForm)
 const handleSearchUser = (searchId) => {
   console.log("Searching for:", searchId);
   const found = MOCK_DATABASE.find(u => u.customId === searchId);
   if (found) {
       // เช็คว่าเป็นเพื่อนกันหรือยัง
       const alreadyFriend = users.find(u => u.customId === found.customId);
       if (alreadyFriend) {
           alert("คนนี้เป็นเพื่อนอยู่แล้วครับ!");
       } else {
           setSearchedUser(found);
           setCurrentView('add_preview');
       }
   } else {
       alert("ไม่พบผู้ใช้ ID นี้ครับ (ลอง elon, mark, lisa ดูนะ)");
   }
 };
 // ยืนยันเพิ่มเพื่อน (จากหน้า FinishAdd)
 const handleConfirmAddFriend = () => {
   if (searchedUser) {
       const newUser = {
           ...searchedUser,
           id: Date.now(),
       };
       setUsers([...users, newUser]);
       handleSelectUser(newUser); // เพิ่มเสร็จเด้งไปหน้าแชทเลย
       setSearchedUser(null);
   }
 };
 // ยกเลิกการเพิ่มเพื่อน
 const handleCancelAdd = () => {
     setCurrentView('add_form');
     setSearchedUser(null);
 };
 // ส่งข้อความ
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

 // --- 3. Render Helper (ส่วนแสดงผลด้านขวา) ---
 const renderRightPanel = () => {
     switch (currentView) {
         case 'add_form':
             return <AddFriendForm onSearch={handleSearchUser} />;
         case 'add_preview':
             return (
<FinishAdd
                     user={searchedUser}
                     onConfirm={handleConfirmAddFriend}
                     onCancel={handleCancelAdd}
                 />
             );
         case 'profile':
             return <Profile />; // ✅ แสดงหน้า Profile เมื่อ currentView เป็น 'profile'
         default: // case 'chat'
             return (
<ChatWindow
                     selectedUser={selectedUser}
                     messages={selectedUser ? (chatHistory[selectedUser.customId] || []) : []}
                     onSendMessage={handleSendMessage}
                 />
             );
     }
 };

return (
    <div className="chat-container">
      {/* Sidebar Strip */}
      <div className="sidebar-strip">
        <div className="profile-circle" onClick={handleGoToProfile}>
            User
        </div>

        {/* ✅ 3. ปุ่มกดดูคำขอเป็นเพื่อน (รูปกระดิ่ง) */}
        <div 
            className="icon-circle" 
            onClick={() => setShowRequests(true)}
            style={{ marginTop: '10px', cursor: 'pointer', fontSize: '20px' }}
        >
            🔔
        </div>

        <div className="settings-circle" style={{ marginTop: 'auto' }}>⚙️</div>
      </div>

      {/* User List Panel */}
      <UserList
        users={users}
        selectedUser={selectedUser}
        onSelectUser={handleSelectUser}
        onAddClick={handleGoToAddPage}
      />

      {/* Right Area */}
      <div className="chat-area">
        {renderRightPanel()}
      </div>

      {/* ✅ 4. แสดง Popup รายการคำขอ (ถ้า showRequests เป็น true) */}
      {showRequests && (
        <FriendRequestList onClose={() => setShowRequests(false)} />
      )}
    </div>
  );
};

export default Chat;