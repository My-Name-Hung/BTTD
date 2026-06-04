import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiEye, FiDownload } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { layDanhSachTramTron, taoTramTron, suaTramTron, xoaTramTron } from '../services/api';
import { exportToExcel } from '../utils/exportData';
import { TramTron } from '../types';
import { usePagination, useToast } from '../hooks';
import { Modal, Loading, EmptyState, ConfirmModal, Pagination } from '../components/Common';
import styles from './QuanLyTramTronPage.module.css';

const TRANG_THAI_LABELS: Record<string, string> = {
  hoat_dong: 'Hoạt động',
  khong_hoat_dong: 'Không hoạt động',
};

const TRANG_THAI_CLASS: Record<string, string> = {
  hoat_dong: styles.badgeHoatDong,
  khong_hoat_dong: styles.badgeKhongHoatDong,
};

export default function QuanLyTramTronPage() {
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 10);
  const userVaiTro = JSON.parse(localStorage.getItem('bttd_user') || '{}')?.vaiTro;
  const canDelete = ['admin'].includes(userVaiTro);

  const [tramTrons, setTramTrons] = useState<TramTron[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TramTron | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [tuKhoa, setTuKhoa] = useState('');
  const [trangThaiFilter, setTrangThaiFilter] = useState('');

  const [form, setForm] = useState({
    tenTram: '',
    diaChi: '',
    soDienThoai: '',
    trangThai: 'hoat_dong' as string,
  });
  const [initialForm, setInitialForm] = useState(form);

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const data = await layDanhSachTramTron(); setTramTrons(data); }
    catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredTramTrons = tramTrons.filter((t) => {
    const matchTen = !tuKhoa || t.tenTram.toLowerCase().includes(tuKhoa.toLowerCase());
    const matchTrangThai = !trangThaiFilter || t.trangThai === trangThaiFilter;
    return matchTen && matchTrangThai;
  });

  const hasFilters = !!tuKhoa || !!trangThaiFilter;

  const clearFilters = () => {
    setTuKhoa('');
    setTrangThaiFilter('');
    resetPage();
  };

  // Pagination
  const limit = 10;
  const total = filteredTramTrons.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedTramTrons = filteredTramTrons.slice((page - 1) * limit, page * limit);

  const openCreate = () => {
    const f: typeof form = { tenTram: '', diaChi: '', soDienThoai: '', trangThai: 'hoat_dong' };
    setEditingId(null);
    setForm(f);
    setInitialForm(f);
    setModalOpen(true);
  };

  const openEdit = (t: TramTron) => {
    const f: typeof form = { tenTram: t.tenTram, diaChi: t.diaChi || '', soDienThoai: t.soDienThoai || '', trangThai: t.trangThai };
    setEditingId(t.id);
    setForm(f);
    setInitialForm(f);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.tenTram.trim()) { showToast('Tên trạm trộn là bắt buộc', 'error'); return; }
    setFormLoading(true);
    try {
      const payload: Partial<TramTron> = {
        tenTram: form.tenTram,
        diaChi: form.diaChi || null,
        soDienThoai: form.soDienThoai || null,
        trangThai: form.trangThai as "hoat_dong" | "khong_hoat_dong",
      };
      if (editingId) { await suaTramTron(editingId, payload); }
      else { await taoTramTron(payload); }
      setModalOpen(false);
      setShowSuccess(true);
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
    finally { setFormLoading(false); }
  };

  const resetForm = () => {
    const f: typeof form = { tenTram: '', diaChi: '', soDienThoai: '', trangThai: 'hoat_dong' };
    setForm(f);
    setInitialForm(f);
    setEditingId(null);
  };

  const closeModal = () => {
    if (JSON.stringify(form) !== JSON.stringify(initialForm)) { setShowCancel(true); }
    else { setModalOpen(false); resetForm(); }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await layDanhSachTramTron(undefined, undefined);
      const allData = res || [];

      const headers = [
        { key: "id" as keyof TramTron, label: "ID", width: 8 },
        { key: "tenTram" as keyof TramTron, label: "Tên trạm trộn", width: 28 },
        { key: "diaChi" as keyof TramTron, label: "Địa chỉ", width: 40 },
        { key: "soDienThoai" as keyof TramTron, label: "SĐT", width: 14 },
        { key: "trangThai" as keyof TramTron, label: "Trạng thái", width: 14 },
      ];

      const rows = allData.map((tt: TramTron) => ({
        id: tt.id,
        tenTram: tt.tenTram,
        diaChi: tt.diaChi || "",
        soDienThoai: tt.soDienThoai || "",
        trangThai: tt.trangThai === "hoat_dong" ? "Hoạt động" : "Khóa",
      }));

      await exportToExcel("BÁO CÁO TRẠM TRỘN", headers, rows, `BaoCaoTramTron_${new Date().toISOString().slice(0, 10)}.xlsx`, "Trạm trộn");
      showToast("Xuất báo cáo thành công!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xuất báo cáo", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await xoaTramTron(deleteTarget.id);
      showToast('Xóa trạm trộn thành công');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Quản lý trạm trộn</div>
          <div className={styles.pageHeaderDesc}>Thêm, sửa, xóa thông tin trạm trộn bê tông</div>
        </div>
        <div className={styles.pageHeaderActions}>
          <button className="btn btn-export" onClick={handleExportExcel} disabled={exporting}><FiDownload /> {exporting ? 'Đang xuất...' : 'Xuất báo cáo'}</button>
          <button className="btn btn-add" onClick={openCreate}><FiPlus /> Thêm trạm trộn</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrap}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm tên trạm trộn..."
            value={tuKhoa}
            onChange={(e) => { setTuKhoa(e.target.value); resetPage(); }}
          />
        </div>

        {/* Trạng thái filter */}
        <div className={`${styles.selectWrap} ${trangThaiFilter ? styles.activeFilter : ''}`}>
          <span className={styles.selectLabel}>Trạng thái</span>
          <div className={styles.selectControl}>
            <select className={styles.selectInput} value={trangThaiFilter} onChange={(e) => { setTrangThaiFilter(e.target.value); resetPage(); }}>
              <option value="">Tất cả</option>
              <option value="hoat_dong">Hoạt động</option>
              <option value="khong_hoat_dong">Không hoạt động</option>
            </select>
            <span className={styles.selectArrow}>▼</span>
          </div>
        </div>

        {hasFilters && (
          <button className={styles.filterClearBtn} onClick={clearFilters}>
            <FiX size={13} /> Xóa lọc
          </button>
        )}
      </div>

      <div className={styles.card}>
        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{filteredTramTrons.length}</span> trạm trộn
            {hasFilters && <> / {tramTrons.length} tổng</>}
          </div>
          <div className={styles.statDot} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>{filteredTramTrons.filter((t) => t.trangThai === 'hoat_dong').length}</span> hoạt động
          </div>
          <div className={styles.statDot} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>{filteredTramTrons.filter((t) => t.trangThai === 'khong_hoat_dong').length}</span> không hoạt động
          </div>
        </div>

        <div className={styles.tableWrap}>
          {loading ? <Loading /> : filteredTramTrons.length === 0 ? (
            <EmptyState icon="🏭" text={hasFilters ? 'Không có trạm trộn phù hợp với bộ lọc' : 'Chưa có trạm trộn nào'} />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên trạm</th>
                  <th>Địa chỉ</th>
                  <th>SĐT</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedTramTrons.map((t) => (
                  <tr key={t.id}>
                    <td><strong className={styles.tableName}>{t.tenTram}</strong></td>
                    <td>{t.diaChi || <span className={styles.placeholder}>—</span>}</td>
                    <td className={styles.tablePhone}>{t.soDienThoai || <span className={styles.placeholder}>—</span>}</td>
                    <td><span className={`${styles.badge} ${TRANG_THAI_CLASS[t.trangThai] || ''}`}>{TRANG_THAI_LABELS[t.trangThai] || t.trangThai}</span></td>
                    <td>
                      <div className={styles.rowActions}>
                        <button className={`${styles.actionBtn} ${styles.actionBtnEye}`} onClick={() => navigate(`/quan-ly/tram/don-hang/${t.id}`)} title="Xem đơn hàng"><FiEye size={14} /></button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => openEdit(t)} title="Sửa"><FiEdit2 size={14} /></button>
                        {canDelete && (
                          <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteTarget(t)} title="Xóa"><FiTrash2 size={14} /></button>
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
        {!loading && total > 10 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={goToPage}
          />
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingId ? 'Sửa trạm trộn' : 'Thêm trạm trộn mới'}
        footer={<><button className="btn btn-cancel" onClick={closeModal} disabled={formLoading}>Hủy</button><button className="btn btn-save" onClick={handleSubmit} disabled={formLoading}>{formLoading ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Thêm trạm trộn')}</button></>}
      >
        <div className={styles.formGroup}><label className={styles.formLabel}>Tên trạm trộn *</label><input className={styles.formInput} value={form.tenTram} onChange={(e) => setForm({ ...form, tenTram: e.target.value })} placeholder="VD: Trạm trộn số 1" /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Địa chỉ</label><input className={styles.formInput} value={form.diaChi} onChange={(e) => setForm({ ...form, diaChi: e.target.value })} placeholder="VD: Km 14, QL91, P.Phước Thới, TP.Cần Thơ" /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Số điện thoại</label><input className={styles.formInput} value={form.soDienThoai} onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })} /></div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Trạng thái</label>
          <select className={styles.formSelect} value={form.trangThai} onChange={(e) => setForm({ ...form, trangThai: e.target.value })}>
            <option value="hoat_dong">Hoạt động</option>
            <option value="khong_hoat_dong">Không hoạt động</option>
          </select>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa trạm trộn"
        message={`Bạn có chắc muốn xóa trạm trộn "${deleteTarget?.tenTram}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        loading={deleteLoading}
      />

      <ConfirmModal
        isOpen={showSuccess}
        onClose={() => { setShowSuccess(false); loadData(); resetForm(); }}
        onConfirm={() => { setShowSuccess(false); loadData(); resetForm(); }}
        message={editingId ? 'Cập nhật trạm trộn thành công!' : 'Thêm trạm trộn thành công!'}
        confirmText="Đồng ý"
        cancelText=""
        title="Thành công"
        type="success"
      />

      <ConfirmModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => { setShowCancel(false); setModalOpen(false); resetForm(); }}
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
