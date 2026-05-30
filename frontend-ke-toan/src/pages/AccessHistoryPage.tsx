import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiLogOut, FiKey, FiEye, FiChevronLeft, FiChevronRight, FiShieldOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import {
  layLichSuTruyCap,
  layDanhSachNguoiDungAccess,
  batBuocDangXuatSession,
  capNhatBannedIp,
} from '../services/api';
import { AccessSession } from '../types';
import { useToast } from '../hooks';
import { EmptyState } from '../components/Common';
import styles from './AccessHistoryPage.module.css';

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

const THAO_TAC_LABELS: Record<string, string> = {
  dang_nhap: 'Đăng nhập',
  dang_xuat: 'Đăng xuất',
};

export default function AccessHistoryPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<AccessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [userFilter, setUserFilter] = useState('');
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [userList, setUserList] = useState<{ id: number; hoTen: string; vaiTro: string }[]>([]);

  const [banIpTarget, setBanIpTarget] = useState<AccessSession | null>(null);
  const [banIpInput, setBanIpInput] = useState('');
  const [banIpLoading, setBanIpLoading] = useState(false);
  const [banLoadingId, setBanLoadingId] = useState<number | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<number | null>(null);

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
        page, limit: LIMIT,
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

  const handleForceLogout = async (s: AccessSession) => {
    setLoadingSessionId(s.id);
    try {
      await batBuocDangXuatSession(s.id);
      showToast(`Đã buộc "${s.hoTen}" đăng xuất`);
      loadSessions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally { setLoadingSessionId(null); }
  };

  const handleBanIp = async () => {
    if (!banIpTarget || !banIpInput.trim()) {
      showToast('Vui lòng nhập địa chỉ IP', 'error');
      return;
    }
    setBanIpLoading(true);
    try {
      await capNhatBannedIp(banIpTarget.idNguoiDung, banIpInput.trim());
      showToast(`Đã cấm IP "${banIpInput}" và buộc "${banIpTarget.hoTen}" đăng xuất`);
      setBanIpTarget(null);
      setBanIpInput('');
      loadSessions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally { setBanIpLoading(false); setBanLoadingId(null); }
  };

  const openBanIp = (s: AccessSession) => {
    setBanLoadingId(s.id);
    setBanIpTarget(s);
    setBanIpInput(s.ipAddress || '');
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
        <select
          className={styles.filterSelect}
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tất cả người dùng</option>
          {userList.map((u) => (
            <option key={u.id} value={u.id}>{u.hoTen} [{u.vaiTro}]</option>
          ))}
        </select>
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
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <span className={styles.spinner} style={{ width: 24, height: 24, borderWidth: 3 }} />
            </div>
          ) : sessions.length === 0 ? (
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
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className={styles.userCell}>
                        <div className={styles.userName}>{s.hoTen}</div>
                        <div className={styles.userRole}>{s.vaiTro}</div>
                      </td>
                      <td className={styles.ipCell}>{s.ipAddress || '—'}</td>
                      <td>
                        <span className={`${styles.badge} ${s.thaoTac === 'dang_nhap' ? styles.badgeLogin : styles.badgeLogout}`}>
                          {THAO_TAC_LABELS[s.thaoTac] || s.thaoTac}
                        </span>
                      </td>
                      <td className={styles.dateCell}>{formatDate(s.ngayTao)}</td>
                      <td className={styles.dateCell}>{s.ngayKetThuc ? formatDate(s.ngayKetThuc) : '—'}</td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button
                            className={styles.btnView}
                            onClick={() => navigate(`/lich-su-truy-cap/${s.id}`)}
                            title="Xem chi tiết"
                          >
                            <FiEye size={14} />
                          </button>
                          {s.thaoTac === 'dang_nhap' && (
                            <button
                              className={styles.btnLogout}
                              onClick={() => handleForceLogout(s)}
                              disabled={loadingSessionId === s.id}
                              title="Buộc đăng xuất"
                            >
                              {loadingSessionId === s.id ? (
                                <span className={styles.spinner} />
                              ) : (
                                <FiLogOut size={14} />
                              )}
                            </button>
                          )}
                          <button
                            className={styles.btnKey}
                            onClick={() => navigate(`/lich-su-truy-cap/${s.id}?action=reset-pw`)}
                            title="Đổi mật khẩu"
                          >
                            <FiKey size={14} />
                          </button>
                          <button
                            className={styles.btnBan}
                            onClick={() => openBanIp(s)}
                            title="Cấm IP"
                          >
                            {banLoadingId === s.id ? (
                              <span className={styles.spinner} />
                            ) : (
                              <FiShieldOff size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button className={styles.pageBtn}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}>
                    <FiChevronLeft size={16} />
                  </button>
                  <span className={styles.pageInfo}>Trang {page} / {totalPages} — {total} phiên</span>
                  <button className={styles.pageBtn}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}>
                    <FiChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Ban IP Modal */}
      {banIpTarget && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) { setBanIpTarget(null); setBanIpInput(''); } }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>Cấm IP — {banIpTarget.hoTen}</span>
              <button className={styles.modalClose} onClick={() => { setBanIpTarget(null); setBanIpInput(''); }}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalText}>
                IP hiện tại: <code>{banIpTarget.ipAddress || '—'}</code>
              </p>
              <p className={styles.modalText}>User sẽ bị buộc đăng xuất và không thể đăng nhập lại từ IP bị cấm.</p>
              <div className={styles.formGroup}>
                <label>Địa chỉ IP cấm</label>
                <input className={styles.formInput} type="text" value={banIpInput}
                  placeholder="VD: 192.168.1.1"
                  onChange={(e) => setBanIpInput(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => { setBanIpTarget(null); setBanIpInput(''); }}>Hủy</button>
              <button className="btn btn-danger" onClick={handleBanIp} disabled={banIpLoading || !banIpInput.trim()}>
                {banIpLoading ? 'Đang xử lý...' : 'Cấm IP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
