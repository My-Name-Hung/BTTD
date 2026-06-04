import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiDownload, FiPlus, FiSearch, FiEdit2, FiTrash2, FiX, FiExternalLink } from 'react-icons/fi';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { layDanhSachKhachHang, taoKhachHang, suaKhachHang, xoaKhachHang } from '../services/api';
import { KhachHang, ApiResponseWithPagination } from '../types';
import { exportToExcel, formatDateForExport } from '../utils/exportData';
import { useToast, usePagination, usePageRole } from '../hooks';
import { Modal, Loading, EmptyState, ConfirmModal, Pagination } from '../components/Common';
import styles from './KhachHangPage.module.css';

// Danh sách nhóm kinh doanh cho khách hàng
const NHOM_KINH_DOANH_OPTIONS = [
  'Bê tông Tây Đô',
  'Các công ty thuộc Tây Đô Group',
  'Đơn vị, cá nhân, tổ chức có MST',
  'Đơn vị trong nước có MST',
  'Cá nhân có MST',
  'Đơn vị, cá nhân, tổ chức không có MST',
  'Nội bộ từng công ty',
  'Nội bộ công ty Bê Tông Tây Đô',
];

const LIMIT = 10;

export default function KhachHangPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, LIMIT);
  const [data, setData] = useState<ApiResponseWithPagination<KhachHang[]>>({
    success: true, message: '', data: [], pagination: { page: 1, limit: LIMIT, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState(() => searchParams.get('search') || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KhachHang | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [nhomDropdownOpen, setNhomDropdownOpen] = useState(false);
  const nhomDropdownRef = useRef<HTMLDivElement>(null);

  const formInit = { maKhachHang: '', tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '', nhom: '' };
  const [form, setForm] = useState(formInit);
  const [initialForm, setInitialForm] = useState(formInit);

  const canCreate = hasPermission('khachhang.create');
  const canEdit = hasPermission('khachhang.edit');
  const canDelete = hasPermission('khachhang.delete');
  const { hasAnyRole } = usePageRole();
  const canWriteKhachHang = hasAnyRole(['admin', 'sale']);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layDanhSachKhachHang(page, LIMIT, tuKhoa || undefined);
      setData(res);
    } catch {
      showToast('Lỗi tải dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, tuKhoa, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (nhomDropdownRef.current && !nhomDropdownRef.current.contains(e.target as Node)) {
        setNhomDropdownOpen(false);
      }
    };
    if (nhomDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [nhomDropdownOpen]);

  const handleSubmit = async () => {
    if (!form.tenKhachHang.trim()) { showToast('Tên khách hàng là bắt buộc', 'error'); return; }
    setFormLoading(true);
    try {
      const payload: Partial<KhachHang> = {
        tenKhachHang: form.tenKhachHang,
        diaChi: form.diaChi || null,
        soDienThoai: form.soDienThoai || null,
        email: form.email || null,
        ghiChu: form.ghiChu || null,
        nhom: form.nhom || null,
      };
      // Chỉ gửi mã khách hàng nếu người dùng nhập tay
      if (editingId && form.maKhachHang) {
        payload.maKhachHang = form.maKhachHang;
      }
      if (editingId) {
        await suaKhachHang(editingId, payload);
      } else {
        await taoKhachHang(payload);
      }
      setModalOpen(false);
      setShowSuccess(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const closeModal = () => {
    if (JSON.stringify(form) !== JSON.stringify(initialForm)) {
      setShowCancel(true);
    } else {
      setModalOpen(false);
      setEditingId(null);
      setForm(formInit);
      setNhomDropdownOpen(false);
    }
  };

  const openEdit = (kh: KhachHang) => {
    setEditingId(kh.id);
    const f = {
      maKhachHang: kh.maKhachHang || '',
      tenKhachHang: kh.tenKhachHang,
      diaChi: kh.diaChi || '',
      soDienThoai: kh.soDienThoai || '',
      email: kh.email || '',
      ghiChu: kh.ghiChu || '',
      nhom: kh.nhom || '',
    };
    setForm(f);
    setInitialForm(f);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await xoaKhachHang(deleteTarget.id);
      showToast('Xóa khách hàng thành công');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await layDanhSachKhachHang(1, 10000, undefined);
      const allData = res.data || [];

      const headers = [
        { key: "maKhachHang" as keyof KhachHang, label: "Mã KH", width: 14 },
        { key: "tenKhachHang" as keyof KhachHang, label: "Tên khách hàng", width: 30 },
        { key: "nhom" as keyof KhachHang, label: "Nhóm", width: 25 },
        { key: "diaChi" as keyof KhachHang, label: "Địa chỉ", width: 35 },
        { key: "soDienThoai" as keyof KhachHang, label: "SĐT", width: 14 },
        { key: "email" as keyof KhachHang, label: "Email", width: 25 },
        { key: "ghiChu" as keyof KhachHang, label: "Ghi chú", width: 30 },
      ];

      const rows = allData.map((kh: KhachHang) => ({
        maKhachHang: kh.maKhachHang || "",
        tenKhachHang: kh.tenKhachHang,
        nhom: kh.nhom || "",
        diaChi: kh.diaChi || "",
        soDienThoai: kh.soDienThoai || "",
        email: kh.email || "",
        ghiChu: kh.ghiChu || "",
      }));

      await exportToExcel("BÁO CÁO KHÁCH HÀNG", headers, rows, `BaoCaoKhachHang_${new Date().toISOString().slice(0, 10)}.xlsx`, "Khách hàng");
      showToast("Xuất báo cáo thành công!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xuất báo cáo", "error");
    } finally {
      setExporting(false);
    }
  };

  const total = data.pagination?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const hasFilters = !!tuKhoa;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Khách hàng</div>
          <div className={styles.pageHeaderDesc}>Quản lý danh sách khách hàng</div>
        </div>
        <div className={styles.pageHeaderActions}>
          <button
            className={`btn btn-export ${exporting ? "btn-loading" : ""}`}
            onClick={handleExportExcel}
            disabled={exporting}
          >
            <FiDownload />
            {exporting ? "Đang xuất..." : "Xuất báo cáo"}
          </button>
          {canCreate && (
            <button className="btn btn-add" onClick={() => { resetPage(); setModalOpen(true); }}>
              <FiPlus /> Thêm khách hàng
            </button>
          )}
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrap}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm khách hàng..."
            value={tuKhoa}
            onChange={(e) => { setTuKhoa(e.target.value); resetPage(); }}
          />
        </div>
        {hasFilters && (
          <button className={styles.filterClearBtn} onClick={() => { setTuKhoa(''); resetPage(); }}>
            <FiX size={13} /> Xóa lọc
          </button>
        )}
      </div>

      <div className={styles.card}>
        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{total}</span> khách hàng
            {hasFilters && <span className={styles.statFiltered}> / {total} tổng</span>}
          </div>
        </div>

        <div className={styles.tableWrap}>
          {loading ? <Loading /> : (data.data?.length ?? 0) === 0 ? (
            <EmptyState icon="👥" text={hasFilters ? 'Không có khách hàng phù hợp với bộ lọc' : 'Chưa có khách hàng nào'} />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mã KH</th>
                  <th>Tên khách hàng</th>
                  <th>Nhóm</th>
                  <th>Địa chỉ</th>
                  <th>Số điện thoại</th>
                  <th>Email</th>
                  <th>Ghi chú</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.data?.map((kh) => (
                  <tr key={kh.id}>
                    <td><span className={styles.tableCode}>{kh.maKhachHang || '—'}</span></td>
                    <td><strong className={styles.tableName}>{kh.tenKhachHang}</strong></td>
                    <td>{kh.nhom ? <span className={styles.tableNhom}>{kh.nhom}</span> : <span className={styles.placeholder}>—</span>}</td>
                    <td>{kh.diaChi || <span className={styles.placeholder}>—</span>}</td>
                    <td className={styles.tablePhone}>{kh.soDienThoai || <span className={styles.placeholder}>—</span>}</td>
                    <td>{kh.email || <span className={styles.placeholder}>—</span>}</td>
                    <td className={styles.tableNote}>{kh.ghiChu || <span className={styles.placeholder}>—</span>}</td>
                    <td>
                      <div className={styles.rowActions}>
                        {canWriteKhachHang && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnView}`}
                            onClick={() => navigate(`/quan-ly/cong-no?khachHang=${kh.maKhachHang || kh.tenKhachHang}`)}
                            title="Xem công nợ"
                          >
                            <FiExternalLink size={14} />
                          </button>
                        )}
                        {canEdit && (
                          <button className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => openEdit(kh)} title="Sửa">
                            <FiEdit2 size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteTarget(kh)} title="Xóa">
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && total > LIMIT && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            onPageChange={goToPage}
          />
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}
        footer={
          <>
            <button className="btn btn-cancel" onClick={closeModal} disabled={formLoading}>Hủy</button>
            <button className="btn btn-save" onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Thêm')}
            </button>
          </>
        }
      >
        <div className={styles.formGrid}>
          {canWriteKhachHang && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Mã khách hàng</label>
              <input
                className={styles.formInput}
                value={form.maKhachHang}
                onChange={(e) => setForm({ ...form, maKhachHang: e.target.value })}
                placeholder="Tự sinh nếu để trống"
              />
            </div>
          )}
          <div className={`${styles.formGroup} ${!canWriteKhachHang ? styles.formGridFull : ''}`}>
            <label className={styles.formLabel}>Tên khách hàng *</label>
            <input className={styles.formInput} value={form.tenKhachHang} onChange={(e) => setForm({ ...form, tenKhachHang: e.target.value })} required />
          </div>

          {canWriteKhachHang && (
            <div className={`${styles.formGroup} ${styles.formGridFull}`}>
              <label className={styles.formLabel}>Thuộc nhóm</label>
              <div className={styles.searchDropdownWrap} ref={nhomDropdownRef}>
                <div
                  className={`${styles.searchDropdownDisplay} ${nhomDropdownOpen ? styles.searchDropdownDisplayFocused : ''}`}
                  onClick={() => setNhomDropdownOpen(!nhomDropdownOpen)}
                >
                  <span className={form.nhom ? '' : styles.searchDropdownPlaceholder}>
                    {form.nhom || '— Chọn nhóm —'}
                  </span>
                  <svg
                    className={`${styles.searchDropdownArrow} ${nhomDropdownOpen ? styles.searchDropdownArrowOpen : ''}`}
                    width="16" height="16" viewBox="0 0 16 16" fill="none"
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {nhomDropdownOpen && (
                  <div className={styles.searchDropdownPanel} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'white', border: '1.5px solid var(--color-border)', borderRadius: 10, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto' }}>
                    <input
                      id="nhom-kh-input"
                      className={styles.searchDropdownInput}
                      placeholder="Tìm hoặc nhập nhóm..."
                      value={form.nhom}
                      onChange={(e) => setForm({ ...form, nhom: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const matches = NHOM_KINH_DOANH_OPTIONS.filter(n => n.toLowerCase().includes(form.nhom.toLowerCase()));
                          if (matches.length > 0) {
                            setForm({ ...form, nhom: matches[0] });
                            setNhomDropdownOpen(false);
                          } else if (form.nhom.trim()) {
                            setNhomDropdownOpen(false);
                          }
                        } else if (e.key === 'Escape') {
                          setNhomDropdownOpen(false);
                        }
                      }}
                      autoFocus
                    />
                    {NHOM_KINH_DOANH_OPTIONS.filter(n => n.toLowerCase().includes(form.nhom.toLowerCase())).map(n => (
                      <div key={n} className={styles.searchDropdownItem}
                        onClick={() => { setForm({ ...form, nhom: n }); setNhomDropdownOpen(false); }}>
                        {n}
                      </div>
                    ))}
                    {form.nhom && !NHOM_KINH_DOANH_OPTIONS.includes(form.nhom) && (
                      <div className={styles.searchDropdownItem} style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                        onClick={() => setNhomDropdownOpen(false)}>
                        Nhấn Enter để dùng: "{form.nhom}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Địa chỉ</label>
            <input className={styles.formInput} value={form.diaChi} onChange={(e) => setForm({ ...form, diaChi: e.target.value })} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Số điện thoại</label>
            <input className={styles.formInput} value={form.soDienThoai} onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })} />
          </div>
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Email</label>
            <input className={styles.formInput} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className={`${styles.formGroup} ${styles.formGridFull}`}>
            <label className={styles.formLabel}>Ghi chú</label>
            <textarea className={styles.formTextarea} value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa khách hàng"
        message={`Bạn có chắc muốn xóa khách hàng "${deleteTarget?.tenKhachHang}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        loading={deleteLoading}
      />

      <ConfirmModal
        isOpen={showSuccess}
        onClose={() => { setShowSuccess(false); loadData(); setEditingId(null); setForm(formInit); setInitialForm(formInit); }}
        onConfirm={() => { setShowSuccess(false); loadData(); setEditingId(null); setForm(formInit); setInitialForm(formInit); }}
        message={editingId ? 'Cập nhật khách hàng thành công!' : 'Thêm khách hàng thành công!'}
        confirmText="Đồng ý"
        cancelText=""
        title="Thành công"
        type="success"
      />

      <ConfirmModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => { setShowCancel(false); setModalOpen(false); setEditingId(null); setForm(formInit); setInitialForm(formInit); setNhomDropdownOpen(false); }}
        message="Bạn có chắc muốn hủy bỏ? Dữ liệu đã nhập sẽ không được lưu."
        confirmText="Hủy bỏ"
        cancelText="Ở lại"
        title="Xác nhận hủy bỏ"
        type="warning"
      />

      <div className={styles.toastContainer}>
        {toasts.map((t) => <div key={t.id} className={`${styles.toast} ${t.type === 'error' ? styles.toastError : styles.toastSuccess}`}>{t.message}</div>)}
      </div>
    </div>
  );
}
