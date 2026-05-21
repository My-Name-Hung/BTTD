import React, { useState } from "react";
import { FiLock, FiUser } from "react-icons/fi";
import { PiEyeSlashThin, PiEyeThin } from "react-icons/pi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks";
import { dangNhap } from "../services/api";
import styles from "./LoginPage.module.css";

const LOGO_URL =
  "https://betongtaydo.com/wp-content/uploads/2024/06/Logo-Be-Tong-Tay-Do-xanh-duong-1024x1024.png";

  const REMEMBER_PASSWORD_KEY = "bttd_remember";
const SAVED_USERNAME_KEY = "bttd_saved_user";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [username, setUsername] = useState(() => {
    return localStorage.getItem(SAVED_USERNAME_KEY) || "";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(
    localStorage.getItem(REMEMBER_PASSWORD_KEY) === "true",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await dangNhap(username, password);
      setUser(result.user);
      if (rememberPassword) {
        localStorage.setItem(REMEMBER_PASSWORD_KEY, "true");
        localStorage.setItem(SAVED_USERNAME_KEY, username);
      } else {
        localStorage.removeItem(REMEMBER_PASSWORD_KEY);
        localStorage.removeItem(SAVED_USERNAME_KEY);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Tài khoản hoặc mật khẩu không đúng, hãy thử lại.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authWrapper}>
      {/* Left panel */}
      <div className={styles.authIllustration}>
        <div className={styles.illustrationContent}>
          <img
            src={LOGO_URL}
            alt="Bê Tông Tây Đô"
            className={styles.illustrationLogo}
          />
          <h1>QUẢN LÝ ĐƠN HÀNG</h1>
          <p className={styles.introText}>
            Bê Tông Tây Đô - Chất lượng tạo niềm tin
          </p>
          <ul className={styles.illustrationContact}>
            <li>SĐT: 0292 651 8375</li>
            <li>MST: 1801286137</li>
            <li>Địa chỉ: Km14, QL91, P.Phước Thới, TP.Cần Thơ</li>
          </ul>
          <div className={styles.illustrationFooter}>
            ĐƯỢC THỰC HIỆN BỞI ĐỘI NGŨ IT GROUP XMTĐ
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <img
              src={LOGO_URL}
              alt="Bê Tông Tây Đô"
              className={styles.loginLogo}
            />
            <h1 className={styles.loginTitle}>Đăng nhập hệ thống</h1>
            <p className={styles.loginSubtitle}>
              Vui lòng sử dụng tài khoản được cấp để truy cập.
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            {error && <div className={styles.errorMessage}>{error}</div>}

            <div className={styles.loginFormGroup}>
              <label className={styles.loginLabel} htmlFor="username">
                Tên đăng nhập
              </label>
              <div className={styles.inputWithIcon}>
                <FiUser className={styles.inputIcon} />
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

            <div className={styles.loginFormGroup}>
              <label className={styles.loginLabel} htmlFor="password">
                Mật khẩu
              </label>
              <div className={styles.inputWithIcon}>
                <FiLock className={styles.inputIcon} />
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
                  className={styles.eyeButton}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"
                  }
                >
                  {showPassword ? <PiEyeSlashThin /> : <PiEyeThin />}
                </button>
              </div>
            </div>

            <div className={styles.loginFormGroup}>
              <label className={styles.rememberCheckbox}>
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
              className={styles.submitBtn}
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <div className={styles.loginVersion}>Phiên bản 1.0.0</div>
        </div>
      </div>
    </div>
  );
}
