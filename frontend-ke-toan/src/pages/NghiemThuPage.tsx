import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiCheck, FiFileText, FiX } from 'react-icons/fi';
import {
  layDanhSachDonHang, layNghiemThu, taoNghiemThu,
  xacNhanNghiemThu, layLichSuThanhToan, taoCongNo,
} from '../services/api';
import { DonHang, NghiemThu, ThanhToan, TRANG_THAI_DON_LABELS } from '../types';
import { useToast, usePageRole } from '../hooks';
import { Modal, Loading, EmptyState } from '../components/Common';
import styles from './NghiemThuPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

export default function NghiemThuPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [nghiemThus, setNghiemThus] = useState<Record<number, NghiemThu | null>>({});
  const [lichSuTT, setLichSuTT] = useState<Record<number, ThanhToan[]>>({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDonHang, setSelectedDonHang] = useState<DonHang | null>(null);
  const [form, setForm] = useState({
    khoiLuongThucTe: '', bienBanSo: '', nguoiLap: '', nguoiKy: '',
    chucVu: '', ghiChu: '',
  });

  const canCreate = hasPermission('nghiemthu.create');
  const canConfirm = hasPermission('nghiemthu.confirm');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dhRes = await layDanhSachDonHang(1, 100, 'da_giao');
      const dhs = dhRes.data || [];
      setDonHangs(dhs);
      for (const dh of dhs) {
        const [nt, tt] = await Promise.all([layNghiemThu(dh.id), layLichSuThanhToan(dh.id)]);
        setNghiemThus((prev) => ({ ...prev, [dh.id]: nt }));
        setLichSuTT((prev) => ({ ...prev, [dh.id]: tt }));
      }
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openNghiemThu = (dh: DonHang) => {
    setSelectedDonHang(dh);
    const existing = nghiemThus[dh.id];
    setForm({
      khoiLuongThucTe: existing?.khoiLuongThucTe ? String(existing.khoiLuongThucTe) : String(dh.khoiLuongDat),
      bienBanSo: existing?.bienBanSo || '',
      nguoiLap: existing?.nguoiLap || '',
      nguoiKy: existing?.nguoiKy || '',
      chucVu: existing?.chucVu || '',
      ghiChu: existing?.ghiChu || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedDonHang) return;
    try {
      await taoNghiemThu({
        idDonHang: selectedDonHang.id,
        khoiLuongThucTe: parseFloat(form.khoiLuongThucTe),
        bienBanSo: form.bienBanSo || null,
        nguoiLap: form.nguoiLap || null,
        nguoiKy: form.nguoiKy || null,
        chucVu: form.chucVu || null,
        ghiChu: form.ghiChu || null,
      });
      showToast('Tạo biên bản nghiệm thu thành công');
      setModalOpen(false);
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
  };

  const handleXacNhan = async (dh: DonHang) => {
    if (!window.confirm('Xác nhận nghiệm thu đơn hàng này?')) return;
    try {
      await xacNhanNghiemThu(dh.id);
      await taoCongNo(dh.id);
      showToast('Xác nhận nghiệm thu thành công');
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
  };

  const filteredDonHangs = donHangs.filter((dh) =>
    !tuKhoa || dh.maDonHang.toLowerCase().includes(tuKhoa.toLowerCase()) || dh.tenKhachHang.toLowerCase().includes(tuKhoa.toLowerCase())
  );

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Nghiệm thu đơn hàng</div>
          <div className={styles.pageHeaderDesc}>Xác nhận khối lượng và chất lượng bê tông đã giao</div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterBarLeft}>
          <div className={styles.filterSearch}>
            <FiSearch className={styles.filterSearchIcon} />
            <input className={styles.filterSearchInput} placeholder="Tìm đơn hàng..." value={tuKhoa} onChange={(e) => setTuKhoa(e.target.value)} />
          </div>
          {tuKhoa && (
            <button className={styles.filterClearBtn} onClick={() => setTuKhoa('')}>
              <FiX size={13} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      {loading ? <Loading /> : filteredDonHangs.length === 0 ? (
        <div className={styles.card}><EmptyState icon="📋" text="Không có đơn hàng cần nghiệm thu" /></div>
      ) : (
        <div className={styles.cardGrid}>
          {filteredDonHangs.map((dh) => {
            const nt = nghiemThus[dh.id];
            const thanhToans = lichSuTT[dh.id] || [];
            const daTT = thanhToans.reduce((sum, t) => sum + t.soTien, 0);
            return (
              <div key={dh.id} className={`${styles.cardGridItem} ${styles.cardGridItemInfo}`}>
                <div className={styles.cardGridHeader}>
                  <span className={styles.cardGridTitle}>{dh.maDonHang}</span>
                  <span className={`${styles.badge}`}>{TRANG_THAI_DON_LABELS[dh.trangThaiDon]}</span>
                </div>
                <div className={styles.cardGridMeta}><strong>{dh.tenKhachHang}</strong></div>
                <div className={styles.cardGridMeta} style={{ color: 'var(--color-text-secondary)' }}>{dh.diaChiNhan}</div>
                <div className={styles.cardGridValue} style={{ marginTop: 8 }}>
                  KL đặt: <strong>{dh.khoiLuongDat} m³</strong>
                  {dh.khoiLuongThucTe && (<> &bull; KL thực tế: <strong>{dh.khoiLuongThucTe} m³</strong></>)}
                </div>
                <div className={styles.cardGridValue}>
                  {dh.tenMacBeTong} &bull; <strong>{formatCurrency(dh.thanhTien || 0)}</strong>
                </div>

                {nt ? (
                  <div className={styles.infoBox} style={{ marginTop: 12 }}>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>BB số</span><span className={styles.infoBoxValue}>{nt.bienBanSo || '—'}</span></div>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>Người lập</span><span className={styles.infoBoxValue}>{nt.nguoiLap || '—'}</span></div>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>Người ký</span><span className={styles.infoBoxValue}>{nt.nguoiKy || '—'}</span></div>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>Chất lượng</span><span className={`${styles.infoBoxValue} ${nt.chatLuong === 'dat' ? styles.infoBoxValueSuccess : styles.infoBoxValueDanger}`}>{nt.chatLuong === 'dat' ? 'Đạt' : nt.chatLuong === 'khong_dat' ? 'Không đạt' : '—'}</span></div>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>Đã thanh toán</span><span className={styles.infoBoxValueSuccess}>{formatCurrency(daTT)}</span></div>
                  </div>
                ) : null}

                <div className={styles.cardGridFooter}>
                  {canCreate && (
                    <button className="btn btn-edit" onClick={() => openNghiemThu(dh)}><FiFileText /> {nt ? 'Sửa biên bản' : 'Tạo biên bản NT'}</button>
                  )}
                  {canConfirm && nt && nt.chatLuong === 'dat' && dh.trangThaiDon === 'nghiem_thu' && (
                    <button className="btn btn-save" onClick={() => handleXacNhan(dh)}><FiCheck /> Xác nhận NT</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Biên bản nghiệm thu - ${selectedDonHang?.maDonHang}`}
        footer={<><button className="btn btn-cancel" onClick={() => setModalOpen(false)}>Hủy</button><button className="btn btn-save" onClick={handleSubmit}>Lưu biên bản</button></>}
      >
        <div className={styles.formRow}>
          <div className={styles.formGroup}><label className={styles.formLabel}>Khối lượng xác nhận (m³)</label><input type="number" step="0.01" className={styles.formInput} value={form.khoiLuongThucTe} onChange={(e) => setForm({ ...form, khoiLuongThucTe: e.target.value })} /></div>
          <div className={styles.formGroup}><label className={styles.formLabel}>Số biên bản</label><input className={styles.formInput} value={form.bienBanSo} onChange={(e) => setForm({ ...form, bienBanSo: e.target.value })} /></div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}><label className={styles.formLabel}>Người lập biên bản</label><input className={styles.formInput} value={form.nguoiLap} onChange={(e) => setForm({ ...form, nguoiLap: e.target.value })} /></div>
          <div className={styles.formGroup}><label className={styles.formLabel}>Người ký</label><input className={styles.formInput} value={form.nguoiKy} onChange={(e) => setForm({ ...form, nguoiKy: e.target.value })} /></div>
        </div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Chức vụ</label><input className={styles.formInput} value={form.chucVu} onChange={(e) => setForm({ ...form, chucVu: e.target.value })} /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Ghi chú</label><textarea className={styles.formTextarea} value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} /></div>
      </Modal>

      <div className={styles.toastContainer}>
        {toasts.map((t) => <div key={t.id} className={`${styles.toast} ${t.type === 'error' ? styles.toastError : styles.toastSuccess}`}>{t.message}</div>)}
      </div>
    </div>
  );
}
