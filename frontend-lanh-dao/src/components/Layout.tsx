import React, { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { FiMenu, FiX, FiLogOut } from 'react-icons/fi';
import { MdDashboard } from 'react-icons/md';

const LOGO_URL = 'https://betongtaydo.com/wp-content/uploads/2024/06/Logo-Be-Tong-Tay-Do-xanh-duong-1024x1024.png';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('bttd_token');
    if (!token) navigate('/login');
  }, [navigate]);

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <img src={LOGO_URL} alt="Bê Tông Tây Đô" />
          <div>
            <div className="sidebar-logo-text">Bê Tông Tây Đô</div>
            <div className="sidebar-logo-sub">Dashboard Lãnh đạo</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-title">Dashboard</div>
          <div className={`nav-item ${location.pathname === '/dashboard' ? 'nav-item-active' : ''}`} onClick={() => { navigate('/dashboard'); setSidebarOpen(false); }}>
            <span className="nav-icon"><MdDashboard /></span>
            <span>Tổng quan</span>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.hoTen?.charAt(0)}</div>
            <div>
              <div className="user-name">{user?.hoTen}</div>
              <div className="user-role">Lãnh đạo</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm sidebarLogoutBtn" onClick={logout}>
            <FiLogOut /> Đăng xuất
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="header">
          <div className="headerLeft">
            <button className="header-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <FiX /> : <FiMenu />}
            </button>
            <h1 className="header-title">Dashboard Lãnh đạo</h1>
          </div>
          <div className="headerDate">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
