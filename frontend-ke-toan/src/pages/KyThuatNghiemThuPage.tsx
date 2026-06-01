import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiFileText, FiEye, FiSearch, FiUpload } from 'react-icons/fi';
import {
  layDonHangChoNghiemThu,
  xacNhanNghiemThuUploadFile,
} from '../services/api';
import { DonHang, TRANG_THAI_DON_LABELS } from '../types';
import { useToast, useAuth } from '../hooks';
import { Loading, ConfirmModal } from '../components/Common';
import styles from './KyThuatNghiemThuPage.module.css';
import { formatDateVN } from '../utils/dateUtils';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }
function formatDate(d: string | null | undefined): string {
  return d ? formatDateVN(d) : '';
}
function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

export default function KyThuatNghiemThuPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, showToast } = useToast();
  const [donHangList, setDonHangList] = useState<DonHang[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<DonHang | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [tuKhoa, setTuKhoa] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await layDonHangChoNghiemThu();
      setDonHangList(data);
    } catch {
      showToast('Không tải được danh sách', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleNghiemThu = async () => {
    if (!confirmTarget) return;
    if (!uploadFile) {
      showToast('Vui lòng chọn file biên bản nghiệm thu', 'error');
      return;
    }
    setUploadLoading(true);
    try {
      await xacNhanNghiemThuUploadFile(confirmTarget.id, uploadFile);
      showToast('Xác nhận nghiệm thu thành công');
      setConfirmTarget(null);
      setUploadFile(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi nghiệm thu', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const filteredList = tuKhoa
    ? donHangList.filter(d =>
        d.maDonHang?.toLowerCase().includes(tuKhoa.toLowerCase()) ||
        d.tenKhachHang?.toLowerCase().includes(tuKhoa.toLowerCase())
      )
    : donHangList;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <FiCheckCircle size={22} />
          <span>Nghiệm thu</span>
        </div>
        <div className={styles.pageSubtitle}>
          Xin chào, {user?.hoTen} — Xác nhận nghiệm thu khi đã ký biên bản với khách
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{donHangList.length}</div>
          <div className={styles.kpiLabel}>Chờ nghiệm thu</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiValue} ${styles.kpiSuccess}`}>
            {donHangList.filter(d => d.trangThaiDon === 'nghiem_thu').length}
          </div>
          <div className={styles.kpiLabel}>Đã nghiệm thu</div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchBar}>
        <div className={styles.searchInput}>
          <FiSearch size={16} />
          <input
            type="text"
            placeholder="Tìm theo mã đơn, tên khách..."
            value={tuKhoa}
            onChange={(e) => setTuKhoa(e.target.value)}
          />
        </div>
      </div>

      {/* Order List */}
      {loading ? <Loading /> : filteredList.length === 0 ? (
        <div className={styles.emptyState}>
          <FiCheckCircle size={48} />
          <p>Không có đơn cần nghiệm thu</p>
        </div>
      ) : (
        <div className={styles.orderList}>
          {filteredList.map((dh) => (
            <div
              key={dh.id}
              className={styles.orderCard}
              onClick={() => navigate(`/ky-thuat/don-hang/${dh.id}`)}
            >
              <div className={styles.orderCardHeader}>
                <div>
                  <div className={styles.orderMa}>{dh.maDonHang}</div>
                  <div className={styles.orderKhach}>{dh.tenKhachHang}</div>
                </div>
                <span
                  className={styles.orderStatus}
                  style={{
                    background: dh.trangThaiDon === 'nghiem_thu' ? '#79554822' : '#4caf5022',
                    color: dh.trangThaiDon === 'nghiem_thu' ? '#795548' : '#4caf50',
                  }}
                >
                  {dh.trangThaiDon === 'nghiem_thu' ? 'Đã nghiệm thu' : 'Chờ nghiệm thu'}
                </span>
              </div>

              <div className={styles.orderInfo}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Mác BT</span>
                  <span className={styles.infoValue}>{dh.tenMacBeTong || '—'}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Khối lượng</span>
                  <span className={styles.infoValue}>{dh.khoiLuongDat || 0} m³</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Thành tiền</span>
                  <span className={`${styles.infoValue} ${styles.infoBold}`}>
                    {formatCurrency(dh.thanhTien || 0)}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Ngày giao</span>
                  <span className={styles.infoValue}>{formatDate(dh.ngayGiao as unknown as string)}</span>
                </div>
              </div>

              <div className={styles.orderActions}>
                <button
                  className={styles.btnView}
                  onClick={(e) => { e.stopPropagation(); navigate(`/ky-thuat/don-hang/${dh.id}`); }}
                >
                  <FiEye size={14} /> Chi tiết
                </button>
                {dh.trangThaiDon !== 'nghiem_thu' && (
                  <button
                    className={styles.btnNghiemThu}
                    onClick={(e) => { e.stopPropagation(); setConfirmTarget(dh); }}
                  >
                    <FiCheckCircle size={14} /> Xác nhận
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <ConfirmModal
        isOpen={!!confirmTarget}
        title={`Xác nhận — ${confirmTarget?.maDonHang}`}
        message=""
        confirmText="Xác nhận nghiệm thu"
        cancelText="Hủy"
        onConfirm={handleNghiemThu}
        onClose={() => { setConfirmTarget(null); setUploadFile(null); }}
        loading={uploadLoading}
        extra={
          <div className={styles.uploadSection}>
            <p className={styles.uploadNote}>
              Tải lên <strong>biên bản nghiệm thu</strong> đã ký với khách hàng để xác nhận nghiệm thu.
            </p>
            {!uploadFile ? (
              <div className={styles.fileDropZone}>
                <input
                  type="file"
                  className={styles.fileDropZoneInput}
                  accept=".doc,.docx,.pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <div className={styles.fileDropZoneIcon}>
                  <FiUpload size={36} />
                </div>
                <div className={styles.fileDropZoneText}>Nhấn hoặc kéo file vào đây</div>
                <div className={styles.fileDropZoneHint}>Nhấn để chọn file từ máy</div>
                <div className={styles.fileDropZoneFormats}>Hỗ trợ: .doc, .docx, .pdf, .jpg, .png (tối đa 50MB)</div>
              </div>
            ) : (
              <div className={styles.filePreview}>
                <FiFileText size={18} />
                <div className={styles.filePreviewInfo}>
                  <span className={styles.filePreviewName}>{uploadFile.name}</span>
                  <span className={styles.fileSize}>
                    {formatFileSize(uploadFile.size)}
                  </span>
                </div>
                <button
                  className={styles.filePreviewRemove}
                  onClick={() => setUploadFile(null)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        }
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
