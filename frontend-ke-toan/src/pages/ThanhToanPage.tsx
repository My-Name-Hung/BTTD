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

  const canCreate = hasPermission('thanhtoan.create');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dhRes = await layDanhSachDonHang(page, 20, undefined, tuKhoa || undefined);
      const dhs = (dhRes.data || []).filter((dh: DonHang) => dh.trangThaiDon !== 'cho_duyet' && dh.trangThaiDon !== 'tu_choi');
      setDonHangs(dhs);
      for (const dh of dhs) {
        const tt = await layLichSuThanhToan(dh.id);
        setThanhToans((prev) => ({ ...prev, [dh.id]: tt }));
      }
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [page, tuKhoa, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openThanhToan = (dh: DonHang) => {
    setSelectedDonHang(dh);
    setForm({ soTien: '', hinhThuc: 'tien_mat', nguoiNhan: '', ghiChu: '' });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedDonHang || !form.soTien) return;
    try {
      await taoThanhToan({
        idDonHang: selectedDonHang.id,
        soTien: parseFloat(form.soTien),
        hinhThuc: form.hinhThuc as 'tien_mat' | 'chuyen_khoan' | 'truct_hop_dong',
        nguoiNhan: form.nguoiNhan || undefined,
        ghiChu: form.ghiChu || undefined,
      });
      showToast('Ghi nhận thanh toán thành công');
      setModalOpen(false);
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
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
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Tổng tiền</th>
                  <th>Đã thanh toán</th>
                  <th>Còn lại</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {donHangs.map((dh) => {
                  const conLai = Math.max(0, (dh.thanhTien || 0) - (dh.daThanhToan || 0));
                  return (
                    <tr key={dh.id}>
                      <td><strong>{dh.maDonHang}</strong></td>
                      <td>{dh.tenKhachHang}</td>
                      <td><strong>{formatCurrency(dh.thanhTien || 0)}</strong></td>
                      <td style={{ color: 'var(--color-success)' }}>{formatCurrency(dh.daThanhToan || 0)}</td>
                      <td>
                        <span style={{ color: conLai > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 700 }}>
                          {formatCurrency(conLai)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.badge}>{TRANG_THAI_DON_LABELS[dh.trangThaiDon]}</span>
                      </td>
                      <td>
                        {canCreate && (
                          <button className="btn btn-save btn-sm" onClick={() => openThanhToan(dh)} disabled={conLai <= 0}>
                            <FiPlus /> Thanh toán
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
            <button className="btn btn-cancel" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-save" onClick={handleSubmit}>Xác nhận thanh toán</button>
          </>
        }
      >
        <div className={styles.infoBox}>
          <div className={styles.infoBoxRow}>
            <span className={styles.infoBoxLabel}>Khách hàng</span>
            <span className={styles.infoBoxValue}>{selectedDonHang?.tenKhachHang}</span>
          </div>
          <div className={styles.infoBoxRow}>
            <span className={styles.infoBoxLabel}>Tổng tiền</span>
            <span className={styles.infoBoxValue}>{formatCurrency(selectedDonHang?.thanhTien || 0)}</span>
          </div>
          <div className={styles.infoBoxRow}>
            <span className={styles.infoBoxLabel}>Đã thanh toán</span>
            <span className={styles.infoBoxValueSuccess}>{formatCurrency(selectedDonHang?.daThanhToan || 0)}</span>
          </div>
          <div className={styles.infoBoxRow}>
            <span className={styles.infoBoxLabel}>Còn lại</span>
            <span className={styles.infoBoxValueWarning}>{formatCurrency((selectedDonHang?.thanhTien || 0) - (selectedDonHang?.daThanhToan || 0))}</span>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Số tiền thanh toán (VNĐ) *</label>
          <input
            type="number"
            className={styles.formInput}
            value={form.soTien}
            onChange={(e) => setForm({ ...form, soTien: e.target.value })}
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
