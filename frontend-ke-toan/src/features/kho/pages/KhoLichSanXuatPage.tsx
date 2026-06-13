import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheck, FiClock, FiDownload, FiEye, FiPackage, FiTruck } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import { exportLichSanXuat, layLichSanXuatTramTron } from "../../../shared/services/api";
import { TRANG_THAI_DON_COLORS, TRANG_THAI_DON_LABELS } from "../../../shared/types";
import styles from "./KhoLichSanXuatPage.module.css";
import { formatDateVN } from "../../../shared/utils/dateUtils";
import { exportToExcel, formatDateForExport } from "../../../shared/utils/exportData";

interface LichSanXuatItem {
  id: number;
  idDonHang: number;
  maDonHang?: string;
  tenKhachHang?: string;
  diaChiNhan?: string;
  tenMacBeTong?: string;
  khoiLuongDat?: number;
  trangThaiDon?: string;
  bienSoXe?: string;
  tenTaiXe?: string;
  tenTram?: string;
  idTramTron?: number;
  thoiGianTron?: string;
  thoiGianBatDauDo?: string;
  thoiGianKetThucDo?: string;
  trangThai?: string;
  ngayTao?: string;
  // Số khối đã trộn của dòng này
  khoiLuongDaTron?: number;
  // Tổng số khối đã trộn của TẤT CẢ trạm cho đơn này (từ backend subquery)
  tongKhoiLuongDaTron?: number;
}

// Group nhiều trạm trộn vào 1 dòng theo idDonHang
interface GroupedLichSanXuat {
  idDonHang: number;
  maDonHang?: string;
  tenKhachHang?: string;
  diaChiNhan?: string;
  tenMacBeTong?: string;
  khoiLuongDat?: number;
  trangThaiDon?: string;
  // Lấy thông tin xe từ dòng đầu tiên (hoặc aggregate)
  bienSoXe?: string;
  tenTaiXe?: string;
  ngayTao?: string;
  // Tổng số khối đã trộn (tổng tất cả trạm)
  tongKhoiLuongDaTron: number;
  // Tất cả trạm trộn của đơn này (mỗi dòng LichSanXuat là 1 trạm)
  tramTrons: {
    id: number;
    tenTram: string;
    idLichSanXuat: number;
    thoiGianTron?: string;
    trangThai?: string; // chua_san_xuat | dang_san_xuat | da_xong
    khoiLuongDaTron?: number; // Khối lượng trạm này đã trộn
  }[];
}

type FilterMode = "ngay" | "thang" | "nam";

function formatDate(d: string) {
  return d ? formatDateVN(d) : '';
}

function getFilterSourceDate(item: GroupedLichSanXuat) {
  // Lấy ngày từ trạm trộn đầu tiên hoặc ngayTao
  const firstTram = item.tramTrons[0];
  return firstTram?.thoiGianTron || item.ngayTao || "";
}

// Group dữ liệu theo idDonHang - mỗi đơn hàng 1 dòng
function groupByDonHang(items: LichSanXuatItem[]): GroupedLichSanXuat[] {
  const map = new Map<number, GroupedLichSanXuat>();

  for (const item of items) {
    if (!map.has(item.idDonHang)) {
      map.set(item.idDonHang, {
        idDonHang: item.idDonHang,
        maDonHang: item.maDonHang,
        tenKhachHang: item.tenKhachHang,
        diaChiNhan: item.diaChiNhan,
        tenMacBeTong: item.tenMacBeTong,
        khoiLuongDat: item.khoiLuongDat,
        trangThaiDon: item.trangThaiDon,
        bienSoXe: item.bienSoXe,
        tenTaiXe: item.tenTaiXe,
        ngayTao: item.ngayTao,
        // Sử dụng tongKhoiLuongDaTron từ backend nếu có, không thì cộng dồn
        tongKhoiLuongDaTron: item.tongKhoiLuongDaTron || 0,
        tramTrons: [],
      });
    }

    const group = map.get(item.idDonHang)!;

    // Ưu tiên lấy thông tin tài xế/biển số từ dòng có dữ liệu (không null)
    if (!group.tenTaiXe && item.tenTaiXe) {
      group.tenTaiXe = item.tenTaiXe;
    }
    if (!group.bienSoXe && item.bienSoXe) {
      group.bienSoXe = item.bienSoXe;
    }

    // Nếu backend không trả tongKhoiLuongDaTron thì cộng dồn từ mỗi trạm
    if (!item.tongKhoiLuongDaTron && item.khoiLuongDaTron) {
      group.tongKhoiLuongDaTron += item.khoiLuongDaTron;
    }

    // Thêm trạm trộn vào danh sách - mỗi dòng LichSanXuat là 1 trạm
    if (item.idTramTron && item.tenTram) {
      // Tránh trùng lặp trạm
      if (!group.tramTrons.find(t => t.id === item.idTramTron)) {
        group.tramTrons.push({
          id: item.idTramTron,
          tenTram: item.tenTram,
          idLichSanXuat: item.id,
          thoiGianTron: item.thoiGianTron,
          trangThai: item.trangThai,
          khoiLuongDaTron: item.khoiLuongDaTron,
        });
      }
    }
  }

  return Array.from(map.values());
}

