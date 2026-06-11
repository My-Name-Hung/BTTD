import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { NOTIFICATION_TYPE_ICONS } from "../../../types";

export interface PopupNotification {
  id: number;
  tieuDe: string;
  noiDung: string;
  loai: string;
  duongDan?: string;
  ngayTao?: string;
}

interface NotificationPopupProps {
  notification: PopupNotification;
  onClose: () => void;
  onViewDetails: () => void;
  onSkipAll?: () => void;
}

export function NotificationPopup({
  notification,
  onClose,
  onViewDetails,
  onSkipAll,
}: NotificationPopupProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const icon = NOTIFICATION_TYPE_ICONS[notification.loai] || '🔔';
  const timeAgo = formatTimeAgo(notification.ngayTao);

  const handleXemChiTiet = () => {
    onViewDetails();
    navigate('/thong-bao');
  };

  return (
    <div
      className="notif-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="notif-modal">
        {/* Header */}
        <div className="notif-modal__header">
          <div className="notif-modal__icon">{icon}</div>
          <div className="notif-modal__meta">
            <div className="notif-modal__label">Thông báo mới</div>
            <div className="notif-modal__time">{timeAgo}</div>
          </div>
          <button
            className="notif-modal__close"
            onClick={onSkipAll}
            aria-label="Bỏ qua tất cả thông báo"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="notif-modal__body">
          <h3 className="notif-modal__title" id="notif-modal-title">
            {notification.tieuDe}
          </h3>
          <p className="notif-modal__message">{notification.noiDung}</p>
        </div>

        {/* Footer */}
        <div className="notif-modal__footer">
          <button
            className="btn btn-cancel"
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            className="btn btn-primary"
            onClick={handleXemChiTiet}
          >
            Xem chi tiết
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'Vừa xong';
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
