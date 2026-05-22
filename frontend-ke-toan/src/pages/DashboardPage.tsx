import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { useCallback, useEffect, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiPackage,
  FiShoppingCart,
  FiTrendingUp,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Loading } from "../components/Common";
import { ROLE_LABELS, useAuth, usePageRole } from "../hooks";
import {
  layDoanhThuTheoThang,
  layDonHangTheoTrangThai,
  layThongKeDashboard,
} from "../services/api";
import {
  DoanhThuTheoThang,
  DonHangTheoTrangThai,
  ThongKeDashboard,
  TRANG_THAI_DON_COLORS,
  TRANG_THAI_DON_LABELS,
} from "../types";
import styles from "./DashboardPage.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  ChartDataLabels,
);

type FilterPeriod = "ngay" | "tuan" | "thang";

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`;
  return value.toLocaleString("vi-VN");
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

function getDateRange(period: FilterPeriod): {
  tuNgay: string;
  denNgay: string;
} {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  switch (period) {
    case "ngay": {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      const sd = String(start.getDate()).padStart(2, "0");
      const sm = String(start.getMonth() + 1).padStart(2, "0");
      return { tuNgay: `${start.getFullYear()}-${sm}-${sd}`, denNgay: `${year}-${month}-${day}` };
    }
    case "tuan": {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      const sd = String(start.getDate()).padStart(2, "0");
      const sm = String(start.getMonth() + 1).padStart(2, "0");
      return { tuNgay: `${start.getFullYear()}-${sm}-${sd}`, denNgay: `${year}-${month}-${day}` };
    }
    case "thang":
    default: {
      return { tuNgay: `${year}-01`, denNgay: `${year}-${month}` };
    }
  }
}

const FILTER_LABELS: Record<FilterPeriod, string> = {
  ngay: "7 ngày qua",
  tuan: "30 ngày qua",
  thang: "Năm nay",
};

interface KpiItem {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  isCurrency?: boolean;
  roles?: string[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const vaiTro = usePageRole().vaiTro;
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<ThongKeDashboard | null>(null);
  const [doanhThu, setDoanhThu] = useState<DoanhThuTheoThang[]>([]);
  const [trangThai, setTrangThai] = useState<DonHangTheoTrangThai[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("thang");

  const loadData = useCallback(async (period: FilterPeriod) => {
    setLoading(true);
    try {
      const { tuNgay, denNgay } = getDateRange(period);
      const [dashRes, revenueRes, statusRes] = await Promise.all([
        layThongKeDashboard(),
        layDoanhThuTheoThang(tuNgay, denNgay),
        layDonHangTheoTrangThai(),
      ]);
      setDashboard(dashRes);
      setDoanhThu(revenueRes);
      setTrangThai(statusRes);
    } catch (err) {
      console.error("Lỗi tải dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) { navigate("/login"); return; }
    loadData(filterPeriod);
  }, [navigate, filterPeriod, loadData]);

  const roleLabel = vaiTro ? ROLE_LABELS[vaiTro] : "";

  const showRevenueChart = vaiTro === "admin" || vaiTro === "ke_toan";
  const showStatusChart = trangThai.length > 0;

  // ── KPI Cards theo vai trò ──────────────────────────────────────────────
  const kpiCards: KpiItem[] = [
    {
      label: "Tổng đơn hàng",
      value: dashboard?.tongDonHang || 0,
      icon: <FiShoppingCart size={20} />,
      color: "#073ceb",
      bg: "rgba(7,60,235,0.08)",
    },
    {
      label: "Chờ duyệt",
      value: dashboard?.donChoDuyet || 0,
      icon: <FiClock size={20} />,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
    },
    {
      label: "Đang xử lý",
      value: dashboard?.donDangXuLy || 0,
      icon: <FiTrendingUp size={20} />,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
    },
    {
      label: "Hoàn thành",
      value: dashboard?.donDaHoanThanh || 0,
      icon: <FiCheckCircle size={20} />,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
    {
      label: "Doanh thu",
      value: formatCurrency(dashboard?.tongDoanhThu || 0),
      icon: <FiDollarSign size={20} />,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
      isCurrency: true,
      roles: ["admin", "ke_toan"],
    },
    {
      label: "Công nợ",
      value: formatCurrency(dashboard?.tongCongNo || 0),
      icon: <FiAlertTriangle size={20} />,
      color: "#ef4444",
      bg: "rgba(239,68,68,0.08)",
      isCurrency: true,
      roles: ["admin", "ke_toan"],
    },
    {
      label: "Qúa hạn",
      value: dashboard?.donQuaHan || 0,
      icon: <FiPackage size={20} />,
      color: "#ef4444",
      bg: "rgba(239,68,68,0.08)",
      roles: ["admin", "ke_toan"],
    },
  ].filter(k => !k.roles || k.roles.includes(vaiTro!));

  // ── Chart data ─────────────────────────────────────────────────────────
  const pieData = trangThai.map((item) => ({
    name: TRANG_THAI_DON_LABELS[item.trangThai] || item.trangThai,
    value: item.soLuong,
    color: TRANG_THAI_DON_COLORS[item.trangThai] || "#64748b",
  }));

  const barChartData = {
    labels: doanhThu.map((d) => d.thang),
    datasets: [
      {
        label: "Doanh thu (triệu)",
        data: doanhThu.map((d) => d.doanhThu / 1_000_000),
        backgroundColor: "rgba(7, 60, 235, 0.85)",
        borderColor: "#073ceb",
        borderWidth: 1,
        borderRadius: 6,
        barThickness: 32,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { raw: unknown }) =>
            `${formatCurrencyFull((ctx.raw as number) * 1_000_000)}`,
        },
      },
      datalabels: {
        anchor: "end" as const,
        align: "top" as const,
        font: { size: 11, weight: "bold" as const },
        color: "#073ceb",
        formatter: (v: unknown) => {
          const n = v as number;
          if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
          if (n >= 1) return n.toFixed(1);
          return "";
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        grid: { color: "rgba(226,232,240,0.6)" },
        ticks: { font: { size: 11 }, callback: (v: unknown) => `${v}M` },
      },
    },
  };

  const donutChartData = {
    labels: pieData.map((d) => d.name),
    datasets: [
      {
        data: pieData.map((d) => d.value),
        backgroundColor: pieData.map((d) => d.color),
        borderWidth: 2,
        borderColor: "#ffffff",
        hoverOffset: 6,
      },
    ],
  };

  const donutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { padding: 16, usePointStyle: true, pointStyle: "circle", font: { size: 12 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; raw: unknown }) =>
            ` ${ctx.label}: ${ctx.raw} đơn`,
        },
      },
      datalabels: {
        color: "#ffffff",
        font: { size: 11, weight: "bold" as const },
        formatter: (v: unknown) => {
          const total = pieData.reduce((s, d) => s + d.value, 0);
          const n = v as number;
          if (n === 0 || total === 0) return "";
          return `${((n / total) * 100).toFixed(0)}%`;
        },
      },
    },
  };

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
            {roleLabel ? `Vai trò: ${roleLabel}` : ""} — Tổng quan hoạt động kinh doanh
          </p>
        </div>
        <div className={styles.dashHeaderRight}>
          <div className={styles.filterTabs}>
            {(Object.keys(FILTER_LABELS) as FilterPeriod[]).map((p) => (
              <button
                key={p}
                className={`${styles.filterTab} ${filterPeriod === p ? styles.filterTabActive : ""}`}
                onClick={() => setFilterPeriod(p)}
              >
                {FILTER_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {kpiCards.map((kpi, idx) => (
          <div key={idx} className={styles.kpiCard}>
            <div className={styles.kpiCardLeft}>
              <div className={styles.kpiLabel}>{kpi.label}</div>
              <div className={styles.kpiValue} style={kpi.isCurrency ? { fontSize: 18 } : {}}>
                {kpi.value}
              </div>
            </div>
            <div className={styles.kpiIconWrap} style={{ background: kpi.bg, color: kpi.color }}>
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className={styles.chartGrid}>
        {/* Biểu đồ doanh thu — chỉ admin & kế toán */}
        {showRevenueChart && (
          <div className={styles.chartCard}>
            <div className={styles.chartCardHeader}>
              <div>
                <h3 className={styles.chartCardTitle}>Doanh thu theo tháng</h3>
                <p className={styles.chartCardDesc}>
                  {FILTER_LABELS[filterPeriod]} · Đơn vị: triệu đồng
                </p>
              </div>
            </div>
            <div className={styles.chartArea}>
              {doanhThu.length > 0 ? (
                <Bar data={barChartData} options={barChartOptions} />
              ) : (
                <div className={styles.chartEmpty}>
                  <FiTrendingUp size={40} />
                  <p>Không có dữ liệu doanh thu</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Biểu đồ trạng thái đơn hàng */}
        {showStatusChart && (
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
                <Pie data={donutChartData} options={donutChartOptions} />
              ) : (
                <div className={styles.chartEmpty}>
                  <FiShoppingCart size={40} />
                  <p>Không có dữ liệu trạng thái</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
