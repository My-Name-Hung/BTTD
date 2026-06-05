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
import { useCallback, useEffect, useState, useMemo } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiGrid,
  FiPieChart,
  FiTrendingUp,
  FiTruck,
  FiUsers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Loading } from "../../../shared/components/Common";
import { ROLE_LABELS, useAuth, usePageRole } from "../../../shared/hooks";
import {
  layDashboardSummary,
  layThongKeTaiXe,
} from "../../../shared/services/api";
import {
  ThongKeDashboard,
  TRANG_THAI_DON_COLORS,
  TRANG_THAI_DON_LABELS,
  DashboardSummary,
} from "../../../shared/types";
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
type TabKey = "tongquan" | "doanhthu" | "trangthai" | "thanhtoan" | "nghiemthu" | "tramtron";

// Tabs theo vai trò
const TABS_BY_ROLE: Record<string, { key: TabKey; label: string; icon: React.ReactNode }[]> = {
  admin: [
    { key: "tongquan", label: "Tổng quan", icon: <FiGrid size={16} /> },
    { key: "doanhthu", label: "Doanh thu", icon: <FiTrendingUp size={16} /> },
    { key: "trangthai", label: "Trạng thái", icon: <FiBarChart2 size={16} /> },
    { key: "thanhtoan", label: "Thanh toán", icon: <FiDollarSign size={16} /> },
    { key: "nghiemthu", label: "Nghiệm thu", icon: <FiFileText size={16} /> },
    { key: "tramtron", label: "Trạm trộn", icon: <FiPieChart size={16} /> },
  ],
  ke_toan: [
    { key: "tongquan", label: "Tổng quan", icon: <FiGrid size={16} /> },
    { key: "doanhthu", label: "Doanh thu", icon: <FiTrendingUp size={16} /> },
    { key: "thanhtoan", label: "Thanh toán", icon: <FiDollarSign size={16} /> },
    { key: "nghiemthu", label: "Nghiệm thu", icon: <FiFileText size={16} /> },
  ],
  lanh_dao: [
    { key: "tongquan", label: "Tổng quan", icon: <FiGrid size={16} /> },
    { key: "doanhthu", label: "Doanh thu", icon: <FiTrendingUp size={16} /> },
    { key: "trangthai", label: "Trạng thái", icon: <FiBarChart2 size={16} /> },
    { key: "thanhtoan", label: "Thanh toán", icon: <FiDollarSign size={16} /> },
    { key: "tramtron", label: "Trạm trộn", icon: <FiPieChart size={16} /> },
  ],
  dieu_phoi: [
    { key: "tongquan", label: "Tổng quan", icon: <FiGrid size={16} /> },
    { key: "trangthai", label: "Trạng thái", icon: <FiBarChart2 size={16} /> },
    { key: "tramtron", label: "Trạm trộn", icon: <FiPieChart size={16} /> },
  ],
  tram_tron: [
    { key: "tongquan", label: "Tổng quan", icon: <FiGrid size={16} /> },
    { key: "trangthai", label: "Trạng thái", icon: <FiBarChart2 size={16} /> },
  ],
  sale: [
    { key: "tongquan", label: "Tổng quan", icon: <FiGrid size={16} /> },
    { key: "doanhthu", label: "Doanh thu", icon: <FiTrendingUp size={16} /> },
    { key: "trangthai", label: "Trạng thái", icon: <FiBarChart2 size={16} /> },
  ],
  tai_xe: [
    { key: "tongquan", label: "Tổng quan", icon: <FiGrid size={16} /> },
  ],
  ky_thuat: [
    { key: "tongquan", label: "Tổng quan", icon: <FiGrid size={16} /> },
    { key: "nghiemthu", label: "Nghiệm thu", icon: <FiFileText size={16} /> },
  ],
};

const FILTER_LABELS: Record<FilterPeriod, string> = {
  ngay: "7 ngày",
  tuan: "30 ngày",
  thang: "Năm nay",
};

// Format tiền: rút gọn theo triệu
function fmt(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} K`;
  return `${value}`;
}

// Format triệu cho chart (đơn vị: triệu VNĐ)
function fmtChart(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} tỷ`;
  return `${value.toFixed(1)} tr`;
}

