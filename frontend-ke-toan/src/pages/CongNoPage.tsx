import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiX, FiEdit2, FiTrash2, FiUpload, FiDownload,
  FiFileText, FiCheckCircle, FiXCircle,
} from 'react-icons/fi';
import {
  layDanhSachCongNo, suaCongNo, xoaCongNo, layCongNoTheoId, importCongNo,
  layCongNoGrouped, layDanhSachNhomCongNo,
} from '../services/api';
import { CongNo, CongNoGroup } from '../types';
import { useToast, usePageRole } from '../hooks';
import { Loading, EmptyState, ConfirmModal } from '../components/Common';
import { generateCongNoBravoTemplate } from '../utils/exportCongNo';
import styles from './CongNoPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }
function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const TRANG_THAI_LABELS: Record<string, string> = {
  chua_thanh_toan: 'Chưa thanh toán',
  dang_thanh_toan: 'Đang thanh toán',
  da_thanh_toan: 'Đã thanh toán',
  qua_han: 'Quá hạn',
};

const TRANG_THAI_CLASS: Record<string, string> = {
  chua_thanh_toan: styles.badgeChuaTT,
  dang_thanh_toan: styles.badgeDangTT,
  da_thanh_toan: styles.badgeDaTT,
  qua_han: styles.badgeQuaHan,
};

type TabKey = 'danh_sach' | 'tai_len';

type EditForm = {
  id: number;
  tongTien: string;
  daThanhToan: string;
  conLai: string;
  ngayBatDau: string;
  hanThanhToan: string;
  trangThai: string;
  ghiChu: string;
};

const TRANG_THAI_OPTIONS = [
  { value: 'chua_thanh_toan', label: 'Chưa thanh toán' },
  { value: 'dang_thanh_toan', label: 'Đang thanh toán' },
  { value: 'da_thanh_toan', label: 'Đã thanh toán' },
  { value: 'qua_han', label: 'Quá hạn' },
];

