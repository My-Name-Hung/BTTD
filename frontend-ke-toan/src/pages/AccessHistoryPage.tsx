import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiLogOut, FiKey, FiEye, FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
import { LiaBanSolid } from "react-icons/lia";
import {
  layLichSuTruyCap,
  layChiTietAccessSession,
  layDanhSachNguoiDungAccess,
  batBuocDangXuatSession,
  resetMatKhauUser,
  capNhatBannedIp,
} from '../services/api';
import { AccessSession, AccessSessionDetail } from '../types';
import { useToast } from '../hooks';
import { Loading, EmptyState, ConfirmModal } from '../components/Common';
import styles from './AccessHistoryPage.module.css';

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const THAO_TAC_LABELS: Record<string, string> = {
  dang_nhap: 'Đăng nhập',
  dang_xuat: 'Đăng xuất',
};

const HANH_DONG_LABELS: Record<string, string> = {
  TAO: 'Tạo mới',
  SUA: 'Sửa',
  XOA: 'Xóa',
  DUYET: 'Duyệt',
  TU_CHOI: 'Từ chối',
  DANG_NHAP: 'Đăng nhập',
  DANG_XUAT: 'Đăng xuất',
};

export default function AccessHistoryPage() {
  const { toasts, showToast } = useToast();

  const [sessions, setSessions] = useState<AccessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [userFilter, setUserFilter] = useState('');
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [userList, setUserList] = useState<{ id: number; hoTen: string; vaiTro: string }[]>([]);

  const [detailSession, setDetailSession] = useState<AccessSessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [resetPwTarget, setResetPwTarget] = useState<AccessSession | null>(null);
  const [resetPwInput, setResetPwInput] = useState('');
  const [resetPwLoading, setResetPwLoading] = useState(false);

  const [banIpTarget, setBanIpTarget] = useState<AccessSession | null>(null);
  const [banIpInput, setBanIpInput] = useState('');
  const [banIpLoading, setBanIpLoading] = useState(false);

  const [forceLogoutTarget, setForceLogoutTarget] = useState<AccessSession | null>(null);
  const [forceLogoutLoading, setForceLogoutLoading] = useState(false);

  const LIMIT = 20;

  const loadUsers = useCallback(async () => {
    try {
      const data = await layDanhSachNguoiDungAccess();
      setUserList(data);
    } catch { /* ignore */ }
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layLichSuTruyCap({
        page,
        limit: LIMIT,
        idNguoiDung: userFilter ? parseInt(userFilter, 10) : undefined,
        tuNgay: tuNgay || undefined,
        denNgay: denNgay || undefined,
      });
      setSessions(Array.isArray(res.data) ? (res.data as unknown as AccessSession[]) : []);
      setTotal(res.pagination?.total ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch {
      showToast('Lỗi tải dữ liệu', 'error');
    } finally { setLoading(false); }
  }, [page, userFilter, tuNgay, denNgay, showToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleOpenDetail = async (s: AccessSession) => {
    setLoadingDetail(true);
    setDetailSession(null);
    try {
      const data = await layChiTietAccessSession(s.id);
      setDetailSession(data);
    } catch {
      showToast('Lỗi tải chi tiết', 'error');
    } finally { setLoadingDetail(false); }
  };

  const handleForceLogout = async () => {
    if (!forceLogoutTarget) return;
    setForceLogoutLoading(true);
    try {
      await batBuocDangXuatSession(forceLogoutTarget.id);
      showToast('Đã buộc đăng xuất');
      setForceLogoutTarget(null);
      loadSessions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally { setForceLogoutLoading(false); }
  };

  const handleResetPw = async () => {
    if (!resetPwTarget || resetPwInput.length < 6) {
      showToast('Mật khẩu phải từ 6 ký tự', 'error');
      return;
    }
    setResetPwLoading(true);
    try {
      await resetMatKhauUser(resetPwTarget.idNguoiDung, resetPwInput);
      showToast(`Đã đổi mật khẩu cho ${resetPwTarget.hoTen}`);
      setResetPwTarget(null);
      setResetPwInput('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally { setResetPwLoading(false); }
  };

  const handleBanIp = async (ban: boolean) => {
    if (!banIpTarget) return;
    setBanIpLoading(true);
    try {
      if (ban && banIpInput) {
        await capNhatBannedIp(banIpTarget.idNguoiDung, banIpInput.trim());
        showToast(`Đã cấm IP "${banIpInput}" cho ${banIpTarget.hoTen}`);
      } else {
        await capNhatBannedIp(banIpTarget.idNguoiDung, null);
        showToast(`Đã bỏ cấm IP cho ${banIpTarget.hoTen}`);
      }
      setBanIpTarget(null);
      setBanIpInput('');
      loadSessions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally { setBanIpLoading(false); }
  };

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderTitle}>Lịch sử truy cập</div>
        <div className={styles.pageHeaderDesc}>Quản lý đăng nhập, đăng xuất và thao tác của người dùng</div>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <select
            className={`${styles.filterSelect}`}
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tất cả người dùng</option>
            {userList.map((u) => (
              <option key={u.id} value={u.id}>{u.hoTen} [{u.vaiTro}]</option>
            ))}
          </select>
        </div>
        <input type="date" className={styles.dateInput} value={tuNgay}
          onChange={(e) => { setTuNgay(e.target.value); setPage(1); }} />
        <span className={styles.dateSep}>—</span>
        <input type="date" className={styles.dateInput} value={denNgay}
          onChange={(e) => { setDenNgay(e.target.value); setPage(1); }} />
        {(userFilter || tuNgay || denNgay) && (
          <button className={styles.clearBtn}
            onClick={() => { setUserFilter(''); setTuNgay(''); setDenNgay(''); setPage(1); }}>
            <FiX size={13} /> Xóa lọc
          </button>
        )}
      </div>

      {/* Table */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          {loading ? <Loading /> : sessions.length === 0 ? (
            <EmptyState icon="🔐" text="Không có lịch sử truy cập" />
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>IP</th>
                    <th>Thao tác</th>
                    <th>Thời gian đăng nhập</th>
                    <th>Thời gian kết thúc</th>
                    <th className={styles.thCenter}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(sessions) ? sessions : []).map((s) => (
                    <tr key={s.id} className={styles.row}>
                      <td className={styles.userCell}>
                        <div className={styles.userName}>{s.hoTen}</div>
                        <div className={styles.userRole}>{s.vaiTro}</div>
                      </td>
                      <td className={styles.ipCell}>{s.ipAddress || '—'}</td>
                      <td className={styles.thaoTacCell}>
                        <span className={`${styles.badge} ${s.thaoTac === 'dang_nhap' ? styles.badgeLogin : styles.badgeLogout}`}>
                          {THAO_TAC_LABELS[s.thaoTac] || s.thaoTac}
                        </span>
                      </td>
                      <td className={styles.dateCell}>{formatDate(s.ngayTao)}</td>
                      <td className={styles.dateCell}>{s.ngayKetThuc ? formatDate(s.ngayKetThuc) : '—'}</td>
                      <td className={styles.thCenter}>
                        <div className={styles.actionBtns}>
                          <button className={styles.btnView} onClick={() => handleOpenDetail(s)} title="Xem chi tiết">
                            <FiEye size={14} />
                          </button>
                          {s.thaoTac === 'dang_nhap' && (
                            <button className={styles.btnLogout} onClick={() => setForceLogoutTarget(s)} title="Buộc đăng xuất">
                              <FiLogOut size={14} />
                            </button>
                          )}
                          <button className={styles.btnKey} onClick={() => { setResetPwTarget(s); setResetPwInput(''); }} title="Đổi mật khẩu">
                            <FiKey size={14} />
                          </button>
                          <button className={styles.btnBan} onClick={() => { setBanIpTarget(s); setBanIpInput(s.ipAddress || ''); }} title="Cấm IP">
                            <LiaBanSolid size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <FiChevronLeft size={16} />
                  </button>
                  <span className={styles.pageInfo}>Trang {page} / {totalPages} — {total} phiên</span>
                  <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <FiChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detailSession !== null && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setDetailSession(null); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>Chi tiết phiên — {detailSession.session.hoTen}</span>
              <button className={styles.modalClose} onClick={() => setDetailSession(null)}><FiX size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              {/* Session info */}
              <div className={styles.sessionInfo}>
                <div className={styles.sessionInfoItem}><span className={styles.sessionInfoLabel}>IP</span><span>{detailSession.session.ipAddress || '—'}</span></div>
                <div className={styles.sessionInfoItem}><span className={styles.sessionInfoLabel}>User-Agent</span><span className={styles.sessionInfoWrap}>{detailSession.session.userAgent || '—'}</span></div>
                <div className={styles.sessionInfoItem}><span className={styles.sessionInfoLabel}>Đăng nhập</span><span>{formatDate(detailSession.session.ngayTao)}</span></div>
                <div className={styles.sessionInfoItem}><span className={styles.sessionInfoLabel}>Kết thúc</span><span>{detailSession.session.ngayKetThuc ? formatDate(detailSession.session.ngayKetThuc) : 'Đang hoạt động'}</span></div>
              </div>

              {/* Action buttons */}
              <div className={styles.sessionActions}>
                {detailSession.session.thaoTac === 'dang_nhap' && (
                  <button className={`btn btn-danger ${styles.btnSm}`} onClick={() => { setForceLogoutTarget(detailSession!.session); setDetailSession(null); }}>
                    <FiLogOut size={14} /> Buộc đăng xuất
                  </button>
                )}
                <button className={`btn btn-primary ${styles.btnSm}`} onClick={() => { setResetPwTarget(detailSession!.session); setResetPwInput(''); setDetailSession(null); }}>
                  <FiKey size={14} /> Đổi mật khẩu
                </button>
                <button className={`btn ${styles.btnSm} ${styles.btnBanModal}`} onClick={() => { setBanIpTarget(detailSession!.session); setBanIpInput(detailSession!.session.ipAddress || ''); setDetailSession(null); }}>
                  <LiaBanSolid size={14} /> Cấm IP
                </button>
              </div>

              {/* Logs */}
              <div className={styles.logsSection}>
                <div className={styles.logsSectionTitle}>Nhật ký thao tác ({detailSession.logs.length})</div>
                {loadingDetail ? <Loading /> : detailSession.logs.length === 0 ? (
                  <div className={styles.logsEmpty}>Chưa có thao tác nào</div>
                ) : (
                  <div className={styles.logsList}>
                    {detailSession.logs.map((log) => (
                      <div key={log.id} className={styles.logItem}>
                        <div className={styles.logHeader}>
                          <span className={styles.logAction}>{HANH_DONG_LABELS[log.hanhDong] || log.hanhDong}</span>
                          {log.bangDuocTacDong && <span className={styles.logTable}>trên {log.bangDuocTacDong}</span>}
                          <span className={styles.logTime}>{formatDate(log.thoiGian)}</span>
                        </div>
                        {log.noiDungMoi && <div className={styles.logDetail}>Mới: {log.noiDungMoi}</div>}
                        {log.noiDungCu && <div className={styles.logDetail}>Cũ: {log.noiDungCu}</div>}
                        {log.ipAddress && <div className={styles.logDetail}>IP: {log.ipAddress}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Force logout confirm */}
      <ConfirmModal
        isOpen={!!forceLogoutTarget}
        title="Buộc đăng xuất"
        message={`Buộc "${forceLogoutTarget?.hoTen}" đăng xuất khỏi phiên này?`}
        confirmText="Đăng xuất"
        cancelText="Hủy"
        onConfirm={handleForceLogout}
        onClose={() => setForceLogoutTarget(null)}
        loading={forceLogoutLoading}
      />

      {/* Reset password modal */}
      {resetPwTarget && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setResetPwTarget(null); }}>
          <div className={styles.modal} style={{ maxWidth: 400 }}>
            <div className={styles.modalHeader}>
              <span>Đổi mật khẩu — {resetPwTarget.hoTen}</span>
              <button className={styles.modalClose} onClick={() => setResetPwTarget(null)}><FiX size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Mật khẩu mới</label>
                <input className={styles.formInput} type="text" value={resetPwInput}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  onChange={(e) => setResetPwInput(e.target.value)} />
              </div>
              <p className={styles.formHint}>Sau khi đổi, user sẽ phải dùng mật khẩu mới để đăng nhập.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => setResetPwTarget(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleResetPw} disabled={resetPwLoading || resetPwInput.length < 6}>
                {resetPwLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban IP modal */}
      {banIpTarget && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setBanIpTarget(null); }}>
          <div className={styles.modal} style={{ maxWidth: 400 }}>
            <div className={styles.modalHeader}>
              <span>Cấm IP — {banIpTarget.hoTen}</span>
              <button className={styles.modalClose} onClick={() => setBanIpTarget(null)}><FiX size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Địa chỉ IP cấm</label>
                <input className={styles.formInput} type="text" value={banIpInput}
                  placeholder="VD: 192.168.1.1"
                  onChange={(e) => setBanIpInput(e.target.value)} />
              </div>
              <p className={styles.formHint}>Để trống để bỏ cấm tất cả IP.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => setBanIpTarget(null)}>Hủy</button>
              <button className="btn btn-danger" onClick={() => handleBanIp(true)} disabled={banIpLoading}>
                {banIpLoading ? 'Đang xử lý...' : 'Cấm IP'}
              </button>
              <button className="btn btn-primary" onClick={() => handleBanIp(false)} disabled={banIpLoading}>
                {banIpLoading ? '...' : 'Bỏ cấm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
