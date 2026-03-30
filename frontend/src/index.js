import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; 
import './index.css';
import { HashRouter } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
);