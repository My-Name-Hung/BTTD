import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiShoppingCart,
  FiClock,
  FiCheckCircle,
  FiDollarSign,
  FiAlertTriangle,
  FiTrendingUp,
  FiPackage,
  FiAlertCircle,
} from 'react-icons/fi';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  layThongKeLanhDao,
  layDoanhThuLanhDao,
  layDonHangTheoTrangThai,
  layDoanhThuTongHop,
  layDonHangDangXuLy,
} from '../services/api';
import {
  ThongKeDashboard,
  DoanhThuTheoThang,
  DonHangTheoTrangThai,
  DonHang,
  DoanhThuTongHop,
  TRANG_THAI_DON_LABELS,
  TRANG_THAI_DON_COLORS,
} from '../types';
import '../styles/shared.css';

type FilterPeriod = 'ngay' | 'tuan' | 'thang' | 'nam';

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`;
  return value.toLocaleString('vi-VN');
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

const FILTER_LABELS: Record<FilterPeriod, string> = {
  ngay: '7 ngày',
  tuan: '30 ngày',
  thang: 'Năm nay',
  nam: '2 năm',
};

function getDateRange(period: FilterPeriod): { thangBatDau: string; thangKetThuc: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');

  switch (period) {
    case 'ngay': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      const md = String(d.getMonth() + 1).padStart(2, '0');
      return { thangBatDau: `${d.getFullYear()}-${md}`, thangKetThuc: `${y}-${m}` };
    }
    case 'tuan': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      const md = String(d.getMonth() + 1).padStart(2, '0');
      return { thangBatDau: `${d.getFullYear()}-${md}`, thangKetThuc: `${y}-${m}` };
    }
    case 'thang':
      return { thangBatDau: `${y}-01`, thangKetThuc: `${y}-${m}` };
    case 'nam':
    default:
      return { thangBatDau: `${y - 1}-01`, thangKetThuc: `${y}-${m}` };
  }
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<ThongKeDashboard | null>(null);
  const [tongHop, setTongHop] = useState<DoanhThuTongHop | null>(null);
  const [doanhThu, setDoanhThu] = useState<DoanhThuTheoThang[]>([]);
  const [trangThai, setTrangThai] = useState<DonHangTheoTrangThai[]>([]);
  const [recentOrders, setRecentOrders] = useState<DonHang[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('thang');

  const loadData = useCallback(async (period: FilterPeriod) => {
    setLoading(true);
    try {
      const { thangBatDau, thangKetThuc } = getDateRange(period);
      const [dashRes, thRes, revenueRes, statusRes, ordersRes] = await Promise.all([
        layThongKeLanhDao(),
        layDoanhThuTongHop(),
        layDoanhThuLanhDao(thangBatDau, thangKetThuc),
        layDonHangTheoTrangThai(),
        layDonHangDangXuLy(),
      ]);
      setDashboard(dashRes);
      setTongHop(thRes);
      setDoanhThu(revenueRes);
      setTrangThai(statusRes);
      setRecentOrders(ordersRes.slice(0, 8));
    } catch (err) {
      console.error('Lỗi tải dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('bttd_token');
    if (!token) { navigate('/login'); return; }
    loadData(filterPeriod);
  }, [navigate, filterPeriod, loadData]);

  const pieData = trangThai.map(item => ({
    name: TRANG_THAI_DON_LABELS[item.trangThai] || item.trangThai,
    value: item.soLuong,
    color: TRANG_THAI_DON_COLORS[item.trangThai] || '#64748b',
  }));

  const tongTienTrangThai = pieData.reduce((s, d) => s + d.value, 0);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <span>Đang tải dữ liệu dashboard...</span>
      </div>
    );
  }

  const tiLeTang =
    tongHop && tongHop.doanhThuThangTruoc > 0
      ? ((tongHop.doanhThuThangNay - tongHop.doanhThuThangTruoc) / tongHop.doanhThuThangTruoc) * 100
      : 0;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 className="page-header-title">Tổng quan</h2>
          <p className="page-header-desc">Dashboard lãnh đạo — Bê Tông Tây Đô</p>
        </div>
        <div className="filter-tabs">
          {(Object.keys(FILTER_LABELS) as FilterPeriod[]).map(p => (
            <button
              key={p}
              className={`filter-tab ${filterPeriod === p ? 'filter-tab-active' : ''}`}
              onClick={() => setFilterPeriod(p)}
            >
              {FILTER_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="kpi-label">Tổng đơn hàng</div>
          <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>
            {dashboard?.tongDonHang || 0}
          </div>
          <div className="kpi-sub">Đơn hàng đã xử lý</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div className="kpi-label">Chờ duyệt</div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>
            {dashboard?.donChoDuyet || 0}
          </div>
          <div className="kpi-sub">Đơn chưa được duyệt</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-info)' }}>
          <div className="kpi-label">Đang xử lý</div>
          <div className="kpi-value" style={{ color: 'var(--color-info)' }}>
            {dashboard?.donDangXuLy || 0}
          </div>
          <div className="kpi-sub">Đơn đang trong quy trình</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="kpi-label">Hoàn thành</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>
            {dashboard?.donDaHoanThanh || 0}
          </div>
          <div className="kpi-sub">Đơn đã hoàn tất</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="kpi-label">Tổng doanh thu</div>
          <div className="kpi-value" style={{ fontSize: 22, color: 'var(--color-success)' }}>
            {formatCurrency(dashboard?.tongDoanhThu || 0)}
          </div>
          <div className="kpi-sub">Doanh thu từ đơn đã TT</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div className="kpi-label">Tổng công nợ</div>
          <div className="kpi-value" style={{ fontSize: 22, color: 'var(--color-warning)' }}>
            {formatCurrency(dashboard?.tongCongNo || 0)}
          </div>
          <div className="kpi-sub">Còn phải thu</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div className="kpi-label">Đơn quá hạn</div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>
            {dashboard?.donQuaHan || 0}
          </div>
          <div className="kpi-sub">Công nợ quá hạn</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-purple)' }}>
          <div className="kpi-label">Tăng trưởng tháng</div>
          <div className="kpi-value" style={{ fontSize: 22, color: tiLeTang >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {tiLeTang >= 0 ? '+' : ''}{tiLeTang.toFixed(1)}%
          </div>
          <div className="kpi-sub">
            vs tháng trước
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Doanh thu theo tháng</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Đơn vị: triệu đồng
            </span>
          </div>
          <div className="card-body">
            {doanhThu.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={doanhThu}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#073ceb" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#073ceb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="thang" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrencyFull(value), 'Doanh thu']}
                    labelFormatter={l => `Tháng ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="doanhThu"
                    stroke="#073ceb"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <FiTrendingUp className="empty-state-icon" />
                <p className="empty-state-text">Chưa có dữ liệu doanh thu</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Đơn hàng theo trạng thái</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              Tổng {tongTienTrangThai} đơn
            </span>
          </div>
          <div className="card-body">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} đơn (${((value / tongTienTrangThai) * 100).toFixed(0)}%)`, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <FiPackage className="empty-state-icon" />
                <p className="empty-state-text">Chưa có dữ liệu trạng thái</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 20 }}>
        {/* Doanh thu tháng này */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">So sánh tháng</span>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Doanh thu tháng này</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-success)' }}>
                {formatCurrency(tongHop?.doanhThuThangNay || 0)}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Doanh thu tháng trước</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {formatCurrency(tongHop?.doanhThuThangTruoc || 0)}
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Tăng trưởng</span>
              <span style={{
                fontSize: 16, fontWeight: 800,
                color: tiLeTang >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                {tiLeTang >= 0 ? `+${tiLeTang.toFixed(1)}%` : `${tiLeTang.toFixed(1)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Top KPI */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tổng hợp</span>
          </div>
          <div className="card-body">
            <div className="stat-row">
              <span className="stat-row-label">Tổng đơn hoàn thành</span>
              <span className="stat-row-value" style={{ color: 'var(--color-success)' }}>
                {tongHop?.tongDonHang || 0} đơn
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">Tổng doanh thu</span>
              <span className="stat-row-value" style={{ color: 'var(--color-success)' }}>
                {formatCurrency(tongHop?.tongDoanhThu || 0)}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">Tổng công nợ</span>
              <span className="stat-row-value" style={{ color: 'var(--color-warning)' }}>
                {formatCurrency(tongHop?.tongCongNo || 0)}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">Số đơn quá hạn</span>
              <span className="stat-row-value" style={{ color: 'var(--color-danger)' }}>
                {tongHop?.soDonQuaHan || 0} đơn
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Đơn gần nhất */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <span className="card-title">Đơn hàng đang xử lý gần đây</span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => navigate('/don-hang-dang-xu-ly')}
          >
            Xem tất cả →
          </button>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Địa chỉ</th>
                <th>Mác BT</th>
                <th>Khối lượng</th>
                <th>Thành tiền</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 24 }}>
                    Không có đơn hàng nào đang xử lý
                  </td>
                </tr>
              ) : (
                recentOrders.map(dh => (
                  <tr key={dh.id}>
                    <td><strong>{dh.maDonHang}</strong></td>
                    <td>{dh.tenKhachHang}</td>
                    <td style={{ maxWidth: 180 }}>{dh.diaChiNhan}</td>
                    <td>{dh.tenMacBeTong || '—'}</td>
                    <td>{dh.khoiLuongDat} m³</td>
                    <td><strong>{dh.thanhTien?.toLocaleString('vi-VN')} đ</strong></td>
                    <td>
                      <span className={`badge badge-${dh.trangThaiDon}`}>
                        {TRANG_THAI_DON_LABELS[dh.trangThaiDon]}
                      </span>
                    </td>
                    <td>{new Date(dh.ngayTaoDon).toLocaleDateString('vi-VN')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
