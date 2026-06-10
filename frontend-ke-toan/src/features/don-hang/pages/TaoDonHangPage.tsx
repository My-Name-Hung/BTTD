import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiCalendar, FiArrowLeft, FiPlus, FiExternalLink } from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  taoDonHang, suaDonHang, layDonHang,
  layDanhSachKhachHang, layDanhSachMacBeTong,
  taoKhachHang,
} from '../../../shared/services/api';
import { DonHang, KhachHang, MacBeTong } from "../../../shared/types";
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
  tenKhachHang: '', diaChiNhan: '', soDienThoai: '', mstCccd: '',
  tenMacBeTong: '', khoiLuongDat: '', donGia: '',
  ghiChu: '', idKhachHang: '', idMacBeTong: '',
  hangMuc: '',
  phuongPhapDo: '' as '' | 'do_xa' | 'do_bom',
  loaiBom: '' as '' | 'bom_ngang' | 'bom_can',
  chieuDaiBom: '',
  kieuNoi: '' as '' | 'khong_dau' | 'noi_dau' | 'noi_dit',
  chieuDaiNoi: '',
  nguoiNhanHang: '',
  giaTienTamTinh: '',
};

export default function TaoDonHangPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const editingId = id ? parseInt(id) : null;
  const isEdit = !!editingId;

  const userVaiTro = JSON.parse(localStorage.getItem("bttd_user") || "{}")?.vaiTro;
  const userId = JSON.parse(localStorage.getItem("bttd_user") || "{}")?.id;

  const { toasts, showToast } = useToast();

  const [khachHangs, setKhachHangs] = useState<KhachHang[]>([]);
  const [macBeTongs, setMacBeTongs] = useState<MacBeTong[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [macSearchOpen, setMacSearchOpen] = useState(false);
  const [macSearchQuery, setMacSearchQuery] = useState('');
  const [khachSearchOpen, setKhachSearchOpen] = useState(false);
  const [khachSearchQuery, setKhachSearchQuery] = useState('');
  const [khachSearchLoading, setKhachSearchLoading] = useState(false);
  const [showKhachHangModal, setShowKhachHangModal] = useState(false);
  const [newKhachHang, setNewKhachHang] = useState({ tenKhachHang: '', soDienThoai: '', diaChi: '', mstCccd: '' });
  const [newKhachLoading, setNewKhachLoading] = useState(false);
  const khachDropdownRef = useRef<HTMLDivElement>(null);
  const giaTienRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [thoiGianGiaoDuKien, setThoiGianGiaoDuKien] = useState<Date | null>(null);
  const [loadedDonHang, setLoadedDonHang] = useState<DonHang | null>(null);

  const thanhTien = (() => {
    const raw = form.giaTienTamTinh.replace(/[^\d]/g, '');
    return parseInt(raw) || 0;
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
      layDanhSachKhachHang(1, 20),
    ]).then(([mac, kh]) => {
      setMacBeTongs(mac || []);
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
            mstCccd: (dh as any).mstCccdKh || (dh as any).mstCccd || '',
            tenMacBeTong: dh.tenMacBeTong || '',
            khoiLuongDat: String(dh.khoiLuongDat),
            donGia: '',
            ghiChu: dh.ghiChu || '',
            idKhachHang: String(dh.idKhachHang || ''),
            idMacBeTong: String(dh.idMacBeTong || ''),
            hangMuc: dh.hangMuc || '',
            phuongPhapDo: (dh.phuongPhapDo || '') as '' | 'do_xa' | 'do_bom',
            loaiBom: (dh.loaiBom || '') as '' | 'bom_ngang' | 'bom_can',
            chieuDaiBom: dh.chieuDaiBom != null ? String(dh.chieuDaiBom) : '',
            kieuNoi: (dh.kieuNoi || '') as '' | 'khong_dau' | 'noi_dau' | 'noi_dit',
            chieuDaiNoi: dh.chieuDaiNoi != null ? String(dh.chieuDaiNoi) : '',
            nguoiNhanHang: (dh as any).nguoiNhanHang || '',
            giaTienTamTinh: (dh as any).giaTienTamTinh != null ? String((dh as any).giaTienTamTinh) : '',
          };
          const t = parseLocalDatetime(dh.thoiGianGiaoDuKien);
          setForm(f);
          setThoiGianGiaoDuKien(t);
          setInitialForm(f);
          setInitialThoiGian(t);
          setLoadedDonHang(dh);
        })
        .catch(() => showToast('Không tải được đơn hàng', 'error'));
    } else {
      setInitialForm(EMPTY_FORM);
      setInitialThoiGian(null);
    }
  }, [editingId, showToast]);

  useEffect(() => {
    if (!khachSearchOpen) {
      setKhachSearchLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setKhachSearchLoading(true);
      try {
        const res = await layDanhSachKhachHang(1, 20, khachSearchQuery.trim() || undefined);
        setKhachHangs(res.data || []);
      } catch {
        // giữ danh sách hiện tại để tránh nhấp nháy UI
      } finally {
        setKhachSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [khachSearchOpen, khachSearchQuery]);

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
      mstCccd: kh.mstCccd || '',
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
        mstCccd: newKhachHang.mstCccd,
      });
      setKhachHangs((prev) => [created, ...prev]);
      handleKhachHangChange(created);
      setShowKhachHangModal(false);
      setNewKhachHang({ tenKhachHang: '', soDienThoai: '', diaChi: '', mstCccd: '' });
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
    // Kiểm tra quyền sửa: không cho sửa nếu đơn đã qua nghiệm thu
    const isSale = userVaiTro === "sale";
    if (editingId && loadedDonHang) {
      const isPastNghiemThu = ["nghiem_thu", "da_nghiem_thu", "da_thanh_toan", "hoan_thanh", "tu_choi"].includes(loadedDonHang.trangThaiDon);
      const notOwner = isSale && loadedDonHang.nguoiTaoId !== userId;
      if (isPastNghiemThu || notOwner) {
        showToast('Không có quyền sửa đơn hàng này', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const rawGia = form.giaTienTamTinh.replace(/[^\d]/g, '');
      const giaTamTinh = parseInt(rawGia) || 0;

      const payload: Partial<DonHang> = {
        tenKhachHang: form.tenKhachHang,
        diaChiNhan: form.diaChiNhan,
        soDienThoai: form.soDienThoai,
        tenMacBeTong: form.tenMacBeTong,
        khoiLuongDat: parseFloat(form.khoiLuongDat) || 0,
        donGia: parseFloat(form.donGia.replace(/[^\d]/g, '')) || 0,
        thanhTien: giaTamTinh,
        thoiGianGiaoDuKien: thoiGianGiaoDuKien ? toLocalDatetimeInput(thoiGianGiaoDuKien) : null,
        ghiChu: form.ghiChu || null,
        idKhachHang: form.idKhachHang ? parseInt(form.idKhachHang) : null,
        idMacBeTong: form.idMacBeTong ? parseInt(form.idMacBeTong) : null,
        hangMuc: form.hangMuc || null,
        phuongPhapDo: (form.phuongPhapDo || null) as "do_xa" | "do_bom" | null,
        loaiBom: (form.loaiBom || null) as "bom_ngang" | "bom_can" | null,
        chieuDaiBom: form.chieuDaiBom ? parseFloat(form.chieuDaiBom) : null,
        kieuNoi: (form.kieuNoi || null) as "khong_dau" | "noi_dau" | "noi_dit" | null,
        chieuDaiNoi: form.chieuDaiNoi ? parseFloat(form.chieuDaiNoi) : null,
        nguoiNhanHang: form.nguoiNhanHang || null,
        giaTienTamTinh: giaTamTinh || null,
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
                  <input className={styles.searchDropdownInput} placeholder="Tìm mã hoặc tên khách hàng..." value={khachSearchQuery}
                    onChange={(e) => setKhachSearchQuery(e.target.value)} autoFocus />
                  <div className={styles.searchDropdownList}>
                    {khachSearchLoading && (
                      <div className={styles.searchDropdownEmpty}>Đang tìm khách hàng...</div>
                    )}
                    {!khachSearchLoading && khachHangs.length === 0 && (
                      <div className={styles.searchDropdownEmpty}>Không tìm thấy</div>
                    )}
                    {!khachSearchLoading && khachHangs.map((k) => (
                      <div key={k.id} className={`${styles.searchDropdownItem} ${parseInt(form.idKhachHang) === k.id ? styles.searchDropdownItemActive : ''}`}
                        onClick={() => handleKhachHangChange(k)}>
                        <div className={styles.searchDropdownItemName}>{k.tenKhachHang}</div>
                        <div className={styles.searchDropdownItemSub}>{k.maKhachHang || '—'} • {k.soDienThoai || '—'}</div>
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
          <div className={styles.formRow}>
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
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>MST/CCCD</label>
              <input
                className={styles.formInput}
                value={form.mstCccd}
                onChange={(e) => setForm({ ...form, mstCccd: e.target.value })}
                placeholder="VD: 012345678901"
              />
            </div>
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
          <div className={styles.sectionTitle}>Hạng mục &amp; Phương pháp đổ</div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Hạng mục / Cấu kiện</label>
              <input
                className={styles.formInput}
                value={form.hangMuc}
                onChange={(e) => setForm({ ...form, hangMuc: e.target.value })}
                placeholder="VD: Móng, cột, sàn..."
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Phương pháp đổ</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="phuongPhapDo"
                  value="do_xa"
                  checked={form.phuongPhapDo === 'do_xa'}
                  onChange={() => setForm({
                    ...form,
                    phuongPhapDo: 'do_xa',
                    loaiBom: '',
                    chieuDaiBom: '',
                    kieuNoi: '',
                    chieuDaiNoi: '',
                  })}
                />
                <span className={styles.radioCustom} />
                Đổ xả
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="phuongPhapDo"
                  value="do_bom"
                  checked={form.phuongPhapDo === 'do_bom'}
                  onChange={() => setForm({
                    ...form,
                    phuongPhapDo: 'do_bom',
                    loaiBom: '',
                    chieuDaiBom: '',
                    kieuNoi: '',
                    chieuDaiNoi: '',
                  })}
                />
                <span className={styles.radioCustom} />
                Đổ bơm
              </label>
            </div>
          </div>

          {form.phuongPhapDo === 'do_bom' && (
            <div className={styles.phuongPhapDoSub}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Loại bơm</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="loaiBom"
                      value="bom_ngang"
                      checked={form.loaiBom === 'bom_ngang'}
                      onChange={() => setForm({
                        ...form,
                        loaiBom: 'bom_ngang',
                        chieuDaiBom: '',
                        kieuNoi: '',
                        chieuDaiNoi: '',
                      })}
                    />
                    <span className={styles.radioCustom} />
                    Bơm ngang (ống)
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="loaiBom"
                      value="bom_can"
                      checked={form.loaiBom === 'bom_can'}
                      onChange={() => setForm({
                        ...form,
                        loaiBom: 'bom_can',
                        chieuDaiBom: '',
                        kieuNoi: '',
                        chieuDaiNoi: '',
                      })}
                    />
                    <span className={styles.radioCustom} />
                    Bơm cần
                  </label>
                </div>
              </div>

              {form.loaiBom === 'bom_ngang' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Chiều dài ống (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className={styles.formInput}
                    value={form.chieuDaiBom}
                    onChange={(e) => setForm({ ...form, chieuDaiBom: e.target.value })}
                    placeholder="VD: 30"
                  />
                </div>
              )}

              {form.loaiBom === 'bom_can' && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nối cần</label>
                    <div className={styles.radioGroup}>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="kieuNoi"
                          value="khong_dau"
                          checked={form.kieuNoi === 'khong_dau'}
                          onChange={() => setForm({
                            ...form,
                            kieuNoi: 'khong_dau',
                            chieuDaiNoi: '',
                          })}
                        />
                        <span className={styles.radioCustom} />
                        Không đầu
                      </label>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="kieuNoi"
                          value="noi_dau"
                          checked={form.kieuNoi === 'noi_dau'}
                          onChange={() => setForm({
                            ...form,
                            kieuNoi: 'noi_dau',
                            chieuDaiNoi: '',
                          })}
                        />
                        <span className={styles.radioCustom} />
                        Nối đầu
                      </label>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name="kieuNoi"
                          value="noi_dit"
                          checked={form.kieuNoi === 'noi_dit'}
                          onChange={() => setForm({
                            ...form,
                            kieuNoi: 'noi_dit',
                            chieuDaiNoi: '',
                          })}
                        />
                        <span className={styles.radioCustom} />
                        Nối đít
                      </label>
                    </div>
                  </div>

                  {(form.kieuNoi === 'noi_dau' || form.kieuNoi === 'noi_dit') && (
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Chiều dài nối {form.kieuNoi === 'noi_dau' ? 'đầu' : 'đít'} (m)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        className={styles.formInput}
                        value={form.chieuDaiNoi}
                        onChange={(e) => setForm({ ...form, chieuDaiNoi: e.target.value })}
                        placeholder="VD: 6"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className={styles.formDivider} />
          <div className={styles.sectionTitle}>Thông tin giao hàng</div>
          <div className={styles.formRow}>
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
              <label className={styles.formLabel}>Người nhận hàng</label>
              <input
                className={styles.formInput}
                value={form.nguoiNhanHang}
                onChange={(e) => setForm({ ...form, nguoiNhanHang: e.target.value })}
                placeholder="VD: Trần Văn B"
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Giá tiền tạm tính</label>
              <input
                ref={giaTienRef}
                className={styles.formInput}
                value={form.giaTienTamTinh}
                onChange={(e) => {
                  const input = giaTienRef.current;
                  const raw = e.target.value.replace(/[^\d]/g, '');
                  const formatted = raw ? parseInt(raw).toLocaleString('vi-VN') : '';
                  setForm({ ...form, giaTienTamTinh: formatted });
                  setTimeout(() => {
                    if (input) {
                      const pos = raw.length - (e.target.value.length - (e.nativeEvent as InputEvent).inputType.length);
                      const dotCount = (formatted.match(/,/g) || []).length;
                      input.setSelectionRange(
                        Math.min(pos + dotCount, formatted.length),
                        Math.min(pos + dotCount, formatted.length),
                      );
                    }
                  }, 0);
                }}
                placeholder="VD: 50.000.000"
              />
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
          <label className={styles.formLabel}>MST/CCCD</label>
          <input className={styles.formInput} value={newKhachHang.mstCccd}
            onChange={(e) => setNewKhachHang({ ...newKhachHang, mstCccd: e.target.value })} placeholder="VD: 012345678901 hoặc 079123456789" />
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
