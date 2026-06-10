import { useCallback, useEffect, useState } from "react";
import {
  FiCheck,
  FiDownload,
  FiEdit2,
  FiEye,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
  ConfirmModal,
  EmptyState,
  Loading,
  Pagination,
} from "../../../shared/components/Common";
import { usePagination, useToast } from "../../../shared/hooks";
import {
  duyetDonHang,
  exportDonHang,
  layDanhSachDonHang,
  layThongKeDonHang,
  tuChoiDonHang,
  xoaDonHang,
  ThongKeDonHang,
} from "../../../shared/services/api";
import {
  ApiResponseWithPagination,
  DonHang,
  TRANG_THAI_DON_LABELS,
  TRANG_THAI_DON_COLORS,
} from "../../../shared/types";
import styles from "./QuanLyDonHangPage.module.css";
import { formatDateVN } from "../../../shared/utils/dateUtils";
import { exportToExcel, formatCurrencyForExport, formatDateForExport } from "../../../shared/utils/exportData";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}
function formatDate(d: string) {
  return d ? formatDateVN(d) : "";
}

function getBadgeStyle(trangThai: string): React.CSSProperties {
  const color = TRANG_THAI_DON_COLORS[trangThai] || "#64748b";
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: `rgba(${r}, ${g}, ${b}, 0.12)`,
    color: color,
  };
}

