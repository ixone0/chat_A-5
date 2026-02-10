// src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Login from './pages/Login'; 
import Chat from './pages/Chat'; // <--- บรรทัดนี้ต้องเปิดใช้งาน (ห้ามมี // ข้างหน้า)

function App() {
  return (
    <Routes>
      {/* เส้นทางหลักคือหน้า Login */}
      <Route path="/" element={<Login />} />
      
      {/* เส้นทางไปห้องแชท (ต้องเปิดใช้งานบรรทัดนี้) */}
      <Route path="/chat" element={<Chat />} />
    </Routes>
  );
}

export default App;