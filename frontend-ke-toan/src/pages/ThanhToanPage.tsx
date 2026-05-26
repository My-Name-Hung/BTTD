import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiX, FiSearch } from 'react-icons/fi';
import { layDanhSachDonHang, taoThanhToan, layLichSuThanhToan } from '../services/api';
import { DonHang, ThanhToan, TRANG_THAI_DON_LABELS } from '../types';
import { useToast, usePagination, usePageRole } from '../hooks';
import { Modal, Loading, EmptyState, Pagination } from '../components/Common';
import styles from './ThanhToanPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

export default function ThanhToanPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [thanhToans, setThanhToans] = useState<Record<number, ThanhToan[]>>({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDonHang, setSelectedDonHang] = useState<DonHang | null>(null);
  const [form, setForm] = useState({ soTien: '', hinhThuc: 'tien_mat', nguoiNhan: '', ghiChu: '' });
  const [formLoading, setFormLoading] = useState(false);

  const canCreate = hasPermission('thanhtoan.create');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dhRes = await layDanhSachDonHang(page, 20, undefined, tuKhoa || undefined);
      const dhs = (dhRes.data || []).filter((dh: DonHang) =>
        ['nghiem_thu', 'da_thanh_toan'].includes(dh.trangThaiDon)
      );
      setDonHangs(dhs);
      // Gọi song song tất cả lịch sử thanh toán
      const histories = await Promise.all(dhs.map((dh: DonHang) => layLichSuThanhToan(dh.id)));
      const map: Record<number, ThanhToan[]> = {};
      dhs.forEach((dh: DonHang, i: number) => { map[dh.id] = histories[i] || []; });
      setThanhToans(map);
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [page, tuKhoa, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openThanhToan = (dh: DonHang) => {
    setSelectedDonHang(dh);
    const conLai = Math.max(0, (dh.thanhTien || 0) - (dh.daThanhToan || 0));
    setForm({ soTien: conLai > 0 ? Number(Math.round(conLai)).toLocaleString('vi-VN') : '', hinhThuc: 'tien_mat', nguoiNhan: '', ghiChu: '' });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedDonHang || !form.soTien) return;
    setFormLoading(true);
    try {
      await taoThanhToan({
        idDonHang: selectedDonHang.id,
        soTien: parseFloat(form.soTien.replace(/[^\d]/g, '')),
        hinhThuc: form.hinhThuc as 'tien_mat' | 'chuyen_khoan' | 'truct_hop_dong',
        nguoiNhan: form.nguoiNhan || undefined,
        ghiChu: form.ghiChu || undefined,
      });
      showToast('Ghi nhận thanh toán thành công');
      setModalOpen(false);
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
    finally { setFormLoading(false); }
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
                          <button className={`${styles.btnPay} ${conLai <= 0 ? styles.btnPayDisabled : ''}`} onClick={() => openThanhToan(dh)} disabled={conLai <= 0}>
                            <FiPlus size={14} /> Thanh toán
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Thanh toán - ${selectedDonHang?.maDonHang}`}
        footer={
          <>
            <button className="btn btn-cancel" onClick={() => setModalOpen(false)} disabled={formLoading}>Hủy</button>
            <button className="btn btn-save" onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
            </button>
          </>
        }
      >
        <div className={styles.modalInfoBox}>
          <div className={styles.modalInfoRow}>
            <span className={styles.modalInfoLabel}>Khách hàng</span>
            <span className={styles.modalInfoValue}>{selectedDonHang?.tenKhachHang}</span>
          </div>
          <div className={styles.modalInfoRow}>
            <span className={styles.modalInfoLabel}>Tổng tiền</span>
            <span className={styles.modalInfoValue}>{formatCurrency(selectedDonHang?.thanhTien || 0)}</span>
          </div>
          <div className={styles.modalInfoRow}>
            <span className={styles.modalInfoLabel}>Đã thanh toán</span>
            <span className={styles.modalInfoSuccess}>{formatCurrency(selectedDonHang?.daThanhToan || 0)}</span>
          </div>
          <div className={styles.modalInfoRow}>
            <span className={styles.modalInfoLabel}>Còn lại</span>
            <span className={styles.modalInfoWarning}>{formatCurrency((selectedDonHang?.thanhTien || 0) - (selectedDonHang?.daThanhToan || 0))}</span>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Số tiền thanh toán (VNĐ) *</label>
          <input
            type="text"
            className={styles.formInput}
            value={form.soTien}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, '');
              const formatted = raw ? Number(raw).toLocaleString('vi-VN') : '';
              setForm({ ...form, soTien: formatted });
            }}
            placeholder="Nhập số tiền..."
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Hình thức</label>
          <select className={styles.formSelect} value={form.hinhThuc} onChange={(e) => setForm({ ...form, hinhThuc: e.target.value })}>
            <option value="tien_mat">Tiền mặt</option>
            <option value="chuyen_khoan">Chuyển khoản</option>
            <option value="truct_hop_dong">Trực tiếp</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Người nhận</label>
          <input className={styles.formInput} value={form.nguoiNhan} onChange={(e) => setForm({ ...form, nguoiNhan: e.target.value })} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ghi chú</label>
          <textarea className={styles.formTextarea} value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} />
        </div>
      </Modal>

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
