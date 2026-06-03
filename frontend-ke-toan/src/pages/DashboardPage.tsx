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
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiPackage,
  FiShoppingCart,
  FiTrendingUp,
  FiTruck,
  FiUsers,
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
  const isTaiXe = vaiTro === "tai_xe";

  // ── Chart data ─────────────────────────────────────────────────────────

  // Biểu đồ doanh thu Line
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
  const orderChartData = {
    labels: doanhThu.map((d) => d.thang),
    datasets: [
      {
        label: "Số đơn hàng",
        data: doanhThu.map((d) => d.soDonHang),
        backgroundColor: "rgba(16, 185, 129, 0.85)",
        borderColor: "#10b981",
        borderWidth: 1,
        borderRadius: 6,
        barThickness: 28,
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

  // Biểu đồ trạng thái đơn hàng - horizontal bar
  const statusChartData = {
    labels: trangThai.map((d) => TRANG_THAI_DON_LABELS[d.trangThai] || d.trangThai),
    datasets: [
      {
        label: "Số đơn",
        data: trangThai.map((d) => d.soLuong),
        backgroundColor: trangThai.map((d) => `${TRANG_THAI_DON_COLORS[d.trangThai] || "#64748b"}cc`),
        borderColor: trangThai.map((d) => TRANG_THAI_DON_COLORS[d.trangThai] || "#64748b"),
        borderWidth: 1,
        borderRadius: 6,
        barThickness: 24,
      },
    ],
  };

  const statusChartOptions = {
    indexAxis: "y" as const,
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
        align: "right" as const,
        font: { size: 11, weight: "bold" as const },
        color: "#374151",
        formatter: (v: unknown) => (v as number) > 0 ? v : "",
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(226,232,240,0.6)" },
        ticks: { font: { size: 11 }, stepSize: 1 },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };

  // Biểu đồ trạng thái - Doughnut
  const donutChartData = {
    labels: trangThai.filter(d => d.soLuong > 0).map((d) => TRANG_THAI_DON_LABELS[d.trangThai] || d.trangThai),
    datasets: [
      {
        data: trangThai.filter(d => d.soLuong > 0).map((d) => d.soLuong),
        backgroundColor: trangThai.filter(d => d.soLuong > 0).map((d) => TRANG_THAI_DON_COLORS[d.trangThai] || "#64748b"),
        borderWidth: 2,
        borderColor: "#ffffff",
        hoverOffset: 6,
      },
    ],
  };

  const donutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { padding: 12, usePointStyle: true, pointStyle: "circle", font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; raw: unknown }) =>
            ` ${ctx.label}: ${ctx.raw} đơn`,
        },
      },
    },
  };

  // Tính tổng số đơn
  const totalOrders = trangThai.reduce((sum, d) => sum + d.soLuong, 0);

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

      {/* Compact Stats Row */}
      {!isTaiXe && (
        <div className={styles.compactStatsRow}>
          <div className={styles.compactStatCard}>
            <FiShoppingCart size={18} />
            <div className={styles.compactStatValue}>{dashboard?.tongDonHang || 0}</div>
            <div className={styles.compactStatLabel}>Tổng đơn</div>
          </div>
          <div className={styles.compactStatCard}>
            <FiClock size={18} />
            <div className={styles.compactStatValue}>{dashboard?.donChoDuyet || 0}</div>
            <div className={styles.compactStatLabel}>Chờ duyệt</div>
          </div>
          <div className={styles.compactStatCard}>
            <FiCheckCircle size={18} />
            <div className={styles.compactStatValue}>{dashboard?.donDaHoanThanh || 0}</div>
            <div className={styles.compactStatLabel}>Hoàn thành</div>
          </div>
          <div className={styles.compactStatCard}>
            <FiDollarSign size={18} />
            <div className={styles.compactStatValue}>{formatCurrency(dashboard?.tongDoanhThu || 0)}</div>
            <div className={styles.compactStatLabel}>Doanh thu</div>
          </div>
          <div className={styles.compactStatCard}>
            <FiAlertTriangle size={18} />
            <div className={styles.compactStatValue}>{formatCurrency(dashboard?.tongCongNo || 0)}</div>
            <div className={styles.compactStatLabel}>Công nợ</div>
          </div>
          <div className={styles.compactStatCard}>
            <FiTruck size={18} />
            <div className={styles.compactStatValue}>{tongXe}</div>
            <div className={styles.compactStatLabel}>Phương tiện</div>
          </div>
          <div className={styles.compactStatCard}>
            <FiUsers size={18} />
            <div className={styles.compactStatValue}>{tongKhach}</div>
            <div className={styles.compactStatLabel}>Khách hàng</div>
          </div>
          <div className={styles.compactStatCard}>
            <FiPackage size={18} />
            <div className={styles.compactStatValue}>{tongTram}</div>
            <div className={styles.compactStatLabel}>Trạm trộn</div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className={styles.chartGrid}>
        {/* Biểu đồ doanh thu Line */}
        {doanhThu.length > 0 && (
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
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          </div>
        )}

        {/* Biểu đồ sản lượng đơn hàng */}
        {doanhThu.length > 0 && (
          <div className={styles.chartCard}>
            <div className={styles.chartCardHeader}>
              <div>
                <h3 className={styles.chartCardTitle}>Sản lượng đơn hàng</h3>
                <p className={styles.chartCardDesc}>
                  Số đơn hàng hoàn thành theo tháng
                </p>
              </div>
            </div>
            <div className={styles.chartArea}>
              <Bar data={orderChartData} options={orderChartOptions} />
            </div>
          </div>
        )}

        {/* Biểu đồ trạng thái - Horizontal Bar */}
        {trangThai.length > 0 && (
          <div className={styles.chartCard}>
            <div className={styles.chartCardHeader}>
              <div>
                <h3 className={styles.chartCardTitle}>Đơn hàng theo trạng thái</h3>
                <p className={styles.chartCardDesc}>
                  Tổng {totalOrders} đơn hàng
                </p>
              </div>
            </div>
            <div className={styles.chartArea}>
              <Bar data={statusChartData} options={statusChartOptions} />
            </div>
          </div>
        )}

        {/* Biểu đồ trạng thái - Doughnut */}
        {trangThai.filter(d => d.soLuong > 0).length > 0 && (
          <div className={styles.chartCard}>
            <div className={styles.chartCardHeader}>
              <div>
                <h3 className={styles.chartCardTitle}>Tỷ lệ trạng thái đơn hàng</h3>
                <p className={styles.chartCardDesc}>
                  Biểu đồ donut
                </p>
              </div>
            </div>
            <div className={styles.chartArea}>
              <Doughnut data={donutChartData} options={donutChartOptions} />
            </div>
          </div>
        )}

        {/* Stats cards for admin */}
        {!isTaiXe && (
          <div className={styles.statsGrid}>
            <div className={styles.statsGridItem}>
              <div className={styles.statsGridLabel}>Phương tiện</div>
              <div className={styles.statsGridValue}>{tongXe}</div>
            </div>
            <div className={styles.statsGridItem}>
              <div className={styles.statsGridLabel}>Khách hàng</div>
              <div className={styles.statsGridValue}>{tongKhach}</div>
            </div>
            <div className={styles.statsGridItem}>
              <div className={styles.statsGridLabel}>Trạm trộn</div>
              <div className={styles.statsGridValue}>{tongTram}</div>
            </div>
            <div className={styles.statsGridItem}>
              <div className={styles.statsGridLabel}>Tài xế</div>
              <div className={styles.statsGridValue}>{tongTaiXe}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tài xế Dashboard */}
      {isTaiXe && (
        <div className={styles.chartCard} style={{ maxWidth: 400 }}>
          <div className={styles.chartCardHeader}>
            <div>
              <h3 className={styles.chartCardTitle}>Tỷ lệ giao hàng</h3>
              <p className={styles.chartCardDesc}>
                Tổng {(dashboard as any)?.tongDonTaiXe || 0} đơn đã nhận
              </p>
            </div>
          </div>
          <div className={styles.chartArea}>
            <Doughnut
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
              options={donutChartOptions}
            />
          </div>
        </div>
      )}
    </div>
  );
}