function getDateRange(period: FilterPeriod): { tuNgay: string; denNgay: string } {
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

export default function DashboardPage() {
  const { user } = useAuth();
  const vaiTro = usePageRole().vaiTro;
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<ThongKeDashboard | null>(null);
  const [doanhThu, setDoanhThu] = useState<DoanhThuTheoThang[]>([]);
  const [trangThai, setTrangThai] = useState<DonHangTheoTrangThai[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("thang");

  // Lấy tabs theo vai trò
  const roleTabs = TABS_BY_ROLE[vaiTro || "admin"] || TABS_BY_ROLE.admin;
  const defaultTab = roleTabs[0]?.key || "tongquan";
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  // Additional data
  const [thanhToan, setThanhToan] = useState({ daThanhToan: 0, chuaThanhToan: 0, congNo: 0 });
  const [nghiemThu, setNghiemThu] = useState({ daNghiemThu: 0, chuaNghiemThu: 0, dangNghiemThu: 0 });
  const [tramTron, setTramTron] = useState<{ tramTron: string; soDonHang: number; doanhThu: number }[]>([]);
  const [congNoThang, setCongNoThang] = useState<{ thang: string; congNoCu: number }[]>([]);
  const [counts, setCounts] = useState({ xe: 0, khach: 0, tram: 0, taiXe: 0 });

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
        // OPTIMIZED: Sử dụng Dashboard Summary API - 1 request thay vì 11 requests
        const summary = await layDashboardSummary();
        
        setDashboard({
          tongDonHang: summary.thongKe.tongDon,
          donChoDuyet: summary.thongKe.donChoDuyet,
          donDangXuLy: summary.thongKe.donDangXuLy,
          donDaHoanThanh: summary.thongKe.donDaHoanThanh,
          tongDoanhThu: summary.thongKe.tongDoanhThu,
          tongCongNo: summary.thongKe.tongCongNo,
          donQuaHan: summary.thongKe.donQuaHan,
        } as ThongKeDashboard);
        
        setDoanhThu(summary.doanhThu);
        setTrangThai(summary.trangThai);
        setThanhToan({
          daThanhToan: summary.thanhToan.tongThanhToan,
          chuaThanhToan: summary.thanhToan.chuaThanhToan,
          congNo: summary.thongKe.tongCongNo,
        });
        setNghiemThu({
          daNghiemThu: summary.nghiemThu.daNghiemThu,
          chuaNghiemThu: summary.nghiemThu.choNghiemThu,
          dangNghiemThu: 0,
        });
        // Transform tram data: backend trả tenTram/soDon, component expect tramTron/doanhThu
        setTramTron(summary.tram.map(t => ({
          tramTron: t.tenTram || 'N/A',
          soDonHang: t.soDon,
          doanhThu: 0, // API mới không trả doanhThu theo trạm
        })));
        setCongNoThang(summary.congNo.map(c => ({ thang: c.thang, congNoCu: c.congNo })));
        setCounts({
          xe: summary.xe.length,
          khach: summary.khachHang.length,
          tram: summary.tramTron.length,
          taiXe: summary.taiXe.length,
        });
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
  const isTaiXe = vaiTro === "tai_xe";

  // OPTIMIZED: Memoize expensive computations
  const totalOrders = useMemo(() => 
    trangThai.reduce((sum, d) => sum + d.soLuong, 0), 
  [trangThai]);

  // OPTIMIZED: Memoize chart data objects
  const revenueLineData = useMemo(() => ({
    labels: doanhThu.map(d => {
      const [y, m] = d.thang.split("-");
      return `T${m}/${y.slice(2)}`;
    }),
    datasets: [{
      label: "Doanh thu (triệu VNĐ)",
      data: doanhThu.map(d => d.doanhThu / 1_000_000),
      borderColor: "#073ceb",
      backgroundColor: "rgba(7, 60, 235, 0.08)",
      fill: true,
      tension: 0.4,
      pointBackgroundColor: "#073ceb",
      pointRadius: 5,
      pointHoverRadius: 7,
    }],
  }), [doanhThu]);

  const revenueBarData = useMemo(() => ({
    labels: doanhThu.map(d => {
      const [y, m] = d.thang.split("-");
      return `T${m}/${y.slice(2)}`;
    }),
    datasets: [{
      label: "Số đơn hàng",
      data: doanhThu.map(d => d.soDonHang),
      backgroundColor: "rgba(16, 185, 129, 0.85)",
      borderColor: "#10b981",
      borderWidth: 1,
      borderRadius: 8,
      barThickness: 36,
    }],
  }), [doanhThu]);

  const congNoBarData = useMemo(() => ({
    labels: congNoThang.map(d => {
      const [y, m] = d.thang.split("-");
      return `T${m}/${y.slice(2)}`;
    }),
    datasets: [{
      label: "Công nợ (triệu VNĐ)",
      data: congNoThang.map(d => d.congNoCu / 1_000_000),
      backgroundColor: "rgba(239, 68, 68, 0.75)",
      borderColor: "#ef4444",
      borderWidth: 1,
      borderRadius: 8,
      barThickness: 32,
    }],
  }), [congNoThang]);

  // Chart font config
  const chartFont = { size: 12, weight: "bold" as const };

  // Common chart options factory
  const createBarOpts = (unit = "") => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { raw: unknown; dataIndex: number; dataset: { data: unknown[] } }) => {
            const v = ctx.raw as number;
            return unit === "đơn" ? `${v} đơn` : `${v.toFixed(1)} tr VNĐ`;
          },
        },
      },
      datalabels: {
        anchor: "end" as const,
        align: "top" as const,
        font: { size: 11, weight: "bold" as const },
        color: "#374151",
        formatter: (v: unknown) => {
          const n = v as number;
          return n > 0 ? (unit === "đơn" ? n : `${n.toFixed(1)}`) : "";
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        grid: { color: "rgba(226,232,240,0.6)" },
        ticks: {
          font: { size: 11 },
          callback: (v: unknown) => `${v}${unit === "đơn" ? "" : " tr"}`,
        },
      },
    },
  });

  const createHBarOpts = (unit = "") => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { raw: unknown }) => {
            const v = ctx.raw as number;
            return unit === "đơn" ? `${v} đơn` : `${v.toFixed(1)} tr VNĐ`;
          },
        },
      },
      datalabels: {
        anchor: "end" as const,
        align: "right" as const,
        font: { size: 11, weight: "bold" as const },
        color: "#374151",
        formatter: (v: unknown) => {
          const n = v as number;
          return n > 0 ? (unit === "đơn" ? n : `${n.toFixed(1)}`) : "";
        },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(226,232,240,0.6)" },
        ticks: {
          font: { size: 11 },
          callback: (v: unknown) => `${v}${unit === "đơn" ? "" : " tr"}`,
        },
      },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  });

  const createDonutOpts = (unit = "đơn") => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; raw: unknown }) => {
            const v = ctx.raw as number;
            return ` ${ctx.label}: ${unit === "đơn" ? v : `${v.toFixed(1)} tr VNĐ`}`;
          },
        },
      },
      datalabels: {
        color: "#fff",
        font: { size: 12, weight: "bold" as const },
        formatter: (v: unknown) => {
          const n = v as number;
          if (n === 0) return "";
          return `${n.toFixed(1)}`;
        },
      },
    },
  });

  // ── TRẠNG THÁI CHARTS ──
  const statusBarData = {
    labels: trangThai.map(d => {
      const label = TRANG_THAI_DON_LABELS[d.trangThai] || d.trangThai;
      return label.length > 15 ? label.slice(0, 14) + "..." : label;
    }),
    datasets: [{
      label: "Số đơn",
      data: trangThai.map(d => d.soLuong),
      backgroundColor: trangThai.map(d => `${TRANG_THAI_DON_COLORS[d.trangThai] || "#64748b"}cc`),
      borderColor: trangThai.map(d => TRANG_THAI_DON_COLORS[d.trangThai] || "#64748b"),
      borderWidth: 1,
      borderRadius: 8,
      barThickness: 28,
    }],
  };

  const statusDonutData = {
    labels: trangThai.filter(d => d.soLuong > 0).map(d => TRANG_THAI_DON_LABELS[d.trangThai] || d.trangThai),
    datasets: [{
      data: trangThai.filter(d => d.soLuong > 0).map(d => d.soLuong),
      backgroundColor: trangThai.filter(d => d.soLuong > 0).map(d => TRANG_THAI_DON_COLORS[d.trangThai] || "#64748b"),
      borderWidth: 2,
      borderColor: "#ffffff",
      hoverOffset: 4,
    }],
  };

  // ── THANH TOÁN CHARTS ──
  const thanhToanBarData = {
    labels: ["Hoàn thành", "Chưa thanh toán", "Công nợ"],
    datasets: [{
      data: [thanhToan.daThanhToan, thanhToan.chuaThanhToan, thanhToan.congNo].map(v => v / 1_000_000),
      backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
      borderWidth: 0,
      borderRadius: 8,
      barThickness: 44,
    }],
  };

  const thanhToanDonutData = {
    labels: ["Hoàn thành", "Chưa thanh toán", "Công nợ"],
    datasets: [{
      data: [thanhToan.daThanhToan, thanhToan.chuaThanhToan, thanhToan.congNo].map(v => v / 1_000_000),
      backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
      borderWidth: 2,
      borderColor: "#ffffff",
    }],
  };

  // ── NGHIỆM THU CHARTS ──
  const nghiemThuBarData = {
    labels: ["Đã nghiệm thu", "Đang nghiệm thu", "Chưa nghiệm thu"],
    datasets: [{
      data: [nghiemThu.daNghiemThu, nghiemThu.dangNghiemThu, nghiemThu.chuaNghiemThu],
      backgroundColor: ["#10b981", "#3b82f6", "#f59e0b"],
      borderWidth: 0,
      borderRadius: 8,
      barThickness: 44,
    }],
  };

  const nghiemThuDonutData = {
    labels: ["Đã nghiệm thu", "Đang nghiệm thu", "Chưa nghiệm thu"],
    datasets: [{
      data: [nghiemThu.daNghiemThu, nghiemThu.dangNghiemThu, nghiemThu.chuaNghiemThu],
      backgroundColor: ["#10b981", "#3b82f6", "#f59e0b"],
      borderWidth: 2,
      borderColor: "#ffffff",
    }],
  };

  // ── TRẠM TRỘN CHARTS ──
  const tramTronBarData = {
    labels: tramTron.map(t => t.tramTron.length > 12 ? t.tramTron.slice(0, 11) + "..." : t.tramTron),
    datasets: [{
      label: "Doanh thu (triệu VNĐ)",
      data: tramTron.map(t => t.doanhThu / 1_000_000),
      backgroundColor: ["#073ceb", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef"],
      borderWidth: 0,
      borderRadius: 8,
      barThickness: 36,
    }],
  };

  const tramTronDonutData = {
    labels: tramTron.map(t => t.tramTron),
    datasets: [{
      data: tramTron.map(t => t.doanhThu / 1_000_000),
      backgroundColor: ["#073ceb", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef"],
      borderWidth: 2,
      borderColor: "#ffffff",
    }],
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
          <p className={styles.dashSubtitle}>{roleLabel} — Bảng điều khiển</p>
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

      {/* Tab Navigation */}
      <div className={styles.tabNav}>
        {roleTabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TỔNG QUAN */}
      {activeTab === "tongquan" && (
        <div className={styles.tabContent}>
          {/* KPI Cards */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(7,60,235,0.1)" }}>
                <FiGrid size={22} color="#073ceb" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Tổng đơn hàng</div>
                <div className={styles.kpiValue}>{dashboard?.tongDonHang || 0}</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(245,158,11,0.1)" }}>
                <FiClock size={22} color="#f59e0b" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Chờ duyệt</div>
                <div className={styles.kpiValue} style={{ color: "#f59e0b" }}>{dashboard?.donChoDuyet || 0}</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(16,185,129,0.1)" }}>
                <FiDollarSign size={22} color="#10b981" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Doanh thu</div>
                <div className={styles.kpiValue} style={{ color: "#10b981" }}>{fmt(dashboard?.tongDoanhThu || 0)} đ</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(239,68,68,0.1)" }}>
                <FiAlertTriangle size={22} color="#ef4444" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Công nợ</div>
                <div className={styles.kpiValue} style={{ color: "#ef4444" }}>{fmt(dashboard?.tongCongNo || 0)} đ</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(59,130,246,0.1)" }}>
                <FiTruck size={22} color="#3b82f6" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Phương tiện</div>
                <div className={styles.kpiValue}>{counts.xe}</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(139,92,246,0.1)" }}>
                <FiUsers size={22} color="#8b5cf6" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Khách hàng</div>
                <div className={styles.kpiValue}>{counts.khach}</div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <FiCheckCircle size={18} color="#10b981" />
              <span>Hoàn thành: <strong>{dashboard?.donDaHoanThanh || 0}</strong></span>
            </div>
            <div className={styles.statCard}>
              <FiUsers size={18} color="#8b5cf6" />
              <span>Tài xế: <strong>{counts.taiXe}</strong></span>
            </div>
          </div>

          {/* Mini charts row */}
          <div className={styles.miniChartsRow}>
            {trangThai.length > 0 && (
              <div className={styles.miniChartCard}>
                <h4 className={styles.miniChartTitle}>Tỷ lệ trạng thái</h4>
                <div className={styles.miniChartArea}>
                  <Doughnut data={statusDonutData} options={createDonutOpts("đơn")} />
                </div>
              </div>
            )}
            {tramTron.length > 0 && (
              <div className={styles.miniChartCard}>
                <h4 className={styles.miniChartTitle}>Doanh thu theo trạm</h4>
                <div className={styles.miniChartArea}>
                  <Bar data={tramTronBarData} options={createHBarOpts()} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DOANH THU */}
      {activeTab === "doanhthu" && (
        <div className={styles.tabContent}>
          <div className={styles.chartRow2}>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Doanh thu theo tháng</h3>
                <p className={styles.chartCardDesc}>{FILTER_LABELS[filterPeriod]} · Đơn vị: triệu VNĐ</p>
              </div>
              <div className={styles.chartArea}>
                <Line data={revenueLineData} options={revenueLineOpts} />
              </div>
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Sản lượng đơn hàng</h3>
                <p className={styles.chartCardDesc}>Số đơn hàng hoàn thành</p>
              </div>
              <div className={styles.chartArea}>
                <Bar data={revenueBarData} options={createBarOpts("đơn")} />
              </div>
            </div>
          </div>
          <div className={styles.chartRow2}>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Công nợ theo tháng</h3>
                <p className={styles.chartCardDesc}>Đơn vị: triệu VNĐ</p>
              </div>
              <div className={styles.chartArea}>
                <Bar data={congNoBarData} options={congNoBarOpts} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRẠNG THÁI */}
      {activeTab === "trangthai" && (
        <div className={styles.tabContent}>
          <div className={styles.chartRow2}>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Đơn hàng theo trạng thái</h3>
                <p className={styles.chartCardDesc}>Tổng {totalOrders} đơn hàng</p>
              </div>
              <div className={styles.chartArea}>
                <Bar data={statusBarData} options={createHBarOpts("đơn")} />
              </div>
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Tỷ lệ trạng thái</h3>
              </div>
              <div className={styles.chartArea}>
                <Doughnut data={statusDonutData} options={createDonutOpts("đơn")} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THANH TOÁN */}
      {activeTab === "thanhtoan" && (
        <div className={styles.tabContent}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(16,185,129,0.1)" }}>
                <FiCheckCircle size={22} color="#10b981" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Đã thanh toán</div>
                <div className={styles.kpiValue} style={{ color: "#10b981" }}>{fmt(thanhToan.daThanhToan)} đ</div>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(245,158,11,0.1)" }}>
                <FiClock size={22} color="#f59e0b" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Chưa thanh toán</div>
                <div className={styles.kpiValue} style={{ color: "#f59e0b" }}>{fmt(thanhToan.chuaThanhToan)} đ</div>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(239,68,68,0.1)" }}>
                <FiAlertTriangle size={22} color="#ef4444" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Công nợ</div>
                <div className={styles.kpiValue} style={{ color: "#ef4444" }}>{fmt(thanhToan.congNo)} đ</div>
              </div>
            </div>
          </div>
          <div className={styles.chartRow2}>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Thanh toán theo trạng thái</h3>
                <p className={styles.chartCardDesc}>Đơn vị: triệu VNĐ</p>
              </div>
              <div className={styles.chartArea}>
                <Bar data={thanhToanBarData} options={createBarOpts()} />
              </div>
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Tỷ lệ thanh toán</h3>
                <p className={styles.chartCardDesc}>Đơn vị: triệu VNĐ</p>
              </div>
              <div className={styles.chartArea}>
                <Doughnut data={thanhToanDonutData} options={createDonutOpts()} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NGHIỆM THU */}
      {activeTab === "nghiemthu" && (
        <div className={styles.tabContent}>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(16,185,129,0.1)" }}>
                <FiCheckCircle size={22} color="#10b981" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Đã nghiệm thu</div>
                <div className={styles.kpiValue} style={{ color: "#10b981" }}>{nghiemThu.daNghiemThu}</div>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(59,130,246,0.1)" }}>
                <FiClock size={22} color="#3b82f6" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Đang nghiệm thu</div>
                <div className={styles.kpiValue} style={{ color: "#3b82f6" }}>{nghiemThu.dangNghiemThu}</div>
              </div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: "rgba(245,158,11,0.1)" }}>
                <FiFileText size={22} color="#f59e0b" />
              </div>
              <div className={styles.kpiCardLeft}>
                <div className={styles.kpiLabel}>Chưa nghiệm thu</div>
                <div className={styles.kpiValue} style={{ color: "#f59e0b" }}>{nghiemThu.chuaNghiemThu}</div>
              </div>
            </div>
          </div>
          <div className={styles.chartRow2}>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Nghiệm thu theo trạng thái</h3>
                <p className={styles.chartCardDesc}>Số lượng đơn hàng</p>
              </div>
              <div className={styles.chartArea}>
                <Bar data={nghiemThuBarData} options={createBarOpts("đơn")} />
              </div>
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Tỷ lệ nghiệm thu</h3>
              </div>
              <div className={styles.chartArea}>
                <Doughnut data={nghiemThuDonutData} options={createDonutOpts("đơn")} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRẠM TRỘN */}
      {activeTab === "tramtron" && (
        <div className={styles.tabContent}>
          <div className={styles.chartRow2}>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Doanh thu theo trạm trộn</h3>
                <p className={styles.chartCardDesc}>Đơn vị: triệu VNĐ</p>
              </div>
              <div className={styles.chartArea}>
                <Bar data={tramTronBarData} options={createBarOpts()} />
              </div>
            </div>
            <div className={styles.chartCard}>
              <div className={styles.chartCardHeader}>
                <h3 className={styles.chartCardTitle}>Tỷ lệ doanh thu trạm</h3>
                <p className={styles.chartCardDesc}>Đơn vị: triệu VNĐ</p>
              </div>
              <div className={styles.chartArea}>
                <Doughnut data={tramTronDonutData} options={createDonutOpts()} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tài xế Dashboard */}
      {isTaiXe && (
        <div className={styles.chartCard} style={{ maxWidth: 400 }}>
          <div className={styles.chartCardHeader}>
            <h3 className={styles.chartCardTitle}>Tỷ lệ giao hàng</h3>
          </div>
          <div className={styles.chartArea}>
            <Doughnut
              data={{
                labels: ["Chưa giao", "Đã giao"],
                datasets: [{
                  data: [(dashboard as any)?.chuaGiaoTaiXe || 0, (dashboard as any)?.daGiaoTaiXe || 0],
                  backgroundColor: ["#f59e0b", "#10b981"],
                  borderWidth: 2,
                  borderColor: "#ffffff",
                }],
              }}
              options={{ responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "bottom" } } }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
