import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiEye } from 'react-icons/fi';
import { layDanhSachXe, taoXe, suaXe, xoaXe, layDanhSachDonHang, layTatCaLichSanXuat } from '../services/api';
import { Xe, DonHang } from '../types';
import { usePagination, useToast } from '../hooks';
import { Modal, Loading, EmptyState, ConfirmModal, Pagination } from '../components/Common';
import { TRANG_THAI_DON_LABELS, TRANG_THAI_DON_COLORS } from '../types';
import styles from './QuanLyXePage.module.css';

const TRANG_THAI_LABELS: Record<string, string> = {
  san_sang: 'Sẵn sàng',
  dang_giao: 'Đang giao',
  bao_tri: 'Bảo trì',
};

const TRANG_THAI_CLASS: Record<string, string> = {
  san_sang: styles.badgeSanSang,
  dang_giao: styles.badgeDangGiao,
  bao_tri: styles.badgeBaoTri,
};

export default function QuanLyXePage() {
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 10);
  const userVaiTro = JSON.parse(localStorage.getItem('bttd_user') || '{}')?.vaiTro;
  const canDelete = ['admin'].includes(userVaiTro);

  const [xes, setXes] = useState<Xe[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Xe | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  // Filters
  const [tuKhoa, setTuKhoa] = useState('');
  const [taiTrongFilter, setTaiTrongFilter] = useState('');
  const [trangThaiFilter, setTrangThaiFilter] = useState('');
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedXe, setSelectedXe] = useState<Xe | null>(null);
  const [orders, setOrders] = useState<DonHang[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersTotal, setOrdersTotal] = useState(0);

  const [form, setForm] = useState({
    bienSo: '', tenTaiXe: '', soDienThoaiTaiXe: '', taiTrong: '', trangThai: 'san_sang' as Xe['trangThai'],
  });
  const [initialForm, setInitialForm] = useState(form);

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const data = await layDanhSachXe(); setXes(data); }
    catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredXes = xes.filter((x) => {
    const matchBienSo = !tuKhoa || x.bienSo.toLowerCase().includes(tuKhoa.toLowerCase());
    const matchTaiXe = !tuKhoa || (x.tenTaiXe && x.tenTaiXe.toLowerCase().includes(tuKhoa.toLowerCase()));
    const matchTaiTrong = !taiTrongFilter || (x.taiTrong !== null && x.taiTrong !== undefined && String(x.taiTrong) === taiTrongFilter);
    const matchTrangThai = !trangThaiFilter || x.trangThai === trangThaiFilter;
    return matchBienSo && matchTaiXe && matchTaiTrong && matchTrangThai;
  });

  const hasFilters = !!tuKhoa || !!taiTrongFilter || !!trangThaiFilter;

  const clearFilters = () => {
    setTuKhoa('');
    setTaiTrongFilter('');
    setTrangThaiFilter('');
    resetPage();
  };

  // Pagination
  const limit = 10;
  const total = filteredXes.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedXes = filteredXes.slice((page - 1) * limit, page * limit);

  const openViewOrders = async (xe: Xe) => {
    setSelectedXe(xe);
    setOrderModalOpen(true);
    setOrdersLoading(true);
    try {
      const [lichSanList, allOrders] = await Promise.all([
        layTatCaLichSanXuat(),
        layDanhSachDonHang(1, 100),
      ]);
      const matchedIds = new Set(
        (Array.isArray(lichSanList) ? lichSanList : [])
          .filter((ls) => ls.bienSoXe === xe.bienSo)
          .map((ls) => ls.idDonHang),
      );
      const filtered = (Array.isArray(allOrders) ? allOrders : []).filter((o) => matchedIds.has(o.id));
      setOrders(filtered);
      setOrdersTotal(filtered.length);
    } catch {
      showToast('Lỗi tải đơn hàng', 'error');
    } finally {
      setOrdersLoading(false);
    }
  };

  const openCreate = () => {
    const f = { bienSo: '', tenTaiXe: '', soDienThoaiTaiXe: '', taiTrong: '', trangThai: 'san_sang' as Xe['trangThai'] };
    setEditingId(null);
    setForm(f);
    setInitialForm(f);
    setModalOpen(true);
  };

  const openEdit = (x: Xe) => {
    const f = { bienSo: x.bienSo, tenTaiXe: x.tenTaiXe || '', soDienThoaiTaiXe: x.soDienThoaiTaiXe || '', taiTrong: x.taiTrong ? String(x.taiTrong) : '', trangThai: x.trangThai };
    setEditingId(x.id);
    setForm(f);
    setInitialForm(f);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.bienSo.trim()) { showToast('Biển số xe là bắt buộc', 'error'); return; }
    setFormLoading(true);
    try {
      const payload = { bienSo: form.bienSo, tenTaiXe: form.tenTaiXe || null, soDienThoaiTaiXe: form.soDienThoaiTaiXe || null, taiTrong: form.taiTrong ? parseFloat(form.taiTrong) : null, trangThai: form.trangThai };
      if (editingId) { await suaXe(editingId, payload); }
      else { await taoXe(payload); }
      setModalOpen(false);
      setShowSuccess(true);
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
    finally { setFormLoading(false); }
  };

  const resetForm = () => {
    const f = { bienSo: '', tenTaiXe: '', soDienThoaiTaiXe: '', taiTrong: '', trangThai: 'san_sang' as Xe['trangThai'] };
    setForm(f);
    setInitialForm(f);
    setEditingId(null);
  };

  const closeModal = () => {
    if (JSON.stringify(form) !== JSON.stringify(initialForm)) { setShowCancel(true); }
    else { setModalOpen(false); resetForm(); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await xoaXe(deleteTarget.id);
      showToast('Xóa xe thành công');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Unique tai trong options from data
  const taiTrongOptions = Array.from(
    new Set(xes.map((x) => x.taiTrong).filter((v): v is number => v !== null && v !== undefined)),
  ).sort((a, b) => a - b);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Quản lý phương tiện</div>
          <div className={styles.pageHeaderDesc}>Thêm, sửa, xóa xe vận chuyển bê tông</div>
        </div>
        <button className="btn btn-add" onClick={openCreate}><FiPlus /> Thêm xe</button>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrap}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm biển số, tên tài xế..."
            value={tuKhoa}
            onChange={(e) => { setTuKhoa(e.target.value); resetPage(); }}
          />
        </div>

        {/* Tải trọng filter */}
        <div className={`${styles.selectWrap} ${taiTrongFilter ? styles.activeFilter : ''}`}>
          <span className={styles.selectLabel}>Tải trọng</span>
          <div className={styles.selectControl}>
            <select className={styles.selectInput} value={taiTrongFilter} onChange={(e) => { setTaiTrongFilter(e.target.value); resetPage(); }}>
              <option value="">Tất cả</option>
              {taiTrongOptions.map((t) => <option key={t} value={String(t)}>{t} tấn</option>)}
            </select>
            <span className={styles.selectArrow}>▼</span>
          </div>
        </div>

        {/* Trạng thái filter */}
        <div className={`${styles.selectWrap} ${trangThaiFilter ? styles.activeFilter : ''}`}>
          <span className={styles.selectLabel}>Trạng thái</span>
          <div className={styles.selectControl}>
            <select className={styles.selectInput} value={trangThaiFilter} onChange={(e) => { setTrangThaiFilter(e.target.value); resetPage(); }}>
              <option value="">Tất cả</option>
              <option value="san_sang">Sẵn sàng</option>
              <option value="dang_giao">Đang giao</option>
              <option value="bao_tri">Bảo trì</option>
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
            <span className={styles.statNum}>{filteredXes.length}</span> phương tiện
            {hasFilters && <> / {xes.length} tổng</>}
          </div>
          <div className={styles.statDot} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>{filteredXes.filter((x) => x.trangThai === 'san_sang').length}</span> sẵn sàng
          </div>
          <div className={styles.statDot} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>{filteredXes.filter((x) => x.trangThai === 'dang_giao').length}</span> đang giao
          </div>
        </div>

        <div className={styles.tableWrap}>
          {loading ? <Loading /> : filteredXes.length === 0 ? (
            <EmptyState icon="🚛" text={hasFilters ? 'Không có phương tiện phù hợp với bộ lọc' : 'Chưa có phương tiện nào'} />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Biển số</th>
                  <th>Tài xế</th>
                  <th>SĐT</th>
                  <th>Tải trọng</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedXes.map((x) => (
                  <tr key={x.id}>
                    <td><strong className={styles.tableName}>{x.bienSo}</strong></td>
                    <td>{x.tenTaiXe || <span className={styles.placeholder}>—</span>}</td>
                    <td className={styles.tablePhone}>{x.soDienThoaiTaiXe || <span className={styles.placeholder}>—</span>}</td>
                    <td>{x.taiTrong ? `${x.taiTrong} tấn` : <span className={styles.placeholder}>—</span>}</td>
                    <td><span className={`${styles.badge} ${TRANG_THAI_CLASS[x.trangThai] || ''}`}>{TRANG_THAI_LABELS[x.trangThai] || x.trangThai}</span></td>
                    <td>
                      <div className={styles.rowActions}>
                        <button className={`${styles.actionBtn} ${styles.actionBtnEye}`} onClick={() => openViewOrders(x)} title="Xem đơn hàng"><FiEye size={14} /></button>
                        <button className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => openEdit(x)} title="Sửa"><FiEdit2 size={14} /></button>
                        {canDelete && (
                          <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteTarget(x)} title="Xóa"><FiTrash2 size={14} /></button>
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

      {/* Order Modal */}
      <Modal
        isOpen={orderModalOpen}
        onClose={() => { setOrderModalOpen(false); setSelectedXe(null); setOrders([]); }}
        title={selectedXe ? `Đơn hàng của xe ${selectedXe.bienSo}` : 'Đơn hàng'}
        size="lg"
      >
        {ordersLoading ? (
          <div className={styles.orderLoading}><Loading /></div>
        ) : orders.length === 0 ? (
          <div className={styles.orderEmpty}>
            <span className={styles.orderEmptyIcon}>📦</span>
            <p>Chưa có đơn hàng nào được giao cho xe này</p>
          </div>
        ) : (
          <div className={styles.orderList}>
            {orders.map((o) => (
              <div key={o.id} className={styles.orderItem}>
                <div className={styles.orderItemHeader}>
                  <span className={styles.orderMa}>{o.maDonHang}</span>
                  <span
                    className={styles.orderStatus}
                    style={{ background: `${TRANG_THAI_DON_COLORS[o.trangThaiDon] || '#6b7280'}18`, color: TRANG_THAI_DON_COLORS[o.trangThaiDon] || '#6b7280' }}
                  >
                    {TRANG_THAI_DON_LABELS[o.trangThaiDon] || o.trangThaiDon}
                  </span>
                </div>
                <div className={styles.orderItemBody}>
                  <div className={styles.orderInfoRow}>
                    <span className={styles.orderLabel}>Khách hàng</span>
                    <span className={styles.orderValue}>{o.tenKhachHang}</span>
                  </div>
                  <div className={styles.orderInfoRow}>
                    <span className={styles.orderLabel}>Địa chỉ</span>
                    <span className={styles.orderValue}>{o.diaChiNhan}</span>
                  </div>
                  <div className={styles.orderInfoRow}>
                    <span className={styles.orderLabel}>Khối lượng</span>
                    <span className={styles.orderValue}>{o.khoiLuongDat} m³</span>
                  </div>
                  <div className={styles.orderInfoRow}>
                    <span className={styles.orderLabel}>Đơn giá</span>
                    <span className={styles.orderValue}>{o.donGia.toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingId ? 'Sửa phương tiện' : 'Thêm phương tiện mới'}
        footer={<><button className="btn btn-cancel" onClick={closeModal} disabled={formLoading}>Hủy</button><button className="btn btn-save" onClick={handleSubmit} disabled={formLoading}>{formLoading ? 'Đang lưu...' : (editingId ? 'Cập nhật' : 'Thêm xe')}</button></>}
      >
        <div className={styles.formGroup}><label className={styles.formLabel}>Biển số xe *</label><input className={styles.formInput} value={form.bienSo} onChange={(e) => setForm({ ...form, bienSo: e.target.value })} placeholder="VD: 59C1-12345" /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Tên tài xế</label><input className={styles.formInput} value={form.tenTaiXe} onChange={(e) => setForm({ ...form, tenTaiXe: e.target.value })} /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>SĐT tài xế</label><input className={styles.formInput} value={form.soDienThoaiTaiXe} onChange={(e) => setForm({ ...form, soDienThoaiTaiXe: e.target.value })} /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Tải trọng (tấn)</label><input type="number" className={styles.formInput} value={form.taiTrong} onChange={(e) => setForm({ ...form, taiTrong: e.target.value })} placeholder="VD: 10" /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Trạng thái</label><select className={styles.formSelect} value={form.trangThai} onChange={(e) => setForm({ ...form, trangThai: e.target.value as Xe['trangThai'] })}><option value="san_sang">Sẵn sàng</option><option value="dang_giao">Đang giao</option><option value="bao_tri">Bảo trì</option></select></div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa phương tiện"
        message={`Bạn có chắc muốn xóa phương tiện "${deleteTarget?.bienSo}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        loading={deleteLoading}
      />

      <ConfirmModal
        isOpen={showSuccess}
        onClose={() => { setShowSuccess(false); loadData(); resetForm(); }}
        onConfirm={() => { setShowSuccess(false); loadData(); resetForm(); }}
        message={editingId ? 'Cập nhật phương tiện thành công!' : 'Thêm phương tiện thành công!'}
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
