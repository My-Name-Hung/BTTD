import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import {
  layDanhSachXe, taoXe, layDanhSachDonHang,
  layLichSanXuat, taoLichSanXuat, capNhatLichSanXuat,
  xacNhanDaGiao, layDanhSachTramTron, layDanhSachMacBeTong,
} from '../services/api';
import { Xe, DonHang, LichSanXuat, TramTron, MacBeTong, TRANG_THAI_DON_LABELS } from '../types';
import { useToast, usePageRole } from '../hooks';
import { Modal, Loading, EmptyState } from '../components/Common';
import styles from './DieuPhoiPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

export default function DieuPhoiPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [xes, setXes] = useState<Xe[]>([]);
  const [tramTrons, setTramTrons] = useState<TramTron[]>([]);
  const [macBeTongs, setMacBeTongs] = useState<MacBeTong[]>([]);
  const [lichSanXuats, setLichSanXuats] = useState<Record<number, LichSanXuat[]>>({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDonHang, setSelectedDonHang] = useState<DonHang | null>(null);
  const [xeModal, setXeModal] = useState(false);
  const [lichForm, setLichForm] = useState({
    idXe: '', kyThuatCongTrinh: '', nguoiOmOng: '', nguoiBatOng: '',
    phuongAnDo: '', bienSoXe: '', ghiChu: '',
  });
  const [xeForm, setXeForm] = useState({ bienSo: '', tenTaiXe: '', soDienThoaiTaiXe: '' });

  const canCreateSchedule = hasPermission('dieuphoi.create');
  const canEditSchedule = hasPermission('dieuphoi.edit');
  const canConfirm = hasPermission('dieuphoi.confirm');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dhRes, xeRes, tramRes, macRes] = await Promise.all([
        layDanhSachDonHang(1, 100, 'da_duyet'),
        layDanhSachXe(),
        layDanhSachTramTron(),
        layDanhSachMacBeTong(),
      ]);
      setDonHangs(dhRes.data || []);
      setXes(xeRes);
      setTramTrons(tramRes);
      setMacBeTongs(macRes);
      for (const dh of (dhRes.data || [])) {
        const lich = await layLichSanXuat(dh.id);
        setLichSanXuats((prev) => ({ ...prev, [dh.id]: lich }));
      }
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openLichSanXuat = (dh: DonHang) => {
    setSelectedDonHang(dh);
    const existing = lichSanXuats[dh.id]?.[0];
    setLichForm({
      idXe: existing?.idXe ? String(existing.idXe) : '',
      kyThuatCongTrinh: existing?.kyThuatCongTrinh || '',
      nguoiOmOng: existing?.nguoiOmOng || '',
      nguoiBatOng: existing?.nguoiBatOng || '',
      phuongAnDo: existing?.phuongAnDo || '',
      bienSoXe: existing?.bienSoXe || '',
      ghiChu: existing?.ghiChu || '',
    });
    setModalOpen(true);
  };

  const handleTaoLich = async () => {
    if (!selectedDonHang) return;
    try {
      const existing = lichSanXuats[selectedDonHang.id]?.[0];
      const xe = xes.find((x) => x.id === parseInt(lichForm.idXe));
      const payload: Partial<LichSanXuat> = {
        idDonHang: selectedDonHang.id,
        idXe: lichForm.idXe ? parseInt(lichForm.idXe) : null,
        kyThuatCongTrinh: lichForm.kyThuatCongTrinh || null,
        nguoiOmOng: lichForm.nguoiOmOng || null,
        nguoiBatOng: lichForm.nguoiBatOng || null,
        phuongAnDo: lichForm.phuongAnDo || null,
        bienSoXe: xe?.bienSo || lichForm.bienSoXe || null,
        ghiChu: lichForm.ghiChu || null,
      };
      if (existing) { await capNhatLichSanXuat(existing.id, payload); showToast('Cập nhật lịch sản xuất thành công'); }
      else { await taoLichSanXuat(payload); showToast('Tạo lịch sản xuất thành công'); }
      setModalOpen(false);
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
  };

  const handleXacNhanGiao = async (dh: DonHang) => {
    const kl = window.prompt('Nhập khối lượng thực tế (m³):', String(dh.khoiLuongDat));
    if (kl === null) return;
    try { await xacNhanDaGiao(dh.id, parseFloat(kl) || undefined); showToast('Xác nhận giao hàng thành công'); loadData(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
  };

  const handleTaoXe = async () => {
    if (!xeForm.bienSo.trim()) return;
    try {
      await taoXe(xeForm);
      showToast('Thêm xe thành công');
      const xeRes = await layDanhSachXe();
      setXes(xeRes);
      setXeForm({ bienSo: '', tenTaiXe: '', soDienThoaiTaiXe: '' });
      setXeModal(false);
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
  };

  const filteredDonHangs = donHangs.filter((dh) =>
    !tuKhoa || dh.maDonHang.toLowerCase().includes(tuKhoa.toLowerCase()) || dh.tenKhachHang.toLowerCase().includes(tuKhoa.toLowerCase())
  );

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Điều phối sản xuất</div>
          <div className={styles.pageHeaderDesc}>Tạo lịch sản xuất và theo dõi giao hàng</div>
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
        <div className={styles.card}><EmptyState icon="🚚" text="Không có đơn hàng nào cần điều phối" /></div>
      ) : (
        <div className={styles.cardGrid}>
          {filteredDonHangs.map((dh) => {
            const lich = lichSanXuats[dh.id]?.[0];
            const sxStatus = lich?.trangThai || 'chua_tao';
            const borderClass = sxStatus === 'da_xong' ? styles.cardGridItemSuccess : sxStatus === 'dang_san_xuat' ? styles.cardGridItemWarning : styles.cardGridItemInfo;
            return (
              <div key={dh.id} className={`${styles.cardGridItem} ${borderClass}`}>
                <div className={styles.cardGridHeader}>
                  <span className={styles.cardGridTitle}>{dh.maDonHang}</span>
                  <span className={`${styles.badge}`}>{TRANG_THAI_DON_LABELS[dh.trangThaiDon]}</span>
                </div>
                <div className={styles.cardGridMeta}>{dh.tenKhachHang}</div>
                <div className={styles.cardGridMeta} style={{ color: 'var(--color-text-secondary)' }}>{dh.diaChiNhan}</div>
                <div className={styles.cardGridValue}>
                  {dh.tenMacBeTong} &bull; {dh.khoiLuongDat} m³ &bull; <strong>{formatCurrency(dh.thanhTien || 0)}</strong>
                </div>

                {lich && (
                  <div className={styles.infoBox} style={{ marginTop: 12 }}>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>Xe</span><span className={styles.infoBoxValue}>{lich.bienSoXe || 'Chưa chọn'}</span></div>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>Kỹ thuật</span><span className={styles.infoBoxValue}>{lich.kyThuatCongTrinh || '—'}</span></div>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>Ôm ống</span><span className={styles.infoBoxValue}>{lich.nguoiOmOng || '—'}</span></div>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>Bắt ống</span><span className={styles.infoBoxValue}>{lich.nguoiBatOng || '—'}</span></div>
                    <div className={styles.infoBoxRow}><span className={styles.infoBoxLabel}>Phương án đổ</span><span className={styles.infoBoxValue}>{lich.phuongAnDo || '—'}</span></div>
                  </div>
                )}

                <div className={styles.cardGridFooter}>
                  {(canCreateSchedule || canEditSchedule) && (
                    <button className="btn btn-edit" onClick={() => openLichSanXuat(dh)}><FiEdit2 /> {lich ? 'Sửa lịch' : 'Tạo lịch SX'}</button>
                  )}
                  {canConfirm && lich && lich.trangThai === 'dang_san_xuat' && (
                    <button className="btn btn-save" onClick={() => handleXacNhanGiao(dh)}><FiCheck /> Xác nhận giao</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Lịch sản xuất - ${selectedDonHang?.maDonHang}`}
        footer={<><button className="btn btn-cancel" onClick={() => setModalOpen(false)}>Hủy</button><button className="btn btn-save" onClick={handleTaoLich}>Lưu lịch sản xuất</button></>}
      >
        <div className={styles.formGroup}><label className={styles.formLabel}>Xe giao</label><select className={styles.formSelect} value={lichForm.idXe} onChange={(e) => setLichForm({ ...lichForm, idXe: e.target.value })}><option value="">Chọn xe</option>{xes.map((x) => (<option key={x.id} value={x.id}>{x.bienSo} - {x.tenTaiXe}</option>))}</select></div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}><label className={styles.formLabel}>Kỹ thuật công trình</label><input className={styles.formInput} value={lichForm.kyThuatCongTrinh} onChange={(e) => setLichForm({ ...lichForm, kyThuatCongTrinh: e.target.value })} /></div>
          <div className={styles.formGroup}><label className={styles.formLabel}>Phương án đổ</label><input className={styles.formInput} value={lichForm.phuongAnDo} onChange={(e) => setLichForm({ ...lichForm, phuongAnDo: e.target.value })} /></div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}><label className={styles.formLabel}>Người ôm ống</label><input className={styles.formInput} value={lichForm.nguoiOmOng} onChange={(e) => setLichForm({ ...lichForm, nguoiOmOng: e.target.value })} /></div>
          <div className={styles.formGroup}><label className={styles.formLabel}>Người bắt ống</label><input className={styles.formInput} value={lichForm.nguoiBatOng} onChange={(e) => setLichForm({ ...lichForm, nguoiBatOng: e.target.value })} /></div>
        </div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Ghi chú</label><textarea className={styles.formTextarea} value={lichForm.ghiChu} onChange={(e) => setLichForm({ ...lichForm, ghiChu: e.target.value })} /></div>
      </Modal>

      <Modal isOpen={xeModal} onClose={() => setXeModal(false)} title="Thêm xe mới"
        footer={<><button className="btn btn-cancel" onClick={() => setXeModal(false)}>Hủy</button><button className="btn btn-add" onClick={handleTaoXe}>Thêm</button></>}
      >
        <div className={styles.formGroup}><label className={styles.formLabel}>Biển số xe *</label><input className={styles.formInput} value={xeForm.bienSo} onChange={(e) => setXeForm({ ...xeForm, bienSo: e.target.value })} placeholder="VD: 59C1-12345" /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Tên tài xế</label><input className={styles.formInput} value={xeForm.tenTaiXe} onChange={(e) => setXeForm({ ...xeForm, tenTaiXe: e.target.value })} /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>SĐT tài xế</label><input className={styles.formInput} value={xeForm.soDienThoaiTaiXe} onChange={(e) => setXeForm({ ...xeForm, soDienThoaiTaiXe: e.target.value })} /></div>
      </Modal>

      <div className={styles.toastContainer}>
        {toasts.map((t) => <div key={t.id} className={`${styles.toast} ${t.type === 'error' ? styles.toastError : t.type === 'warning' ? styles.toastWarning : styles.toastSuccess}`}>{t.message}</div>)}
      </div>
    </div>
  );
}
