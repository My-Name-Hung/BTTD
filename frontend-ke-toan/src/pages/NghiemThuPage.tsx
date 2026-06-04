import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiCheck, FiFileText, FiX, FiUpload, FiExternalLink, FiCheckCircle, FiClock, FiImage, FiFile } from 'react-icons/fi';
import {
  layDanhSachDonHang, layNghiemThu,
  xacNhanNghiemThu, layLichSuThanhToan,
  uploadBienBanNghiemThu,
} from '../services/api';
import { DonHang, NghiemThu, ThanhToan } from '../types';
import { useToast, usePageRole } from '../hooks';
import { Modal, Loading, EmptyState, ConfirmModal } from '../components/Common';
import styles from './NghiemThuPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

type TabType = 'can_nghiem_thu' | 'da_nghiem_thu';

// Parse bienBanFile: có thể là string, string[], hoặc JSON string
function parseBienBanFiles(bienBanFile: string | string[] | null | undefined): string[] {
  if (!bienBanFile) return [];
  if (Array.isArray(bienBanFile)) return bienBanFile;
  if (typeof bienBanFile === 'string') {
    if (bienBanFile.startsWith('[')) {
      try { return JSON.parse(bienBanFile); } catch { return []; }
    }
    return [bienBanFile];
  }
  return [];
}

function getBaseUrl() {
  return import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3433';
}

