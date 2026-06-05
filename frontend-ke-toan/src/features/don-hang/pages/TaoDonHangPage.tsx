import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiCalendar, FiArrowLeft, FiPlus, FiExternalLink } from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  taoDonHang, suaDonHang, layDonHang,
  layDanhSachKhachHang, layDanhSachMacBeTong, layDanhSachTramTron,
  taoKhachHang,
} from '../../../shared/services/api';
import { DonHang, KhachHang, MacBeTong, TramTron } from "../../../shared/types";
import { useToast } from "../../../shared/hooks";
import { ConfirmModal, Modal } from "../../../shared/components/Common";
import styles from './TaoDonHangPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

function parseLocalDatetime(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [datePart, timePart] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  let h = 0, min = 0;
  if (timePart) {
    [h, min] = timePart.split(':').map(Number);
  }
  return new Date(y, m - 1, d, h, min);
}

const EMPTY_FORM = {
  tenKhachHang: '', diaChiNhan: '', soDienThoai: '',
  tenMacBeTong: '', khoiLuongDat: '', donGia: '',
  ghiChu: '', idKhachHang: '', idMacBeTong: '', idTramTron: '',
};

export default function TaoDonHangPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const editingId = id ? parseInt(id) : null;
  const isEdit = !!editingId;

  const { toasts, showToast } = useToast();

  const [khachHangs, setKhachHangs] = useState<KhachHang[]>([]);
  const [macBeTongs, setMacBeTongs] = useState<MacBeTong[]>([]);
  const [tramTrons, setTramTrons] = useState<TramTron[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [macSearchOpen, setMacSearchOpen] = useState(false);
  const [macSearchQuery, setMacSearchQuery] = useState('');
  const [khachSearchOpen, setKhachSearchOpen] = useState(false);
  const [khachSearchQuery, setKhachSearchQuery] = useState('');
  const [showKhachHangModal, setShowKhachHangModal] = useState(false);
  const [newKhachHang, setNewKhachHang] = useState({ tenKhachHang: '', soDienThoai: '', diaChi: '' });
  const [newKhachLoading, setNewKhachLoading] = useState(false);
  const khachDropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [thoiGianGiaoDuKien, setThoiGianGiaoDuKien] = useState<Date | null>(null);

  const thanhTien = (() => {
    const khoiLuong = parseFloat(form.khoiLuongDat) || 0;
    const mac = macBeTongs.find(m => m.id === parseInt(form.idMacBeTong));
    const donGia = mac?.donGia || 0;
    return khoiLuong * donGia;
  })();

  // Track initial state for change detection
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [initialThoiGian, setInitialThoiGian] = useState<Date | null>(null);

  const hasChanges =
    JSON.stringify(form) !== JSON.stringify(initialForm) ||
    thoiGianGiaoDuKien?.getTime() !== initialThoiGian?.getTime();

  const macDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (macDropdownRef.current && !macDropdownRef.current.contains(e.target as Node)) {
        setMacSearchOpen(false);
        setMacSearchQuery('');
      }
      if (khachDropdownRef.current && !khachDropdownRef.current.contains(e.target as Node)) {
        setKhachSearchOpen(false);
        setKhachSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    Promise.all([
      layDanhSachMacBeTong(),
      layDanhSachTramTron(),
      layDanhSachKhachHang(),
    ]).then(([mac, tram, kh]) => {
      setMacBeTongs(mac || []);
      setTramTrons(tram);
      setKhachHangs(kh.data || []);
      setLoading(false);
    });

    if (editingId) {
      layDonHang(editingId)
        .then((dh: DonHang) => {
          const f = {
            tenKhachHang: dh.tenKhachHang,
            diaChiNhan: dh.diaChiNhan,
            soDienThoai: dh.soDienThoai,
            tenMacBeTong: dh.tenMacBeTong || '',
            khoiLuongDat: String(dh.khoiLuongDat),
            donGia: '',
            ghiChu: dh.ghiChu || '',
            idKhachHang: String(dh.idKhachHang || ''),
            idMacBeTong: String(dh.idMacBeTong || ''),
            idTramTron: String(dh.idTramTron || ''),
          };
          const t = parseLocalDatetime(dh.thoiGianGiaoDuKien);
          setForm(f);
          setThoiGianGiaoDuKien(t);
          setInitialForm(f);
          setInitialThoiGian(t);
        })
        .catch(() => showToast('Không tải được đơn hàng', 'error'));
    } else {
      setInitialForm(EMPTY_FORM);
      setInitialThoiGian(null);
    }
  }, [editingId, showToast]);

  const handleMacChange = (macId: string) => {
    const mac = macBeTongs.find((m) => m.id === parseInt(macId));
    setForm((prev) => ({
      ...prev,
      idMacBeTong: macId,
      tenMacBeTong: mac?.tenMac || '',
      donGia: mac?.donGia
        ? Number(mac.donGia).toLocaleString('vi-VN')
        : '',
    }));
    setMacSearchOpen(false);
    setMacSearchQuery('');
  };

  const handleKhachHangChange = (kh: KhachHang) => {
    setForm((prev) => ({
      ...prev,
      idKhachHang: String(kh.id || ''),
      tenKhachHang: kh.tenKhachHang || '',
      soDienThoai: kh.soDienThoai || '',
      diaChiNhan: kh.diaChi || '',
    }));
    setKhachSearchOpen(false);
    setKhachSearchQuery('');
  };

  const handleAddKhachHang = async () => {
    if (!newKhachHang.tenKhachHang.trim()) {
      showToast('Vui lòng nhập tên khách hàng', 'error');
      return;
    }
    setNewKhachLoading(true);
    try {
      const created = await taoKhachHang({
        tenKhachHang: newKhachHang.tenKhachHang,
        soDienThoai: newKhachHang.soDienThoai,
        diaChi: newKhachHang.diaChi,
      });
      setKhachHangs((prev) => [created, ...prev]);
      handleKhachHangChange(created);
      setShowKhachHangModal(false);
      setNewKhachHang({ tenKhachHang: '', soDienThoai: '', diaChi: '' });
      showToast('Thêm khách hàng thành công');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi thêm khách hàng', 'error');
    } finally {
      setNewKhachLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!form.tenKhachHang.trim() || !form.diaChiNhan.trim() || !form.soDienThoai.trim()) {
      showToast('Vui lòng nhập đầy đủ thông tin bắt buộc', 'error');
      return;
    }
    if (!form.khoiLuongDat || parseFloat(form.khoiLuongDat) <= 0) {
      showToast('Khối lượng phải lớn hơn 0', 'error');
      return;
    }
    if (!form.idMacBeTong) {
      showToast('Vui lòng chọn mác bê tông', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const khoiLuong = parseFloat(form.khoiLuongDat);
      const mac = macBeTongs.find(m => m.id === parseInt(form.idMacBeTong));
      const donGiaMac = mac?.donGia || 0;
      const tongThanhTien = khoiLuong * donGiaMac;

      const payload: Partial<DonHang> = {
        tenKhachHang: form.tenKhachHang,
        diaChiNhan: form.diaChiNhan,
        soDienThoai: form.soDienThoai,
        tenMacBeTong: form.tenMacBeTong,
        khoiLuongDat: khoiLuong,
        donGia: donGiaMac,
        thanhTien: tongThanhTien,
        thoiGianGiaoDuKien: thoiGianGiaoDuKien ? toLocalDatetimeInput(thoiGianGiaoDuKien) : null,
        ghiChu: form.ghiChu || null,
        idKhachHang: form.idKhachHang ? parseInt(form.idKhachHang) : null,
        idMacBeTong: form.idMacBeTong ? parseInt(form.idMacBeTong) : null,
        idTramTron: form.idTramTron ? parseInt(form.idTramTron) : null,
      };

      if (editingId) {
        await suaDonHang(editingId, payload);
      } else {
        await taoDonHang(payload);
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
      navigate('/quan-ly/don-hang');
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

  const minDate = new Date();

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderBack}>
          <button type="button" className={styles.backBtn} onClick={handleCancel}>
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className={styles.pageHeaderTitle}>{isEdit ? 'Sửa đơn hàng' : 'Tạo đơn hàng mới'}</div>
            <div className={styles.pageHeaderDesc}>
              {isEdit ? 'Cập nhật thông tin đơn hàng' : 'Nhập thông tin để tạo đơn hàng mới'}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          <div className={styles.sectionTitle}>Thông tin khách hàng</div>
          <div className={styles.formRow}>
            <div className={styles.formGroup} ref={khachDropdownRef} style={{ position: 'relative' }}>
              <label className={styles.formLabel}>Khách hàng</label>
              <div className={styles.searchDropdownDisplay} onClick={() => setKhachSearchOpen(o => !o)}
                role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setKhachSearchOpen(o => !o)}>
                <span className={form.idKhachHang ? '' : styles.searchDropdownPlaceholder}>
                  {form.tenKhachHang || '— Chọn khách hàng —'}
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button type="button" className={styles.iconBtnSmall} onClick={(e) => { e.stopPropagation(); setKhachSearchOpen(false); setKhachSearchQuery(''); setShowKhachHangModal(true); }} title="Thêm khách hàng mới">
                    <FiPlus size={14} />
                  </button>
                  <svg className={`${styles.searchDropdownArrow} ${khachSearchOpen ? styles.searchDropdownArrowOpen : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              {khachSearchOpen && (
                <div className={styles.searchDropdownPanel}>
                  <input className={styles.searchDropdownInput} placeholder="Tìm tên khách hàng..." value={khachSearchQuery}
                    onChange={(e) => setKhachSearchQuery(e.target.value)} autoFocus />
                  <div className={styles.searchDropdownList}>
                    {khachHangs.filter(k => (k.tenKhachHang || '').toLowerCase().includes(khachSearchQuery.toLowerCase())).length === 0 && (
                      <div className={styles.searchDropdownEmpty}>Không tìm thấy</div>
                    )}
                    {khachHangs.filter(k => (k.tenKhachHang || '').toLowerCase().includes(khachSearchQuery.toLowerCase())).map((k) => (
                      <div key={k.id} className={`${styles.searchDropdownItem} ${parseInt(form.idKhachHang) === k.id ? styles.searchDropdownItemActive : ''}`}
                        onClick={() => handleKhachHangChange(k)}>
                        <div className={styles.searchDropdownItemName}>{k.tenKhachHang}</div>
                        <div className={styles.searchDropdownItemSub}>{k.soDienThoai || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Số điện thoại *</label>
              <input className={styles.formInput} value={form.soDienThoai} onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })} placeholder="VD: 0901 234 567" required />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Địa chỉ nhận hàng *</label>
            <input
              className={styles.formInput}
              value={form.diaChiNhan}
              onChange={(e) => setForm({ ...form, diaChiNhan: e.target.value })}
              placeholder="VD: Số 123, Đường Nguyễn Huệ, P.Thới Bình, Q.Ninh Kiều, TP.Cần Thơ"
              required
            />
          </div>

          <div className={styles.formDivider} />
          <div className={styles.sectionTitle}>Thông tin sản phẩm</div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Mác bê tông</label>
              <div className={styles.searchDropdownWrap} ref={macDropdownRef}>
                <div
                  className={styles.searchDropdownDisplay}
                  onClick={() => setMacSearchOpen((o) => !o)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setMacSearchOpen((o) => !o)}
                >
                  {form.idMacBeTong ? (
                    <span>
                      {(macBeTongs.find(m => m.id === parseInt(form.idMacBeTong)) || { tenMac: form.tenMacBeTong }).tenMac}
                      <span className={styles.searchDropdownPrice}>
                        — {formatCurrency(macBeTongs.find(m => m.id === parseInt(form.idMacBeTong))?.donGia || 0)}/m³
                      </span>
                    </span>
                  ) : (
                    <span className={styles.searchDropdownPlaceholder}>— Chọn mác bê tông —</span>
                  )}
                  <svg className={`${styles.searchDropdownArrow} ${macSearchOpen ? styles.searchDropdownArrowOpen : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {macSearchOpen && (
                  <div className={styles.searchDropdownPanel}>
                    <input
                      className={styles.searchDropdownInput}
                      placeholder="Tìm tên mác bê tông..."
                      value={macSearchQuery}
                      onChange={(e) => setMacSearchQuery(e.target.value)}
                      autoFocus
                    />
                    <div className={styles.searchDropdownList}>
                      {macBeTongs
                        .filter(m => m.tenMac.toLowerCase().includes(macSearchQuery.toLowerCase()))
                        .map((m) => (
                          <div
                            key={m.id}
                            className={`${styles.searchDropdownItem} ${parseInt(form.idMacBeTong) === m.id ? styles.searchDropdownItemActive : ''}`}
                            onClick={() => handleMacChange(String(m.id))}
                          >
                            <span className={styles.searchDropdownItemName}>{m.tenMac}</span>
                            <span className={styles.searchDropdownItemPrice}>{formatCurrency(m.donGia)}/m³</span>
                          </div>
                        ))}
                      {macBeTongs.filter(m => m.tenMac.toLowerCase().includes(macSearchQuery.toLowerCase())).length === 0 && (
                        <div className={styles.searchDropdownEmpty}>Không tìm thấy mác bê tông</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Trạm trộn</label>
              <select
                className={styles.formSelect}
                value={form.idTramTron}
                onChange={(e) => setForm({ ...form, idTramTron: e.target.value })}
              >
                <option value="">— Chọn trạm trộn —</option>
                {(() => {
                  const selectedTram = tramTrons.find(t => String(t.id) === form.idTramTron);
                  if (form.idTramTron && !selectedTram) {
                    return <option value={form.idTramTron}>{form.idTramTron} (đã nhập)</option>;
                  }
                  return tramTrons.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.tenTram}</option>
                  ));
                })()}
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Khối lượng (m³) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={styles.formInput}
                value={form.khoiLuongDat}
                onChange={(e) => setForm({ ...form, khoiLuongDat: e.target.value })}
                placeholder="VD: 50"
                required
              />
            </div>
          </div>

          <div className={styles.formDivider} />
          <div className={styles.sectionTitle}>Thông tin giao hàng</div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Thời gian giao dự kiến</label>
            <div className={styles.datePickerWrap}>
              <FiCalendar className={styles.datePickerIcon} />
              <DatePicker
                className={styles.datePickerInput}
                selected={thoiGianGiaoDuKien}
                onChange={(date: Date | null) => setThoiGianGiaoDuKien(date)}
                showTimeSelect
                timeIntervals={15}
                timeFormat="HH:mm"
                dateFormat="dd/MM/yyyy HH:mm"
                minDate={minDate}
                placeholderText="Chọn ngày và giờ giao hàng"
                todayButton="Hôm nay"
                autoComplete="off"
              />
              {thoiGianGiaoDuKien && (
                <button
                  type="button"
                  className={styles.datePickerClear}
                  onClick={() => setThoiGianGiaoDuKien(null)}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ghi chú</label>
            <textarea
              className={styles.formTextarea}
              value={form.ghiChu}
              onChange={(e) => setForm({ ...form, ghiChu: e.target.value })}
              placeholder="VD: Giao vào buổi sáng, cần liên hệ trước 30 phút..."
              rows={3}
            />
          </div>

          {thanhTien > 0 && (
            <div className={styles.thanhTienBox}>
              <span className={styles.thanhTienLabel}>Thành tiền dự kiến:</span>
              <span className={styles.thanhTienValue}>{formatCurrency(thanhTien)}</span>
            </div>
          )}

          <div className={styles.formActions}>
            <button type="button" className="btn btn-cancel" onClick={handleCancel}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn btn-save" disabled={submitting}>
              <FiSave /> {submitting ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Tạo đơn hàng')}
            </button>
          </div>
        </form>
      </div>

      {/* Confirm success modal */}
      <ConfirmModal
        isOpen={showSuccess}
        onClose={() => {
          setShowSuccess(false);
          navigate('/quan-ly/don-hang');
        }}
        onConfirm={() => {
          setShowSuccess(false);
          navigate('/quan-ly/don-hang');
        }}
        message={isEdit ? 'Cập nhật đơn hàng thành công!' : 'Tạo đơn hàng thành công!'}
        confirmText="Đồng ý"
        cancelText=""
        title={isEdit ? 'Thành công' : 'Thành công'}
        type="success"
      />

      {/* Confirm cancel modal */}
      <ConfirmModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => {
          setShowCancel(false);
          navigate('/quan-ly/don-hang');
        }}
        message="Bạn có chắc muốn hủy bỏ? Dữ liệu đã nhập sẽ không được lưu."
        confirmText="Hủy bỏ"
        cancelText="Ở lại"
        title="Xác nhận hủy bỏ"
        type="warning"
      />

      {/* Modal thêm khách hàng mới */}
      <Modal
        isOpen={showKhachHangModal}
        onClose={() => setShowKhachHangModal(false)}
        title="Thêm khách hàng mới"
        footer={
          <>
            <button className="btn btn-cancel" onClick={() => setShowKhachHangModal(false)} disabled={newKhachLoading}>Hủy</button>
            <button className="btn btn-save" onClick={handleAddKhachHang} disabled={newKhachLoading}>
              {newKhachLoading ? 'Đang lưu...' : 'Thêm mới'}
            </button>
          </>
        }
      >
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Tên khách hàng *</label>
          <input className={styles.formInput} value={newKhachHang.tenKhachHang}
            onChange={(e) => setNewKhachHang({ ...newKhachHang, tenKhachHang: e.target.value })} placeholder="VD: Công ty TNHH ABC" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Số điện thoại</label>
          <input className={styles.formInput} value={newKhachHang.soDienThoai}
            onChange={(e) => setNewKhachHang({ ...newKhachHang, soDienThoai: e.target.value })} placeholder="VD: 0901 234 567" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Địa chỉ</label>
          <input className={styles.formInput} value={newKhachHang.diaChi}
            onChange={(e) => setNewKhachHang({ ...newKhachHang, diaChi: e.target.value })} placeholder="VD: Số 123, Đường Nguyễn Huệ, TP.Cần Thơ" />
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
