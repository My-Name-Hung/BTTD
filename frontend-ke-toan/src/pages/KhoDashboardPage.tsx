import { useCallback, useEffect, useState } from "react";
import { FiCheckCircle, FiClock, FiPackage, FiTruck, FiEye } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Loading } from "../components/Common";
import { useAuth } from "../hooks";
import { layLichSanXuatKho } from "../services/api";
import { TRANG_THAI_DON_COLORS, TRANG_THAI_DON_LABELS } from "../types";
import styles from "./KhoDashboardPage.module.css";
import { formatDateVN } from "../utils/dateUtils";

interface KpiItem {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

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
  ngayTao?: string;
}

function formatDate(d: string) {
  return d ? formatDateVN(d) : '';
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

export default function KhoDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<LichSanXuatItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layLichSanXuatKho();
      const sorted = (res || []).sort(
        (a, b) => new Date(b.ngayTao || 0).getTime() - new Date(a.ngayTao || 0).getTime()
      );
      setData(sorted);
    } catch (err) {
      console.error("Lỗi tải dashboard kho:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) { navigate("/login"); return; }
    loadData();
  }, [navigate, loadData]);

  // Tính toán KPI cho kho
  const choGiao = data.filter(d => d.trangThaiDon === "dang_san_xuat").length;
  const dangGiao = data.filter(d => d.trangThaiDon === "dang_giao").length;
  const daGiao = data.filter(d => d.trangThaiDon === "da_giao").length;
  const tongDonHang = choGiao + dangGiao + daGiao;

  const kpiCards: KpiItem[] = [
    {
      label: "Chờ giao",
      value: choGiao,
      icon: <FiClock size={20} />,
      color: "#f97316",
      bg: "rgba(249,115,22,0.1)",
    },
    {
      label: "Đang giao",
      value: dangGiao,
      icon: <FiTruck size={20} />,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
    },
    {
      label: "Đã giao thành công",
      value: daGiao,
      icon: <FiCheckCircle size={20} />,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
    {
      label: "Tổng đơn hàng kho",
      value: tongDonHang,
      icon: <FiPackage size={20} />,
      color: "#073ceb",
      bg: "rgba(7,60,235,0.08)",
    },
  ];

  // Recent orders (top 10)
  const recentOrders = data.slice(0, 10);

  if (loading) return <Loading />;

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.dashHeader}>
        <div className={styles.dashHeaderLeft}>
          <h2 className={styles.dashTitle}>
            Xin chào, <span className={styles.dashUserName}>{user?.hoTen}</span>
          </h2>
          <p className={styles.dashSubtitle}>
            Vai trò: Kho — Tổng quan kho hàng
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {kpiCards.map((kpi, idx) => (
          <div key={idx} className={styles.kpiCard}>
            <div className={styles.kpiCardLeft}>
              <div className={styles.kpiLabel}>{kpi.label}</div>
              <div className={styles.kpiValue}>{kpi.value}</div>
            </div>
            <div className={styles.kpiIconWrap} style={{ background: kpi.bg, color: kpi.color }}>
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Status Bar Chart */}
      <div className={styles.chartCard}>
        <div className={styles.chartCardHeader}>
          <div>
            <h3 className={styles.chartCardTitle}>Đơn hàng theo trạng thái</h3>
            <p className={styles.chartCardDesc}>
              Tổng {tongDonHang} đơn hàng trong kho
            </p>
          </div>
        </div>
        <div className={styles.chartArea}>
          {tongDonHang > 0 ? (
            <div className={styles.barChart}>
              {choGiao > 0 && (
                <div className={styles.barItem}>
                  <div className={styles.barLabel}>
                    <span className={styles.barDot} style={{ background: "#f97316" }} />
                    <span>Chờ giao</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(choGiao / tongDonHang) * 100}%`,
                        background: "#f97316"
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{choGiao}</span>
                </div>
              )}
              {dangGiao > 0 && (
                <div className={styles.barItem}>
                  <div className={styles.barLabel}>
                    <span className={styles.barDot} style={{ background: "#8b5cf6" }} />
                    <span>Đang giao</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(dangGiao / tongDonHang) * 100}%`,
                        background: "#8b5cf6"
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{dangGiao}</span>
                </div>
              )}
              {daGiao > 0 && (
                <div className={styles.barItem}>
                  <div className={styles.barLabel}>
                    <span className={styles.barDot} style={{ background: "#10b981" }} />
                    <span>Đã giao</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(daGiao / tongDonHang) * 100}%`,
                        background: "#10b981"
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>{daGiao}</span>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.chartEmpty}>
              <FiPackage size={40} />
              <p>Không có dữ liệu đơn hàng</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className={styles.chartCard}>
        <div className={styles.chartCardHeader}>
          <div>
            <h3 className={styles.chartCardTitle}>Đơn hàng gần nhất</h3>
            <p className={styles.chartCardDesc}>
              10 đơn hàng mới nhất trong kho
            </p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          {recentOrders.length === 0 ? (
            <div className={styles.chartEmpty}>
              <FiPackage size={40} />
              <p>Chưa có đơn hàng nào</p>
            </div>
          ) : (
            <table className={styles.recentTable}>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Địa chỉ</th>
                  <th>Trạng thái</th>
                  <th>Khối lượng</th>
                  <th>Ngày tạo lịch</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((item) => {
                  const trangThai = item.trangThaiDon || "cho_duyet";
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className={styles.tableCode}>
                          {item.maDonHang || `#${item.idDonHang}`}
                        </span>
                      </td>
                      <td>
                        <div className={styles.tableName}>{item.tenKhachHang || "—"}</div>
                      </td>
                      <td>
                        <div className={styles.tableAddress}>{item.diaChiNhan || "—"}</div>
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
                        <span>{item.khoiLuongDat ? `${item.khoiLuongDat} m³` : "—"}</span>
                      </td>
                      <td>
                        <span className={styles.tableDate}>
                          {item.ngayTao ? formatDate(item.ngayTao) : "—"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={styles.viewBtn}
                          onClick={() => navigate(`/kho/don-hang/${item.idDonHang}`)}
                          title="Xem chi tiết"
                        >
                          <FiEye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
