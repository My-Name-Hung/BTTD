import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { FiMenu, FiX, FiLogOut, FiBell } from 'react-icons/fi';
import {
  MdDashboard,
  MdLocalShipping,
  MdAssessment,
  MdMoneyOff,
  MdWarning,
  MdReceipt,
} from 'react-icons/md';
import { HiTrendingUp } from 'react-icons/hi';

const LOGO_URL = 'https://betongtaydo.com/wp-content/uploads/2024/06/Logo-Be-Tong-Tay-Do-xanh-duong-1024x1024.png';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Tổng quan', icon: <MdDashboard /> },
  { path: '/don-hang-dang-xu-ly', label: 'Đơn đang xử lý', icon: <MdLocalShipping /> },
  { path: '/giao-hang', label: 'Trạng thái giao hàng', icon: <MdLocalShipping /> },
  { path: '/doanh-thu', label: 'Doanh thu', icon: <MdAssessment /> },
  { path: '/cong-no', label: 'Công nợ', icon: <MdMoneyOff /> },
  { path: '/canh-bao', label: 'Cảnh báo', icon: <MdWarning /> },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('bttd_token');
    if (!token) navigate('/login');
  }, [navigate]);

  const formatDate = () => {
    return new Date().toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="app-layout">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <img src={LOGO_URL} alt="Bê Tông Tây Đô" />
          <div>
            <div className="sidebar-logo-text">Bê Tông Tây Đô</div>
            <div className="sidebar-logo-sub">Dashboard Lãnh đạo</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu</div>
          {navItems.map((item) => (
            <div
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'nav-item-active' : ''}`}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.hoTen?.charAt(0) || 'L'}</div>
            <div>
              <div className="user-name">{user?.hoTen || 'Lãnh đạo'}</div>
              <div className="user-role">Lãnh đạo</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm sidebarLogoutBtn" onClick={logout}>
            <FiLogOut /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <header className="header">
          <div className="headerLeft">
            <button className="header-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <FiX /> : <FiMenu />}
            </button>
            <h1 className="header-title">
              {navItems.find(n => n.path === location.pathname)?.label || 'Dashboard Lãnh đạo'}
            </h1>
          </div>
          <div className="header-actions">
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {formatDate()}
            </span>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
