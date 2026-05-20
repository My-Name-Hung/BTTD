import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'recharts';
import {
  layDoanhThuLanhDao,
  layDoanhThuTheoMac,
  layDoanhThuTongHop,
} from '../services/api';
import { DoanhThuTheoThang, DoanhThuTheoMac, DoanhThuTongHop } from '../types';
import '../styles/shared.css';

type FilterPeriod = 'thang' | 'quy' | 'nam';

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`;
  return value.toLocaleString('vi-VN');
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function getDateRange(period: FilterPeriod): { thangBatDau: string; thangKetThuc: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  switch (period) {
    case 'thang': {
      const prev = new Date(y, m - 6, 1);
      return {
        thangBatDau: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`,
        thangKetThuc: `${y}-${String(m).padStart(2, '0')}`,
      };
    }
    case 'quy': {
      const prev = new Date(y, m - 12, 1);
      return {
        thangBatDau: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`,
        thangKetThuc: `${y}-${String(m).padStart(2, '0')}`,
      };
    }
    case 'nam':
    default: {
      return {
        thangBatDau: `${y - 1}-01`,
        thangKetThuc: `${y}-${String(m).padStart(2, '0')}`,
      };
    }
  }
}

const FILTER_LABELS: Record<FilterPeriod, string> = {
  thang: '6 tháng gần nhất',
  quy: '12 tháng gần nhất',
  nam: '2 năm',
};

const MAC_COLORS = [
  '#073ceb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
];

export default function DoanhThuPage() {
  const navigate = useNavigate();
  const [tongHop, setTongHop] = useState<DoanhThuTongHop | null>(null);
  const [doanhThu, setDoanhThu] = useState<DoanhThuTheoThang[]>([]);
  const [theoMac, setTheoMac] = useState<DoanhThuTheoMac[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('quy');

  const loadData = useCallback(async (period: FilterPeriod) => {
    setLoading(true);
    try {
      const { thangBatDau, thangKetThuc } = getDateRange(period);
      const [thRes, revenueRes, macRes] = await Promise.all([
        layDoanhThuTongHop(),
        layDoanhThuLanhDao(thangBatDau, thangKetThuc),
        layDoanhThuTheoMac(thangBatDau, thangKetThuc),
      ]);
      setTongHop(thRes);
      setDoanhThu(revenueRes);
      setTheoMac(macRes);
    } catch (err) {
      console.error('Lỗi tải doanh thu:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('bttd_token');
    if (!token) { navigate('/login'); return; }
    loadData(filterPeriod);
  }, [navigate, filterPeriod, loadData]);

  const totalRevenue = doanhThu.reduce((s, d) => s + d.doanhThu, 0);
  const totalOrders = doanhThu.reduce((s, d) => s + d.soDonHang, 0);

  const macPieData = theoMac.map((m, i) => ({
    name: m.tenMac,
    value: m.tongDoanhThu,
    soDonHang: m.soDonHang,
    color: MAC_COLORS[i % MAC_COLORS.length],
  }));

  const tiLeTang = tongHop && tongHop.doanhThuThangTruoc > 0
    ? ((tongHop.doanhThuThangNay - tongHop.doanhThuThangTruoc) / tongHop.doanhThuThangTruoc) * 100
    : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header-title">Báo cáo doanh thu</h2>
          <p className="page-header-desc">Phân tích doanh thu theo thời gian và theo mác bê tông</p>
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

      {/* KPI */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="kpi-label">Tổng doanh thu</div>
          <div className="kpi-value" style={{ fontSize: 22, color: 'var(--color-success)' }}>
            {formatCurrency(tongHop?.tongDoanhThu || 0)}
          </div>
          <div className="kpi-sub">Từ {tongHop?.tongDonHang || 0} đơn đã thanh toán</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="kpi-label">Doanh thu kỳ này</div>
          <div className="kpi-value" style={{ fontSize: 22, color: 'var(--color-primary)' }}>
            {formatCurrency(totalRevenue)}
          </div>
          <div className="kpi-sub">{totalOrders} đơn hàng</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="kpi-label">Doanh thu tháng này</div>
          <div className="kpi-value" style={{ fontSize: 22, color: 'var(--color-success)' }}>
            {formatCurrency(tongHop?.doanhThuThangNay || 0)}
          </div>
          <div className="kpi-sub">
            Tháng trước: {formatCurrency(tongHop?.doanhThuThangTruoc || 0)}
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="kpi-label">Tăng trưởng</div>
          <div className="kpi-value" style={{ fontSize: 22, color: tiLeTang >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {tiLeTang >= 0 ? '+' : ''}{tiLeTang.toFixed(1)}%
          </div>
          <div className="kpi-sub">So với tháng trước</div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /><span>Đang tải...</span></div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Doanh thu theo tháng</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Đơn vị: đồng</span>
            </div>
            <div className="card-body">
              {doanhThu.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={doanhThu}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="thang" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={v => `${(v / 1_000_000).toFixed(0)}M`}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrencyFull(value), 'Doanh thu']}
                      labelFormatter={l => `Tháng ${l}`}
                    />
                    <Bar dataKey="doanhThu" fill="#073ceb" radius={[4, 4, 0, 0]} name="Doanh thu" />
                    <Bar dataKey="soDonHang" fill="#c7d2fe" radius={[4, 4, 0, 0]} name="Số đơn hàng" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <p className="empty-state-text">Chưa có dữ liệu doanh thu</p>
                </div>
              )}
            </div>
          </div>

          {/* Pie chart + table */}
          <div className="chart-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Doanh thu theo mác bê tông</span>
              </div>
              <div className="card-body">
                {macPieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={macPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {macPieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            `${formatCurrency(value)} (${((value / totalRevenue) * 100).toFixed(1)}%)`,
                            name,
                          ]}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 12 }}>
                      <table className="table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Mác BT</th>
                            <th>Số đơn</th>
                            <th>Doanh thu</th>
                            <th>Tỷ lệ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {macPieData.map((m, i) => (
                            <tr key={i}>
                              <td>
                                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: m.color, marginRight: 8 }} />
                                {m.name}
                              </td>
                              <td>{m.soDonHang}</td>
                              <td><strong>{formatCurrency(m.value)}</strong></td>
                              <td>{totalRevenue > 0 ? ((m.value / totalRevenue) * 100).toFixed(1) : 0}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <p className="empty-state-text">Chưa có dữ liệu</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top tháng */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Top tháng có doanh thu cao nhất</span>
              </div>
              <div className="card-body">
                {doanhThu.length > 0 ? (
                  <div>
                    {[...doanhThu]
                      .sort((a, b) => b.doanhThu - a.doanhThu)
                      .slice(0, 6)
                      .map((d, i) => (
                        <div key={d.thang} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>
                              #{i + 1} {d.thang}
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                              {formatCurrency(d.doanhThu)}
                            </span>
                          </div>
                          <div className="progress-bar-wrap">
                            <div
                              className="progress-bar-fill"
                              style={{
                                width: `${Math.min((d.doanhThu / (doanhThu[0]?.doanhThu || 1)) * 100, 100)}%`,
                                background: `hsl(${220 - i * 20}, 80%, 50%)`,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            {d.soDonHang} đơn hàng
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p className="empty-state-text">Chưa có dữ liệu</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
