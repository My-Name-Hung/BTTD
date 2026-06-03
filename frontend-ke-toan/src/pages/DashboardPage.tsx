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
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, Doughnut, Line, Pie } from "react-chartjs-2";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiPackage,
  FiShoppingCart,
  FiTrendingUp,
  FiUsers,
  FiTruck,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Loading } from "../components/Common";
import { ROLE_LABELS, useAuth, usePageRole } from "../hooks";
import {
  layDoanhThuTheoThang,
  layDonHangTheoTrangThai,
  layThongKeDashboard,
  layThongKeTaiXe,
  layDanhSachXe,
  layDanhSachKhachHang,
  layDanhSachTramTron,
  layDanhSachTaiXe,
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
  const [tongXe, setTongXe] = useState(0);
  const [tongKhach, setTongKhach] = useState(0);
  const [tongTram, setTongTram] = useState(0);
  const [tongTaiXe, setTongTaiXe] = useState(0);
  const [activeTab, setActiveTab] = useState<"kpi" | "doanh-thu" | "trang-thai" | "san-luong">("kpi");

  const loadData = useCallback(async (period: FilterPeriod) => {
    setLoading(true);
    try {
      if (vaiTro === "tai_xe") {
        const taiXeStats = await layThongKeTaiXe();
        setDashboard({
          tongDonTaiXe: taiXeStats.tongDon,
          chuaGiaoTaiXe: taiXeStats.chuaGiao,
          daGiaoTaiXe: taiXeStats.daGiao,
        } as ThongKeDashboard);
        setDoanhThu([]);
        setTrangThai([]);
      } else {
        const { tuNgay, denNgay } = getDateRange(period);
        const [dashRes, revenueRes, statusRes, xeRes, khachRes, tramRes, txRes] = await Promise.all([
          layThongKeDashboard(),
          layDoanhThuTheoThang(tuNgay, denNgay),
          layDonHangTheoTrangThai(),
          layDanhSachXe(),
          layDanhSachKhachHang(),
          layDanhSachTramTron(),
          layDanhSachTaiXe(),
        ]);
        setDashboard(dashRes);
        setDoanhThu(revenueRes);
        setTrangThai(statusRes);
        setTongXe(Array.isArray(xeRes) ? xeRes.length : 0);
        setTongKhach(Array.isArray(khachRes?.data) ? khachRes.data.length : 0);
        setTongTram(Array.isArray(tramRes) ? tramRes.length : 0);
        setTongTaiXe(Array.isArray(txRes) ? txRes.length : 0);
      }
    } catch (err) {
      console.error("Lỗi tải dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [vaiTro]);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) { navigate("/login"); return; }
    loadData(filterPeriod);
  }, [navigate, filterPeriod, loadData]);

  const roleLabel = vaiTro ? ROLE_LABELS[vaiTro] : "";

  const showRevenueChart = vaiTro === "admin" || vaiTro === "ke_toan";
  const showStatusChart = trangThai.length > 0;

  const isTaiXe = vaiTro === "tai_xe";

  const kpiCards: KpiItem[] = [
    {
      label: "Tổng đơn hàng",
      value: isTaiXe ? (dashboard as any)?.tongDonTaiXe || 0 : dashboard?.tongDonHang || 0,
      icon: <FiShoppingCart size={20} />,
      color: "#073ceb",
      bg: "rgba(7,60,235,0.08)",
      roles: ["admin", "ke_toan", "dieu_phoi", "sale", "lanh_dao"],
    },
    {
      label: "Chờ duyệt",
      value: dashboard?.donChoDuyet || 0,
      icon: <FiClock size={20} />,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
      roles: ["admin", "ke_toan", "lanh_dao"],
    },
    {
      label: "Đang xử lý",
      value: dashboard?.donDangXuLy || 0,
      icon: <FiTrendingUp size={20} />,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
      roles: ["admin", "ke_toan", "lanh_dao"],
    },
    {
      label: "Hoàn thành",
      value: dashboard?.donDaHoanThanh || 0,
      icon: <FiCheckCircle size={20} />,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
      roles: ["admin", "ke_toan", "lanh_dao"],
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
    // KPI dành cho tài xế
    ...(isTaiXe
      ? [
          {
            label: "Tổng đơn nhận",
            value: (dashboard as any)?.tongDonTaiXe || 0,
            icon: <FiShoppingCart size={20} />,
            color: "#073ceb",
            bg: "rgba(7,60,235,0.08)",
            roles: ["tai_xe"] as string[],
          },
          {
            label: "Chưa giao",
            value: (dashboard as any)?.chuaGiaoTaiXe || 0,
            icon: <FiClock size={20} />,
            color: "#f59e0b",
            bg: "rgba(245,158,11,0.1)",
            roles: ["tai_xe"] as string[],
          },
          {
            label: "Đã giao",
            value: (dashboard as any)?.daGiaoTaiXe || 0,
            icon: <FiCheckCircle size={20} />,
            color: "#10b981",
            bg: "rgba(16,185,129,0.1)",
            roles: ["tai_xe"] as string[],
          },
        ]
      : []),
  ].filter((k) => !k.roles || k.roles.includes(vaiTro!));

  // Additional stats cards for admin
  const statCards = [
    { label: "Phương tiện", value: tongXe, icon: <FiTruck size={20} />, color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
    { label: "Khách hàng", value: tongKhach, icon: <FiUsers size={20} />, color: "#ec4899", bg: "rgba(236,72,153,0.1)" },
    { label: "Trạm trộn", value: tongTram, icon: <FiPackage size={20} />, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    { label: "Tài xế", value: tongTaiXe, icon: <FiUsers size={20} />, color: "#14b8a6", bg: "rgba(20,184,166,0.1)" },
  ].filter(() => vaiTro === "admin" || vaiTro === "ke_toan");

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

  // Line chart data cho doanh thu
  const lineChartData = {
    labels: doanhThu.map((d) => d.thang),
    datasets: [
      {
        label: "Doanh thu (triệu)",
        data: doanhThu.map((d) => d.doanhThu / 1_000_000),
        borderColor: "#073ceb",
        backgroundColor: "rgba(7, 60, 235, 0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#073ceb",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const lineChartOptions = {
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
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        grid: { color: "rgba(226,232,240,0.6)" },
        ticks: { font: { size: 11 }, callback: (v: unknown) => `${v}M` },
      },
    },
  };

  // Biểu đồ số đơn hàng theo tháng
  const orderBarChartData = {
    labels: doanhThu.map((d) => d.thang),
    datasets: [
      {
        label: "Số đơn hàng",
        data: doanhThu.map((d) => d.soDonHang),
        backgroundColor: "rgba(16, 185, 129, 0.85)",
        borderColor: "#10b981",
        borderWidth: 1,
        borderRadius: 6,
        barThickness: 32,
      },
    ],
  };

  const orderChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { raw: unknown }) => `${ctx.raw} đơn`,
        },
      },
      datalabels: {
        anchor: "end" as const,
        align: "top" as const,
        font: { size: 11, weight: "bold" as const },
        color: "#10b981",
        formatter: (v: unknown) => (v as number) > 0 ? v : "",
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        grid: { color: "rgba(226,232,240,0.6)" },
        ticks: { font: { size: 11 }, stepSize: 1 },
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

      {/* Tab Navigation for Admin/Kế toán */}
      {showRevenueChart && (
        <div className={styles.tabNav}>
          {[
            { key: "kpi", label: "Tổng quan" },
            { key: "doanh-thu", label: "Doanh thu" },
            { key: "trang-thai", label: "Trạng thái" },
            { key: "san-luong", label: "Sản lượng" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ""}`}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      {(activeTab === "kpi" || !showRevenueChart) && (
        <>
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

          {/* Stats row for admin */}
          {statCards.length > 0 && (
            <div className={styles.statsRow}>
              {statCards.map((s, idx) => (
                <div key={idx} className={styles.statCard}>
                  <div className={styles.statIcon} style={{ background: s.bg, color: s.color }}>
                    {s.icon}
                  </div>
                  <div className={styles.statContent}>
                    <div className={styles.statValue}>{s.value}</div>
                    <div className={styles.statLabel}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Charts */}
      <div className={styles.chartGrid}>
        {/* Biểu đồ doanh thu Line */}
        {showRevenueChart && (activeTab === "doanh-thu" || activeTab === "kpi") && (
          <>
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
                  <Line data={lineChartData} options={lineChartOptions} />
                ) : (
                  <div className={styles.chartEmpty}>
                    <FiTrendingUp size={40} />
                    <p>Không có dữ liệu doanh thu</p>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <div>
                  <h3 className={styles.chartCardTitle}>Doanh thu theo tháng (Cột)</h3>
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
          </>
        )}

        {/* Biểu đồ donut tài xế */}
        {isTaiXe && (
          <div className={styles.chartCard}>
            <div className={styles.chartCardHeader}>
              <div>
                <h3 className={styles.chartCardTitle}>Tỷ lệ giao hàng</h3>
                <p className={styles.chartCardDesc}>
                  Tổng {(dashboard as any)?.tongDonTaiXe || 0} đơn đã nhận
                </p>
              </div>
            </div>
            <div className={styles.chartArea}>
              <Pie
                data={{
                  labels: ["Chưa giao", "Đã giao"],
                  datasets: [
                    {
                      data: [
                        (dashboard as any)?.chuaGiaoTaiXe || 0,
                        (dashboard as any)?.daGiaoTaiXe || 0,
                      ],
                      backgroundColor: ["#f59e0b", "#10b981"],
                      borderWidth: 2,
                      borderColor: "#ffffff",
                      hoverOffset: 6,
                    },
                  ],
                }}
                options={{
                  ...donutChartOptions,
                  plugins: {
                    ...donutChartOptions.plugins,
                    datalabels: {
                      color: "#ffffff",
                      font: { size: 12, weight: "bold" as const },
                      formatter: (v: unknown) => {
                        const n = v as number;
                        if (n === 0) return "";
                        return `${n}`;
                      },
                    },
                    legend: {
                      position: "bottom" as const,
                      labels: {
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: "circle",
                        font: { size: 12 },
                        generateLabels: (chart: any) => {
                          const { tongDonTaiXe, chuaGiaoTaiXe, daGiaoTaiXe } = (dashboard as any) || {};
                          return [
                            {
                              text: `Chưa giao: ${chuaGiaoTaiXe || 0}`,
                              fillStyle: "#f59e0b",
                              strokeStyle: "#f59e0b",
                              pointStyle: "circle",
                              hidden: false,
                              index: 0,
                            },
                            {
                              text: `Đã giao: ${daGiaoTaiXe || 0}`,
                              fillStyle: "#10b981",
                              strokeStyle: "#10b981",
                              pointStyle: "circle",
                              hidden: false,
                              index: 1,
                            },
                          ];
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}

        {/* Biểu đồ trạng thái đơn hàng */}
        {showStatusChart && (activeTab === "trang-thai" || activeTab === "kpi") && (
          <>
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
                  <Doughnut data={donutChartData} options={donutChartOptions} />
                ) : (
                  <div className={styles.chartEmpty}>
                    <FiShoppingCart size={40} />
                    <p>Không có dữ liệu trạng thái</p>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <div>
                  <h3 className={styles.chartCardTitle}>Đơn hàng theo trạng thái (Cột)</h3>
                  <p className={styles.chartCardDesc}>
                    Tổng {trangThai.reduce((sum, d) => sum + d.soLuong, 0)} đơn hàng
                  </p>
                </div>
              </div>
              <div className={styles.chartArea}>
                {trangThai.length > 0 ? (
                  <Bar
                    data={{
                      labels: trangThai.map((d) => TRANG_THAI_DON_LABELS[d.trangThai] || d.trangThai),
                      datasets: [
                        {
                          label: "Số đơn",
                          data: trangThai.map((d) => d.soLuong),
                          backgroundColor: trangThai.map((d) => `${TRANG_THAI_DON_COLORS[d.trangThai] || "#64748b"}cc`),
                          borderColor: trangThai.map((d) => TRANG_THAI_DON_COLORS[d.trangThai] || "#64748b"),
                          borderWidth: 1,
                          borderRadius: 6,
                          barThickness: 40,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        datalabels: {
                          anchor: "end" as const,
                          align: "top" as const,
                          font: { size: 11, weight: "bold" as const },
                          formatter: (v: unknown) => (v as number) > 0 ? v : "",
                        },
                      },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: {
                          grid: { color: "rgba(226,232,240,0.6)" },
                          ticks: { font: { size: 11 }, stepSize: 1 },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className={styles.chartEmpty}>
                    <FiShoppingCart size={40} />
                    <p>Không có dữ liệu trạng thái</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Biểu đồ sản lượng */}
        {showRevenueChart && (activeTab === "san-luong" || activeTab === "kpi") && (
          <div className={styles.chartCard} style={{ gridColumn: "1 / -1" }}>
            <div className={styles.chartCardHeader}>
              <div>
                <h3 className={styles.chartCardTitle}>Sản lượng đơn hàng theo tháng</h3>
                <p className={styles.chartCardDesc}>
                  {FILTER_LABELS[filterPeriod]}
                </p>
              </div>
            </div>
            <div className={styles.chartArea} style={{ height: 300 }}>
              {doanhThu.length > 0 ? (
                <Bar data={orderBarChartData} options={orderChartOptions} />
              ) : (
                <div className={styles.chartEmpty}>
                  <FiPackage size={40} />
                  <p>Không có dữ liệu sản lượng</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