function parseLocalDateParts(d: string) {
  if (!d) return null;
  const cleaned = d.replace("Z", "").replace(/\.\d+$/, "");
  const [datePart] = cleaned.split("T");
  if (!datePart) return null;
  const [y, mo, day] = datePart.split("-").map(Number);
  if (!y || !mo || !day) return null;
  return { y, mo, day };
}

function getDateKey(d: string) {
  const parts = parseLocalDateParts(d);
  if (!parts) return "";
  return `${parts.y}-${String(parts.mo).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getMonthKey(d: string) {
  const parts = parseLocalDateParts(d);
  if (!parts) return "";
  return `${parts.y}-${String(parts.mo).padStart(2, "0")}`;
}

function getYearKey(d: string) {
  const parts = parseLocalDateParts(d);
  if (!parts) return "";
  return String(parts.y);
}

function statusColor(key: string) {
  return TRANG_THAI_DON_COLORS[key] || "#64748b";
}

function statusBg(key: string) {
  const c = statusColor(key);
  const hex = c.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},0.12)`;
}

export default function KhoLichSanXuatPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<LichSanXuatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("ngay");
  const [filterValue, setFilterValue] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [maDonFilter, setMaDonFilter] = useState("");
  const [tenKhachFilter, setTenKhachFilter] = useState("");
  const [maDonDropdownOpen, setMaDonDropdownOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Lấy thông tin user từ localStorage
  const userInfo = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("bttd_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  // Xác định vai trò user
  const isAdmin = userInfo.vaiTro === "admin";
  const isTramTron = userInfo.vaiTro === "tram_tron";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Admin và tram_tron đều dùng API /tram-tron/lich-san-xuat
      // Backend sẽ tự lọc theo trạm cho user tram_tron
      const result = await layLichSanXuatTramTron();
      setData(result || []);
    } catch (err) {
      console.error("Lỗi tải lịch sản xuất:", err);
      showToast("Không tải được dữ liệu lịch sản xuất", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) {
      navigate("/login");
      return;
    }
    loadData();
  }, [navigate, loadData]);

  // Navigate sang trang xác nhận SX xong
  const handleNavigateXacNhanSanXuat = (item: GroupedLichSanXuat) => {
    navigate(`/kho/xac-nhan-san-xuat/${item.idDonHang}`);
  };

  // Navigate sang trang tạo lịch sản xuất ở chế độ "tiếp tục" - thêm trạm trộn mới
  const handleNavigateTiepTuc = (item: GroupedLichSanXuat) => {
    navigate(`/dieu-phoi/lich-san-xuat/${item.idDonHang}`, {
      state: { cheDo: "tiepTuc", idDonHang: item.idDonHang },
    });
  };

  // Group dữ liệu theo đơn hàng - mỗi đơn 1 dòng
  const groupedData = useMemo(() => {
    return groupByDonHang(data);
  }, [data]);

  const filteredData = useMemo(() => {
    // Bắt đầu từ dữ liệu đã group
    let items = [...groupedData];

    // Lọc theo filter
    if (filterMode === "ngay") {
      items = items.filter(
        (item) => getDateKey(getFilterSourceDate(item)) === filterValue,
      );
    } else if (filterMode === "thang") {
      items = items.filter(
        (item) => getMonthKey(getFilterSourceDate(item)) === filterValue,
      );
    } else if (filterMode === "nam") {
      items = items.filter(
        (item) => getYearKey(getFilterSourceDate(item)) === filterValue,
      );
    }

    // Lọc theo mã đơn
    if (maDonFilter) {
      const q = maDonFilter.toLowerCase();
      items = items.filter(
        (item) =>
          (item.maDonHang || "").toLowerCase().includes(q) ||
          String(item.idDonHang).includes(q),
      );
    }

    // Lọc theo tên khách hàng
    if (tenKhachFilter) {
      const q = tenKhachFilter.toLowerCase();
      items = items.filter(
        (item) => (item.tenKhachHang || "").toLowerCase().includes(q),
      );
    }

    // Sắp xếp: chưa xác nhận (dang_san_xuat) lên đầu, sau đó theo ngày mới nhất
    items.sort((a, b) => {
      const isA = a.trangThaiDon === "dang_san_xuat";
      const isB = b.trangThaiDon === "dang_san_xuat";
      if (isA && !isB) return -1;
      if (!isA && isB) return 1;
      return (
        new Date(getFilterSourceDate(b) || 0).getTime() - new Date(getFilterSourceDate(a) || 0).getTime()
      );
    });

    return items;
  }, [groupedData, filterMode, filterValue, maDonFilter, tenKhachFilter]);

  // Stats
  const stats = useMemo(() => {
    const chuaXacNhan = filteredData.filter(
      (i) => i.trangThaiDon === "dang_san_xuat",
    ).length;
    const dangGiao = filteredData.filter(
      (i) => i.trangThaiDon === "dang_giao",
    ).length;
    const daXong = filteredData.filter((i) =>
      ["da_giao", "nghiem_thu", "da_nghiem_thu", "da_thanh_toan", "hoan_thanh"].includes(
        i.trangThaiDon || "",
      ),
    ).length;
    return { chuaXacNhan, dangGiao, daXong, total: filteredData.length };
  }, [filteredData]);


  const clearFilter = () => {
    const now = new Date();
    setFilterMode("ngay");
    setFilterValue(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    );
    setMaDonFilter("");
    setTenKhachFilter("");
    setMaDonDropdownOpen(false);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const allData = await exportLichSanXuat();

      const headers = [
        { key: "maDonHang", label: "Mã đơn", width: 16 },
        { key: "tenKhachHang", label: "Khách hàng", width: 28 },
        { key: "tenMacBeTong", label: "Mác BT", width: 16 },
        { key: "khoiLuongDat", label: "Khối lượng", width: 12, alignRight: true },
        { key: "bienSoXe", label: "Biển số xe", width: 14 },
        { key: "tenTaiXe", label: "Tài xế", width: 20 },
        { key: "trangThai", label: "Trạng thái", width: 16 },
        { key: "thoiGianTron", label: "Giờ trộn", width: 16 },
        { key: "thoiGianXuatBen", label: "Giờ xuất bến", width: 16 },
        { key: "diaChiNhan", label: "Địa chỉ giao", width: 35 },
      ];

      const rows = allData.map((ls: any) => ({
        maDonHang: ls.maDonHang || "",
        tenKhachHang: ls.tenKhachHang || "",
        tenMacBeTong: ls.tenMacBeTong || "",
        khoiLuongDat: ls.khoiLuongDat || 0,
        bienSoXe: ls.bienSoXe || "",
        tenTaiXe: ls.tenTaiXe || "",
        trangThai: ls.trangThai || "",
        thoiGianTron: formatDateForExport(ls.thoiGianTron),
        thoiGianXuatBen: formatDateForExport(ls.thoiGianXuatBen),
        diaChiNhan: ls.diaChiNhan || "",
      }));

      await exportToExcel("BÁO CÁO LỊCH SẢN XUẤT", headers, rows, `BaoCaoLichSanXuat_${new Date().toISOString().slice(0, 10)}.xlsx`, "Lịch sản xuất");
      showToast("Xuất báo cáo thành công!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xuất báo cáo", "error");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Lịch sản xuất</h1>
          <p className={styles.pageDesc}>
            Danh sách đơn hàng đã lên lịch sản xuất
          </p>
        </div>
        <div className={styles.pageHeaderActions}>
          <button
            className={`btn btn-export ${styles.exportBtn}`}
            onClick={handleExportExcel}
            disabled={exporting}
          >
            {exporting ? (
              <FiClock size={15} />
            ) : (
              <FiDownload size={15} />
            )}
            {exporting ? "Đang xuất..." : "Xuất báo cáo"}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterModeGroup}>
          {(["ngay", "thang", "nam"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              className={`${styles.filterModeBtn} ${filterMode === mode ? styles.filterModeBtnActive : ""}`}
              onClick={() => setFilterMode(mode)}
            >
              {mode === "ngay"
                ? "Theo ngày"
                : mode === "thang"
                  ? "Theo tháng"
                  : "Theo năm"}
            </button>
          ))}
        </div>

        <div className={styles.filterValueWrap}>
          {filterMode === "ngay" && (
            <input
              type="date"
              className={styles.filterDateInput}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
          )}
          {filterMode === "thang" && (
            <input
              type="month"
              className={styles.filterDateInput}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
          )}
          {filterMode === "nam" && (
            <div className={styles.yearInputWrap}>
              <button
                className={styles.yearStepBtn}
                onClick={() => {
                  const y = parseInt(filterValue) - 1;
                  if (y >= 2000) setFilterValue(String(y));
                }}
                title="Năm trước"
              >
                ‹
              </button>
              <input
                type="number"
                className={styles.filterYearInput}
                value={filterValue}
                min={2000}
                max={2100}
                step={1}
                onChange={(e) => setFilterValue(e.target.value)}
              />
              <button
                className={styles.yearStepBtn}
                onClick={() => {
                  const y = parseInt(filterValue) + 1;
                  if (y <= 2100) setFilterValue(String(y));
                }}
                title="Năm sau"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter row 2: mã đơn + tên khách hàng */}
      <div className={styles.filterRow2}>
        {/* Dropdown mã đơn */}
        <div className={styles.filterDropdownWrap}>
          <div
            className={`${styles.filterDropdownTrigger} ${maDonFilter ? styles.filterDropdownTriggerActive : ""}`}
            onClick={() => setMaDonDropdownOpen(!maDonDropdownOpen)}
          >
            <span className={styles.filterDropdownLabel}>
              {maDonFilter || "Chọn mã đơn"}
            </span>
            <svg className={`${styles.filterDropdownChevron} ${maDonDropdownOpen ? styles.filterDropdownChevronOpen : ""}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {maDonDropdownOpen && (
            <div className={styles.filterDropdown}>
              <input
                className={styles.filterDropdownSearch}
                placeholder="Tìm mã đơn..."
                value={maDonFilter}
                onChange={(e) => setMaDonFilter(e.target.value)}
                autoFocus
              />
              <div className={styles.filterDropdownList}>
                {data
                  .filter((item) =>
                    (item.maDonHang || "")
                      .toLowerCase()
                      .includes(maDonFilter.toLowerCase())
                  )
                  .slice(0, 20)
                  .map((item) => (
                    <div
                      key={item.id}
                      className={`${styles.filterDropdownItem} ${maDonFilter === item.maDonHang ? styles.filterDropdownItemSelected : ""}`}
                      onClick={() => {
                        setMaDonFilter(item.maDonHang || "");
                        setMaDonDropdownOpen(false);
                      }}
                    >
                      <span className={styles.filterDropdownItemCode}>
                        {item.maDonHang}
                      </span>
                      <span className={styles.filterDropdownItemName}>
                        {item.tenKhachHang || ""}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Input tên khách hàng */}
        <div className={styles.filterSearchWrap}>
          <svg className={styles.filterSearchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            className={`${styles.filterSearchInput} ${tenKhachFilter ? styles.filterSearchInputActive : ""}`}
            type="text"
            placeholder="Tìm tên khách hàng..."
            value={tenKhachFilter}
            onChange={(e) => setTenKhachFilter(e.target.value)}
          />
          {(maDonFilter || tenKhachFilter) && (
            <button
              className={styles.filterClearBtn}
              onClick={() => {
                setMaDonFilter("");
                setTenKhachFilter("");
                setMaDonDropdownOpen(false);
              }}
              title="Xóa filter"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={`${styles.statCard} ${styles.statCardWarning}`}>
          <FiClock size={18} />
          <div className={styles.statContent}>
            <div className={styles.statNum}>{stats.chuaXacNhan}</div>
            <div className={styles.statLabel}>Chưa xác nhận</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardInfo}`}>
          <FiTruck size={18} />
          <div className={styles.statContent}>
            <div className={styles.statNum}>{stats.dangGiao}</div>
            <div className={styles.statLabel}>Đang giao</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardSuccess}`}>
          <FiCheck size={18} />
          <div className={styles.statContent}>
            <div className={styles.statNum}>{stats.daXong}</div>
            <div className={styles.statLabel}>Đã hoàn thành</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardAll}`}>
          <FiPackage size={18} />
          <div className={styles.statContent}>
            <div className={styles.statNum}>{stats.total}</div>
            <div className={styles.statLabel}>Tổng cộng</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableCard}>
        {filteredData.length === 0 ? (
          <div className={styles.empty}>
            <FiPackage size={48} />
            <p>Không có lịch sản xuất nào trong khoảng thời gian này</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th className={styles.hideOnMobile}>Mác bê tông</th>
                  <th>Ban đầu</th>
                  <th>Đã trộn</th>
                  <th>Còn lại</th>
                  <th>Trạng thái</th>
                  <th className={styles.hideOnMobile}>Trạm trộn</th>
                  <th className={styles.hideOnMobile}>Biển số xe</th>
                  <th className={styles.hideOnMobile}>Tài xế</th>
                  <th>Ngày tạo lịch</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => {
                  const trangThai = item.trangThaiDon || "cho_duyet";
                  const khoiLuongBanDau = item.khoiLuongDat || 0;
                  const khoiLuongDaTron = item.tongKhoiLuongDaTron || 0;
                  const khoiLuongConLai = Math.max(0, khoiLuongBanDau - khoiLuongDaTron);
                  const isChuaXacNhan = trangThai === "dang_san_xuat";
                  return (
                    <tr
                      key={item.idDonHang}
                      className={isChuaXacNhan ? styles.rowChuaXacNhan : ""}
                    >
                      <td>
                        <span className={styles.tableCode}>
                          {item.maDonHang || `#${item.idDonHang}`}
                        </span>
                      </td>
                      <td>
                        <div className={styles.tableName}>
                          {item.tenKhachHang || "—"}
                        </div>
                      </td>
                      <td className={styles.hideOnMobile}>
                        <div className={styles.tableMac}>
                          {item.tenMacBeTong || "—"}
                        </div>
                      </td>
                      <td>
                        <span className={styles.tableKhoiLuong}>
                          {khoiLuongBanDau ? `${khoiLuongBanDau.toFixed(1)} m³` : "—"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={styles.tableDaTron}
                          style={{
                            color: khoiLuongDaTron > 0 ? "#10b981" : "#94a3b8",
                          }}
                        >
                          {khoiLuongDaTron > 0 ? `${khoiLuongDaTron.toFixed(1)} m³` : "—"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={styles.tableConLai}
                          style={{
                            color: khoiLuongConLai > 0 ? "#f59e0b" : "#10b981",
                            fontWeight: 700,
                          }}
                        >
                          {khoiLuongConLai > 0 ? `${khoiLuongConLai.toFixed(1)} m³` : "OK"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={styles.statusBadge}
                          style={{
                            background: statusBg(trangThai),
                            color: statusColor(trangThai),
                          }}
                        >
                          {TRANG_THAI_DON_LABELS[trangThai] || trangThai}
                        </span>
                      </td>
                      <td className={styles.hideOnMobile}>
                        <div className={styles.tramTagsWrap}>
                          {item.tramTrons.map((tram) => {
                            const isTramDaGiao = tram.trangThai === "da_xong";
                            const klTram = tram.khoiLuongDaTron || 0;
                            return (
                              <span
                                key={tram.id}
                                className={styles.tramTag}
                                style={
                                  isTramDaGiao
                                    ? {
                                        background: "rgba(245, 158, 11, 0.12)",
                                        color: "#f59e0b",
                                        border: "1px solid rgba(245, 158, 11, 0.3)",
                                      }
                                    : undefined
                                }
                                title={
                                  isTramDaGiao
                                    ? `${tram.tenTram} - đã giao ${klTram.toFixed(1)} m³`
                                    : tram.tenTram
                                }
                              >
                                {tram.tenTram}
                                {klTram > 0
                                  ? ` - ${klTram.toFixed(1)}/${khoiLuongBanDau.toFixed(1)} m³`
                                  : ""}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className={styles.hideOnMobile}>
                        <span className={styles.tableXe}>
                          {item.bienSoXe || "—"}
                        </span>
                      </td>
                      <td className={styles.hideOnMobile}>
                        <span className={styles.tableTaiXe}>
                          {item.tenTaiXe || "—"}
                        </span>
                      </td>
                      <td>
                        <span className={styles.tableDate}>
                          {item.ngayTao ? formatDate(item.ngayTao) : "—"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {(() => {
                            // Xác định số trạm trong đơn
                            const soTram = item.tramTrons.length;
                            const isMotTram = soTram <= 1;

                            // Nếu chưa trộn gì (khoiLuongDaTron = 0): luôn hiển thị nút "SX xong"
                            // (bất kể 1 trạm hay nhiều trạm - đây là lần xác nhận đầu tiên)
                            if (khoiLuongDaTron === 0) {
                              if (isAdmin || isTramTron) {
                                return (
                                  <button
                                    className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                                    onClick={() => handleNavigateXacNhanSanXuat(item)}
                                    title="Xác nhận sản xuất xong"
                                  >
                                    <FiCheck size={14} />
                                    SX xong
                                  </button>
                                );
                              }
                              return null;
                            }

                            // Đã trộn 1 phần (khoiLuongDaTron > 0) và còn dư (khoiLuongConLai > 0):
                            // - Đơn chỉ có 1 trạm: nút "Tiếp tục" → chọn thêm trạm mới
                            // - Đơn có 2+ trạm: nút "Tiếp tục" thay thế nút "SX xong" (xác nhận trộn xong cho trạm chưa hoàn thành)
                            if (isMotTram) {
                              // Đơn 1 trạm: nút "Tiếp tục" cho phép thêm trạm trộn khác
                              return (
                                <button
                                  className={`${styles.actionBtn} ${styles.actionBtnWarning}`}
                                  onClick={() => handleNavigateTiepTuc(item)}
                                  title="Thêm trạm trộn để trộn nốt phần còn lại"
                                >
                                  <FiTruck size={14} />
                                  Tiếp tục
                                </button>
                              );
                            }

                            // Đơn nhiều trạm: ẩn nút "SX xong", chỉ hiển thị nút "Tiếp tục"
                            // với chức năng xác nhận SX xong (giống nút "SX xong")
                            return (
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                                onClick={() => handleNavigateXacNhanSanXuat(item)}
                                title="Xác nhận sản xuất xong"
                              >
                                <FiCheck size={14} />
                                Tiếp tục
                              </button>
                            );
                          })()}
                          {/* Đang giao */}
                          {trangThai === "dang_giao" && (
                            <span
                              className={styles.rowStatusBadge}
                              style={{
                                color: "#ea580c",
                                background: "rgba(234,88,12,0.1)",
                              }}
                            >
                              <FiTruck size={12} />
                              Đang giao
                            </span>
                          )}
                          {/* Đã giao */}
                          {trangThai === "da_giao" && (
                            <span
                              className={styles.rowStatusBadge}
                              style={{
                                color: "#06b6d4",
                                background: "rgba(6,182,212,0.1)",
                              }}
                            >
                              <FiCheck size={12} /> Đã giao
                            </span>
                          )}
                          {/* Xem chi tiết */}
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnView}`}
                            onClick={() =>
                              navigate(`/tram-tron/don-hang/${item.idDonHang}`)
                            }
                            title="Xem chi tiết"
                          >
                            <FiEye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
