import React from 'react';
import { Routes, Route } from 'react-router-dom'; 

import Login from './pages/Login'; 
import Chat from './pages/Chat'; 
import Register from './pages/Register'; // <--- 1. Import เข้ามา

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} /> 
      <Route path="/chat" element={<Chat />} />
    </Routes>
  );
}

export default App;