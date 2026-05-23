import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiSearch, FiEye, FiCheckCircle } from 'react-icons/fi';
import {
  layDonHangCuaToi,
} from '../services/api';
import { DonHang, TRANG_THAI_DON_LABELS, ApiResponseWithPagination } from '../types';
import { useToast, usePagination, useAuth } from '../hooks';
import { Pagination, Loading, EmptyState } from '../components/Common';
import styles from './SaleDonHangPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }
function formatDate(d: string) { return d ? new Date(d).toLocaleDateString('vi-VN') : ''; }

export default function SaleDonHangPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, showToast } = useToast();
  const { page, goToPage } = usePagination(1, 20);
  const [data, setData] = useState<ApiResponseWithPagination<DonHang[]>>({
    success: true, message: '', data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');
  const [trangThai, setTrangThai] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layDonHangCuaToi(page, 20, trangThai || undefined);
      setData(res);
    } catch {
      showToast('Không tải được dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, trangThai, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      cho_duyet: '#ff9800', da_duyet: '#2196f3', dang_san_xuat: '#673ab7',
      dang_giao: '#009688', da_giao: '#4caf50', nghiem_thu: '#795548',
      da_thanh_toan: '#2e7d32', hoan_thanh: '#2e7d32', tu_choi: '#f44336',
    };
    return map[s] || '#999';
  };

  const statusLabel = (s: string) => TRANG_THAI_DON_LABELS[s as keyof typeof TRANG_THAI_DON_LABELS] || s;

  const tongSo = data.data?.length || 0;
  const choDuyet = data.data?.filter(d => d.trangThaiDon === 'cho_duyet').length || 0;
  const dangXL = data.data?.filter(d =>
    ['da_duyet', 'dang_san_xuat', 'dang_giao', 'da_giao', 'nghiem_thu'].includes(d.trangThaiDon)
  ).length || 0;
  const hoanThanh = data.data?.filter(d =>
    ['hoan_thanh', 'da_thanh_toan'].includes(d.trangThaiDon)
  ).length || 0;

  return (
    <div className={styles.page}>
      {/* KPI Cards */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard} onClick={() => { setTrangThai(''); goToPage(1); }}>
          <div className={styles.kpiValue}>{data.pagination.total}</div>
          <div className={styles.kpiLabel}>Tổng đơn</div>
        </div>
        <div className={styles.kpiCard} onClick={() => { setTrangThai('cho_duyet'); goToPage(1); }}>
          <div className={`${styles.kpiValue} ${styles.kpiWarning}`}>{choDuyet}</div>
          <div className={styles.kpiLabel}>Chờ duyệt</div>
        </div>
        <div className={styles.kpiCard} onClick={() => { setTrangThai('dang_giao'); goToPage(1); }}>
          <div className={`${styles.kpiValue} ${styles.kpiInfo}`}>{dangXL}</div>
          <div className={styles.kpiLabel}>Đang xử lý</div>
        </div>
        <div className={styles.kpiCard} onClick={() => { setTrangThai('hoan_thanh'); goToPage(1); }}>
          <div className={`${styles.kpiValue} ${styles.kpiSuccess}`}>{hoanThanh}</div>
          <div className={styles.kpiLabel}>Hoàn thành</div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchBar}>
        <div className={styles.searchInput}>
          <FiSearch size={16} />
          <input
            type="text"
            placeholder="Tìm theo mã, tên khách..."
            value={tuKhoa}
            onChange={(e) => setTuKhoa(e.target.value)}
          />
        </div>
        <button className={styles.btnCreate} onClick={() => navigate('/quan-ly/don-hang/tao')}>
          <FiPlus size={18} /> <span>Tạo đơn</span>
        </button>
      </div>

      {/* Order List */}
      {loading ? <Loading /> : data.data?.length === 0 ? (
        <EmptyState message="Chưa có đơn hàng nào" />
      ) : (
        <div className={styles.orderList}>
          {data.data?.map((dh) => (
            <div
              key={dh.id}
              className={styles.orderCard}
              onClick={() => navigate(`/quan-ly/don-hang/chi-tiet/${dh.id}`)}
            >
              <div className={styles.orderCardHeader}>
                <div>
                  <div className={styles.orderMa}>{dh.maDonHang}</div>
                  <div className={styles.orderKhach}>{dh.tenKhachHang}</div>
                </div>
                <span
                  className={styles.orderStatus}
                  style={{ background: statusColor(dh.trangThaiDon) + '22', color: statusColor(dh.trangThaiDon) }}
                >
                  {statusLabel(dh.trangThaiDon)}
                </span>
              </div>
              <div className={styles.orderCardBody}>
                <div className={styles.orderRow}>
                  <span className={styles.orderLabel}>Địa chỉ</span>
                  <span className={styles.orderValue}>{dh.diaChiNhan || '—'}</span>
                </div>
                <div className={styles.orderRow}>
                  <span className={styles.orderLabel}>Mác bê tông</span>
                  <span className={styles.orderValue}>{dh.tenMacBeTong || '—'}</span>
                </div>
                <div className={styles.orderRow}>
                  <span className={styles.orderLabel}>Khối lượng</span>
                  <span className={styles.orderValue}>{dh.khoiLuongDat || 0} m³</span>
                </div>
                <div className={styles.orderRow}>
                  <span className={styles.orderLabel}>Thành tiền</span>
                  <span className={`${styles.orderValue} ${styles.orderValueBold}`}>
                    {formatCurrency(dh.thanhTien || 0)}
                  </span>
                </div>
              </div>
              <div className={styles.orderCardFooter}>
                <span>{formatDate(dh.ngayTaoDon as unknown as string)}</span>
                <div className={styles.orderActions}>
                  <button className={styles.btnView} onClick={(e) => { e.stopPropagation(); navigate(`/quan-ly/don-hang/chi-tiet/${dh.id}`); }}>
                    <FiEye size={14} /> Xem
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        onPageChange={(p) => goToPage(p)}
      />

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
