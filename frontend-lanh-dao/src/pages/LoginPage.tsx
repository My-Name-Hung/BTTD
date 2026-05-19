import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiEyeSlashThin, PiEyeThin } from 'react-icons/pi';
import { FiUser, FiLock } from 'react-icons/fi';
import { dangNhap } from '../services/api';
import '../styles/login.css';

const LOGO_URL =
  "https://betongtaydo.com/wp-content/uploads/2024/06/Logo-Be-Tong-Tay-Do-xanh-duong-1024x1024.png";

const REMEMBER_PASSWORD_KEY = 'bttd_remember';
const SAVED_USERNAME_KEY = 'bttd_saved_user';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => {
    return localStorage.getItem(SAVED_USERNAME_KEY) || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(
    localStorage.getItem(REMEMBER_PASSWORD_KEY) === 'true'
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await dangNhap(username, password);
      if (rememberPassword) {
        localStorage.setItem(REMEMBER_PASSWORD_KEY, 'true');
        localStorage.setItem(SAVED_USERNAME_KEY, username);
      } else {
        localStorage.removeItem(REMEMBER_PASSWORD_KEY);
        localStorage.removeItem(SAVED_USERNAME_KEY);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tài khoản hoặc mật khẩu không đúng, hãy thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      {/* Left panel */}
      <div className="auth-illustration">
        <div className="illustration-content">
          <img
            src={LOGO_URL}
            alt="Bê Tông Tây Đô"
            className="illustration-logo"
          />
          <h1>DASHBOARD LÃNH ĐẠO</h1>
          <p className="intro-text">Bê Tông Tây Đô - Chất lượng tạo niềm tin</p>
          <ul>
            <li>SĐT: 0292 651 8375</li>
            <li>MST: 1801286137</li>
            <li>Địa chỉ: Km14, QL91, P.Phước Thới, TP.Cần Thơ</li>
          </ul>
          <div className="illustration-footer">
            ĐƯỢC THỰC HIỆN BỞI ĐỘI NGŨ IT XMTĐ
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src={LOGO_URL} alt="Bê Tông Tây Đô" className="login-logo" />
            <h1>Đăng nhập hệ thống</h1>
            <p className="login-subtitle">
              Vui lòng sử dụng tài khoản được cấp để truy cập.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="username">Tên đăng nhập</label>
              <div className="input-with-icon">
                <FiUser className="input-icon" />
                <input
                  type="text"
                  id="username"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Mật khẩu</label>
              <div className="input-with-icon">
                <FiLock className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"
                  }
                >
                  {showPassword ? <PiEyeSlashThin /> : <PiEyeThin />}
                </button>
              </div>
            </div>

            <div className="form-group remember-password">
              <label className="remember-checkbox">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary-login"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <div className="login-version">Phiên bản 1.0.0</div>
        </div>
      </div>
    </div>
  );
}
