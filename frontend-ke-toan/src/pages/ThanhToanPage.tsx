import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiX, FiSearch, FiFileText } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { layDanhSachDonHang, layLichSuThanhToan } from '../services/api';
import { DonHang, ThanhToan, TRANG_THAI_DON_LABELS } from '../types';
import { useToast, usePagination, usePageRole } from '../hooks';
import { Loading, EmptyState, Pagination } from '../components/Common';
import styles from './ThanhToanPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

export default function ThanhToanPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);
  const navigate = useNavigate();
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [thanhToans, setThanhToans] = useState<Record<number, ThanhToan[]>>({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');

  const canCreate = hasPermission('thanhtoan.create');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dhRes = await layDanhSachDonHang(page, 20, undefined, tuKhoa || undefined);
      const dhs = (dhRes.data || []).filter((dh: DonHang) =>
        ['nghiem_thu', 'da_thanh_toan', 'da_giao'].includes(dh.trangThaiDon)
      );
      setDonHangs(dhs);
      const histories = await Promise.all(dhs.map((dh: DonHang) => layLichSuThanhToan(dh.id)));
      const map: Record<number, ThanhToan[]> = {};
      dhs.forEach((dh: DonHang, i: number) => { map[dh.id] = histories[i] || []; });
      setThanhToans(map);
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [page, tuKhoa, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleXuatHoaDon = (dh: DonHang) => {
    navigate(`/thanh-toan/xuat/${dh.id}`);
  };

  const tongCongNo = donHangs.reduce((sum, dh) => sum + Math.max(0, (dh.thanhTien || 0) - (dh.daThanhToan || 0)), 0);
  const tongDaTT = donHangs.reduce((sum, dh) => sum + (dh.daThanhToan || 0), 0);
  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(donHangs.length / LIMIT));

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Thanh toán</div>
          <div className={styles.pageHeaderDesc}>Ghi nhận thanh toán và theo dõi công nợ</div>
        </div>
      </div>

      <div className={styles.kpiGrid} style={{ marginBottom: 20 }}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng công nợ</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>{formatCurrency(tongCongNo)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Đã thanh toán</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{formatCurrency(tongDaTT)}</div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterBarLeft}>
          <div className={styles.filterSearch}>
            <FiSearch className={styles.filterSearchIcon} />
            <input
              className={styles.filterSearchInput}
              placeholder="Tìm đơn hàng..."
              value={tuKhoa}
              onChange={(e) => { setTuKhoa(e.target.value); resetPage(); }}
            />
          </div>
          {tuKhoa && (
            <button className={styles.filterClearBtn} onClick={() => { setTuKhoa(''); resetPage(); }}>
              <FiX size={13} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          {loading ? <Loading /> : donHangs.length === 0 ? (
            <EmptyState icon="💰" text="Không có dữ liệu" />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ minWidth: 90 }}>Mã đơn</th>
                  <th style={{ minWidth: 110 }}>Khách hàng</th>
                  <th className={styles.hideOnMobile} style={{ minWidth: 100, textAlign: 'right' }}>Tổng tiền</th>
                  <th className={styles.hideOnMobile} style={{ minWidth: 90, textAlign: 'right' }}>Đã Thanh Toán</th>
                  <th style={{ minWidth: 80 }}>Còn lại</th>
                  <th className={styles.hideOnMobile} style={{ minWidth: 90 }}>Trạng thái</th>
                  <th style={{ minWidth: 90 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {donHangs.map((dh) => {
                  const conLai = Math.max(0, (dh.thanhTien || 0) - (dh.daThanhToan || 0));
                  return (
                    <tr key={dh.id}>
                      <td>
                        <span className={styles.tableCode}>{dh.maDonHang}</span>
                      </td>
                      <td>
                        <div className={styles.tableName}>{dh.tenKhachHang}</div>
                      </td>
                      <td className={`${styles.tableRight} ${styles.hideOnMobile}`}>
                        <strong>{formatCurrency(dh.thanhTien || 0)}</strong>
                      </td>
                      <td className={`${styles.tableRight} ${styles.hideOnMobile}`} style={{ color: 'var(--color-success)' }}>
                        {formatCurrency(dh.daThanhToan || 0)}
                      </td>
                      <td>
                        <span style={{ color: conLai > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 700 }}>
                          {formatCurrency(conLai)}
                        </span>
                      </td>
                      <td className={styles.hideOnMobile}>
                        <span className={styles.badge}>{TRANG_THAI_DON_LABELS[dh.trangThaiDon]}</span>
                      </td>
                      <td>
                        {canCreate && (
                          <button className={`${styles.btnPay}`} onClick={() => handleXuatHoaDon(dh)}>
                            <FiFileText size={14} /> Xuất HĐ
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && donHangs.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={donHangs.length}
            limit={LIMIT}
            onPageChange={goToPage}
          />
        )}
      </div>

      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${t.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