function isDriveLink(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

function buildFileUrl(fileUrl: string): string {
  if (isDriveLink(fileUrl)) return fileUrl;
  return `${getBaseUrl()}${fileUrl}`;
}

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
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [selectedDonHang, setSelectedDonHang] = useState<DonHang | null>(null);
  const [selectedNt, setSelectedNt] = useState<NghiemThu | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  const canConfirm = hasPermission('nghiemthu.confirm');

  const userVaiTro = JSON.parse(localStorage.getItem("bttd_user") || "{}")?.vaiTro;
  const isKyThuat = userVaiTro === "ky_thuat" || userVaiTro === "admin";

  const resetModal = () => {
    setUploadModalOpen(false);
    setSelectedDonHang(null);
    setSelectedNt(null);
    setUploadFiles([]);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch cả đơn đang giao + đã nghiệm thu (chờ thanh toán)
      const [dangGiaoRes, nghiemThuRes] = await Promise.all([
        layDanhSachDonHang(1, 100, 'da_giao'),
        layDanhSachDonHang(1, 100, 'nghiem_thu'),
      ]);
      const dhs = [...(dangGiaoRes.data || []), ...(nghiemThuRes.data || [])];
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

  useEffect(() => { resetModal(); }, [tab]);

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
    setUploadModalOpen(true);
  };

  const handleUpload = async () => {
    if (!selectedDonHang || uploadFiles.length === 0) return;
    setUploadLoading(true);
    try {
      await xacNhanNghiemThu(selectedDonHang.id, 'da');
      await uploadBienBanNghiemThu(selectedDonHang.id, uploadFiles);
      showToast(`Đã tải ${uploadFiles.length} file và xác nhận nghiệm thu thành công`);
      setUploadModalOpen(false);
      setUploadFiles([]);
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi tải file', 'error'); }
    finally { setUploadLoading(false); }
  };

  const openUploadFile = (dh: DonHang, nt: NghiemThu) => {
    setSelectedDonHang(dh);
    setSelectedNt(nt);
    setUploadFiles([]);
    setUploadModalOpen(true);
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

            return (
              <div
                key={dh.id}
                className={`${styles.cardGridItem} ${isDaNT ? styles.cardGridItemSuccess : styles.cardGridItemInfo}`}
              >
                <div className={styles.cardBody}>
                  <div className={styles.cardGridHeader}>
                    <span className={styles.cardGridTitle}>{dh.maDonHang}</span>
                    <div className={styles.cardGridStatus}>
                      <span className={`${styles.statusDot} ${isDaNT ? styles.statusDotSuccess : styles.statusDotWarning}`} />
                      <span className={`${styles.badge} ${isDaNT ? styles.badgeDaNghiemThu : styles.badgeChoNghiemThu}`}>
                        {isDaNT ? 'Đã nghiệm thu' : 'Cần nghiệm thu'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardGridMeta}><strong>{dh.tenKhachHang}</strong></div>
                  <div className={styles.cardGridMetaSecondary}>{dh.diaChiNhan}</div>

                  <div className={styles.cardGridDivider} />

                  <div className={styles.cardGridValue}>
                    {dh.tenMacBeTong} &bull; <strong>{formatCurrency(dh.thanhTien || 0)}</strong>
                  </div>
                  <div className={styles.cardGridValueSmall}>
                    KL đặt: {dh.khoiLuongDat} m³
                    {dh.khoiLuongThucTe && <> &bull; KL thực tế: <strong>{dh.khoiLuongThucTe} m³</strong></>}
                  </div>

                  {nt && (
                    <div className={styles.infoBox}>
                      <div className={styles.infoBoxRow}>
                        <div>
                          <div className={styles.infoBoxLabel}>Đã thanh toán</div>
                          <div className={`${styles.infoBoxValue} ${styles.infoBoxValueSuccess}`}>{formatCurrency(daTT)}</div>
                        </div>
                        <div>
                          <div className={styles.infoBoxLabel}>Giá trị đơn</div>
                          <div className={`${styles.infoBoxValue} ${styles.infoBoxValueHighlight}`}>{formatCurrency(dh.thanhTien || 0)}</div>
                        </div>
                      </div>
                      {parseBienBanFiles(nt?.bienBanFile).length > 0 && (
                        <div className={styles.infoBoxRow}>
                          <div>
                            <div className={styles.infoBoxLabel}>Biên bản ({parseBienBanFiles(nt?.bienBanFile).length} file)</div>
                            <div className={styles.bienBanFileList}>
                              {parseBienBanFiles(nt?.bienBanFile).map((fileUrl, idx) => (
                                <a key={idx} href={buildFileUrl(fileUrl)} target="_blank" rel="noopener noreferrer" className={styles.bienBanLink}>
                                  <FiExternalLink size={12} /> File {idx + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.cardGridFooter}>
                  {!isDaNT && isKyThuat && (
                    <button className="btn btn-save" onClick={() => handleDaNghiemThu(dh)}>
                      <FiCheck /> Đã nghiệm thu
                    </button>
                  )}
                  {isDaNT && parseBienBanFiles(nt?.bienBanFile).length > 0 && (
                    <div className={styles.bienBanMultiLinks}>
                      {parseBienBanFiles(nt?.bienBanFile).map((fileUrl, idx) => (
                        <a
                          key={idx}
                          href={buildFileUrl(fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.bienBanLink}
                        >
                          <FiExternalLink size={14} /> File {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal upload file biên bản nghiệm thu */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={resetModal}
        title={`Tải biên bản nghiệm thu - ${selectedDonHang?.maDonHang}`}
        footer={
          <>
            <button className="btn btn-cancel" onClick={resetModal}>Hủy</button>
            <button
              className="btn btn-save"
              onClick={handleUpload}
              disabled={uploadFiles.length === 0 || uploadLoading}
            >
              {uploadLoading ? 'Đang tải...' : 'Xác nhận nghiệm thu'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
          Vui lòng tải lên <strong>biên bản nghiệm thu</strong> đã ký với khách hàng. Hỗ trợ: <strong>.doc, .docx, .pdf, .jpg, .jpeg, .png</strong> (tối đa 10 file, 50MB/file)
        </p>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Chọn file biên bản nghiệm thu (có thể chọn nhiều file) *</label>
          <input
            type="file"
            className={styles.formInput}
            accept=".doc,.docx,.pdf,.jpg,.jpeg,.png"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setUploadFiles(prev => [...prev, ...files]);
            }}
          />
        </div>

        {/* Preview files đã chọn */}
        {uploadFiles.length > 0 && (
          <div className={styles.uploadFileList}>
            <div className={styles.uploadFileListHeader}>
              <span>Đã chọn {uploadFiles.length} file</span>
              <button className={styles.clearAllBtn} onClick={() => setUploadFiles([])}>
                <FiX size={12} /> Xóa tất cả
              </button>
            </div>
            {uploadFiles.map((file, idx) => {
              const isImage = file.type.startsWith('image/');
              return (
                <div key={idx} className={styles.uploadFileItem}>
                  <div className={styles.uploadFileIcon}>
                    {isImage ? <FiImage size={16} /> : <FiFile size={16} />}
                  </div>
                  <div className={styles.uploadFileInfo}>
                    <span className={styles.uploadFileName}>{file.name}</span>
                    <span className={styles.uploadFileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button
                    className={styles.removeFileBtn}
                    onClick={() => setUploadFiles(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <FiX size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
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
