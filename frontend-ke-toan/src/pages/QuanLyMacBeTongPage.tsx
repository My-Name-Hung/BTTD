import React, { useState, useEffect, useCallback } from 'react';
import {
  FiSearch, FiX, FiPlus, FiEdit2, FiTrash2, FiPackage,
} from 'react-icons/fi';
import {
  layDanhSachMacBeTong, taoMacBeTong, suaMacBeTong, xoaMacBeTong,
} from '../services/api';
import { MacBeTong } from '../types';
import { useToast } from '../hooks';
import { Modal, Loading, EmptyState } from '../components/Common';
import styles from './QuanLyMacBeTongPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

export default function QuanLyMacBeTongPage() {
  const { toasts, showToast } = useToast();
  const [macBeTongs, setMacBeTongs] = useState<MacBeTong[]>([]);
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MacBeTong | null>(null);
  const [form, setForm] = useState({ tenMac: '', chiPhiPhatSinh: '', buVanChuyen: '', moTa: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await layDanhSachMacBeTong();
      setMacBeTongs(data || []);
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = tuKhoa
    ? macBeTongs.filter(m => m.tenMac.toLowerCase().includes(tuKhoa.toLowerCase()))
    : macBeTongs;

  const openCreate = () => {
    setEditingId(null);
    setForm({ tenMac: '', chiPhiPhatSinh: '', buVanChuyen: '', moTa: '' });
    setModalOpen(true);
  };

  const openEdit = (m: MacBeTong) => {
    setEditingId(m.id);
    setForm({
      tenMac: m.tenMac,
      chiPhiPhatSinh: Number(m.chiPhiPhatSinh || 0).toLocaleString('vi-VN'),
      buVanChuyen: Number(m.buVanChuyen || 0).toLocaleString('vi-VN'),
      moTa: m.moTa || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.tenMac.trim()) {
      showToast('Vui lòng nhập tên mác', 'error');
      return;
    }
    const chiPhi = parseFloat(form.chiPhiPhatSinh.replace(/[^\d]/g, '') || '0');
    const buVanChuyen = parseFloat(form.buVanChuyen.replace(/[^\d]/g, '') || '0');

    setFormLoading(true);
    try {
      const payload = {
        tenMac: form.tenMac.trim(),
        chiPhiPhatSinh: chiPhi,
        buVanChuyen,
        moTa: form.moTa.trim() || null,
      };
      if (editingId) {
        await suaMacBeTong(editingId, payload);
        showToast('Cập nhật mác bê tông thành công');
      } else {
        await taoMacBeTong(payload);
        showToast('Tạo mác bê tông thành công');
      }
      setModalOpen(false);
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await xoaMacBeTong(deleteTarget.id);
      showToast('Xóa mác bê tông thành công');
      setDeleteTarget(null);
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi xóa', 'error'); }
    finally { setDeleteLoading(false); }
  };

  const formatInput = (v: string) => {
    const raw = v.replace(/[^\d]/g, '');
    return raw ? Number(raw).toLocaleString('vi-VN') : '';
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Quản lý mác bê tông</div>
          <div className={styles.pageHeaderDesc}>Thêm, sửa, xóa mác bê tông</div>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <FiPlus size={16} /> Thêm mác
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterSearch}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm tên mác..."
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

      <div className={styles.card}>
        {loading ? <Loading /> : filtered.length === 0 ? (
          <EmptyState icon={<FiPackage size={48} />} text="Không có mác bê tông nào" />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ minWidth: 100 }}>Tên mác</th>
                  <th style={{ minWidth: 140, textAlign: 'right' }}>Chi phí phát sinh</th>
                  <th style={{ minWidth: 130, textAlign: 'right' }}>Bù vận chuyển</th>
                  <th style={{ minWidth: 100 }}>Ghi chú</th>
                  <th style={{ minWidth: 90 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className={styles.macName}>{m.tenMac}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong>{formatCurrency(m.chiPhiPhatSinh)}</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {m.buVanChuyen > 0 ? (
                        <span className={styles.buHighlight}>{formatCurrency(m.buVanChuyen)}</span>
                      ) : (
                        <span className={styles.buEmpty}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.moTa}>{m.moTa || '-'}</span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                          onClick={() => openEdit(m)}
                          title="Sửa"
                        >
                          <FiEdit2 size={14} />
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                          onClick={() => setDeleteTarget(m)}
                          title="Xóa"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tạo / Sửa */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Sửa mác bê tông' : 'Thêm mác bê tông'}
        footer={
          <>
            <button className="btn btn-cancel" onClick={() => setModalOpen(false)} disabled={formLoading}>Hủy</button>
            <button className="btn btn-save" onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? 'Đang xử lý...' : editingId ? 'Lưu thay đổi' : 'Tạo mới'}
            </button>
          </>
        }
      >
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Tên mác *</label>
          <input
            className={styles.formInput}
            value={form.tenMac}
            onChange={(e) => setForm({ ...form, tenMac: e.target.value })}
            placeholder="VD: M250, M300..."
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Chi phí phát sinh (VNĐ)</label>
          <input
            className={styles.formInput}
            value={form.chiPhiPhatSinh}
            onChange={(e) => setForm({ ...form, chiPhiPhatSinh: formatInput(e.target.value) })}
            placeholder="0"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Bù vận chuyển (VNĐ)</label>
          <input
            className={styles.formInput}
            value={form.buVanChuyen}
            onChange={(e) => setForm({ ...form, buVanChuyen: formatInput(e.target.value) })}
            placeholder="0"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Ghi chú</label>
          <textarea
            className={styles.formTextarea}
            value={form.moTa}
            onChange={(e) => setForm({ ...form, moTa: e.target.value })}
            placeholder="Mô tả mác bê tông..."
          />
        </div>
      </Modal>

      {/* Modal Xác nhận xóa */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xác nhận xóa"
        footer={
          <>
            <button className="btn btn-cancel" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Hủy</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Đang xóa...' : 'Xóa'}
            </button>
          </>
        }
      >
        <p className={styles.deleteMsg}>
          Bạn có chắc muốn xóa mác <strong>{deleteTarget?.tenMac}</strong>? Hành động này không thể hoàn tác.
        </p>
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
