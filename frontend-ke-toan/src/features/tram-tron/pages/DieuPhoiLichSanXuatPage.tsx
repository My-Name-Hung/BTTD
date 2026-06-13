import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiEye, FiPackage, FiTruck } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import { layTatCaLichSanXuat } from "../../../shared/services/api";
import { TRANG_THAI_DON_COLORS, TRANG_THAI_DON_LABELS } from "../../../shared/types";
import styles from "./DieuPhoiLichSanXuatPage.module.css";
import { formatDateVN } from "../../../shared/utils/dateUtils";

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
  kyThuatCongTrinh?: string;
  nguoiOmOng?: string;
  nguoiBatOng?: string;
  ghiChu?: string;
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
  bienSoXe?: string;
  tenTaiXe?: string;
  ngayTao?: string;
  tramTrons: {
    id: number;
    tenTram: string;
    idLichSanXuat: number;
    thoiGianTron?: string;
    trangThai?: string;
  }[];
}

type FilterMode = "ngay" | "thang" | "nam";

function formatDate(d: string) {
  return d ? formatDateVN(d) : "";
}

function getFilterSourceDate(item: GroupedLichSanXuat) {
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

    if (item.idTramTron && item.tenTram) {
      if (!group.tramTrons.find(t => t.id === item.idTramTron)) {
        group.tramTrons.push({
          id: item.idTramTron,
          tenTram: item.tenTram,
          idLichSanXuat: item.id,
          thoiGianTron: item.thoiGianTron,
          trangThai: item.trangThai,
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

// Các trạng thái đơn hàng đã hoàn thành nghiệm thu - không cho chỉnh sửa
const COMPLETED_STATUSES = ["nghiem_thu", "da_nghiem_thu", "da_thanh_toan", "hoan_thanh", "da_giao"];

export default function DieuPhoiLichSanXuatPage() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await layTatCaLichSanXuat();
      setData((res || []) as unknown as LichSanXuatItem[]);
    } catch (err) {
      console.error("Lỗi tải lịch sản xuất:", err);
      if (!silent) {
        showToast("Không tải được dữ liệu lịch sản xuất", "error");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) {
      navigate("/login");
      return;
    }
    loadData();
    // Auto reload mỗi 30s để cập nhật dữ liệu mới (silent - không block UI)
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [navigate, loadData, location.key]);

  // Group dữ liệu theo đơn hàng - mỗi đơn 1 dòng
  const groupedData = useMemo(() => {
    return groupByDonHang(data);
  }, [data]);

  const filteredData = useMemo(() => {
    let items = [...groupedData];

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

    if (maDonFilter) {
      const q = maDonFilter.toLowerCase();
      items = items.filter(
        (item) =>
          (item.maDonHang || "").toLowerCase().includes(q) ||
          String(item.idDonHang).includes(q),
      );
    }

    if (tenKhachFilter) {
      const q = tenKhachFilter.toLowerCase();
      items = items.filter(
        (item) => (item.tenKhachHang || "").toLowerCase().includes(q),
      );
    }

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

  const stats = useMemo(() => {
    const choSanXuat = filteredData.filter(
      (i) => i.trangThaiDon === "chua_san_xuat",
    ).length;
    const dangSanXuat = filteredData.filter(
      (i) => i.trangThaiDon === "dang_san_xuat",
    ).length;
    const daXong = filteredData.filter(
      (i) => i.trangThaiDon === "da_xong",
    ).length;
    return { choSanXuat, dangSanXuat, daXong, total: filteredData.length };
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

  const isEditable = (item: { trangThaiDon?: string }) => {
    const trangThai = item.trangThaiDon || "";
    return !COMPLETED_STATUSES.includes(trangThai);
  };

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Lịch sản xuất</h1>
          <p className={styles.pageDesc}>
            Theo dõi và chỉnh sửa lịch sản xuất
          </p>
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
        <div className={`${styles.statCard} ${styles.statCardInfo}`}>
          <FiTruck size={18} />
          <div className={styles.statContent}>
            <div className={styles.statNum}>{stats.choSanXuat}</div>
            <div className={styles.statLabel}>Chờ sản xuất</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardWarning}`}>
          <FiPackage size={18} />
          <div className={styles.statContent}>
            <div className={styles.statNum}>{stats.dangSanXuat}</div>
            <div className={styles.statLabel}>Đang sản xuất</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardSuccess}`}>
          <FiTruck size={18} />
          <div className={styles.statContent}>
            <div className={styles.statNum}>{stats.daXong}</div>
            <div className={styles.statLabel}>Đã xong</div>
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
                  <th>Địa chỉ</th>
                  <th>Mác bê tông</th>
                  <th>Khối lượng</th>
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
                  const canEdit = isEditable(item);
                  return (
                    <tr key={item.idDonHang}>
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
                      <td>
                        <div className={styles.tableAddress}>
                          {item.diaChiNhan || "—"}
                        </div>
                      </td>
                      <td>
                        <div className={styles.tableMac}>
                          {item.tenMacBeTong || "—"}
                        </div>
                      </td>
                      <td>
                        <span>
                          {item.khoiLuongDat ? `${item.khoiLuongDat} m³` : "—"}
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
                          {item.tramTrons.map((tram) => (
                            <span key={tram.id} className={styles.tramTag}>
                              {tram.tenTram}
                            </span>
                          ))}
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
                          {canEdit ? (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                              onClick={() => navigate(`/dieu-phoi/lich-san-xuat/${item.idDonHang}`)}
                              title="Chỉnh sửa lịch sản xuất"
                            >
                              <FiEdit2 size={14} />
                              Sửa
                            </button>
                          ) : (
                            <span
                              className={styles.completedBadge}
                              title="Đơn đã hoàn thành, không thể chỉnh sửa"
                            >
                              Đã hoàn thành
                            </span>
                          )}
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnView}`}
                            onClick={() => navigate(`/tram-tron/don-hang/${item.idDonHang}`)}
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
