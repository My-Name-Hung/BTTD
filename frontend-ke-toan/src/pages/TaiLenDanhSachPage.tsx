import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiDownload, FiUpload, FiFileText, FiCheckCircle, FiXCircle, FiClock, FiFilter, FiTrash2 } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import {
  importDonHang,
  importKhachHang,
  importNguoiDung,
  importPhuongTien,
  importMacBeTong,
  layLichSuImport,
  ImportHistory,
  ImportResult,
} from '../services/api';
import { useToast, usePageRole, VaiTro } from '../hooks';
import { Loading } from '../components/Common';
import styles from './TaiLenDanhSachPage.module.css';

type TabKey = 'don_hang' | 'khach_hang' | 'nguoi_dung' | 'phuong_tien' | 'mac_be_tong';

interface TabConfig {
  key: TabKey;
  label: string;
  importFn: (file: File) => Promise<ImportResult>;
  canAccess: string[];
  templateColumns: { key: string; title: string; example: string }[];
}

const TABS: TabConfig[] = [
  {
    key: 'don_hang',
    label: 'Đơn hàng',
    importFn: importDonHang,
    canAccess: ['admin', 'ke_toan', 'dieu_phoi'],
    templateColumns: [
      { key: 'Tên khách hàng', title: 'Tên khách hàng', example: 'Nguyễn Văn A' },
      { key: 'Địa chỉ nhận', title: 'Địa chỉ nhận', example: '123 Đường ABC, Q.Ninh Kiều, Cần Thơ' },
      { key: 'Số điện thoại', title: 'Số điện thoại', example: '0909123456' },
      { key: 'Tên mác bê tông', title: 'Tên mác bê tông', example: 'M250' },
      { key: 'Khối lượng đặt', title: 'Khối lượng đặt (m³)', example: '50' },
      { key: 'Đơn giá', title: 'Đơn giá (VNĐ)', example: '1500000' },
      { key: 'Trạm trộn', title: 'Trạm trộn', example: 'Trạm trộn Tây Đô' },
      { key: 'Thời gian giao dự kiến', title: 'Thời gian giao dự kiến', example: '2026-06-01' },
      { key: 'Ghi chú', title: 'Ghi chú', example: 'Giao buổi sáng' },
    ],
  },
  {
    key: 'khach_hang',
    label: 'Khách hàng',
    importFn: importKhachHang,
    canAccess: ['admin', 'ke_toan', 'dieu_phoi'],
    templateColumns: [
      { key: 'Tên khách hàng', title: 'Tên khách hàng', example: 'Công Ty TNHH ABC' },
      { key: 'Địa chỉ', title: 'Địa chỉ', example: '456 Đường XYZ, Cần Thơ' },
      { key: 'Số điện thoại', title: 'Số điện thoại', example: '0292123456' },
      { key: 'Email', title: 'Email', example: 'abc@gmail.com' },
      { key: 'Ghi chú', title: 'Ghi chú', example: 'Khách VIP' },
    ],
  },
  {
    key: 'nguoi_dung',
    label: 'Người dùng',
    importFn: importNguoiDung,
    canAccess: ['admin'],
    templateColumns: [
      { key: 'Tên đăng nhập', title: 'Tên đăng nhập', example: 'nv_hung' },
      { key: 'Mật khẩu', title: 'Mật khẩu', example: 'Matkhau123' },
      { key: 'Họ tên', title: 'Họ tên', example: 'Trần Văn Hùng' },
      { key: 'Email', title: 'Email', example: 'hung@betongtaydo.com' },
      { key: 'Số điện thoại', title: 'Số điện thoại', example: '0909123456' },
      { key: 'Vai trò', title: 'Vai trò (admin/ke_toan/dieu_phoi/lanh_dao)', example: 'ke_toan' },
    ],
  },
  {
    key: 'phuong_tien',
    label: 'Phương tiện',
    importFn: importPhuongTien,
    canAccess: ['admin'],
    templateColumns: [
      { key: 'Biển số', title: 'Biển số xe', example: '65C1-12345' },
      { key: 'Tên tài xế', title: 'Tên tài xế', example: 'Lê Văn Bình' },
      { key: 'SĐT tài xế', title: 'SĐT tài xế', example: '0909123456' },
      { key: 'Tải trọng', title: 'Tải trọng (tấn)', example: '10' },
    ],
  },
  {
    key: 'mac_be_tong',
    label: 'Mác bê tông',
    importFn: importMacBeTong,
    canAccess: ['admin', 'ke_toan', 'dieu_phoi'],
    templateColumns: [
      { key: 'Tên mác', title: 'Tên mác', example: 'M251' },
      { key: 'DonGia', title: 'DonGia', example: '1500000' },
      { key: 'MoTa', title: 'MoTa', example: 'Mác bê tông 250' },
    ],
  },
];

