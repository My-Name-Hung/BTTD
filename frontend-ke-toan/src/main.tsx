import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './shared/styles/global.css';
import './shared/styles/layout.css';
import './shared/styles/shared.css';
import './shared/styles/notifications.css';
import './shared/styles/login.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
