import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiUpload,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ConfirmModal, EmptyState, Loading } from "../components/Common";
import { usePageRole, useToast } from "../hooks";
import {
  importCongNoKhachHang,
  layCongNoGrouped,
  layCongNoKhachHangGrouped,
  layDanhSachNhomCongNoKhachHang,
  suaCongNoKhachHang,
  taoCongNoKhachHang,
  xoaCongNoKhachHang,
} from "../services/api";
import { CongNo, CongNoGroup, CongNoGroupExport, CongNoKhachHang, CongNoKhachHangGroup } from "../types";
import { exportToExcel, formatDateForExport } from "../utils/exportData";
import { generateCongNoBravoTemplate } from "../utils/exportCongNo";
import styles from "./CongNoPage.module.css";

const NHOM_CONG_NO_OPTIONS = [
  'Dư đầu Nợ',
  'Dư đầu Có',
  'Phát sinh Nợ',
  'Phát sinh Có',
  'Dư cuối Nợ',
  'Dư cuối Có',
];

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}

async function downloadTemplate() {
  const buf = await generateCongNoBravoTemplate();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mau_import_cong_no.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

type TabKey = "danh_sach" | "tai_len";

export default function CongNoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toasts, showToast } = useToast();
  const { hasAnyRole } = usePageRole();
  const [activeTab, setActiveTab] = useState<TabKey>("danh_sach");

  const [groups, setGroups] = useState<CongNoKhachHangGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('khachHang') || '';
  });
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('khachHang') || '';
  });
  const [nhomFilter, setNhomFilter] = useState("");
  const [nhomList, setNhomList] = useState<{ nhom: string; soLuong: number }[]>(
    [],
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchTimeout, setSearchTimeoutState] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const [addKhachHangModal, setAddKhachHangModal] = useState(false);
  const [addForm, setAddForm] = useState({ maKhachHang: '', tenKhachHang: '', nhom: '' });
  const [nhomSearchQuery, setNhomSearchQuery] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<CongNoKhachHang | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CongNoKhachHang | null>(
    null,
  );

  const [exporting, setExporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canWrite = hasAnyRole(["admin", "ke_toan"]);

  const loadNhomList = useCallback(async () => {
    try {
      const data = await layDanhSachNhomCongNoKhachHang();
      setNhomList(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await layCongNoKhachHangGrouped(
        search || undefined,
        nhomFilter || undefined,
      );
      setGroups(data);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [search, nhomFilter, showToast]);

  useEffect(() => {
    loadGroups();
    loadNhomList();
  }, [loadGroups, loadNhomList]);

  // Sync search from URL query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('khachHang') || '';
    setSearch(q);
    setSearchInput(q);
  }, [location.search]);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => setSearch(val), 400);
    setSearchTimeoutState(t);
  };

  const tongCong = groups
    .flatMap((g) => g.items)
    .find((cn) => cn.tenKhachHang === "Tổng cộng");
  const displayGroups = groups.filter((g) => g.nhom !== "Tổng cộng");

  const tongDuDauNo =
    tongCong?.duDauNo ?? displayGroups.reduce((s, g) => s + g.tongDuDauNo, 0);
  const tongDuDauCo =
    tongCong?.duDauCo ?? displayGroups.reduce((s, g) => s + g.tongDuDauCo, 0);
  const tongPhatSinhNo =
    tongCong?.phatSinhNo ??
    displayGroups.reduce((s, g) => s + g.tongPhatSinhNo, 0);
  const tongPhatSinhCo =
    tongCong?.phatSinhCo ??
    displayGroups.reduce((s, g) => s + g.tongPhatSinhCo, 0);
  const tongDuCuoiNo =
    tongCong?.duCuoiNo ?? displayGroups.reduce((s, g) => s + g.tongDuCuoiNo, 0);
  const tongDuCuoiCo =
    tongCong?.duCuoiCo ?? displayGroups.reduce((s, g) => s + g.tongDuCuoiCo, 0);

  const toggleGroup = (nhom: string) => {
    const next = new Set(collapsed);
    if (next.has(nhom)) next.delete(nhom);
    else next.add(nhom);
    setCollapsed(next);
  };

  const openEdit = (cn: CongNoKhachHang) => {
    setEditForm(cn);
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      await suaCongNoKhachHang(editForm.id, {
        maKhachHang: editForm.maKhachHang ?? undefined,
        tenKhachHang: editForm.tenKhachHang,
        duDauNo: editForm.duDauNo,
        duDauCo: editForm.duDauCo,
        phatSinhNo: editForm.phatSinhNo,
        phatSinhCo: editForm.phatSinhCo,
        duCuoiNo: editForm.duCuoiNo,
        duCuoiCo: editForm.duCuoiCo,
        nhom: editForm.nhom ?? undefined,
      });
      showToast("Cập nhật thành công");
      setEditModal(false);
      loadGroups();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi lưu", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await xoaCongNoKhachHang(confirmDelete.id);
      showToast("Xóa thành công");
      setConfirmDelete(null);
      loadGroups();
      loadNhomList();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xóa", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddKhachHang = async () => {
    if (!addForm.tenKhachHang.trim()) {
      showToast("Tên khách hàng là bắt buộc", "error");
      return;
    }
    setAddLoading(true);
    try {
      await taoCongNoKhachHang({
        maKhachHang: addForm.maKhachHang || undefined,
        tenKhachHang: addForm.tenKhachHang,
        nhom: addForm.nhom || undefined,
      });
      showToast("Thêm khách hàng vào công nợ thành công!");
      setAddKhachHangModal(false);
      setAddForm({ maKhachHang: '', tenKhachHang: '', nhom: '' });
      setNhomSearchQuery('');
      loadGroups();
      loadNhomList();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi thêm", "error");
    } finally {
      setAddLoading(false);
    }
  };

  const handleFile = (f: File) => {
    const ext = f.name.toLowerCase();
    if (
      !ext.endsWith(".xlsx") &&
      !ext.endsWith(".xls") &&
      !ext.endsWith(".csv")
    ) {
      showToast("Chỉ chấp nhận file .xlsx, .xls, .csv", "error");
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
    if (!file) {
      showToast("Vui lòng chọn file trước", "error");
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await importCongNoKhachHang(file);
      setUploadResult(result);
      if (result.success > 0) {
        showToast(`Import thành công ${result.success}/${result.total} dòng`);
        setFile(null);
        if (activeTab === "tai_len") setActiveTab("danh_sach");
        loadGroups();
        loadNhomList();
      } else {
        showToast(
          `Import thất bại: ${result.errors[0] || "Không rõ lỗi"}`,
          "error",
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi khi import", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await layCongNoGrouped(search || undefined, nhomFilter || undefined);
      const allData = res || [];

      const headers: { key: string; label: string; width?: number; alignRight?: boolean }[] = [
        { key: "nhom", label: "Nhóm", width: 25 },
        { key: "maKhachHang", label: "Mã KH", width: 14 },
        { key: "tenKhachHang", label: "Khách hàng", width: 28 },
        { key: "duDauNo", label: "Dư đầu Nợ", width: 16, alignRight: true },
        { key: "duDauCo", label: "Dư đầu Có", width: 16, alignRight: true },
        { key: "phatSinhNo", label: "PS Nợ", width: 14, alignRight: true },
        { key: "phatSinhCo", label: "PS Có", width: 14, alignRight: true },
        { key: "duCuoiNo", label: "Dư cuối Nợ", width: 16, alignRight: true },
        { key: "duCuoiCo", label: "Dư cuối Có", width: 16, alignRight: true },
      ];

      const rows: CongNoGroupExport[] = allData.flatMap((group: CongNoGroup) =>
        group.items.map((cn: CongNo) => ({
          nhom: group.nhom || "",
          maKhachHang: cn.maKhachHang || "",
          tenKhachHang: cn.tenKhachHang || "",
          duDauNo: cn.duDauNo ?? 0,
          duDauCo: cn.duDauCo ?? 0,
          phatSinhNo: cn.phatSinhNo ?? 0,
          phatSinhCo: cn.phatSinhCo ?? 0,
          duCuoiNo: cn.duCuoiNo ?? 0,
          duCuoiCo: cn.duCuoiCo ?? 0,
        }))
      );

      await exportToExcel("BÁO CÁO CÔNG NỢ", headers, rows, `BaoCaoCongNo_${new Date().toISOString().slice(0, 10)}.xlsx`, "Công nợ");
      showToast("Xuất báo cáo thành công!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xuất báo cáo", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Công nợ Bravo</div>
          <div className={styles.pageHeaderDesc}>
            Theo dõi công nợ theo nhóm từ file Bravo
          </div>
        </div>
        <div className={styles.pageHeaderActions}>
          <button
            className="btn btn-export"
            onClick={handleExportExcel}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loading />
              </>
            ) : (
              <>
                <FiDownload /> Xuất báo cáo
              </>
            )}
          </button>
          {canWrite && (
            <button
              className="btn btn-add"
              onClick={() => setAddKhachHangModal(true)}
            >
              <FiPlus /> Thêm khách hàng
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Dư đầu Nợ</div>
          <div
            className={styles.kpiValue}
            style={{ color: "var(--color-warning)" }}
          >
            {formatCurrency(tongDuDauNo)}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Dư đầu Có</div>
          <div
            className={styles.kpiValue}
            style={{ color: "var(--color-success)" }}
          >
            {formatCurrency(tongDuDauCo)}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Phát sinh Nợ</div>
          <div className={styles.kpiValue} style={{ color: "#7c3aed" }}>
            {formatCurrency(tongPhatSinhNo)}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Phát sinh Có</div>
          <div className={styles.kpiValue} style={{ color: "#059669" }}>
            {formatCurrency(tongPhatSinhCo)}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Dư cuối Nợ</div>
          <div
            className={styles.kpiValue}
            style={{ color: "var(--color-warning)" }}
          >
            {formatCurrency(tongDuCuoiNo)}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Dư cuối Có</div>
          <div
            className={styles.kpiValue}
            style={{ color: "var(--color-success)" }}
          >
            {formatCurrency(tongDuCuoiCo)}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === "danh_sach" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("danh_sach")}
        >
          Danh sách
        </button>
        {canWrite && (
          <button
            className={`${styles.tabBtn} ${activeTab === "tai_len" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("tai_len")}
          >
            Tải lên
          </button>
        )}
      </div>

      {/* ─── TAB: Danh sách ─── */}
      {activeTab === "danh_sach" && (
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
                  <button
                    className={styles.searchClear}
                    onClick={() => {
                      setSearchInput("");
                      setSearch("");
                    }}
                  >
                    <FiX size={13} />
                  </button>
                )}
              </div>
              <select
                className={`${styles.filterSelect} ${nhomFilter ? styles.filterSelectActive : ""}`}
                value={nhomFilter}
                onChange={(e) => setNhomFilter(e.target.value)}
              >
                <option value="">Tất cả nhóm</option>
                {nhomList.map((g) => (
                  <option key={g.nhom} value={g.nhom}>
                    {g.nhom}
                  </option>
                ))}
              </select>
              {(search || nhomFilter) && (
                <button
                  className={styles.filterClearBtn}
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                    setNhomFilter("");
                  }}
                >
                  <FiX size={13} /> Xóa lọc
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className={styles.card}>
            <div className={styles.tableWrap}>
              {loading ? (
                <Loading />
              ) : groups.length === 0 ? (
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
                      {canWrite && (
                        <th className={styles.thCenter}>Hành động</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {displayGroups.map((group) => {
                      const isCollapsed = collapsed.has(group.nhom);
                      return (
                        <React.Fragment key={group.nhom}>
                          {/* Group header */}
                          <tr
                            className={styles.groupHeaderRow}
                            onClick={() => toggleGroup(group.nhom)}
                            style={{ cursor: "pointer" }}
                          >
                            <td colSpan={2} className={styles.groupHeaderLabel}>
                              <div className={styles.groupHeaderLabelInner}>
                                <span className={styles.groupToggleIcon}>
                                  {isCollapsed ? "▶" : "▼"}
                                </span>
                                {group.nhom}
                              </div>
                            </td>
                            {canWrite ? (
                              <>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongDuDauNo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongDuDauCo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongPhatSinhNo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongPhatSinhCo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight} ${styles.groupSubTotal}`}>{formatCurrency(group.tongDuCuoiNo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongDuCuoiCo)}</td>
                                <td />
                              </>
                            ) : (
                              <>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongDuDauNo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongDuDauCo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongPhatSinhNo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongPhatSinhCo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight} ${styles.groupSubTotal}`}>{formatCurrency(group.tongDuCuoiNo)}</td>
                                <td className={`${styles.groupHeaderValue} ${styles.thRight}`}>{formatCurrency(group.tongDuCuoiCo)}</td>
                              </>
                            )}
                          </tr>
                          {/* Data rows */}
                          {!isCollapsed &&
                            group.items.map((cn) => (
                              <tr key={cn.id} className={styles.dataRow}>
                                <td className={styles.dataCell}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <strong>{cn.maKhachHang || "—"}</strong>
                                  </div>
                                </td>
                                <td className={styles.dataCell}>
                                  {cn.tenKhachHang}
                                </td>
                                <td
                                  className={`${styles.dataCell} ${styles.thRight}`}
                                >
                                  {formatCurrency(cn.duDauNo)}
                                </td>
                                <td
                                  className={`${styles.dataCell} ${styles.thRight}`}
                                >
                                  {formatCurrency(cn.duDauCo)}
                                </td>
                                <td
                                  className={`${styles.dataCell} ${styles.thRight}`}
                                >
                                  {formatCurrency(cn.phatSinhNo)}
                                </td>
                                <td
                                  className={`${styles.dataCell} ${styles.thRight}`}
                                >
                                  {formatCurrency(cn.phatSinhCo)}
                                </td>
                                <td
                                  className={`${styles.dataCell} ${styles.thRight} ${cn.duCuoiNo > 0 ? styles.conNoCell : ""}`}
                                >
                                  {formatCurrency(cn.duCuoiNo)}
                                </td>
                                <td
                                  className={`${styles.dataCell} ${styles.thRight}`}
                                >
                                  {formatCurrency(cn.duCuoiCo)}
                                </td>
                                {canWrite && (
                                  <td
                                    className={`${styles.dataCell} ${styles.thCenter}`}
                                  >
                                    <div className={styles.rowActions}>
                                      <button
                                        className={styles.actionBtnEdit}
                                        onClick={() => openEdit(cn)}
                                        title="Sửa"
                                      >
                                        <FiEdit2 size={14} />
                                      </button>
                                      <button
                                        className={styles.actionBtnDelete}
                                        onClick={() => setConfirmDelete(cn)}
                                        title="Xóa"
                                      >
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
                    {/* Dòng Tổng cộng */}
                    {tongCong && (
                      <tr className={styles.grandTotalRow}>
                        <td className={styles.grandTotalLabel}>Tổng cộng</td>
                        {canWrite ? (
                          <>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.duDauNo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.duDauCo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.phatSinhNo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.phatSinhCo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight} ${styles.grandTotalSub}`}>{formatCurrency(tongCong.duCuoiNo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.duCuoiCo)}</td>
                            <td />
                          </>
                        ) : (
                          <>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.duDauNo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.duDauCo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.phatSinhNo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.phatSinhCo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight} ${styles.grandTotalSub}`}>{formatCurrency(tongCong.duCuoiNo)}</td>
                            <td className={`${styles.grandTotalValue} ${styles.thRight}`}>{formatCurrency(tongCong.duCuoiCo)}</td>
                          </>
                        )}
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── TAB: Tải lên ─── */}
      {activeTab === "tai_len" && canWrite && (
        <div className={styles.uploadContent}>
          <div className={styles.uploadCard}>
            <div className={styles.uploadCardHeader}>
              <FiUpload size={18} />
              <span>Import công nợ Bravo</span>
            </div>
            <p className={styles.uploadHint}>
              Tải file Excel từ phần mềm Bravo để import công nợ theo khách hàng
              vào hệ thống.
            </p>
            <button className={styles.templateBtn} onClick={downloadTemplate}>
              <FiDownload size={15} /> Tải file mẫu
            </button>
            <div
              className={`${styles.dropZone} ${dragging ? styles.dropZoneDragging : ""} ${file ? styles.dropZoneHasFile : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className={styles.hiddenInput}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {file ? (
                <div className={styles.filePreview}>
                  <FiFileText size={32} />
                  <div className={styles.fileName}>{file.name}</div>
                  <div className={styles.fileSize}>
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                  <button
                    className={styles.removeFile}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setUploadResult(null);
                    }}
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ) : (
                <div className={styles.dropZoneContent}>
                  <FiUpload size={32} />
                  <p className={styles.dropTitle}>Kéo thả file vào đây</p>
                  <p className={styles.dropSub}>hoặc click để chọn file</p>
                  <p className={styles.dropFormats}>
                    Hỗ trợ: .xlsx, .xls, .csv
                  </p>
                </div>
              )}
            </div>
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

            {uploadResult && (
              <div
                className={`${styles.resultCard} ${uploadResult.failed === 0 ? styles.resultSuccess : uploadResult.success === 0 ? styles.resultError : styles.resultPartial}`}
              >
                <div className={styles.resultHeader}>
                  {uploadResult.failed === 0 ? (
                    <FiCheckCircle size={20} />
                  ) : (
                    <FiXCircle size={20} />
                  )}
                  <span>
                    {uploadResult.failed === 0
                      ? "Import thành công!"
                      : uploadResult.success === 0
                        ? "Import thất bại!"
                        : "Import hoàn thành (có lỗi)"}
                  </span>
                </div>
                <div className={styles.resultStats}>
                  <div className={styles.resultStat}>
                    <span className={styles.resultStatLabel}>Tổng dòng</span>
                    <span className={styles.resultStatValue}>
                      {uploadResult.success + uploadResult.failed}
                    </span>
                  </div>
                  <div
                    className={`${styles.resultStat} ${styles.resultStatSuccess}`}
                  >
                    <span className={styles.resultStatLabel}>Thành công</span>
                    <span className={styles.resultStatValue}>
                      {uploadResult.success}
                    </span>
                  </div>
                  <div
                    className={`${styles.resultStat} ${styles.resultStatError}`}
                  >
                    <span className={styles.resultStatLabel}>Thất bại</span>
                    <span className={styles.resultStatValue}>
                      {uploadResult.failed}
                    </span>
                  </div>
                </div>
                {uploadResult.errors.length > 0 && (
                  <div className={styles.errorList}>
                    <div className={styles.errorListTitle}>Chi tiết lỗi:</div>
                    {uploadResult.errors.slice(0, 10).map((err, i) => (
                      <div key={i} className={styles.errorItem}>
                        {err}
                      </div>
                    ))}
                    {uploadResult.errors.length > 10 && (
                      <div className={styles.errorMore}>
                        ... và {uploadResult.errors.length - 10} lỗi khác
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && editForm && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditModal(false);
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>Sửa công nợ</span>
              <button
                className={styles.modalClose}
                onClick={() => setEditModal(false)}
              >
                <FiX size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Mã khách hàng</label>
                  <input
                    className={styles.formInput}
                    value={editForm.maKhachHang || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, maKhachHang: e.target.value })
                    }
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Tên khách hàng</label>
                  <input
                    className={styles.formInput}
                    value={editForm.tenKhachHang}
                    onChange={(e) =>
                      setEditForm({ ...editForm, tenKhachHang: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Dư đầu Nợ</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    value={editForm.duDauNo}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        duDauNo: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Dư đầu Có</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    value={editForm.duDauCo}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        duDauCo: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Phát sinh Nợ</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    value={editForm.phatSinhNo}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        phatSinhNo: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Phát sinh Có</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    value={editForm.phatSinhCo}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        phatSinhCo: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Dư cuối Nợ</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    value={editForm.duCuoiNo}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        duCuoiNo: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Dư cuối Có</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    value={editForm.duCuoiCo}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        duCuoiCo: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Nhóm</label>
                <select
                  className={styles.formInput}
                  value={editForm.nhom || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, nhom: e.target.value || null })
                  }
                >
                  <option value="">Chưa phân nhóm</option>
                  {nhomList.map((g) => (
                    <option key={g.nhom} value={g.nhom}>
                      {g.nhom}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className="btn btn-secondary"
                onClick={() => setEditModal(false)}
              >
                Hủy
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loading />
                  </>
                ) : (
                  "Lưu thay đổi"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Xóa công nợ"
        message={`Xóa công nợ của "${confirmDelete?.tenKhachHang}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(null)}
        loading={deletingId !== null}
      />

      {/* Modal thêm nhanh khách hàng vào công nợ */}
      {addKhachHangModal && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setAddKhachHangModal(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>Thêm khách hàng vào công nợ</span>
              <button className={styles.modalClose} onClick={() => setAddKhachHangModal(false)}>
                <FiX size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Mã khách hàng</label>
                <input
                  className={styles.formInput}
                  value={addForm.maKhachHang}
                  onChange={(e) => setAddForm({ ...addForm, maKhachHang: e.target.value })}
                  placeholder="Tự sinh nếu để trống"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tên khách hàng *</label>
                <input
                  className={styles.formInput}
                  value={addForm.tenKhachHang}
                  onChange={(e) => setAddForm({ ...addForm, tenKhachHang: e.target.value })}
                  placeholder="VD: Công ty TNHH ABC"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Thuộc nhóm</label>
                <div className={styles.searchDropdownWrap}>
                  <div
                    className={styles.searchDropdownDisplay}
                    onClick={() => {
                      const el = document.getElementById('add-nhom-input');
                      if (el) (el as HTMLInputElement).focus();
                    }}
                  >
                    <span className={addForm.nhom ? '' : styles.searchDropdownPlaceholder}>
                      {addForm.nhom || '— Chọn nhóm —'}
                    </span>
                    <svg className={styles.searchDropdownArrow} width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className={styles.searchDropdownPanel} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'white', border: '1.5px solid var(--color-border)', borderRadius: 10, marginTop: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto' }}>
                    <input
                      id="add-nhom-input"
                      className={styles.searchDropdownInput}
                      placeholder="Tìm hoặc nhập nhóm..."
                      value={nhomSearchQuery}
                      onChange={(e) => { setNhomSearchQuery(e.target.value); setAddForm({ ...addForm, nhom: e.target.value }); }}
                      autoFocus
                    />
                    {NHOM_CONG_NO_OPTIONS.filter(n => n.toLowerCase().includes(nhomSearchQuery.toLowerCase())).map(n => (
                      <div key={n} className={styles.searchDropdownItem}
                        onClick={() => { setAddForm({ ...addForm, nhom: n }); setNhomSearchQuery(n); }}>
                        {n}
                      </div>
                    ))}
                    {nhomList.filter(n => n.nhom.toLowerCase().includes(nhomSearchQuery.toLowerCase()) && !NHOM_CONG_NO_OPTIONS.includes(n.nhom)).map(n => (
                      <div key={n.nhom} className={styles.searchDropdownItem}
                        onClick={() => { setAddForm({ ...addForm, nhom: n.nhom }); setNhomSearchQuery(n.nhom); }}>
                        {n.nhom}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => setAddKhachHangModal(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={handleAddKhachHang} disabled={addLoading}>
                {addLoading ? <><Loading /></> : "Thêm mới"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nút link đến trang khách hàng */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-secondary"
          style={{ fontSize: 13, padding: '8px 16px' }}
          onClick={() => navigate('/quan-ly/khach-hang')}
        >
          <FiExternalLink size={14} style={{ marginRight: 6 }} />
          Quản lý khách hàng
        </button>
      </div>
    </div>
  );
}
