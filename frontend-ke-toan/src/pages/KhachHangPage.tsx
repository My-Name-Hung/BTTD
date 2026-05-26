import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import { layDanhSachKhachHang, taoKhachHang, suaKhachHang, xoaKhachHang } from '../services/api';
import { KhachHang, ApiResponseWithPagination } from '../types';
import { useToast, usePagination, usePageRole } from '../hooks';
import { Modal, Loading, EmptyState, ConfirmModal, Pagination } from '../components/Common';
import styles from './KhachHangPage.module.css';

const LIMIT = 10;

export default function KhachHangPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, LIMIT);
  const [data, setData] = useState<ApiResponseWithPagination<KhachHang[]>>({
    success: true, message: '', data: [], pagination: { page: 1, limit: LIMIT, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KhachHang | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [form, setForm] = useState({
    tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '',
  });
  const [initialForm, setInitialForm] = useState({ tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '' });

  const canCreate = hasPermission('khachhang.create');
  const canEdit = hasPermission('khachhang.edit');
  const canDelete = hasPermission('khachhang.delete');

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

  const handleSubmit = async () => {
    if (!form.tenKhachHang.trim()) { showToast('Tên khách hàng là bắt buộc', 'error'); return; }
    setFormLoading(true);
    try {
      if (editingId) {
        await suaKhachHang(editingId, form);
      } else {
        await taoKhachHang(form);
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
      setForm({ tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '' });
    }
  };

  const openEdit = (kh: KhachHang) => {
    setEditingId(kh.id);
    const f = {
      tenKhachHang: kh.tenKhachHang,
      diaChi: kh.diaChi || '',
      soDienThoai: kh.soDienThoai || '',
      email: kh.email || '',
      ghiChu: kh.ghiChu || '',
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
        {canCreate && (
          <button className="btn btn-add" onClick={() => { resetPage(); setModalOpen(true); }}>
            <FiPlus /> Thêm khách hàng
          </button>
        )}
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
                  <th>Tên khách hàng</th>
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
                    <td><strong className={styles.tableName}>{kh.tenKhachHang}</strong></td>
                    <td>{kh.diaChi || <span className={styles.placeholder}>—</span>}</td>
                    <td className={styles.tablePhone}>{kh.soDienThoai || <span className={styles.placeholder}>—</span>}</td>
                    <td>{kh.email || <span className={styles.placeholder}>—</span>}</td>
                    <td className={styles.tableNote}>{kh.ghiChu || <span className={styles.placeholder}>—</span>}</td>
                    <td>
                      <div className={styles.rowActions}>
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
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Tên khách hàng *</label>
          <input className={styles.formInput} value={form.tenKhachHang} onChange={(e) => setForm({ ...form, tenKhachHang: e.target.value })} required />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Địa chỉ</label>
          <input className={styles.formInput} value={form.diaChi} onChange={(e) => setForm({ ...form, diaChi: e.target.value })} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Số điện thoại</label>
          <input className={styles.formInput} value={form.soDienThoai} onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Email</label>
          <input className={styles.formInput} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ghi chú</label>
          <textarea className={styles.formTextarea} value={form.ghiChu} onChange={(e) => setForm({ ...form, ghiChu: e.target.value })} />
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
        onClose={() => { setShowSuccess(false); loadData(); setEditingId(null); setForm({ tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '' }); setInitialForm({ tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '' }); }}
        onConfirm={() => { setShowSuccess(false); loadData(); setEditingId(null); setForm({ tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '' }); setInitialForm({ tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '' }); }}
        message={editingId ? 'Cập nhật khách hàng thành công!' : 'Thêm khách hàng thành công!'}
        confirmText="Đồng ý"
        cancelText=""
        title="Thành công"
        type="success"
      />

      <ConfirmModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => { setShowCancel(false); setModalOpen(false); setEditingId(null); setForm({ tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '' }); setInitialForm({ tenKhachHang: '', diaChi: '', soDienThoai: '', email: '', ghiChu: '' }); }}
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
