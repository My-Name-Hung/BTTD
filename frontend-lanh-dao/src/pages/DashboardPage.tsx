import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrendingUp, FiShoppingCart, FiClock, FiCheckCircle, FiDollarSign, FiAlertTriangle, FiAlertCircle } from 'react-icons/fi';
import { layThongKeDashboard, layDoanhThuTheoThang, layDonHangTheoTrangThai, layDanhSachDonHang } from '../services/api';
import { ThongKeDashboard, DoanhThuTheoThang, DonHangTheoTrangThai, DonHang, TRANG_THAI_DON_LABELS, TRANG_THAI_DON_COLORS } from '../types';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styles from './DashboardPage.module.css';

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`;
  return value.toLocaleString('vi-VN');
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<ThongKeDashboard | null>(null);
  const [doanhThu, setDoanhThu] = useState<DoanhThuTheoThang[]>([]);
  const [trangThai, setTrangThai] = useState<DonHangTheoTrangThai[]>([]);
  const [recentOrders, setRecentOrders] = useState<DonHang[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('bttd_token');
    if (!token) { navigate('/login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, revenueRes, statusRes, ordersRes] = await Promise.all([
        layThongKeDashboard(),
        layDoanhThuTheoThang('2025-01', '2026-12'),
        layDonHangTheoTrangThai(),
        layDanhSachDonHang(1, 10),
      ]);
      setDashboard(dashRes);
      setDoanhThu(revenueRes);
      setTrangThai(statusRes);
      setRecentOrders(ordersRes.data || []);
    } catch (err) {
      console.error('Lỗi tải dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ width: 48, height: 48, margin: '0 auto 16px' }}></div>
          <div style={{ color: 'var(--color-text-secondary)' }}>Đang tải dữ liệu...</div>
        </div>
      </div>
    );
  }

  const pieData = trangThai.map((item) => ({
    name: TRANG_THAI_DON_LABELS[item.trangThai] || item.trangThai,
    value: item.soLuong,
    color: TRANG_THAI_DON_COLORS[item.trangThai] || '#64748b',
  }));

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Dashboard Lãnh đạo</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>Tổng quan hoạt động kinh doanh Bê Tông Tây Đô</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="kpi-label">Tổng đơn hàng</div>
              <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>{dashboard?.tongDonHang || 0}</div>
            </div>
            <div className="kpi-icon" style={{ color: 'var(--color-primary)' }}><FiShoppingCart /></div>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="kpi-label">Chờ duyệt</div>
              <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{dashboard?.donChoDuyet || 0}</div>
            </div>
            <div className="kpi-icon" style={{ color: 'var(--color-warning)' }}><FiClock /></div>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="kpi-label">Hoàn thành</div>
              <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{dashboard?.donDaHoanThanh || 0}</div>
            </div>
            <div className="kpi-icon" style={{ color: 'var(--color-success)' }}><FiCheckCircle /></div>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="kpi-label">Đơn quá hạn</div>
              <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{dashboard?.donQuaHan || 0}</div>
            </div>
            <div className="kpi-icon" style={{ color: 'var(--color-danger)' }}><FiAlertCircle /></div>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div>
            <div className="kpi-label">Tổng doanh thu</div>
            <div className="kpi-value currency" style={{ color: 'var(--color-success)' }}>{formatCurrency(dashboard?.tongDoanhThu || 0)}</div>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div>
            <div className="kpi-label">Tổng công nợ</div>
            <div className="kpi-value currency" style={{ color: 'var(--color-warning)' }}>{formatCurrency(dashboard?.tongCongNo || 0)}</div>
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-purple)' }}>
          <div>
            <div className="kpi-label">Đang xử lý</div>
            <div className="kpi-value" style={{ color: 'var(--color-purple)' }}>{dashboard?.donDangXuLy || 0}</div>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Doanh thu theo tháng</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={doanhThu}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="thang" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(value: number) => [formatCurrency(value) + ' đ', 'Doanh thu']} />
                <Bar dataKey="doanhThu" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Đơn hàng theo trạng thái</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Đơn hàng gần nhất</span>
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
              {recentOrders.map((dh) => (
                <tr key={dh.id}>
                  <td><strong>{dh.maDonHang}</strong></td>
                  <td>{dh.tenKhachHang}</td>
                  <td style={{ maxWidth: 200 }}>{dh.diaChiNhan}</td>
                  <td>{dh.tenMacBeTong}</td>
                  <td>{dh.khoiLuongDat} m³</td>
                  <td><strong>{dh.thanhTien?.toLocaleString('vi-VN')} đ</strong></td>
                  <td><span className={`badge badge-${dh.trangThaiDon}`}>{TRANG_THAI_DON_LABELS[dh.trangThaiDon]}</span></td>
                  <td>{new Date(dh.ngayTaoDon).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