function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}

function generateTemplate(tab: TabConfig): void {
  const wsData = [
    tab.templateColumns.map((c) => c.title),
    tab.templateColumns.map((c) => c.example),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Du_lieu_mau');
  XLSX.writeFile(wb, `mau_import_${tab.key}.xlsx`);
}

export default function TaiLenDanhSachPage() {
  const { hasPermission, hasAnyRole } = usePageRole();
  const { toasts, showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('don_hang');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const limit = 10;

  const tab = TABS.find((t) => t.key === activeTab)!;
  const canAccess = hasAnyRole(tab.canAccess as VaiTro[]);

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await layLichSuImport(activeTab, page, limit, tuNgay || undefined, denNgay || undefined);
      setHistory(res.data);
      setHistoryPage(page);
      setHistoryTotal(res.pagination.total);
    } catch {
      showToast('Không tải được lịch sử', 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [activeTab, tuNgay, denNgay, showToast]);

  useEffect(() => { loadHistory(1); }, [loadHistory]);

  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
      showToast('Chỉ chấp nhận file .xlsx, .xls, .csv', 'error');
      return;
    }
    setFile(f);
    setImportResult(null);
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
    setImportResult(null);
    try {
      const result = await tab.importFn(file);
      setImportResult(result);
      if (result.success > 0) {
        showToast(`Import thành công ${result.success}/${result.total} dòng`);
        setFile(null);
        loadHistory(1);
      } else {
        showToast(`Import thất bại: ${result.errors[0]}`, 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi khi import', 'error');
    } finally {
      setUploading(false);
    }
  };

  const clearFilter = () => { setTuNgay(''); setDenNgay(''); };

  if (!canAccess) {
    return (
      <div className={styles.noAccess}>
        <FiXCircle size={48} />
        <h2>Bạn không có quyền truy cập trang này</h2>
        <p>Liên hệ quản trị viên để được cấp quyền.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Tải lên danh sách</div>
          <div className={styles.pageHeaderDesc}>Nhập dữ liệu hàng loạt từ file Excel (.xlsx, .xls, .csv)</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        {TABS.map((t) => {
          const accessible = hasAnyRole(t.canAccess as VaiTro[]);
          if (!accessible) return null;
          return (
            <button
              key={t.key}
              className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
              onClick={() => { setActiveTab(t.key); setFile(null); setImportResult(null); }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className={styles.content}>
        {/* Left: Upload */}
        <div className={styles.uploadSection}>
          <div className={styles.uploadCard}>
            <div className={styles.uploadCardHeader}>
              <FiUpload size={18} />
              <span>Tải lên file</span>
            </div>

            {/* Download template */}
            <button className={styles.templateBtn} onClick={() => generateTemplate(tab)}>
              <FiDownload size={15} />
              Tải file mẫu
            </button>

            {/* Drop zone */}
            <div
              className={`${styles.dropZone} ${dragging ? styles.dropZoneDragging : ''} ${file ? styles.dropZoneHasFile : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className={styles.hiddenInput}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {file ? (
                <div className={styles.filePreview}>
                  <FiFileText size={32} />
                  <div className={styles.fileName}>{file.name}</div>
                  <div className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
                  <button
                    className={styles.removeFile}
                    onClick={(e) => { e.stopPropagation(); setFile(null); setImportResult(null); }}
                  >
                    <FiTrash2 size={16} />
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

            {/* Upload button */}
            <button
              className={`btn btn-primary ${styles.uploadBtn}`}
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? (
                <>
                  <Loading />
                </>
              ) : (
                <>
                  <FiUpload size={15} /> Import dữ liệu
                </>
              )}
            </button>

            {/* Result */}
            {importResult && (
              <div className={`${styles.resultCard} ${importResult.failed === 0 ? styles.resultSuccess : importResult.success === 0 ? styles.resultError : styles.resultPartial}`}>
                <div className={styles.resultHeader}>
                  {importResult.failed === 0 ? (
                    <FiCheckCircle size={20} />
                  ) : (
                    <FiXCircle size={20} />
                  )}
                  <span>{importResult.failed === 0 ? 'Import thành công!' : importResult.success === 0 ? 'Import thất bại!' : 'Import hoàn thành (có lỗi)'}</span>
                </div>
                <div className={styles.resultStats}>
                  <div className={styles.resultStat}>
                    <span className={styles.resultStatLabel}>Tổng dòng</span>
                    <span className={styles.resultStatValue}>{importResult.total}</span>
                  </div>
                  <div className={`${styles.resultStat} ${styles.resultStatSuccess}`}>
                    <span className={styles.resultStatLabel}>Thành công</span>
                    <span className={styles.resultStatValue}>{importResult.success}</span>
                  </div>
                  <div className={`${styles.resultStat} ${styles.resultStatError}`}>
                    <span className={styles.resultStatLabel}>Thất bại</span>
                    <span className={styles.resultStatValue}>{importResult.failed}</span>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className={styles.errorList}>
                    <div className={styles.errorListTitle}>Chi tiết lỗi:</div>
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <div key={i} className={styles.errorItem}>{err}</div>
                    ))}
                    {importResult.errors.length > 10 && (
                      <div className={styles.errorMore}>... và {importResult.errors.length - 10} lỗi khác</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: History */}
        <div className={styles.historySection}>
          <div className={styles.historyCard}>
            <div className={styles.historyCardHeader}>
              <FiClock size={18} />
              <span>Lịch sử tải lên</span>
            </div>

            {/* Filter */}
            <div className={styles.filterRow}>
              <div className={styles.filterGroup}>
                <label>Từ ngày</label>
                <input
                  type="date"
                  className={styles.filterDate}
                  value={tuNgay}
                  onChange={(e) => setTuNgay(e.target.value)}
                />
              </div>
              <div className={styles.filterGroup}>
                <label>Đến ngày</label>
                <input
                  type="date"
                  className={styles.filterDate}
                  value={denNgay}
                  onChange={(e) => setDenNgay(e.target.value)}
                />
              </div>
              <button className={styles.filterBtn} onClick={clearFilter}>
                <FiFilter size={14} />
              </button>
            </div>

            {/* Table */}
            {historyLoading ? (
              <div className={styles.historyLoading}><Loading /></div>
            ) : history.length === 0 ? (
              <div className={styles.historyEmpty}>
                <FiFileText size={32} />
                <p>Chưa có lịch sử import</p>
              </div>
            ) : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Tên file</th>
                        <th style={{ textAlign: 'center' }}>Tổng</th>
                        <th style={{ textAlign: 'center' }}>Thành công</th>
                        <th style={{ textAlign: 'center' }}>Thất bại</th>
                        <th>Người tải</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td>
                            <div className={styles.fileCell}>
                              <FiFileText size={14} />
                              <span>{h.tenFile}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>{h.tongSo}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={styles.badgeSuccess}>{h.thanhCong}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {h.thatBai > 0 ? (
                              <span className={styles.badgeError}>{h.thatBai}</span>
                            ) : (
                              <span className={styles.badgeZero}>0</span>
                            )}
                          </td>
                          <td>{h.nguoiTaiHoTen}</td>
                          <td className={styles.dateCell}>{formatDate(h.ngayTai)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {historyTotal > limit && (
                  <div className={styles.pagination}>
                    <button
                      className={styles.pageBtn}
                      disabled={historyPage <= 1}
                      onClick={() => loadHistory(historyPage - 1)}
                    >
                      ←
                    </button>
                    <span className={styles.pageInfo}>
                      Trang {historyPage} / {Math.ceil(historyTotal / limit)}
                    </span>
                    <button
                      className={styles.pageBtn}
                      disabled={historyPage >= Math.ceil(historyTotal / limit)}
                      onClick={() => loadHistory(historyPage + 1)}
                    >
                      →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
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
