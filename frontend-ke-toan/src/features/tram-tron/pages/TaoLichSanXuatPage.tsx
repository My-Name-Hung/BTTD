import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiTruck, FiUser, FiTool, FiArrowLeft, FiHome } from 'react-icons/fi';
import {
  layDanhSachXe, layDanhSachDonHang, layDanhSachTramTron,
  layLichSanXuat, taoLichSanXuat, capNhatLichSanXuat,
} from '../../../shared/services/api';
import { Xe, DonHang, LichSanXuat, TramTron } from '../../../shared/types';
import { useToast } from '../../../shared/hooks';
import { ConfirmModal } from '../../../shared/components/Common';
import styles from './TaoLichSanXuatPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

export default function TaoLichSanXuatPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const idDonHang = id ? parseInt(id) : null;

  const { toasts, showToast } = useToast();

  const [xes, setXes] = useState<Xe[]>([]);
  const [tramTrons, setTramTrons] = useState<TramTron[]>([]);
  const [donHang, setDonHang] = useState<DonHang | null>(null);
  const [existingLich, setExistingLich] = useState<LichSanXuat | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const [form, setForm] = useState({
    idXe: '', bienSoXe: '',
    idTramTron: '', tenTramTron: '',
    kyThuatCongTrinh: '', nguoiOmOng: '', nguoiBatOng: '',
    ghiChu: '',
  });

  const [initialForm, setInitialForm] = useState(form);
  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialForm);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [xeRes, tramRes] = await Promise.all([
          layDanhSachXe(),
          layDanhSachTramTron(),
        ]);
        setXes(xeRes);
        setTramTrons(tramRes);

        if (idDonHang) {
          const dhRes = await layDanhSachDonHang(1, 100, 'da_duyet');
          const found = dhRes.data?.find((d: DonHang) => d.id === idDonHang);
          if (found) setDonHang(found);

          const lichs = await layLichSanXuat(idDonHang);
          if (lichs?.length) {
            const lich = lichs[0];
            setExistingLich(lich);
            const xe = xeRes.find((x: Xe) => x.id === lich.idXe);
            const tram = tramRes.find((t: TramTron) => t.id === lich.idTramTron);
            setForm({
              idXe: lich.idXe ? String(lich.idXe) : '',
              bienSoXe: lich.bienSoXe || '',
              idTramTron: lich.idTramTron ? String(lich.idTramTron) : '',
              tenTramTron: tram?.tenTram || '',
              kyThuatCongTrinh: lich.kyThuatCongTrinh || '',
              nguoiOmOng: lich.nguoiOmOng || '',
              nguoiBatOng: lich.nguoiBatOng || '',
              ghiChu: lich.ghiChu || '',
            });
            setInitialForm({
              idXe: lich.idXe ? String(lich.idXe) : '',
              bienSoXe: lich.bienSoXe || '',
              idTramTron: lich.idTramTron ? String(lich.idTramTron) : '',
              tenTramTron: tram?.tenTram || '',
              kyThuatCongTrinh: lich.kyThuatCongTrinh || '',
              nguoiOmOng: lich.nguoiOmOng || '',
              nguoiBatOng: lich.nguoiBatOng || '',
              ghiChu: lich.ghiChu || '',
            });
          }
        }
      } catch {
        showToast('Lỗi tải dữ liệu', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [idDonHang, showToast]);

  const handleXeChange = (xeId: string) => {
    const xe = xes.find((x) => x.id === parseInt(xeId));
    setForm({ ...form, idXe: xeId, bienSoXe: xe?.bienSo || '' });
  };

  const handleTramChange = (tramId: string) => {
    const tram = tramTrons.find((t) => t.id === parseInt(tramId));
    setForm({ ...form, idTramTron: tramId, tenTramTron: tram?.tenTram || '' });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!idDonHang) return;
    if (!form.idTramTron) { showToast('Vui lòng chọn trạm trộn', 'error'); return; }

    setSubmitting(true);
    try {
      const xe = xes.find((x) => x.id === parseInt(form.idXe));
      const payload: Partial<LichSanXuat> = {
        idDonHang,
        idXe: form.idXe ? parseInt(form.idXe) : null,
        idTramTron: form.idTramTron ? parseInt(form.idTramTron) : null,
        bienSoXe: xe?.bienSo || form.bienSoXe || null,
        kyThuatCongTrinh: form.kyThuatCongTrinh || null,
        nguoiOmOng: form.nguoiOmOng || null,
        nguoiBatOng: form.nguoiBatOng || null,
        ghiChu: form.ghiChu || null,
      };

      if (existingLich) {
        await capNhatLichSanXuat(existingLich.id, payload);
      } else {
        await taoLichSanXuat(payload);
      }
      setShowSuccess(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancel(true);
    } else {
      navigate('/dieu-phoi');
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <span>Đang tải...</span>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderBack}>
          <button type="button" className={styles.backBtn} onClick={handleCancel}>
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className={styles.pageHeaderTitle}>
              {existingLich ? 'Sửa lịch sản xuất' : 'Tạo lịch sản xuất'}
            </div>
            <div className={styles.pageHeaderDesc}>
              {existingLich ? 'Cập nhật thông tin lịch sản xuất' : 'Nhập thông tin để tạo lịch sản xuất'}
            </div>
          </div>
        </div>
      </div>

      {donHang && (
        <div className={styles.orderInfoCard}>
          <div className={styles.orderInfoHeader}>
            <div className={styles.orderInfoTitle}>{donHang.maDonHang}</div>
            <div className={styles.orderInfoBadge}>{donHang.tenKhachHang}</div>
          </div>
          <div className={styles.orderInfoGrid}>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Địa chỉ</span>
              <span className={styles.orderInfoValue}>{donHang.diaChiNhan}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Mác bê tông</span>
              <span className={styles.orderInfoValue}>{donHang.tenMacBeTong}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Khối lượng</span>
              <span className={styles.orderInfoValue}>{donHang.khoiLuongDat} m³</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Thành tiền</span>
              <span className={`${styles.orderInfoValue} ${styles.orderInfoValueHighlight}`}>
                {formatCurrency(donHang.thanhTien || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          <div className={styles.sectionTitle}>
            <FiTruck size={15} /> Thông tin xe giao
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Xe giao hàng</label>
              <select
                className={styles.formSelect}
                value={form.idXe}
                onChange={(e) => handleXeChange(e.target.value)}
              >
                <option value="">— Chọn xe —</option>
                {xes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.bienSo} — {x.tenTaiXe || 'Không có tài xế'}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Biển số xe</label>
              <input
                className={styles.formInput}
                value={form.bienSoXe}
                onChange={(e) => setForm({ ...form, bienSoXe: e.target.value })}
                placeholder="VD: 59C1-12345"
              />
            </div>
          </div>

          <div className={styles.formDivider} />
          <div className={styles.sectionTitle}>
            <FiHome size={15} /> Thông tin trạm trộn
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Trạm trộn *</label>
            <select
              className={styles.formSelect}
              value={form.idTramTron}
              onChange={(e) => handleTramChange(e.target.value)}
            >
              <option value="">— Chọn trạm trộn —</option>
              {tramTrons.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tenTram} {t.diaChi ? `— ${t.diaChi}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formDivider} />
          <div className={styles.sectionTitle}>
            <FiUser size={15} /> Thông tin nhân sự
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Kỹ thuật công trình</label>
              <input
                className={styles.formInput}
                value={form.kyThuatCongTrinh}
                onChange={(e) => setForm({ ...form, kyThuatCongTrinh: e.target.value })}
                placeholder="VD: Nguyễn Văn A"
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Người ôm ống</label>
              <input
                className={styles.formInput}
                value={form.nguoiOmOng}
                onChange={(e) => setForm({ ...form, nguoiOmOng: e.target.value })}
                placeholder="VD: Trần Văn B"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Người bắt ống</label>
              <input
                className={styles.formInput}
                value={form.nguoiBatOng}
                onChange={(e) => setForm({ ...form, nguoiBatOng: e.target.value })}
                placeholder="VD: Lê Văn C"
              />
            </div>
          </div>

          <div className={styles.formDivider} />
          <div className={styles.sectionTitle}>
            <FiTool size={15} /> Ghi chú
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ghi chú lịch sản xuất</label>
            <textarea
              className={styles.formTextarea}
              value={form.ghiChu}
              onChange={(e) => setForm({ ...form, ghiChu: e.target.value })}
              placeholder="VD: Cần xe bơm, đường vào hẹp, liên hệ trước 30 phút..."
              rows={3}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" className="btn btn-cancel" onClick={handleCancel}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn btn-save" disabled={submitting}>
              <FiSave /> {submitting ? 'Đang lưu...' : (existingLich ? 'Lưu thay đổi' : 'Tạo lịch sản xuất')}
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showSuccess}
        onClose={() => { setShowSuccess(false); navigate('/dieu-phoi'); }}
        onConfirm={() => { setShowSuccess(false); navigate('/dieu-phoi'); }}
        message={existingLich ? 'Cập nhật lịch sản xuất thành công!' : 'Tạo lịch sản xuất thành công!'}
        confirmText="Đồng ý"
        cancelText=""
        title="Thành công"
        type="success"
      />

      <ConfirmModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => { setShowCancel(false); navigate('/dieu-phoi'); }}
        message="Bạn có chắc muốn hủy bỏ? Dữ liệu đã nhập sẽ không được lưu."
        confirmText="Hủy bỏ"
        cancelText="Ở lại"
        title="Xác nhận hủy bỏ"
        type="warning"
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
