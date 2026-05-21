import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import {
  taoXe, layDanhSachDonHang,
  layLichSanXuat,
  xacNhanDaGiao, layDanhSachTramTron, layDanhSachMacBeTong,
} from '../services/api';
import { DonHang, LichSanXuat, TramTron, MacBeTong, TRANG_THAI_DON_LABELS } from '../types';
import { useToast, usePageRole } from '../hooks';
import { Modal, Loading, EmptyState } from '../components/Common';
import styles from './DieuPhoiPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

export default function DieuPhoiPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const navigate = useNavigate();
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [tramTrons, setTramTrons] = useState<TramTron[]>([]);
  const [macBeTongs, setMacBeTongs] = useState<MacBeTong[]>([]);
  const [lichSanXuats, setLichSanXuats] = useState<Record<number, LichSanXuat[]>>({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');
  const [xeModal, setXeModal] = useState(false);
  const [xeForm, setXeForm] = useState({ bienSo: '', tenTaiXe: '', soDienThoaiTaiXe: '' });

  const canCreateSchedule = hasPermission('dieuphoi.create');
  const canEditSchedule = hasPermission('dieuphoi.edit');
  const canConfirm = hasPermission('dieuphoi.confirm');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dhRes, tramRes, macRes] = await Promise.all([
        layDanhSachDonHang(1, 100, 'da_duyet'),
        layDanhSachTramTron(),
        layDanhSachMacBeTong(),
      ]);
      setDonHangs(dhRes.data || []);
      setTramTrons(tramRes);
      setMacBeTongs(macRes);

      const allLichs = await Promise.all(
        (dhRes.data || []).map((dh: DonHang) => layLichSanXuat(dh.id))
      );
      const lichMap: Record<number, LichSanXuat[]> = {};
      (dhRes.data || []).forEach((dh: DonHang, i: number) => {
        lichMap[dh.id] = allLichs[i];
      });
      setLichSanXuats(lichMap);
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

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
        <div className="card" style={{ padding: 32, textAlign: 'center' }}><EmptyState icon="🚚" text="Không có đơn hàng nào cần điều phối" /></div>
      ) : (
        <div className={styles.cardGrid}>
          {filteredDonHangs.map((dh) => {
            const lich = lichSanXuats[dh.id]?.[0];
            const sxStatus = lich?.trangThai || 'chua_san_xuat';
            const itemClass =
              sxStatus === 'da_xong' ? styles.cardGridItemSuccess :
              sxStatus === 'dang_san_xuat' ? styles.cardGridItemWarning :
              sxStatus === 'chua_san_xuat' ? styles.cardGridItemInfo :
              styles.cardGridItemInfo;
            const dotClass =
              sxStatus === 'da_xong' ? styles.statusDotSuccess :
              sxStatus === 'dang_san_xuat' ? styles.statusDotWarning :
              styles.statusDotDefault;
            return (
              <div key={dh.id} className={`${styles.cardGridItem} ${itemClass}`}>
                <div className={styles.cardBody}>
                  <div className={styles.cardGridHeader}>
                    <span className={styles.cardGridTitle}>{dh.maDonHang}</span>
                    <div className={styles.cardGridStatus}>
                      <span className={`${styles.statusDot} ${dotClass}`} />
                      <span className={`${styles.badge}`}>{TRANG_THAI_DON_LABELS[dh.trangThaiDon]}</span>
                    </div>
                  </div>
                  <div className={styles.cardGridMeta}>{dh.tenKhachHang}</div>
                  <div className={styles.cardGridMetaSecondary}>{dh.diaChiNhan}</div>

                  <div className={styles.cardGridDivider} />

                  <div className={styles.cardGridValue}>
                    {dh.tenMacBeTong} &bull; {dh.khoiLuongDat} m³ &bull; <strong>{formatCurrency(dh.thanhTien || 0)}</strong>
                  </div>

                  {lich && (
                    <div className={styles.infoBox}>
                      <div className={styles.infoBoxRow}>
                        <div><span className={styles.infoBoxLabel}>Xe</span><div className={styles.infoBoxValue}>{lich.bienSoXe || '—'}</div></div>
                        <div><span className={styles.infoBoxLabel}>Kỹ thuật</span><div className={`${styles.infoBoxValue} ${styles.infoBoxValueHighlight}`}>{lich.kyThuatCongTrinh || '—'}</div></div>
                      </div>
                      <div className={styles.infoBoxRow}>
                        <div><span className={styles.infoBoxLabel}>Ôm ống</span><div className={styles.infoBoxValue}>{lich.nguoiOmOng || '—'}</div></div>
                        <div><span className={styles.infoBoxLabel}>Bắt ống</span><div className={styles.infoBoxValue}>{lich.nguoiBatOng || '—'}</div></div>
                      </div>
                      <div className={styles.infoBoxRow}>
                        <div><span className={styles.infoBoxLabel}>Phương án đổ</span><div className={styles.infoBoxValue}>{lich.phuongAnDo || '—'}</div></div>
                        <div><span className={styles.infoBoxLabel}>Trạng thái</span><div className={`${styles.infoBoxValue} ${sxStatus === 'da_xong' ? styles.infoBoxValueHighlight : ''}`}>
                          {sxStatus === 'da_xong' ? 'Đã xong' : sxStatus === 'dang_san_xuat' ? 'Đang SX' : '—'}
                        </div></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.cardGridFooter}>
                  {(canCreateSchedule || canEditSchedule) && (
                    <button className="btn btn-edit" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => navigate(`/dieu-phoi/lich-san-xuat/${dh.id}`)}>
                      <FiEdit2 /> {lich ? 'Sửa lịch' : 'Tạo lịch SX'}
                    </button>
                  )}
                  {canConfirm && lich && lich.trangThai === 'dang_san_xuat' && (
                    <button className="btn btn-save" style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => handleXacNhanGiao(dh)}>
                      <FiCheck /> Xác nhận giao
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
