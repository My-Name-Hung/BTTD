import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiLogOut, FiKey } from 'react-icons/fi';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  layChiTietAccessSession,
  resetMatKhauUser,
  batBuocDangXuatSession,
} from '../services/api';
import { AccessSessionDetail } from '../types';
import { useToast } from '../hooks';
import { Loading } from '../components/Common';
import styles from './AccessHistoryDetailPage.module.css';

function toVN(d: Date | string): Date {
  const s = typeof d === 'string' ? d : d.toISOString();
  // Backend SQL Server chạy múi giờ VN (UTC+7), không có Z.
  // Nếu có Z → strip đi rồi treat như giờ VN.
  // Đảm bảo luôn parse đúng giờ VN.
  const normalized = s.endsWith('Z') ? s.slice(0, -1) : s;
  return new Date(normalized + ' +07:00');
}

function formatDate(d: Date | string): string {
  return toVN(d).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
  });
}

const HANH_DONG_LABELS: Record<string, string> = {
  TAO: 'Tạo mới', SUA: 'Sửa', XOA: 'Xóa',
  DUYET: 'Duyệt', TU_CHOI: 'Từ chối',
  DANG_NHAP: 'Đăng nhập', DANG_XUAT: 'Đăng xuất',
};

export default function AccessHistoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [detail, setDetail] = useState<AccessSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [resetPwOpen, setResetPwOpen] = useState(searchParams.get('action') === 'reset-pw');
  const [resetPwInput, setResetPwInput] = useState('');
  const [resetPwLoading, setResetPwLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    layChiTietAccessSession(parseInt(id, 10))
      .then((data) => { setDetail(data); })
      .catch(() => showToast('Lỗi tải chi tiết', 'error'))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  const handleForceLogout = async () => {
    if (!detail) return;
    try {
      await batBuocDangXuatSession(detail.session.id);
      showToast('Đã buộc đăng xuất');
      navigate('/lich-su-truy-cap');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    }
  };

  const handleResetPw = async () => {
    if (!detail || resetPwInput.length < 6) {
      showToast('Mật khẩu phải từ 6 ký tự', 'error');
      return;
    }
    setResetPwLoading(true);
    try {
      await resetMatKhauUser(detail.session.idNguoiDung, resetPwInput);
      showToast(`Đã đổi mật khẩu cho ${detail.session.hoTen}`);
      setResetPwOpen(false);
      setResetPwInput('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally { setResetPwLoading(false); }
  };

  if (loading) return <Loading />;
  if (!detail) return (
    <div className={styles.empty}>
      <p>Không tìm thấy phiên</p>
      <button className="btn btn-secondary" onClick={() => navigate('/lich-su-truy-cap')}>
        <FiChevronLeft size={16} /> Quay về
      </button>
    </div>
  );

  const { session, logs } = detail;

  return (
    <div className={styles.page}>
      {/* Back + Title */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/lich-su-truy-cap')}>
          <FiChevronLeft size={18} />
        </button>
        <div>
          <div className={styles.title}>Chi tiết phiên truy cập</div>
          <div className={styles.subtitle}>{session.hoTen} [{session.vaiTro}]</div>
        </div>
      </div>

      {/* Session Info Card */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Thông tin phiên</div>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Người dùng</span>
            <span className={styles.infoValue}>{session.hoTen}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Vai trò</span>
            <span className={styles.infoValue}>{session.vaiTro}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Địa chỉ IP</span>
            <span className={`${styles.infoValue} ${styles.mono}`}>{session.ipAddress || '—'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>User-Agent</span>
            <span className={`${styles.infoValue} ${styles.mono} ${styles.wrap}`}>{session.userAgent || '—'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Đăng nhập lúc</span>
            <span className={styles.infoValue}>{formatDate(session.ngayTao)}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Kết thúc</span>
            <span className={styles.infoValue}>
              {session.ngayKetThuc ? formatDate(session.ngayKetThuc) : <span className={styles.online}>Đang hoạt động</span>}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          {session.thaoTac === 'dang_nhap' && (
            <button className={`btn btn-danger ${styles.actionBtn}`} onClick={handleForceLogout}>
              <FiLogOut size={16} /> Buộc đăng xuất
            </button>
          )}
          <button className={`btn btn-primary ${styles.actionBtn}`} onClick={() => setResetPwOpen(true)}>
            <FiKey size={16} /> Đổi mật khẩu
          </button>
        </div>
      </div>

      {/* Logs Card */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Nhật ký thao tác ({logs.length})</div>
        {logs.length === 0 ? (
          <div className={styles.emptyLogs}>Chưa có thao tác nào được ghi nhận.</div>
        ) : (
          <div className={styles.logsList}>
            {logs.map((log) => (
              <div key={log.id} className={styles.logItem}>
                <div className={styles.logHeader}>
                  <span className={styles.logAction}>{HANH_DONG_LABELS[log.hanhDong] || log.hanhDong}</span>
                  {log.bangDuocTacDong && <span className={styles.logTable}>trên {log.bangDuocTacDong}</span>}
                  <span className={styles.logTime}>{formatDate(log.thoiGian)}</span>
                </div>
                {log.noiDungMoi && <div className={styles.logDetail}><strong>Mới:</strong> {log.noiDungMoi}</div>}
                {log.noiDungCu && <div className={styles.logDetail}><strong>Cũ:</strong> {log.noiDungCu}</div>}
                {log.ipAddress && <div className={styles.logDetail}><strong>IP:</strong> {log.ipAddress}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetPwOpen && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setResetPwOpen(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>Đổi mật khẩu — {session.hoTen}</span>
              <button className={styles.modalClose} onClick={() => setResetPwOpen(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Mật khẩu mới (tối thiểu 6 ký tự)</label>
                <input
                  className={styles.formInput}
                  type="text"
                  value={resetPwInput}
                  placeholder="Nhập mật khẩu mới"
                  onChange={(e) => setResetPwInput(e.target.value)}
                />
              </div>
              <p className={styles.formHint}>User sẽ bị đăng xuất và phải dùng mật khẩu mới để đăng nhập.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => setResetPwOpen(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleResetPw} disabled={resetPwLoading || resetPwInput.length < 6}>
                {resetPwLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
