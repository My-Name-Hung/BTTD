import React, { useState, useEffect, useCallback } from 'react';
import { FiX } from 'react-icons/fi';
import { layDanhSachCongNo } from '../services/api';
import { CongNo, ApiResponseWithPagination } from '../types';
import { useToast, usePagination } from '../hooks';
import { Loading, EmptyState, Pagination } from '../components/Common';
import styles from './CongNoPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

const TRANG_THAI_LABELS: Record<string, string> = {
  chua_thanh_toan: 'Chưa thanh toán', dang_thanh_toan: 'Đang thanh toán', da_thanh_toan: 'Đã thanh toán', qua_han: 'Quá hạn',
};

const TRANG_THAI_CLASS: Record<string, string> = {
  chua_thanh_toan: styles.badgeChoDuyet,
  dang_thanh_toan: styles.badgeDangSanXuat,
  da_thanh_toan: styles.badgeDaThanhToan,
  qua_han: styles.badgeTuChoi,
};

export default function CongNoPage() {
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);
  const [data, setData] = useState<ApiResponseWithPagination<CongNo[]>>({
    success: true, message: '', data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [trangThai, setTrangThai] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const res = await layDanhSachCongNo(page, 20, trangThai || undefined); setData(res); }
    catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [page, trangThai, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const tongCongNo = data.data?.reduce((sum, cn) => sum + cn.conLai, 0) || 0;
  const tongDaTT = data.data?.reduce((sum, cn) => sum + cn.daThanhToan, 0) || 0;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Công nợ</div>
          <div className={styles.pageHeaderDesc}>Theo dõi công nợ khách hàng</div>
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
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Trạng thái</span>
            <select
              className={`${styles.filterSelect} ${trangThai ? styles.filterSelectActive : ''}`}
              value={trangThai}
              onChange={(e) => { setTrangThai(e.target.value); resetPage(); }}
            >
              <option value="">Tất cả</option>
              <option value="chua_thanh_toan">Chưa thanh toán</option>
              <option value="dang_thanh_toan">Đang thanh toán</option>
              <option value="da_thanh_toan">Đã thanh toán</option>
              <option value="qua_han">Quá hạn</option>
            </select>
          </div>
          {trangThai && (
            <button className={styles.filterClearBtn} onClick={() => { setTrangThai(''); resetPage(); }}>
              <FiX size={13} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          {loading ? <Loading /> : data.data?.length === 0 ? (
            <EmptyState icon="📊" text="Không có công nợ nào" />
          ) : (
            <table className={styles.table}>
              <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Tổng tiền</th><th>Đã thanh toán</th><th>Còn lại</th><th>Hạn thanh toán</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {data.data?.map((cn) => (
                  <tr key={cn.id}>
                    <td><strong>{cn.maDonHang || `ĐH-${cn.idDonHang}`}</strong></td>
                    <td>{cn.tenKhachHang || '—'}</td>
                    <td><strong>{formatCurrency(cn.tongTien)}</strong></td>
                    <td style={{ color: 'var(--color-success)' }}>{formatCurrency(cn.daThanhToan)}</td>
                    <td>
                      <span style={{ color: cn.conLai > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 700 }}>
                        {formatCurrency(cn.conLai)}
                      </span>
                    </td>
                    <td>{cn.hanThanhToan ? new Date(cn.hanThanhToan).toLocaleDateString('vi-VN') : '—'}</td>
                    <td><span className={`${styles.badge} ${TRANG_THAI_CLASS[cn.trangThai] || ''}`}>{TRANG_THAI_LABELS[cn.trangThai] || cn.trangThai}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && (data.data?.length ?? 0) > 0 && (
          <Pagination
            page={page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            limit={20}
            onPageChange={goToPage}
          />
        )}
      </div>

      <div className={styles.toastContainer}>
        {toasts.map((t) => <div key={t.id} className={`${styles.toast} ${t.type === 'error' ? styles.toastError : styles.toastSuccess}`}>{t.message}</div>)}
      </div>
    </div>
  );
}
