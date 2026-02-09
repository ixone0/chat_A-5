import React from 'react';
// นำเข้าเครื่องมือเปลี่ยนหน้า (Routing)
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// นำเข้าไฟล์หน้าจอที่เราสร้างไว้
// หมายเหตุ: เช็ค path ให้ดีนะครับ ว่าไฟล์ Login.jsx อยู่ในโฟลเดอร์ pages จริงไหม
import Login from './pages/Login'; 
import Chat from './pages/Chat';   

function App() {
  return (
    // กำหนดขอบเขตว่า App นี้มีระบบ Routing
    <BrowserRouter>
      <Routes>
        {/* Route 1: หน้าแรก (path "/") ให้ไปเรียก Login Component */}
        <Route path="/" element={<Login />} />
        
        {/* Route 2: หน้าแชท (path "/chat") ให้ไปเรียก Chat Component */}
        <Route path="/chat" element={<Chat />} />

        {/* Route 3: ถ้าพิมพ์ URL มั่ว ให้เด้งกลับมาหน้าแรก */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;