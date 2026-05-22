import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiCheck, FiFileText, FiX, FiUpload, FiExternalLink, FiCheckCircle, FiClock } from 'react-icons/fi';
import {
  layDanhSachDonHang, layNghiemThu,
  xacNhanNghiemThu, layLichSuThanhToan, taoCongNo,
  uploadBienBanNghiemThu,
} from '../services/api';
import { DonHang, NghiemThu, ThanhToan } from '../types';
import { useToast, usePageRole } from '../hooks';
import { Modal, Loading, EmptyState, ConfirmModal } from '../components/Common';
import styles from './NghiemThuPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

type TabType = 'can_nghiem_thu' | 'da_nghiem_thu';

export default function NghiemThuPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [nghiemThus, setNghiemThus] = useState<Record<number, NghiemThu | null>>({});
  const [lichSuTT, setLichSuTT] = useState<Record<number, ThanhToan[]>>({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');
  const [tab, setTab] = useState<TabType>('can_nghiem_thu');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalAction, setConfirmModalAction] = useState<'da' | 'chua'>('da');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [selectedDonHang, setSelectedDonHang] = useState<DonHang | null>(null);
  const [selectedNt, setSelectedNt] = useState<NghiemThu | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const canConfirm = hasPermission('nghiemthu.confirm');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dhRes = await layDanhSachDonHang(1, 100, 'da_giao');
      const dhs = dhRes.data || [];
      setDonHangs(dhs);
      const ntMap: Record<number, NghiemThu | null> = {};
      const ttMap: Record<number, ThanhToan[]> = {};
      for (const dh of dhs) {
        const [nt, tt] = await Promise.all([layNghiemThu(dh.id), layLichSuThanhToan(dh.id)]);
        ntMap[dh.id] = nt;
        ttMap[dh.id] = tt || [];
      }
      setNghiemThus(ntMap);
      setLichSuTT(ttMap);
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const canNghiemThu = donHangs.filter((dh) => {
    const nt = nghiemThus[dh.id];
    return !nt || dh.trangThaiDon === 'da_giao';
  });

  const daNghiemThu = donHangs.filter((dh) => {
    const nt = nghiemThus[dh.id];
    return nt && dh.trangThaiDon !== 'da_giao';
  });

  const filteredCan = canNghiemThu.filter((dh) =>
    !tuKhoa || dh.maDonHang.toLowerCase().includes(tuKhoa.toLowerCase()) || dh.tenKhachHang.toLowerCase().includes(tuKhoa.toLowerCase())
  );

  const filteredDa = daNghiemThu.filter((dh) =>
    !tuKhoa || dh.maDonHang.toLowerCase().includes(tuKhoa.toLowerCase()) || dh.tenKhachHang.toLowerCase().includes(tuKhoa.toLowerCase())
  );

  const handleDaNghiemThu = (dh: DonHang) => {
    setSelectedDonHang(dh);
    setConfirmModalAction('da');
    setConfirmModalOpen(true);
  };

  const handleChuaNghiemThu = (dh: DonHang) => {
    setSelectedDonHang(dh);
    setConfirmModalAction('chua');
    setConfirmModalOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedDonHang) return;
    setConfirmLoading(true);
    try {
      if (confirmModalAction === 'da') {
        await xacNhanNghiemThu(selectedDonHang.id, 'da');
        await taoCongNo(selectedDonHang.id);
        showToast('Đã xác nhận đã nghiệm thu — đơn chuyển sang chờ thanh toán');
      } else {
        await xacNhanNghiemThu(selectedDonHang.id, 'chua');
        showToast('Đã xác nhận chưa nghiệm thu');
      }
      setConfirmModalOpen(false);
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
    finally { setConfirmLoading(false); }
  };

  const openUploadFile = (dh: DonHang, nt: NghiemThu) => {
    setSelectedDonHang(dh);
    setSelectedNt(nt);
    setUploadFile(null);
    setUploadModalOpen(true);
  };

  const handleUpload = async () => {
    if (!selectedDonHang) return;
    setUploadLoading(true);
    try {
      await uploadBienBanNghiemThu(selectedDonHang.id, uploadFile);
      showToast('Tải file biên bản thành công');
      setUploadModalOpen(false);
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi tải file', 'error'); }
    finally { setUploadLoading(false); }
  };

  const getBaseUrl = () => {
    return import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://bttd.onrender.com';
  };

  const currentList = tab === 'can_nghiem_thu' ? filteredCan : filteredDa;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Nghiệm thu đơn hàng</div>
          <div className={styles.pageHeaderDesc}>Chỉ hiển thị đơn hàng đã giao thành công</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'can_nghiem_thu' ? styles.tabActive : ''}`}
          onClick={() => setTab('can_nghiem_thu')}
        >
          <FiClock size={14} /> Cần nghiệm thu ({filteredCan.length})
        </button>
        <button
          className={`${styles.tab} ${tab === 'da_nghiem_thu' ? styles.tabActive : ''}`}
          onClick={() => setTab('da_nghiem_thu')}
        >
          <FiCheckCircle size={14} /> Đã nghiệm thu ({filteredDa.length})
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterBarLeft}>
          <div className={styles.filterSearch}>
            <FiSearch className={styles.filterSearchIcon} />
            <input
              className={styles.filterSearchInput}
              placeholder="Tìm đơn hàng..."
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
            />
          </div>
          {tuKhoa && (
            <button className={styles.filterClearBtn} onClick={() => setTuKhoa('')}>
              <FiX size={13} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      {loading ? <Loading /> : currentList.length === 0 ? (
        <div className={styles.card}>
          <EmptyState
            icon={tab === 'can_nghiem_thu' ? '📋' : '✅'}
            text={tab === 'can_nghiem_thu' ? 'Không có đơn cần nghiệm thu' : 'Không có đơn đã nghiệm thu'}
          />
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {currentList.map((dh) => {
            const nt = nghiemThus[dh.id];
            const thanhToans = lichSuTT[dh.id] || [];
            const daTT = thanhToans.reduce((sum, t) => sum + t.soTien, 0);
            const isDaNT = tab === 'da_nghiem_thu';
            const baseUrl = getBaseUrl();

            return (
              <div
                key={dh.id}
                className={`${styles.cardGridItem} ${isDaNT ? styles.cardGridItemSuccess : styles.cardGridItemInfo}`}
              >
                <div className={styles.cardGridHeader}>
                  <span className={styles.cardGridTitle}>{dh.maDonHang}</span>
                  <span className={`${styles.badge} ${isDaNT ? styles.badgeDaNghiemThu : styles.badgeChoNghiemThu}`}>
                    {isDaNT ? 'Đã nghiệm thu' : 'Cần nghiệm thu'}
                  </span>
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

                {nt && (
                  <div className={styles.infoBox} style={{ marginTop: 12 }}>
                    {nt.bienBanFile && (
                      <div className={styles.infoBoxRow}>
                        <span className={styles.infoBoxLabel}>File biên bản</span>
                        <a
                          href={`${baseUrl}${nt.bienBanFile}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.bienBanLink}
                        >
                          <FiExternalLink size={12} /> Mở file
                        </a>
                      </div>
                    )}
                    <div className={styles.infoBoxRow}>
                      <span className={styles.infoBoxLabel}>Đã thanh toán</span>
                      <span className={styles.infoBoxValueSuccess}>{formatCurrency(daTT)}</span>
                    </div>
                  </div>
                )}

                <div className={styles.cardGridFooter}>
                  {!isDaNT && canConfirm && (
                    <>
                      <button className="btn btn-save" onClick={() => handleDaNghiemThu(dh)}>
                        <FiCheck /> Đã nghiệm thu
                      </button>
                      <button className="btn btn-secondary" onClick={() => handleChuaNghiemThu(dh)}>
                        <FiX /> Chưa nghiệm thu
                      </button>
                    </>
                  )}
                  {isDaNT && (
                    <button className="btn btn-secondary" onClick={() => openUploadFile(dh, nt!)}>
                      <FiUpload /> {nt?.bienBanFile ? 'Thay đổi file' : 'Tải file biên bản'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal upload file */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title={`Tải file biên bản - ${selectedDonHang?.maDonHang}`}
        footer={
          <>
            <button className="btn btn-cancel" onClick={() => setUploadModalOpen(false)}>Hủy</button>
            <button
              className="btn btn-save"
              onClick={handleUpload}
              disabled={!uploadFile || uploadLoading}
            >
              {uploadLoading ? 'Đang tải...' : 'Tải lên'}
            </button>
          </>
        }
      >
        <div className={styles.uploadNote}>
          Hỗ trợ: <strong>.doc, .docx, .pdf, .jpg, .png</strong> (tối đa 50MB) — Không bắt buộc
        </div>
        {selectedNt?.bienBanFile && (
          <div className={styles.uploadCurrentFile}>
            <span>File hiện tại:</span>
            <a
              href={`${getBaseUrl()}${selectedNt.bienBanFile}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.bienBanLink}
            >
              <FiExternalLink size={12} /> Mở file đang có
            </a>
          </div>
        )}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Chọn file biên bản nghiệm thu (tùy chọn)</label>
          <input
            type="file"
            className={styles.formInput}
            accept=".doc,.docx,.pdf,.jpg,.jpeg,.png"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
          />
        </div>
        {uploadFile && (
          <div className={styles.uploadFileName}>
            <FiFileText size={14} /> {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirm}
        title={confirmModalAction === 'da' ? 'Xác nhận đã nghiệm thu' : 'Xác nhận chưa nghiệm thu'}
        message={
          confirmModalAction === 'da'
            ? `Bạn có chắc đã nghiệm thu đơn "${selectedDonHang?.maDonHang}"? Đơn sẽ chuyển sang chờ thanh toán.`
            : `Bạn có chắc đơn "${selectedDonHang?.maDonHang}" chưa nghiệm thu? Đơn sẽ giữ nguyên trạng thái.`
        }
        confirmText={confirmModalAction === 'da' ? 'Xác nhận đã nghiệm thu' : 'Xác nhận chưa nghiệm thu'}
        cancelText="Hủy"
        type={confirmModalAction === 'da' ? 'success' : 'warning'}
        loading={confirmLoading}
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
