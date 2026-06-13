import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiLogOut, FiKey, FiDownload } from 'react-icons/fi';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  layChiTietAccessSession,
  resetMatKhauUser,
  batBuocDangXuatSession,
} from '../../../shared/services/api';
import { AccessSessionDetail } from '../../../shared/types';
import { useToast } from '../../../shared/hooks';
import { Loading } from '../../../shared/components/Common';
import styles from './AccessHistoryDetailPage.module.css';
import { formatDateVN } from '../../../shared/utils/dateUtils';

function formatDate(d: Date | string | null | undefined): string {
  return d ? formatDateVN(d) : '';
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
  const [successMsg, setSuccessMsg] = useState('');

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
      setSuccessMsg(`Đã buộc "${detail.session.hoTen}" đăng xuất thành công`);
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
      setSuccessMsg(`Đã đổi mật khẩu cho "${detail.session.hoTen}" thành công`);
      setResetPwOpen(false);
      setResetPwInput('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally { setResetPwLoading(false); }
  };

  const handleExportJson = () => {
    if (!detail) return;
    const exportData = {
      thongTinPhien: {
        id: session.id,
        nguoiDung: session.hoTen,
        vaiTro: session.vaiTro,
        diaChiIP: session.ipAddress,
        userAgent: session.userAgent,
        ngayDangNhap: session.ngayTao,
        ngayKetThuc: session.ngayKetThuc,
        trangThai: session.thaoTac === 'dang_nhap' ? 'Đang hoạt động' : 'Đã kết thúc',
      },
      nhatKyThaoTac: logs.map(log => ({
        id: log.id,
        hanhDong: log.hanhDong,
        hanhDongLabel: HANH_DONG_LABELS[log.hanhDong] || log.hanhDong,
        bangTacDong: log.bangDuocTacDong,
        banGhiId: log.banGhiId,
        noiDungCu: log.noiDungCu,
        noiDungMoi: log.noiDungMoi,
        diaChiIP: log.ipAddress,
        thoiGian: log.thoiGian,
      })),
      xuatLuc: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lich-su-truy-cap-${session.id}-${session.hoTen?.replace(/\s+/g, '-') || 'user'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Đã xuất file JSON', 'success');
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

      {/* 2-column grid */}
      <div className={styles.grid}>
        {/* Col 1: Session Info */}
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
            <div className={`${styles.infoItem} ${styles.span2}`}>
              <span className={styles.infoLabel}>Địa chỉ IP</span>
              <span className={`${styles.infoValue} ${styles.mono}`}>{session.ipAddress || '—'}</span>
            </div>
            <div className={`${styles.infoItem} ${styles.span2}`}>
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
            <button className={`btn btn-secondary ${styles.actionBtn}`} onClick={handleExportJson}>
              <FiDownload size={16} /> Xuất JSON
            </button>
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

        {/* Col 2: Activity Logs */}
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

      {/* Success Modal */}
      {successMsg && (
        <div className={styles.modalOverlay} onClick={() => setSuccessMsg('')}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.successIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="#10b981"/>
                <path d="M14 24l7 7 13-14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.successTitle}>Thành công</div>
            <div className={styles.successMsg}>{successMsg}</div>
            <div className={styles.modalFooter}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setSuccessMsg('')}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
