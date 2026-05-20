import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiAlertCircle } from 'react-icons/fi';
import { layCongNoLanhDao } from '../services/api';
import { CongNoTongHop, TRANG_THAI_CONG_NO_LABELS, TRANG_THAI_CONG_NO_COLORS } from '../types';
import '../styles/shared.css';

function formatCurrency(value: number): string {
  return value.toLocaleString('vi-VN');
}

function getBadgeClass(trangThai: string): string {
  switch (trangThai) {
    case 'qua_han': return 'badge-qua-han';
    case 'chua_thanh_toan': return 'badge-cho-duyet';
    case 'dang_thanh_toan': return 'badge-dang-san-xuat';
    case 'da_thanh_toan': return 'badge-da-thanh-toan';
    default: return '';
  }
}

export default function CongNoPage() {
  const navigate = useNavigate();
  const [congNo, setCongNo] = useState<CongNoTongHop[]>([]);
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');
  const [filterTrangThai, setFilterTrangThai] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('bttd_token');
    if (!token) { navigate('/login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await layCongNoLanhDao();
      setCongNo(data);
    } catch (err) {
      console.error('Lỗi tải công nợ:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = congNo.filter(cn => {
    const matchKw = !tuKhoa ||
      cn.maDonHang.toLowerCase().includes(tuKhoa.toLowerCase()) ||
      cn.tenKhachHang.toLowerCase().includes(tuKhoa.toLowerCase());
    const matchTt = !filterTrangThai || cn.trangThai === filterTrangThai;
    return matchKw && matchTt;
  });

  const tongCongNo = congNo.reduce((s, cn) => s + cn.conLai, 0);
  const tongTien = congNo.reduce((s, cn) => s + cn.tongTien, 0);
  const daThanhToan = congNo.reduce((s, cn) => s + cn.daThanhToan, 0);
  const soQuaHan = congNo.filter(cn => cn.trangThai === 'qua_han').length;

  const thongKe = {
    total: congNo.length,
    chuaTT: congNo.filter(c => c.trangThai === 'chua_thanh_toan').length,
    dangTT: congNo.filter(c => c.trangThai === 'dang_thanh_toan').length,
    daTT: congNo.filter(c => c.trangThai === 'da_thanh_toan').length,
    quaHan: soQuaHan,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header-title">Quản lý công nợ</h2>
          <p className="page-header-desc">Theo dõi toàn bộ công nợ từ các đơn hàng chưa thanh toán đủ</p>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div className="kpi-label">Tổng công nợ</div>
          <div className="kpi-value" style={{ fontSize: 22, color: 'var(--color-warning)' }}>
            {formatCurrency(tongCongNo)}
          </div>
          <div className="kpi-sub">{thongKe.total} đơn hàng</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="kpi-label">Đã thanh toán</div>
          <div className="kpi-value" style={{ fontSize: 22, color: 'var(--color-success)' }}>
            {formatCurrency(daThanhToan)}
          </div>
          <div className="kpi-sub">Tổng giá trị: {formatCurrency(tongTien)}</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #f97316' }}>
          <div className="kpi-label">Chưa thanh toán</div>
          <div className="kpi-value" style={{ color: '#f97316' }}>
            {thongKe.chuaTT}
          </div>
          <div className="kpi-sub">Đơn hàng</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div className="kpi-label">Quá hạn</div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>
            {thongKe.quaHan}
          </div>
          <div className="kpi-sub">Đơn hàng quá hạn</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-box">
          <span className="search-box-icon"><FiSearch /></span>
          <input
            type="text"
            placeholder="Tìm mã đơn, khách hàng..."
            value={tuKhoa}
            onChange={e => setTuKhoa(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {['', 'chua_thanh_toan', 'dang_thanh_toan', 'qua_han'].map(tt => (
            <button
              key={tt}
              className={`btn btn-sm ${filterTrangThai === tt ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterTrangThai(tt)}
            >
              {tt === '' ? 'Tất cả' : tt === 'chua_thanh_toan' ? 'Chưa TT' : tt === 'dang_thanh_toan' ? 'Đang TT' : 'Quá hạn'}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
          {filtered.length} công nợ
        </span>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /><span>Đang tải...</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FiAlertCircle className="empty-state-icon" />
          <p className="empty-state-text">Không có công nợ nào</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Tổng tiền</th>
                  <th>Đã TT</th>
                  <th>Còn nợ</th>
                  <th>Hạn thanh toán</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cn, idx) => (
                  <tr
                    key={cn.id}
                    style={cn.trangThai === 'qua_han' ? { background: 'rgba(239,68,68,0.04)' } : {}}
                  >
                    <td>{idx + 1}</td>
                    <td><strong>{cn.maDonHang}</strong></td>
                    <td>{cn.tenKhachHang}</td>
                    <td>{formatCurrency(cn.tongTien)} đ</td>
                    <td style={{ color: 'var(--color-success)' }}>
                      {formatCurrency(cn.daThanhToan)} đ
                    </td>
                    <td>
                      <strong style={{ color: cn.conLai > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                        {formatCurrency(cn.conLai)} đ
                      </strong>
                    </td>
                    <td>
                      {cn.hanThanhToan || '—'}
                      {cn.trangThai === 'qua_han' && cn.soNgayQuaHan > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 600 }}>
                          Quá {cn.soNgayQuaHan} ngày
                        </div>
                      )}
                    </td>
                    <td>{cn.ngayTao ? new Date(cn.ngayTao).toLocaleDateString('vi-VN') : '—'}</td>
                    <td>
                      <span className={`badge ${getBadgeClass(cn.trangThai)}`}>
                        {TRANG_THAI_CONG_NO_LABELS[cn.trangThai] || cn.trangThai}
                      </span>
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      {cn.ghiChu || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
