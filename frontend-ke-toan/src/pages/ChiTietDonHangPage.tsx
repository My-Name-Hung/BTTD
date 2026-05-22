import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft, FiCheck, FiX, FiEdit2, FiTrash2,
  FiUser, FiMapPin, FiPhone, FiPackage,
  FiDollarSign, FiClock, FiTruck, FiCheckCircle,
  FiAlertTriangle, FiFileText, FiCheckSquare, FiExternalLink,
} from 'react-icons/fi';
import {
  layDonHang,
  layLichSanXuat,
  layNghiemThu,
  duyetDonHang,
  tuChoiDonHang,
  xoaDonHang,
} from '../services/api';
import {
  DonHang, LichSanXuat, NghiemThu,
  TRANG_THAI_DON_LABELS, TRANG_THAI_DON_COLORS,
} from '../types';
import { useToast } from '../hooks';
import { Loading, ConfirmModal } from '../components/Common';
import styles from './ChiTietDonHangPage.module.css';

const TRANG_THAI_STEPS = [
  { key: 'cho_duyet',     label: 'Chờ duyệt' },
  { key: 'da_duyet',      label: 'Đã duyệt' },
  { key: 'dang_san_xuat', label: 'Đang SX' },
  { key: 'dang_giao',     label: 'Đang giao' },
  { key: 'da_giao',       label: 'Đã giao' },
  { key: 'nghiem_thu',    label: 'Nghiệm thu' },
  { key: 'da_thanh_toan', label: 'Thanh toán' },
];

