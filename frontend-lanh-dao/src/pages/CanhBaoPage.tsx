import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiAlertCircle, FiClock } from 'react-icons/fi';
import { layDanhSachCanhBao } from '../services/api';
import { CanhBaoDonHang, TRANG_THAI_DON_LABELS } from '../types';
import '../styles/shared.css';

function formatCurrency(value: number): string {
  return value.toLocaleString('vi-VN');
}

function getAlertIcon(loai: string): React.ReactNode {
  switch (loai) {
    case 'qua_han':
      return <FiAlertCircle size={20} color="var(--color-danger)" />;
    case 'don_tre':
      return <FiClock size={20} color="var(--color-warning)" />;
    default:
      return <FiAlertTriangle size={20} color="#f97316" />;
  }
}

function getAlertLabel(loai: string): string {
  switch (loai) {
    case 'qua_han': return 'Quá hạn';
    case 'don_tre': return 'Đơn trễ';
    case 'cong_no': return 'Công nợ';
    default: return loai;
  }
}

function getAlertColor(loai: string): string {
  switch (loai) {
    case 'qua_han': return 'var(--color-danger)';
    case 'don_tre': return 'var(--color-warning)';
    case 'cong_no': return '#f97316';
    default: return 'var(--color-text-secondary)';
  }
}

export default function CanhBaoPage() {
  const navigate = useNavigate();
  const [canhBao, setCanhBao] = useState<CanhBaoDonHang[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoai, setFilterLoai] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('bttd_token');
    if (!token) { navigate('/login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await layDanhSachCanhBao();
      setCanhBao(data);
    } catch (err) {
      console.error('Lỗi tải cảnh báo:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filterLoai
    ? canhBao.filter(c => c.loaiCanhBao === filterLoai)
    : canhBao;

  const thongKe = {
    total: canhBao.length,
    quaHan: canhBao.filter(c => c.loaiCanhBao === 'qua_han').length,
    donTre: canhBao.filter(c => c.loaiCanhBao === 'don_tre').length,
    congNo: canhBao.filter(c => c.loaiCanhBao === 'cong_no').length,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header-title">Cảnh báo</h2>
          <p className="page-header-desc">
            Theo dõi đơn trễ giao hàng và công nợ chưa thanh toán
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div className="kpi-label">Tổng cảnh báo</div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>
            {thongKe.total}
          </div>
          <div className="kpi-sub">Cần xử lý</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <div className="kpi-label">Quá hạn thanh toán</div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>
            {thongKe.quaHan}
          </div>
          <div className="kpi-sub">Công nợ quá hạn</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div className="kpi-label">Đơn trễ giao</div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>
            {thongKe.donTre}
          </div>
          <div className="kpi-sub">Quá thời gian giao</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #f97316' }}>
          <div className="kpi-label">Công nợ chưa TT</div>
          <div className="kpi-value" style={{ color: '#f97316' }}>
            {thongKe.congNo}
          </div>
          <div className="kpi-sub">Còn nợ chưa thanh toán</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', 'qua_han', 'don_tre', 'cong_no'].map(loai => (
          <button
            key={loai}
            className={`btn btn-sm ${filterLoai === loai ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterLoai(loai)}
          >
            {loai === '' ? 'Tất cả' : getAlertLabel(loai)}
            {loai === 'qua_han' && thongKe.quaHan > 0 && (
              <span style={{
                background: 'var(--color-danger)', color: 'white', borderRadius: '50%',
                width: 18, height: 18, fontSize: 10, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {thongKe.quaHan}
              </span>
            )}
          </button>
        ))}
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', alignSelf: 'center', marginLeft: 8 }}>
          {filtered.length} cảnh báo
        </span>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /><span>Đang tải...</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FiAlertTriangle className="empty-state-icon" />
          <p className="empty-state-text">Không có cảnh báo nào</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filtered.map(ca => (
            <div
              key={`${ca.loaiCanhBao}-${ca.id}`}
              className="card"
              style={{
                borderLeft: `4px solid ${getAlertColor(ca.loaiCanhBao)}`,
                background: ca.loaiCanhBao === 'qua_han'
                  ? 'rgba(239,68,68,0.03)'
                  : ca.loaiCanhBao === 'don_tre'
                  ? 'rgba(245,158,11,0.03)'
                  : 'var(--color-white)',
              }}
            >
              <div style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Icon */}
                <div style={{ marginTop: 2, flexShrink: 0 }}>
                  {getAlertIcon(ca.loaiCanhBao)}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <strong style={{ fontSize: 15 }}>{ca.maDonHang}</strong>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px',
                          borderRadius: 20,
                          color: getAlertColor(ca.loaiCanhBao),
                          background: `${getAlertColor(ca.loaiCanhBao)}15`,
                        }}>
                          {getAlertLabel(ca.loaiCanhBao)}
                        </span>
                        <span className={`badge badge-${ca.trangThaiDon}`}>
                          {TRANG_THAI_DON_LABELS[ca.trangThaiDon]}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{ca.tenKhachHang}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                        {ca.diaChiNhan}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                        {ca.moTa}
                      </div>
                    </div>

                    {/* Info right */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: getAlertColor(ca.loaiCanhBao) }}>
                        {formatCurrency(ca.conLai)} đ
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        Còn nợ
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                        {ca.tenMacBeTong || '—'} · {ca.khoiLuongDat} m³
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        Tạo: {new Date(ca.ngayTaoDon).toLocaleDateString('vi-VN')}
                      </div>
                      {ca.thoiGianGiaoDuKien && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          Giao dự kiến: {new Date(ca.thoiGianGiaoDuKien).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
