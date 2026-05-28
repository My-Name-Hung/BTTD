import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiPackage, FiTruck, FiCheck, FiClock } from "react-icons/fi";
import { Loading } from "../components/Common";
import { layLichSanXuatKho, xacNhanBatDauGiao } from "../services/api";
import { TRANG_THAI_DON_LABELS, TRANG_THAI_DON_COLORS } from "../types";
import { useToast } from "../hooks";
import styles from "./KhoLichSanXuatPage.module.css";

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
  thoiGianTron?: string;
  thoiGianBatDauDo?: string;
  thoiGianKetThucDo?: string;
  trangThai?: string;
  ngayTao?: string;
}

type FilterMode = "ngay" | "thang" | "nam";

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDateKey(d: string) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function getMonthKey(d: string) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function getYearKey(d: string) {
  if (!d) return "";
  return String(new Date(d).getFullYear());
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
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("ngay");
  const [filterValue, setFilterValue] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layLichSanXuatKho();
      setData(res || []);
    } catch (err) {
      console.error("Lỗi tải lịch sản xuất:", err);
      showToast("Không tải được dữ liệu lịch sản xuất", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) { navigate("/login"); return; }
    loadData();
  }, [navigate, loadData]);

  const handleXacNhanSanXuatXong = async (item: LichSanXuatItem) => {
    if (!item.idDonHang) return;
    setActionLoading(item.idDonHang);
    try {
      await xacNhanBatDauGiao(item.idDonHang);
      showToast("Đã xác nhận sản xuất xong");
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xác nhận", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredData = useMemo(() => {
    let items = [...data];

    // Lọc theo filter
    if (filterMode === "ngay") {
      items = items.filter((item) => getDateKey(item.ngayTao || "") === filterValue);
    } else if (filterMode === "thang") {
      items = items.filter((item) => getMonthKey(item.ngayTao || "") === filterValue);
    } else if (filterMode === "nam") {
      items = items.filter((item) => getYearKey(item.ngayTao || "") === filterValue);
    }

    // Sắp xếp: chưa xác nhận (dang_san_xuat) lên đầu, sau đó theo ngày mới nhất
    items.sort((a, b) => {
      const isA = a.trangThaiDon === "dang_san_xuat";
      const isB = b.trangThaiDon === "dang_san_xuat";
      if (isA && !isB) return -1;
      if (!isA && isB) return 1;
      return new Date(b.ngayTao || 0).getTime() - new Date(a.ngayTao || 0).getTime();
    });

    return items;
  }, [data, filterMode, filterValue]);

  // Stats
  const stats = useMemo(() => {
    const chuaXacNhan = filteredData.filter((i) => i.trangThaiDon === "dang_san_xuat").length;
    const dangGiao = filteredData.filter((i) => i.trangThaiDon === "dang_giao" || i.trangThaiDon === "dang_cho_giao").length;
    const daXong = filteredData.filter((i) => ["da_giao", "nghiem_thu", "da_thanh_toan", "hoan_thanh"].includes(i.trangThaiDon || "")).length;
    return { chuaXacNhan, dangGiao, daXong, total: filteredData.length };
  }, [filteredData]);

  // Month options cho filter
  const monthOptions = useMemo(() => {
    const months: string[] = [];
    const seen = new Set<string>();
    data.forEach((item) => {
      const key = getMonthKey(item.ngayTao || "");
      if (key && !seen.has(key)) {
        seen.add(key);
        months.push(key);
      }
    });
    months.sort((a, b) => b.localeCompare(a));
    return months;
  }, [data]);

  // Year options
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    const seen = new Set<number>();
    data.forEach((item) => {
      const y = new Date(item.ngayTao || 0).getFullYear();
      if (y && !seen.has(y)) {
        seen.add(y);
        years.push(y);
      }
    });
    years.sort((a, b) => b - a);
    return years;
  }, [data]);

  const clearFilter = () => {
    const now = new Date();
    setFilterMode("ngay");
    setFilterValue(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
  };


  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Lịch sản xuất</h1>
          <p className={styles.pageDesc}>Danh sách đơn hàng đã lên lịch sản xuất</p>
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
              {mode === "ngay" ? "Theo ngày" : mode === "thang" ? "Theo tháng" : "Theo năm"}
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
            <select
              className={styles.filterSelect}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              {monthOptions.map((m) => {
                const [y, mo] = m.split("-");
                return (
                  <option key={m} value={m}>
                    Tháng {mo}/{y}
                  </option>
                );
              })}
              {monthOptions.length === 0 && <option value="">-- Chọn tháng --</option>}
            </select>
          )}
          {filterMode === "nam" && (
            <select
              className={styles.filterSelect}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  Năm {y}
                </option>
              ))}
              {yearOptions.length === 0 && <option value="">-- Chọn năm --</option>}
            </select>
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
                  <th>Địa chỉ</th>
                  <th>Mác bê tông</th>
                  <th>Khối lượng</th>
                  <th>Trạng thái</th>
                  <th>Biển số xe</th>
                  <th>Ngày tạo lịch</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item) => {
                  const trangThai = item.trangThaiDon || "cho_duyet";
                  const isLoading = actionLoading === item.idDonHang;
                  const isChuaXacNhan = trangThai === "dang_san_xuat";
                  return (
                    <tr key={item.id} className={isChuaXacNhan ? styles.rowChuaXacNhan : ""}>
                      <td>
                        <span className={styles.tableCode}>{item.maDonHang || `#${item.idDonHang}`}</span>
                      </td>
                      <td>
                        <div className={styles.tableName}>{item.tenKhachHang || "—"}</div>
                      </td>
                      <td>
                        <div className={styles.tableAddress}>{item.diaChiNhan || "—"}</div>
                      </td>
                      <td>
                        <div className={styles.tableMac}>{item.tenMacBeTong || "—"}</div>
                      </td>
                      <td>
                        <span>{item.khoiLuongDat ? `${item.khoiLuongDat} m³` : "—"}</span>
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
                      <td>
                        <span className={styles.tableXe}>{item.bienSoXe || "—"}</span>
                      </td>
                      <td>
                        <span className={styles.tableDate}>
                          {item.ngayTao ? formatDate(item.ngayTao) : "—"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {/* Xác nhận sản xuất xong */}
                          {trangThai === "dang_san_xuat" && (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                              onClick={() => handleXacNhanSanXuatXong(item)}
                              disabled={isLoading}
                              title="Xác nhận sản xuất xong"
                            >
                              {isLoading ? <FiClock size={14} /> : <FiCheck size={14} />}
                              {isLoading ? "Đang xử lý..." : "SX xong"}
                            </button>
                          )}
                          {/* Đang chờ giao / đang giao — chỉ hiển thị trạng thái */}
                          {(trangThai === "dang_cho_giao" || trangThai === "dang_giao") && (
                            <span className={styles.rowStatusBadge} style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)' }}>
                              <FiTruck size={12} />
                              {trangThai === "dang_cho_giao" ? "Chờ giao" : "Đang giao"}
                            </span>
                          )}
                          {/* Đã giao */}
                          {trangThai === "da_giao" && (
                            <span className={styles.rowStatusBadge} style={{ color: '#06b6d4', background: 'rgba(6,182,212,0.1)' }}>
                              <FiCheck size={12} /> Đã giao
                            </span>
                          )}
                          {/* Xem chi tiết */}
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnView}`}
                            onClick={() => navigate(`/kho/don-hang/${item.idDonHang}`)}
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
