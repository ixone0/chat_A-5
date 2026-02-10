import React from 'react';
import { Routes, Route } from 'react-router-dom'; 

import Login from './pages/Login'; 
import Chat from './pages/Chat'; 
import Register from './pages/Register'; 
import Profile from "./pages/Profile";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} /> 
      <Route path="/chat" element={<Chat />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}

export default App;