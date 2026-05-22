import { useCallback, useEffect, useState } from "react";
import { FiCheckCircle, FiClock, FiPackage, FiTruck } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Loading } from "../components/Common";
import { useAuth } from "../hooks";
import { layDonHangTheoTrangThai, layThongKeDashboard } from "../services/api";
import { DonHangTheoTrangThai, ThongKeDashboard, TRANG_THAI_DON_COLORS, TRANG_THAI_DON_LABELS } from "../types";
import styles from "./KhoDashboardPage.module.css";

interface KpiItem {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`;
  return value.toLocaleString("vi-VN");
}

export default function KhoDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<ThongKeDashboard | null>(null);
  const [trangThai, setTrangThai] = useState<DonHangTheoTrangThai[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, statusRes] = await Promise.all([
        layThongKeDashboard(),
        layDonHangTheoTrangThai(),
      ]);
      setDashboard(dashRes);
      setTrangThai(statusRes);
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
  const choGiao = trangThai.find(t => t.trangThai === "dang_giao")?.soLuong || 0;
  const daGiaoHomNay = trangThai.find(t => t.trangThai === "da_giao")?.soLuong || 0;
  const tongDonHang = dashboard?.tongDonHang || 0;

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
      value: choGiao,
      icon: <FiTruck size={20} />,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
    },
    {
      label: "Đã giao hôm nay",
      value: daGiaoHomNay,
      icon: <FiCheckCircle size={20} />,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
    {
      label: "Tổng đơn hàng",
      value: tongDonHang,
      icon: <FiPackage size={20} />,
      color: "#073ceb",
      bg: "rgba(7,60,235,0.08)",
    },
  ];

  // Biểu đồ trạng thái
  const pieData = trangThai.map((item) => ({
    name: TRANG_THAI_DON_LABELS[item.trangThai] || item.trangThai,
    value: item.soLuong,
    color: TRANG_THAI_DON_COLORS[item.trangThai] || "#64748b",
  }));

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

      {/* Biểu đồ trạng thái */}
      <div className={styles.chartCard}>
        <div className={styles.chartCardHeader}>
          <div>
            <h3 className={styles.chartCardTitle}>Đơn hàng theo trạng thái</h3>
            <p className={styles.chartCardDesc}>
              Tổng {trangThai.reduce((sum, d) => sum + d.soLuong, 0)} đơn hàng
            </p>
          </div>
        </div>
        <div className={styles.chartArea}>
          {pieData.length > 0 ? (
            <div className={styles.statusList}>
              {pieData.map((item, idx) => (
                <div key={idx} className={styles.statusItem}>
                  <div className={styles.statusDot} style={{ background: item.color }} />
                  <span className={styles.statusName}>{item.name}</span>
                  <span className={styles.statusValue}>{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.chartEmpty}>
              <FiPackage size={40} />
              <p>Không có dữ liệu trạng thái</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
