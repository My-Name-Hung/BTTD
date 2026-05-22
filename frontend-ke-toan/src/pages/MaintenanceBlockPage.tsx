import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import styles from './MaintenanceBlockPage.module.css';

interface Props {
  noiDung: string | null;
  thoiGianKetThuc: string | null;
}

export default function MaintenanceBlockPage({ noiDung, thoiGianKetThuc }: Props) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('bttd_token');
    localStorage.removeItem('bttd_user');
    navigate('/login');
  };

  const formattedEnd = thoiGianKetThuc
    ? new Date(thoiGianKetThuc).toLocaleString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" fill="#FFF3CD" />
            <path
              d="M32 18v16M32 38v4"
              stroke="#856404"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className={styles.title}>Hệ thống đang được bảo trì</h1>

        {noiDung && <p className={styles.message}>{noiDung}</p>}

        {formattedEnd && (
          <p className={styles.time}>
            Dự kiến hoàn thành: <strong>{formattedEnd}</strong>
          </p>
        )}

        <p className={styles.note}>
          Vui lòng quay lại sau. Cảm ơn quý khách đã kiên nhẫn.
        </p>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <FiLogOut size={16} />
          Đăng xuất
        </button>
      </div>

      <div className={styles.logo}>
        <img
          src="https://betongtaydo.com/wp-content/uploads/2024/06/Logo-Be-Tong-Tay-Do-xanh-duong-1024x1024.png"
          alt="Bê Tông Tây Đô"
          className={styles.logoImg}
        />
        <span className={styles.logoName}>Bê Tông Tây Đô</span>
      </div>
    </div>
  );
}
