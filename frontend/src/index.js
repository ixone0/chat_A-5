import React from 'react';
import ReactDOM from 'react-dom/client';
// แก้จุดที่ 1: ลบ .jsx ออก (ให้ระบบหาเองไม่ว่าจะเป็น .js หรือ .jsx)
import App from './App'; 
import './index.css';
import { HashRouter } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);