export default function QuanLyDonHangPage() {
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);
  const [data, setData] = useState<ApiResponseWithPagination<DonHang[]>>({
    success: true,
    message: "",
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
  const [thongKe, setThongKe] = useState<ThongKeDonHang | null>(null);
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState("");
  const [trangThai, setTrangThai] = useState("");

  const [tuChoiModal, setTuChoiModal] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DonHang | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [lyDoTuChoi, setLyDoTuChoi] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const userVaiTro = JSON.parse(
    localStorage.getItem("bttd_user") || "{}",
  )?.vaiTro;
  const userId = JSON.parse(localStorage.getItem("bttd_user") || "{}")?.id;
  const isAdmin = userVaiTro === "admin";
  const isSale = userVaiTro === "sale";
  const isKeToan = userVaiTro === "ke_toan";
  const isGDKD = userVaiTro === "giam_doc_kinh_doanh";
  const isDieuPhoi = userVaiTro === "dieu_phoi";
  const isKeToanOrAdmin = isKeToan || isAdmin;
  const isGDKDOrAdmin = isGDKD || isAdmin;
  const canCreate = ["admin", "dieu_phoi", "sale"].includes(userVaiTro);
  const canCreateOrder = ["admin", "sale", "dieu_phoi"].includes(userVaiTro);
  // Sửa: admin/GDKD/kế toán sửa tất cả đơn đến trước nghiệm thu; sales chỉ sửa đơn của mình
  const canEditAll = ["admin", "giam_doc_kinh_doanh", "ke_toan"].includes(userVaiTro);
  const canEdit = canEditAll || isSale;
  const canDelete = ["admin"].includes(userVaiTro);
  // GDKD duyệt bước 1 (cho_duyet), Kế toán duyệt bước 2 (cho_ke_toan_duyet)
  const canApprove = isGDKDOrAdmin || isKeToan;
  const canApproveStep1 = isGDKDOrAdmin; // GDKD duyệt đơn chờ duyệt
  const canApproveStep2 = isKeToanOrAdmin; // Kế toán duyệt đơn chờ kế toán

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, stats] = await Promise.all([
        layDanhSachDonHang(
          page,
          20,
          trangThai || undefined,
          tuKhoa || undefined,
        ),
        trangThai ? Promise.resolve(null) : layThongKeDonHang(),
      ]);
      setData(res);
      if (stats) setThongKe(stats);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [page, trangThai, tuKhoa, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // KPI: dùng thongKe nếu không filter, ngược lại đếm từ data.data
  const kpiTotal = thongKe && !trangThai && !tuKhoa
    ? thongKe.tongDon
    : (data.data?.length || 0);
  const kpiChoDuyet = thongKe && !trangThai && !tuKhoa
    ? thongKe.choDuyet
    : (data.data?.filter((d) => d.trangThaiDon === "cho_duyet").length || 0);
  const kpiChoKeToanDuyet = thongKe && !trangThai && !tuKhoa
    ? (thongKe as any)?.choKeToanDuyet || 0
    : (data.data?.filter((d) => d.trangThaiDon === "cho_ke_toan_duyet").length || 0);
  const kpiDangXL = thongKe && !trangThai && !tuKhoa
    ? (thongKe.daDuyet + thongKe.dangSanXuat + thongKe.dangGiao + thongKe.daGiao + thongKe.nghiemThu)
    : (data.data?.filter((d) =>
        ["da_duyet", "dang_san_xuat", "dang_giao", "da_giao", "nghiem_thu", "da_nghiem_thu"].includes(d.trangThaiDon),
      ).length || 0);
  const kpiHoanThanh = thongKe && !trangThai && !tuKhoa
    ? (thongKe.hoanThanh + thongKe.daThanhToan)
    : (data.data?.filter((d) =>
        ["hoan_thanh", "da_thanh_toan"].includes(d.trangThaiDon)
      ).length || 0);

  const handleDuyet = async (id: number, trangThaiDon: string) => {
    setApprovingId(id);
    try {
      await duyetDonHang(id);
      if (trangThaiDon === "cho_duyet") {
        showToast("Đã duyệt lần 1. Đơn hàng chuyển sang kế toán duyệt.");
      } else if (trangThaiDon === "cho_ke_toan_duyet") {
        showToast("Đã duyệt lần 2. Đơn hàng chuyển sang điều phối.");
      } else {
        showToast("Duyệt đơn hàng thành công");
      }
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi", "error");
    } finally {
      setApprovingId(null);
    }
  };

  const handleTuChoi = async () => {
    if (!tuChoiModal || !lyDoTuChoi.trim()) return;
    setRejectingId(tuChoiModal);
    try {
      await tuChoiDonHang(tuChoiModal, lyDoTuChoi);
      showToast("Từ chối đơn hàng thành công");
      setTuChoiModal(null);
      setLyDoTuChoi("");
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi", "error");
    } finally {
      setRejectingId(null);
    }
  };

  const handleXoa = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await xoaDonHang(deleteTarget.id);
      showToast("Xóa đơn hàng thành công");
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const clearFilters = () => {
    setTuKhoa("");
    setTrangThai("");
    resetPage();
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const exportData = await exportDonHang(trangThai || undefined, tuKhoa || undefined);

      const isAdminOrKeToan = isAdmin || isKeToan;
      const headers = [
        { key: "maDonHang", label: "Mã đơn", width: 16 },
        { key: "tenKhachHang", label: "Khách hàng", width: 28 },
        { key: "tenMacBeTong", label: "Mác bê tông", width: 18 },
        { key: "tenTramTron", label: "Trạm trộn", width: 20 },
        { key: "khoiLuongDat", label: "Khối lượng đặt", width: 15, alignRight: true },
        { key: "khoiLuongThucTe", label: "Khối lượng thực tế", width: 15, alignRight: true },
        { key: "donGia", label: "Đơn giá", width: 14, alignRight: true },
        { key: "thanhTien", label: "Thành tiền", width: 16, alignRight: true },
        { key: "daThanhToan", label: "Đã thanh toán", width: 16, alignRight: true },
        { key: "conLai", label: "Còn lại", width: 14, alignRight: true },
        { key: "diaChiNhan", label: "Địa chỉ giao", width: 35 },
        { key: "soDienThoai", label: "SĐT", width: 14 },
        { key: "thoiGianGiaoDuKien", label: "Ngày giao dự kiến", width: 18 },
        { key: "ngayTaoDon", label: "Ngày tạo đơn", width: 18 },
        { key: "trangThaiDon", label: "Trạng thái", width: 18 },
      ];

      if (isAdminOrKeToan) {
        headers.push(
          { key: "maNguoiTao", label: "Mã user tạo", width: 16 },
          { key: "tenNguoiTao", label: "Tên user tạo", width: 22 },
          { key: "maNguoiDuyet", label: "Mã user duyệt", width: 16 },
          { key: "tenNguoiDuyet", label: "Tên user duyệt", width: 22 },
        );
      }

      const rows = exportData.map((dh) => {
        const row: Record<string, unknown> = {
          maDonHang: dh.maDonHang,
          tenKhachHang: dh.tenKhachHang,
          tenMacBeTong: dh.tenMacBeTong || "",
          tenTramTron: dh.tenTramTron || "",
          khoiLuongDat: dh.khoiLuongDat,
          khoiLuongThucTe: dh.khoiLuongThucTe ?? "",
          donGia: dh.donGia,
          thanhTien: dh.thanhTien ?? 0,
          daThanhToan: dh.daThanhToan || 0,
          conLai: dh.conLai ?? 0,
          diaChiNhan: dh.diaChiNhan,
          soDienThoai: dh.soDienThoai,
          thoiGianGiaoDuKien: formatDateForExport(dh.thoiGianGiaoDuKien),
          ngayTaoDon: formatDateForExport(dh.ngayTaoDon),
          trangThaiDon: TRANG_THAI_DON_LABELS[dh.trangThaiDon] || dh.trangThaiDon,
        };
        if (isAdminOrKeToan) {
          row.maNguoiTao = dh.maNguoiTao || "";
          row.tenNguoiTao = dh.tenNguoiTao || "";
          row.maNguoiDuyet = dh.maNguoiDuyet || "";
          row.tenNguoiDuyet = dh.tenNguoiDuyet || "";
        }
        return row;
      });

      const title = isAdminOrKeToan ? "BÁO CÁO ĐƠN HÀNG - TOÀN BỘ" : "BÁO CÁO ĐƠN HÀNG CỦA BẠN";
      const filename = `BaoCaoDonHang_${new Date().toISOString().slice(0, 10)}.xlsx`;

      await exportToExcel(title, headers, rows, filename, "Đơn hàng");
      showToast("Xuất báo cáo thành công!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xuất báo cáo", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Quản lý đơn hàng</div>
          <div className={styles.pageHeaderDesc}>
            Toàn quyền quản lý đơn hàng bê tông
          </div>
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
          {canCreateOrder && (
            <button
              className="btn btn-add"
              onClick={() => navigate("/quan-ly/don-hang/tao")}
            >
              <FiPlus /> Tạo đơn hàng
            </button>
          )}
        </div>
      </div>

      {/* KPI Row - Sale/Kế toán/Điều phối/GDKD role uses simplified 2-column grid */}
      <div className={isSale || isKeToan || isDieuPhoi || isGDKD ? styles.kpiRowSale : styles.kpiRow}>
        {isSale || isKeToan || isDieuPhoi || isGDKD ? (
          <>
            <div className={styles.kpiItem}>
              <div className={styles.kpiLabel}>Tổng đơn</div>
              <div className={styles.kpiValue}>{kpiTotal}</div>
            </div>
            {isGDKD ? (
              <>
                <div className={styles.kpiItem}>
                  <div className={styles.kpiLabel}>Chờ GDKD duyệt</div>
                  <div
                    className={styles.kpiValue}
                    style={{ color: "var(--color-warning)" }}
                  >
                    {kpiChoDuyet}
                  </div>
                </div>
              </>
            ) : isKeToan ? (
              <>
                <div className={styles.kpiItem}>
                  <div className={styles.kpiLabel}>Chờ Kế toán duyệt</div>
                  <div
                    className={styles.kpiValue}
                    style={{ color: "var(--color-orange)" }}
                  >
                    {kpiChoKeToanDuyet}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.kpiItem}>
                <div className={styles.kpiLabel}>Chờ duyệt</div>
                <div
                  className={styles.kpiValue}
                  style={{ color: "var(--color-warning)" }}
                >
                  {kpiChoDuyet}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.kpiItem}>
              <div className={styles.kpiLabel}>Tổng đơn</div>
              <div className={styles.kpiValue}>{kpiTotal}</div>
            </div>
            <div className={styles.kpiItem}>
              <div className={styles.kpiLabel}>Chờ duyệt</div>
              <div
                className={styles.kpiValue}
                style={{ color: "var(--color-warning)" }}
              >
                {kpiChoDuyet}
              </div>
            </div>
            <div className={styles.kpiItem}>
              <div className={styles.kpiLabel}>Đang xử lý</div>
              <div
                className={styles.kpiValue}
                style={{ color: "var(--color-purple)" }}
              >
                {kpiDangXL}
              </div>
            </div>
            <div className={styles.kpiItem}>
              <div className={styles.kpiLabel}>Hoàn thành</div>
              <div
                className={styles.kpiValue}
                style={{ color: "var(--color-success)" }}
              >
                {kpiHoanThanh}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterBarLeft}>
          <div className={styles.filterSearch}>
            <FiSearch className={styles.filterSearchIcon} />
            <input
              className={styles.filterSearchInput}
              placeholder="Tìm mã đơn, tên khách..."
              value={tuKhoa}
              onChange={(e) => {
                setTuKhoa(e.target.value);
                resetPage();
              }}
            />
          </div>
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>Trạng thái</span>
            <select
              className={`${styles.filterSelect} ${trangThai ? styles.filterSelectActive : ""}`}
              value={trangThai}
              onChange={(e) => {
                setTrangThai(e.target.value);
                resetPage();
              }}
            >
              <option value="">Tất cả</option>
              {Object.entries(TRANG_THAI_DON_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {(tuKhoa || trangThai) && (
            <button className={styles.filterClearBtn} onClick={clearFilters}>
              <FiX size={13} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Table - Sale/Kế toán/Điều phối/GDKD uses simplified table with actions */}
      {isSale || isKeToan || isDieuPhoi || isGDKD ? (
        <div className={styles.card}>
          <div className={styles.saleCardHeader}>
            <span className={styles.saleCardTitle}>Danh sách đơn hàng</span>
          </div>
          <div className={styles.saleTableWrap}>
            {loading ? (
              <Loading />
            ) : data.data?.length === 0 ? (
              <EmptyState text="Không có đơn hàng nào" />
            ) : (
              <table className={styles.saleTable}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 80 }}>Mã đơn</th>
                    <th style={{ minWidth: 100 }}>Khách hàng</th>
                    <th
                      className={styles.hideOnMobile}
                      style={{ minWidth: 60 }}
                    >
                      Mác
                    </th>
                    <th
                      className={styles.hideOnMobile}
                      style={{ minWidth: 50, textAlign: "right" }}
                    >
                      KL (m3)
                    </th>
                    <th style={{ minWidth: 100 }}>Trạng thái</th>
                    <th style={{ minWidth: (isKeToan || isGDKD) ? 100 : 50 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data?.map((dh) => (
                    <tr key={dh.id}>
                      <td>
                        <span className={styles.tableCodeWrap}>
                          {dh.maDonHang}
                        </span>
                      </td>
                      <td>
                        <div className={styles.tableNameFive}>
                          {dh.tenKhachHang}
                        </div>
                      </td>
                      <td className={styles.hideOnMobile}>
                        <span className={styles.tableMac}>
                          {dh.tenMacBeTong}
                        </span>
                      </td>
                      <td
                        className={`${styles.tableRight} ${styles.hideOnMobile}`}
                      >
                        {dh.khoiLuongDat}
                      </td>
                      <td>
                        <span style={getBadgeStyle(dh.trangThaiDon)}>
                          {dh.trangThaiDon === 'da_thanh_toan'
                            ? 'Hoàn thành'
                            : TRANG_THAI_DON_LABELS[dh.trangThaiDon]}
                        </span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {/* GDKD duyệt bước 1: đơn chờ duyệt */}
                          {dh.trangThaiDon === "cho_duyet" && canApproveStep1 && (
                            <>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnSuccess} ${styles.actionBtnSm}`}
                                onClick={() => handleDuyet(dh.id, dh.trangThaiDon)}
                                disabled={approvingId === dh.id}
                                title={canApproveStep1 ? "Duyệt lần 1 (GDKD)" : "Duyệt lần 1"}
                              >
                                {approvingId === dh.id ? "..." : <FiCheck size={12} />}
                              </button>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnDanger} ${styles.actionBtnSm}`}
                                onClick={() => setTuChoiModal(dh.id)}
                                disabled={rejectingId === dh.id}
                                title="Từ chối"
                              >
                                {rejectingId === dh.id ? "..." : <FiX size={12} />}
                              </button>
                            </>
                          )}
                          {/* Kế toán duyệt bước 2: đơn chờ kế toán duyệt */}
                          {dh.trangThaiDon === "cho_ke_toan_duyet" && canApproveStep2 && (
                            <>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnSuccess} ${styles.actionBtnSm}`}
                                onClick={() => handleDuyet(dh.id, dh.trangThaiDon)}
                                disabled={approvingId === dh.id}
                                title={isAdmin ? "Duyệt lần 2" : "Duyệt (Kế toán)"}
                              >
                                {approvingId === dh.id ? "..." : <FiCheck size={12} />}
                              </button>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnDanger} ${styles.actionBtnSm}`}
                                onClick={() => setTuChoiModal(dh.id)}
                                disabled={rejectingId === dh.id}
                                title="Từ chối"
                              >
                                {rejectingId === dh.id ? "..." : <FiX size={12} />}
                              </button>
                            </>
                          )}
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnView} ${styles.actionBtnSm}`}
                            onClick={() =>
                              navigate(`/quan-ly/don-hang/chi-tiet/${dh.id}`)
                            }
                            title="Xem chi tiết"
                          >
                            <FiEye size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {!loading && (data.data?.length ?? 0) > 0 && (
            <Pagination
              page={page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              limit={10}
              onPageChange={goToPage}
            />
          )}
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.tableWrap}>
            {loading ? (
              <Loading />
            ) : data.data?.length === 0 ? (
              <EmptyState text="Không có đơn hàng nào" />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 130 }}>Mã đơn</th>
                    <th style={{ minWidth: 180 }}>Khách hàng</th>
                    <th
                      className={styles.hideOnMobile}
                      style={{ minWidth: 160 }}
                    >
                      Địa chỉ
                    </th>
                    <th
                      className={styles.hideOnMobile}
                      style={{ minWidth: 80 }}
                    >
                      Mác BT
                    </th>
                    <th
                      className={styles.hideOnMobile}
                      style={{ minWidth: 90, textAlign: "right" }}
                    >
                      Khối lượng
                    </th>
                    <th
                      className={styles.hideOnMobile}
                      style={{ minWidth: 120, textAlign: "right" }}
                    >
                      Thành tiền
                    </th>
                    <th style={{ minWidth: 110 }}>Trạng thái</th>
                    <th
                      className={styles.hideOnMobile}
                      style={{ minWidth: 100 }}
                    >
                      Ngày tạo
                    </th>
                    <th style={{ minWidth: 100 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data?.map((dh) => (
                    <tr key={dh.id}>
                      <td>
                        <strong className={styles.tableCode}>
                          {dh.maDonHang}
                        </strong>
                      </td>
                      <td>
                        <div className={styles.tableName}>
                          {dh.tenKhachHang}
                        </div>
                        <div className={styles.tableSub}>{dh.soDienThoai}</div>
                      </td>
                      <td
                        className={`${styles.tableAddress} ${styles.hideOnMobile}`}
                      >
                        {dh.diaChiNhan}
                      </td>
                      <td className={styles.hideOnMobile}>
                        <span className={styles.tableMac}>
                          {dh.tenMacBeTong}
                        </span>
                      </td>
                      <td
                        className={`${styles.tableRight} ${styles.hideOnMobile}`}
                      >
                        {dh.khoiLuongDat} m³
                      </td>
                      <td
                        className={`${styles.tableRight} ${styles.hideOnMobile}`}
                      >
                        <strong>{formatCurrency(dh.thanhTien || 0)}</strong>
                      </td>
                      <td>
                        <span style={getBadgeStyle(dh.trangThaiDon)}>
                          {dh.trangThaiDon === 'da_thanh_toan'
                            ? 'Hoàn thành'
                            : TRANG_THAI_DON_LABELS[dh.trangThaiDon]}
                        </span>
                      </td>
                      <td
                        className={`${styles.tableDate} ${styles.hideOnMobile}`}
                      >
                        {formatDate(dh.ngayTaoDon)}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnView}`}
                            onClick={() =>
                              navigate(`/quan-ly/don-hang/chi-tiet/${dh.id}`)
                            }
                            title="Xem chi tiết"
                          >
                            <FiEye size={14} />
                          </button>

                          {/* Bước 1: GDKD duyệt đơn chờ duyệt */}
                          {dh.trangThaiDon === "cho_duyet" && (isAdmin || isGDKD) && (
                            <>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                                onClick={() => handleDuyet(dh.id, dh.trangThaiDon)}
                                disabled={approvingId === dh.id}
                                title={isAdmin ? "Duyệt lần 1" : "Duyệt lần 1 (GDKD)"}
                              >
                                {approvingId === dh.id ? "..." : <FiCheck size={14} />}
                              </button>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                onClick={() => setTuChoiModal(dh.id)}
                                disabled={rejectingId === dh.id}
                                title="Từ chối"
                              >
                                {rejectingId === dh.id ? "..." : <FiX size={14} />}
                              </button>
                            </>
                          )}

                          {/* Bước 2: Kế toán duyệt đơn chờ kế toán */}
                          {dh.trangThaiDon === "cho_ke_toan_duyet" && (isAdmin || isKeToan) && (
                            <>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                                onClick={() => handleDuyet(dh.id, dh.trangThaiDon)}
                                disabled={approvingId === dh.id}
                                title={isAdmin ? "Duyệt lần 2" : "Duyệt (Kế toán)"}
                              >
                                {approvingId === dh.id ? "..." : <FiCheck size={14} />}
                              </button>
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                onClick={() => setTuChoiModal(dh.id)}
                                disabled={rejectingId === dh.id}
                                title="Từ chối"
                              >
                                {rejectingId === dh.id ? "..." : <FiX size={14} />}
                              </button>
                            </>
                          )}

                          {canEdit && !["nghiem_thu", "da_nghiem_thu", "da_thanh_toan", "hoan_thanh", "tu_choi"].includes(dh.trangThaiDon) && (canEditAll || dh.nguoiTaoId === userId) && (
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                                onClick={() =>
                                  navigate(`/quan-ly/don-hang/sua/${dh.id}`)
                                }
                                title="Sửa"
                              >
                                <FiEdit2 size={14} />
                              </button>
                            )}

                          {canDelete && (
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                                onClick={() => setDeleteTarget(dh)}
                                title="Xóa"
                              >
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
          {!loading && (data.data?.length ?? 0) > 0 && (
            <Pagination
              page={page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              limit={10}
              onPageChange={goToPage}
            />
          )}
        </div>
      )}

      {/* Modal từ chối */}
      <ConfirmModal
        isOpen={tuChoiModal !== null}
        onClose={() => setTuChoiModal(null)}
        onConfirm={handleTuChoi}
        title="Từ chối đơn hàng"
        message="Vui lòng nhập lý do từ chối đơn hàng này."
        confirmText="Xác nhận từ chối"
        cancelText="Hủy"
        type="warning"
        loading={rejectingId !== null}
        extra={
          <div style={{ marginTop: 16, textAlign: "left" }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                display: "block",
                marginBottom: 6,
              }}
            >
              Lý do từ chối *
            </label>
            <textarea
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: 80,
                boxSizing: "border-box",
              }}
              value={lyDoTuChoi}
              onChange={(e) => setLyDoTuChoi(e.target.value)}
              placeholder="VD: Khách hàng chưa thanh toán đơn cũ..."
              autoFocus
            />
          </div>
        }
      />

      {/* Modal xác nhận xóa */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleXoa}
        title="Xóa đơn hàng"
        message={`Bạn có chắc muốn xóa đơn hàng "${deleteTarget?.maDonHang}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        loading={deleteLoading}
      />

      {/* Toast */}
      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${t.type === "error" ? styles.toastError : styles.toastSuccess}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