function formatCurrency(v: number) {
  return v?.toLocaleString('vi-VN') + ' đ' || '0 đ';
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusColor(key: string) {
  return TRANG_THAI_DON_COLORS[key] || '#64748b';
}

function statusBg(key: string) {
  const c = statusColor(key);
  return `rgba(${hexToRgb(c)}, 0.1)`;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export default function ChiTietDonHangPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();

  const [donHang, setDonHang] = useState<DonHang | null>(null);
  const [lichSX, setLichSX] = useState<LichSanXuat | null>(null);
  const [nghiemThu, setNghiemThu] = useState<NghiemThu | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [lyDoTuChoi, setLyDoTuChoi] = useState('');

  const userVaiTro = JSON.parse(localStorage.getItem('bttd_user') || '{}')?.vaiTro;
  const canApproveReject = ['admin', 'ke_toan'].includes(userVaiTro);
  const canEdit = ['admin', 'dieu_phoi'].includes(userVaiTro);
  const canDelete = ['admin'].includes(userVaiTro);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dh, lsArr, ntArr] = await Promise.all([
        layDonHang(parseInt(id)),
        layLichSanXuat(parseInt(id)),
        layNghiemThu(parseInt(id)),
      ]);
      setDonHang(dh);
      setLichSX(lsArr[0] || null);
      setNghiemThu(ntArr || null);
    } catch {
      showToast('Không tải được thông tin đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDuyet = async () => {
    if (!donHang) return;
    setApproveLoading(true);
    try {
      await duyetDonHang(donHang.id);
      showToast('Duyệt đơn hàng thành công');
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi duyệt đơn', 'error');
    } finally {
      setApproveLoading(false);
    }
  };

  const handleTuChoi = async () => {
    if (!donHang || !lyDoTuChoi.trim()) return;
    setRejectLoading(true);
    try {
      await tuChoiDonHang(donHang.id, lyDoTuChoi);
      showToast('Từ chối đơn hàng thành công');
      setShowRejectModal(false);
      setLyDoTuChoi('');
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi từ chối đơn', 'error');
    } finally {
      setRejectLoading(false);
    }
  };

  const handleXoa = async () => {
    if (!donHang) return;
    setDeleteLoading(true);
    try {
      await xoaDonHang(donHang.id);
      showToast('Xóa đơn hàng thành công');
      navigate('/quan-ly/don-hang');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi xóa đơn', 'error');
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) return <Loading />;

  if (!donHang) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <span>Không tìm thấy đơn hàng</span>
      </div>
    );
  }

  const currentStepIdx = TRANG_THAI_STEPS.findIndex(s => s.key === donHang.trangThaiDon);
  const connLai = (donHang.thanhTien || 0) - (donHang.daThanhToan || 0);

  return (
    <div className={styles.detailPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/quan-ly/don-hang')}>
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className={styles.pageTitle}>{donHang.maDonHang}</div>
            <div className={styles.pageSubtitle}>
              Ngày tạo: {formatDate(donHang.ngayTaoDon)} ·{' '}
              <span style={{ color: statusColor(donHang.trangThaiDon), fontWeight: 600 }}>
                {TRANG_THAI_DON_LABELS[donHang.trangThaiDon]}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className={styles.pageActions}>
          {donHang.trangThaiDon === 'cho_duyet' && canApproveReject && (
            <>
              <button className={`${styles.actionBtn} ${styles.actionBtnSuccess}`} onClick={handleDuyet} disabled={approveLoading}>
                <FiCheck /> {approveLoading ? 'Đang duyệt...' : 'Duyệt đơn'}
              </button>
              <button className={`${styles.actionBtn} ${styles.actionBtnWarning}`} onClick={() => setShowRejectModal(true)}>
                <FiX /> Từ chối
              </button>
            </>
          )}
          {canEdit && ['cho_duyet', 'da_duyet'].includes(donHang.trangThaiDon) && (
            <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={() => navigate(`/quan-ly/don-hang/sua/${donHang.id}`)}>
              <FiEdit2 /> Chỉnh sửa
            </button>
          )}
          {canDelete && ['cho_duyet', 'tu_choi'].includes(donHang.trangThaiDon) && (
            <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setShowDeleteModal(true)}>
              <FiTrash2 /> Xóa
            </button>
          )}
          {canEdit && ['dang_san_xuat', 'dang_giao', 'da_giao'].includes(donHang.trangThaiDon) && (
            <button className={`${styles.actionBtn} ${styles.actionBtnSecondary}`} onClick={() => navigate('/dieu-phoi')}>
              <FiTruck /> Điều phối
            </button>
          )}
          {canEdit && ['da_giao', 'nghiem_thu'].includes(donHang.trangThaiDon) && (
            <button className={`${styles.actionBtn} ${styles.actionBtnSecondary}`} onClick={() => navigate('/nghiem-thu')}>
              <FiCheckSquare /> Nghiệm thu
            </button>
          )}
          {canApproveReject && ['nghiem_thu', 'da_thanh_toan'].includes(donHang.trangThaiDon) && (
            <button className={`${styles.actionBtn} ${styles.actionBtnSecondary}`} onClick={() => navigate('/thanh-toan')}>
              <FiDollarSign /> Thanh toán
            </button>
          )}
        </div>
      </div>

      {/* Step Progress */}
      <div className={styles.stepProgressWrap}>
        <div className={styles.stepProgressTitle}>Tiến trình đơn hàng</div>
        <div className={styles.stepTrack}>
          <div className={styles.stepConnector}>
            <div className={styles.stepConnectorBg} />
            <div
              className={styles.stepConnectorFill}
              style={{
                width: currentStepIdx >= 0
                  ? `${(currentStepIdx / (TRANG_THAI_STEPS.length - 1)) * 100}%`
                  : '0%',
              }}
            />
          </div>
          {TRANG_THAI_STEPS.map((step, idx) => {
            const lastStepIdx = TRANG_THAI_STEPS.length - 1;
            const isLastDone = idx === lastStepIdx && currentStepIdx === lastStepIdx;
            const done = idx < currentStepIdx || isLastDone;
            const active = idx === currentStepIdx && !isLastDone;
            const pending = idx > currentStepIdx;
            let circleClass = styles.stepCirclePending;
            if (done) circleClass = styles.stepCircleDone;
            else if (active) circleClass = styles.stepCircleActive;

            let labelClass = styles.stepLabel;
            if (done) labelClass = `${styles.stepLabel} ${styles.stepLabelDone}`;
            else if (active) labelClass = `${styles.stepLabel} ${styles.stepLabelActive}`;

            return (
              <div key={step.key} className={styles.stepItem}>
                <div className={`${styles.stepCircle} ${circleClass}`}>
                  {done ? <FiCheck size={14} /> : idx + 1}
                </div>
                <div className={labelClass}>{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className={styles.infoGrid}>
        {/* Card: Khách hàng */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiUser size={14} /> Thông tin khách hàng
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Khách hàng</span>
            <span className={styles.infoValue}>{donHang.tenKhachHang}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Số điện thoại</span>
            <span className={styles.infoValue}>{donHang.soDienThoai}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Địa chỉ nhận</span>
            <span className={styles.infoValue} style={{ maxWidth: 220 }}>{donHang.diaChiNhan}</span>
          </div>
        </div>

        {/* Card: Sản phẩm */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiPackage size={14} /> Thông tin sản phẩm
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Mác bê tông</span>
            <span className={`${styles.infoValue} ${styles.infoValuePrimary}`}>{donHang.tenMacBeTong}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Khối lượng đặt</span>
            <span className={styles.infoValue}>{donHang.khoiLuongDat} m³</span>
          </div>
          {donHang.khoiLuongThucTe && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Khối lượng thực tế</span>
              <span className={`${styles.infoValue} ${styles.infoValueSuccess}`}>{donHang.khoiLuongThucTe} m³</span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Đơn giá</span>
            <span className={styles.infoValue}>{formatCurrency(donHang.donGia)}/m³</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Giao dự kiến</span>
            <span className={styles.infoValue}>{formatDateTime(donHang.thoiGianGiaoDuKien || '')}</span>
          </div>
        </div>

        {/* Card: Thanh toán */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiDollarSign size={14} /> Thông tin thanh toán
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Tổng tiền</span>
            <span className={`${styles.infoValue} ${styles.infoValuePrimary}`}>{formatCurrency(donHang.thanhTien || 0)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Đã thanh toán</span>
            <span className={`${styles.infoValue} ${styles.infoValueSuccess}`}>{formatCurrency(donHang.daThanhToan || 0)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Còn lại</span>
            <span className={`${styles.infoValue} ${connLai > 0 ? styles.infoValueDanger : styles.infoValueSuccess}`}>
              {formatCurrency(connLai)}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ngày duyệt</span>
            <span className={styles.infoValue}>{formatDate(donHang.ngayDuyet || '')}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ngày giao</span>
            <span className={styles.infoValue}>{formatDate(donHang.ngayGiao || '')}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ngày nghiệm thu</span>
            <span className={styles.infoValue}>{formatDate(donHang.ngayNghiemThu || '')}</span>
          </div>
        </div>

        {/* Card: Trạng thái */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiClock size={14} /> Trạng thái & Ghi chú
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Trạng thái</span>
            <span>
              <span
                className={styles.infoBadge}
                style={{
                  background: statusBg(donHang.trangThaiDon),
                  color: statusColor(donHang.trangThaiDon),
                }}
              >
                {TRANG_THAI_DON_LABELS[donHang.trangThaiDon]}
              </span>
            </span>
          </div>
          {donHang.lyDoTuChoi && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Lý do từ chối</span>
              <span className={`${styles.infoValue} ${styles.infoValueDanger}`}>{donHang.lyDoTuChoi}</span>
            </div>
          )}
          <div className={styles.infoRow} style={{ flexDirection: 'column', gap: 4 }}>
            <span className={styles.infoLabel}>Ghi chú</span>
            <span className={styles.infoValue} style={{ textAlign: 'left', fontSize: 13 }}>
              {donHang.ghiChu || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Lịch sản xuất */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <div className={`${styles.sectionAccent} ${styles.sectionAccentBlue}`} />
            <FiTruck size={16} style={{ color: 'var(--color-primary)' }} />
            Lịch sản xuất
          </div>
          {lichSX && (
            <span
              className={styles.sectionChip}
              style={{
                background: lichSX.trangThai === 'da_xong'
                  ? 'rgba(16,185,129,0.1)'
                  : lichSX.trangThai === 'dang_san_xuat'
                  ? 'rgba(139,92,246,0.1)'
                  : 'rgba(7,60,235,0.08)',
                color: lichSX.trangThai === 'da_xong'
                  ? '#047857'
                  : lichSX.trangThai === 'dang_san_xuat'
                  ? '#6d28d9'
                  : 'var(--color-primary)',
              }}
            >
              {lichSX.trangThai === 'da_xong' ? 'Hoàn thành' : lichSX.trangThai === 'dang_san_xuat' ? 'Đang sản xuất' : 'Chưa sản xuất'}
            </span>
          )}
        </div>

        {lichSX ? (
          <table className={styles.subTable}>
            <tbody>
              <tr>
                <th style={{ width: 160 }}>Biển số xe</th>
                <td>{lichSX.bienSoXe || '—'}</td>
                <th style={{ width: 160 }}>Kỹ thuật</th>
                <td>{lichSX.kyThuatCongTrinh || '—'}</td>
              </tr>
              <tr>
                <th>Người ôm ống</th>
                <td>{lichSX.nguoiOmOng || '—'}</td>
                <th>Người bắt ống</th>
                <td>{lichSX.nguoiBatOng || '—'}</td>
              </tr>
              <tr>
                <th>Phương án đổ</th>
                <td colSpan={3}>{lichSX.phuongAnDo || '—'}</td>
              </tr>
              {lichSX.ghiChu && (
                <tr>
                  <th>Ghi chú</th>
                  <td colSpan={3}>{lichSX.ghiChu}</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className={styles.subTableEmpty}>
            <FiTruck size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Chưa có lịch sản xuất</div>
          </div>
        )}
      </div>

      {/* Nghiệm thu */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <div className={`${styles.sectionAccent} ${styles.sectionAccentGreen}`} />
            <FiCheckCircle size={16} style={{ color: 'var(--color-success)' }} />
            Biên bản nghiệm thu
          </div>
          {nghiemThu && (
            <span className={styles.sectionChip}
              style={{
                background: nghiemThu.chatLuong === 'dat'
                  ? 'rgba(16,185,129,0.1)'
                  : 'rgba(239,68,68,0.08)',
                color: nghiemThu.chatLuong === 'dat' ? '#047857' : 'var(--color-danger)',
              }}>
              {nghiemThu.chatLuong === 'dat' ? 'Đạt' : 'Không đạt'}
            </span>
          )}
        </div>

        {nghiemThu ? (
          <table className={styles.subTable}>
            <tbody>
              <tr>
                <th style={{ width: 140 }}>Số BB</th>
                <td>{nghiemThu.bienBanSo || '—'}</td>
                <th style={{ width: 140 }}>Ngày lập</th>
                <td>{formatDate(nghiemThu.ngayLapBienBan || '')}</td>
              </tr>
              <tr>
                <th>KL xác nhận</th>
                <td>{nghiemThu.khoiLuongXacNhan ? `${nghiemThu.khoiLuongXacNhan} m³` : '—'}</td>
                <th>KL thực tế</th>
                <td>{nghiemThu.khoiLuongThucTe ? `${nghiemThu.khoiLuongThucTe} m³` : '—'}</td>
              </tr>
              <tr>
                <th>Người lập</th>
                <td>{nghiemThu.nguoiLap || '—'}</td>
                <th>Người ký</th>
                <td>{nghiemThu.nguoiKy || '—'}</td>
              </tr>
              <tr>
                <th>Chức vụ</th>
                <td>{nghiemThu.chucVu || '—'}</td>
                <th>Đã gửi khách</th>
                <td>{nghiemThu.daGuiKhach ? '✓ Đã gửi' : '✗ Chưa gửi'}</td>
              </tr>
              {nghiemThu.bienBanFile && (
                <tr>
                  <th>File đính kèm</th>
                  <td colSpan={3}>
                    <a
                      href={`${(import.meta.env.VITE_API_URL || 'https://bttd.onrender.com/api').replace('/api', '')}${nghiemThu.bienBanFile}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <FiExternalLink size={13} /> Mở biên bản nghiệm thu
                    </a>
                  </td>
                </tr>
              )}
              {nghiemThu.ghiChu && (
                <tr>
                  <th>Ghi chú</th>
                  <td colSpan={3}>{nghiemThu.ghiChu}</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className={styles.subTableEmpty}>
            <FiFileText size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Chưa có biên bản nghiệm thu</div>
          </div>
        )}
      </div>

      {/* Toast */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              boxShadow: 'var(--shadow-md)',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: t.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
              color: 'white',
              minWidth: 280,
              animation: 'taSlideIn 0.3s ease',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Modal từ chối */}
      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleTuChoi}
        title="Từ chối đơn hàng"
        message="Bạn có chắc muốn từ chối đơn hàng này? Vui lòng nhập lý do."
        confirmText="Xác nhận từ chối"
        cancelText="Hủy"
        type="warning"
        loading={rejectLoading}
        extra={
          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Lý do từ chối *
            </label>
            <textarea
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid var(--color-border)',
                borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
                minHeight: 80, boxSizing: 'border-box',
              }}
              value={lyDoTuChoi}
              onChange={(e) => setLyDoTuChoi(e.target.value)}
              placeholder="VD: Khách hàng chưa thanh toán đơn cũ..."
              autoFocus
            />
          </div>
        }
      />

      {/* Modal xóa */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleXoa}
        title="Xóa đơn hàng"
        message={`Bạn có chắc muốn xóa đơn hàng "${donHang.maDonHang}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