async function downloadTemplate() {
  const buf = await generateCongNoBravoTemplate();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mau_import_cong_no.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export default function CongNoPage() {
  const { toasts, showToast } = useToast();
  const { hasAnyRole } = usePageRole();
  const [activeTab, setActiveTab] = useState<TabKey>('danh_sach');

  // List state - grouped
  const [groups, setGroups] = useState<CongNoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [nhomFilter, setNhomFilter] = useState('');
  const [nhomList, setNhomList] = useState<{ nhom: string; soLuong: number }[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchTimeout, setSearchTimeoutState] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CongNo | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canWrite = hasAnyRole(['admin', 'ke_toan']);

  const loadNhomList = useCallback(async () => {
    try {
      const data = await layDanhSachNhomCongNo();
      setNhomList(data);
    } catch { /* ignore */ }
  }, []);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await layCongNoGrouped(search || undefined, nhomFilter || undefined);
      setGroups(data);
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [search, nhomFilter, showToast]);

  useEffect(() => { loadGroups(); loadNhomList(); }, [loadGroups, loadNhomList]);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => setSearch(val), 400);
    setSearchTimeoutState(t);
  };

  const tongCongNo = groups.reduce((s, g) => s + g.tongConLai, 0);
  const tongDaTT = groups.reduce((s, g) => s + g.tongDaThanhToan, 0);

  const toggleGroup = (nhom: string) => {
    const next = new Set(collapsed);
    if (next.has(nhom)) next.delete(nhom);
    else next.add(nhom);
    setCollapsed(next);
  };

  // Open edit modal
  const openEdit = async (cn: CongNo) => {
    try {
      const full = await layCongNoTheoId(cn.id);
      setEditForm({
        id: full.id,
        tongTien: String(full.tongTien),
        daThanhToan: String(full.daThanhToan),
        conLai: String(full.conLai),
        ngayBatDau: full.ngayBatDau ? String(full.ngayBatDau).split('T')[0] : '',
        hanThanhToan: full.hanThanhToan ? String(full.hanThanhToan).split('T')[0] : '',
        trangThai: full.trangThai,
        ghiChu: full.ghiChu || '',
      });
      setEditModal(true);
    } catch { showToast('Không tải được chi tiết công nợ', 'error'); }
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      const tongTien = parseFloat(editForm.tongTien.replace(/[^\d]/g, '')) || 0;
      const daThanhToan = parseFloat(editForm.daThanhToan.replace(/[^\d]/g, '')) || 0;
      const conLai = parseFloat(editForm.conLai.replace(/[^\d]/g, '')) || 0;
      await suaCongNo(editForm.id, {
        tongTien, daThanhToan, conLai,
        ngayBatDau: editForm.ngayBatDau || null,
        hanThanhToan: editForm.hanThanhToan || null,
        trangThai: editForm.trangThai,
        ghiChu: editForm.ghiChu || null,
      });
      showToast('Cập nhật công nợ thành công');
      setEditModal(false);
      loadGroups();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi lưu', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await xoaCongNo(confirmDelete.id);
      showToast('Xóa công nợ thành công');
      setConfirmDelete(null);
      loadGroups();
      loadNhomList();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi xóa', 'error');
    } finally { setDeletingId(null); }
  };

  // Upload handlers
  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
      showToast('Chỉ chấp nhận file .xlsx, .xls, .csv', 'error');
      return;
    }
    setFile(f);
    setUploadResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) { showToast('Vui lòng chọn file trước', 'error'); return; }
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await importCongNo(file);
      setUploadResult(result);
      if (result.success > 0) {
        showToast(`Tải lên thành công ${result.success}/${result.total} dòng`);
        setFile(null);
        if (activeTab === 'tai_len') setActiveTab('danh_sach');
        loadGroups();
        loadNhomList();
      } else {
        showToast(`Tải lên thất bại: ${result.errors[0] || 'Không rõ lỗi'}`, 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi Tải lên', 'error');
    } finally { setUploading(false); }
  };

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Công nợ</div>
          <div className={styles.pageHeaderDesc}>Theo dõi công nợ khách hàng theo nhóm từ Bravo</div>
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng công nợ</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>{formatCurrency(tongCongNo)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Đã thanh toán</div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{formatCurrency(tongDaTT)}</div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'danh_sach' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('danh_sach')}
        >
          Danh sách
        </button>
        {canWrite && (
          <button
            className={`${styles.tabBtn} ${activeTab === 'tai_len' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('tai_len')}
          >
            Tải lên
          </button>
        )}
      </div>

      {/* ─── TAB: Danh sách ─── */}
      {activeTab === 'danh_sach' && (
        <>
          {/* Filter bar */}
          <div className={styles.filterBar}>
            <div className={styles.filterBarLeft}>
              <div className={styles.searchWrap}>
                <input
                  className={styles.searchInput}
                  placeholder="Tìm mã, tên khách hàng..."
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                {searchInput && (
                  <button className={styles.searchClear} onClick={() => { setSearchInput(''); setSearch(''); }}>
                    <FiX size={13} />
                  </button>
                )}
              </div>
              <select
                className={`${styles.filterSelect} ${nhomFilter ? styles.filterSelectActive : ''}`}
                value={nhomFilter}
                onChange={(e) => setNhomFilter(e.target.value)}
              >
                <option value="">Tất cả nhóm</option>
                {nhomList.map((g) => (
                  <option key={g.nhom} value={g.nhom}>{g.nhom}</option>
                ))}
              </select>
              {(search || nhomFilter) && (
                <button className={styles.filterClearBtn}
                  onClick={() => { setSearch(''); setSearchInput(''); setNhomFilter(''); }}>
                  <FiX size={13} /> Xóa lọc
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className={styles.card}>
            <div className={styles.tableWrap}>
              {loading ? <Loading /> : groups.length === 0 ? (
                <EmptyState icon="📊" text="Không có công nợ nào" />
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Tên khách hàng</th>
                      <th className={styles.thRight}>Dư đầu Nợ</th>
                      <th className={styles.thRight}>Dư đầu Có</th>
                      <th className={styles.thRight}>Phát sinh Nợ</th>
                      <th className={styles.thRight}>Phát sinh Có</th>
                      <th className={styles.thRight}>Dư cuối Nợ</th>
                      <th className={styles.thRight}>Dư cuối Có</th>
                      {canWrite && <th className={styles.thCenter}>Hành động</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      const isCollapsed = collapsed.has(group.nhom);
                      const duDauNo = group.items.reduce((s, i) => s + Math.max(0, i.tongTien - i.daThanhToan), 0);
                      const duDauCo = group.items.reduce((s, i) => s + Math.max(0, i.daThanhToan - i.tongTien), 0);
                      const psNo = group.items.reduce((s, i) => s + Math.max(0, i.daThanhToan), 0);
                      const psCo = group.items.reduce((s, i) => s + Math.max(0, i.tongTien - i.daThanhToan), 0);
                      return (
                        <React.Fragment key={group.nhom}>
                          {/* Group header row */}
                          <tr
                            className={styles.groupHeaderRow}
                            onClick={() => toggleGroup(group.nhom)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td colSpan={2} className={styles.groupHeaderLabel}>
                              <span className={styles.groupToggleIcon}>{isCollapsed ? '▶' : '▼'}</span>
                              {group.nhom}
                            </td>
                            <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(duDauNo)}</td>
                            <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(duDauCo)}</td>
                            <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(psNo)}</td>
                            <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(psCo)}</td>
                            <td className={`${styles.groupHeaderValue} ${styles.thRight} ${styles.groupSubTotal}`}>{formatCurrency(group.tongCongNo)}</td>
                            <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongDaThanhToan)}</td>
                            {canWrite && <td />}
                          </tr>
                          {/* Data rows */}
                          {!isCollapsed && group.items.map((cn) => (
                            <tr key={cn.id} className={styles.dataRow}>
                              <td className={styles.dataCell}><strong>{cn.maDonHang || `ĐH-${cn.idDonHang}`}</strong></td>
                              <td className={styles.dataCell}>{cn.tenKhachHang || '—'}</td>
                              <td className={`${styles.dataCell} ${styles.thRight}`} />
                              <td className={`${styles.dataCell} ${styles.thRight}`} />
                              <td className={`${styles.dataCell} ${styles.thRight}`} />
                              <td className={`${styles.dataCell} ${styles.thRight}`} />
                              <td className={`${styles.dataCell} ${styles.thRight} ${cn.conLai > 0 ? styles.conNoCell : ''}`}>
                                {formatCurrency(cn.conLai)}
                              </td>
                              <td className={`${styles.dataCell} ${styles.thRight}`}>
                                {formatCurrency(cn.daThanhToan)}
                              </td>
                              {canWrite && (
                                <td className={`${styles.dataCell} ${styles.thCenter}`}>
                                  <div className={styles.rowActions}>
                                    <button className={styles.actionBtnEdit} onClick={() => openEdit(cn)} title="Sửa">
                                      <FiEdit2 size={14} />
                                    </button>
                                    <button className={styles.actionBtnDelete} onClick={() => setConfirmDelete(cn)} title="Xóa">
                                      <FiTrash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── TAB: Tải lên ─── */}
      {activeTab === 'tai_len' && canWrite && (
        <div className={styles.uploadContent}>
          <div className={styles.uploadCard}>
            <div className={styles.uploadCardHeader}>
              <FiUpload size={18} />
              <span>Tải lên danh sách công nợ</span>
            </div>

            <p className={styles.uploadHint}>
              Tải file từ phần mềm Bravo (Excel) để tải lên công nợ vào hệ thống.
            </p>

            <button className={styles.templateBtn} onClick={downloadTemplate}>
              <FiDownload size={15} /> Tải file mẫu
            </button>

            {/* Drop zone */}
            <div
              className={`${styles.dropZone} ${dragging ? styles.dropZoneDragging : ''} ${file ? styles.dropZoneHasFile : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className={styles.hiddenInput}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

              {file ? (
                <div className={styles.filePreview}>
                  <FiFileText size={32} />
                  <div className={styles.fileName}>{file.name}</div>
                  <div className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
                  <button className={styles.removeFile} onClick={(e) => { e.stopPropagation(); setFile(null); setUploadResult(null); }}>
                    <FiX size={16} />
                  </button>
                </div>
              ) : (
                <div className={styles.dropZoneContent}>
                  <FiUpload size={32} />
                  <p className={styles.dropTitle}>Kéo thả file vào đây</p>
                  <p className={styles.dropSub}>hoặc click để chọn file</p>
                  <p className={styles.dropFormats}>Hỗ trợ: .xlsx, .xls, .csv</p>
                </div>
              )}
            </div>

            <button className={`btn btn-primary ${styles.uploadBtn}`} onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? <><Loading /></> : <><FiUpload size={15} /> Tải lên dữ liệu</>}
            </button>

            {/* Result */}
            {uploadResult && (
              <div className={`${styles.resultCard} ${uploadResult.failed === 0 ? styles.resultSuccess : uploadResult.success === 0 ? styles.resultError : styles.resultPartial}`}>
                <div className={styles.resultHeader}>
                  {uploadResult.failed === 0 ? <FiCheckCircle size={20} /> : <FiXCircle size={20} />}
                  <span>
                    {uploadResult.failed === 0 ? 'Tải lên thành công!' : uploadResult.success === 0 ? 'Tải lên thất bại!' : 'Tải lên hoàn thành (có lỗi)'}
                  </span>
                </div>
                <div className={styles.resultStats}>
                  <div className={styles.resultStat}><span className={styles.resultStatLabel}>Tổng dòng</span><span className={styles.resultStatValue}>{uploadResult.success + uploadResult.failed}</span></div>
                  <div className={`${styles.resultStat} ${styles.resultStatSuccess}`}><span className={styles.resultStatLabel}>Thành công</span><span className={styles.resultStatValue}>{uploadResult.success}</span></div>
                  <div className={`${styles.resultStat} ${styles.resultStatError}`}><span className={styles.resultStatLabel}>Thất bại</span><span className={styles.resultStatValue}>{uploadResult.failed}</span></div>
                </div>
                {uploadResult.errors.length > 0 && (
                  <div className={styles.errorList}>
                    <div className={styles.errorListTitle}>Chi tiết lỗi:</div>
                    {uploadResult.errors.slice(0, 10).map((err, i) => <div key={i} className={styles.errorItem}>{err}</div>)}
                    {uploadResult.errors.length > 10 && <div className={styles.errorMore}>... và {uploadResult.errors.length - 10} lỗi khác</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && editForm && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setEditModal(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>Sửa công nợ</span>
              <button className={styles.modalClose} onClick={() => setEditModal(false)}><FiX size={18} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Tổng tiền (VNĐ)</label>
                  <input className={styles.formInput} type="text" value={editForm.tongTien}
                    onChange={(e) => setEditForm({ ...editForm, tongTien: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Đã thanh toán (VNĐ)</label>
                  <input className={styles.formInput} type="text" value={editForm.daThanhToan}
                    onChange={(e) => setEditForm({ ...editForm, daThanhToan: e.target.value })} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Còn lại (VNĐ)</label>
                  <input className={styles.formInput} type="text" value={editForm.conLai}
                    onChange={(e) => setEditForm({ ...editForm, conLai: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Trạng thái</label>
                  <select className={styles.formInput} value={editForm.trangThai}
                    onChange={(e) => setEditForm({ ...editForm, trangThai: e.target.value })}>
                    {TRANG_THAI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Ngày bắt đầu</label>
                  <input className={styles.formInput} type="date" value={editForm.ngayBatDau}
                    onChange={(e) => setEditForm({ ...editForm, ngayBatDau: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Hạn thanh toán</label>
                  <input className={styles.formInput} type="date" value={editForm.hanThanhToan}
                    onChange={(e) => setEditForm({ ...editForm, hanThanhToan: e.target.value })} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Ghi chú</label>
                <textarea className={styles.formInput} rows={3} value={editForm.ghiChu}
                  onChange={(e) => setEditForm({ ...editForm, ghiChu: e.target.value })} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => setEditModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? <><Loading /></> : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Xóa công nợ"
        message={`Bạn có chắc muốn xóa công nợ của ${confirmDelete?.tenKhachHang || 'khách hàng này'}? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(null)}
        loading={deletingId !== null}
      />
    </div>
  );
}
