import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiTruck, FiCheckCircle, FiClock } from 'react-icons/fi';
import { layDonHangGiaoHang } from '../services/api';
import {
  DonHangGiaoHang,
  TRANG_THAI_DON_LABELS,
  TRANG_THAI_LICH_SAN_XUAT_LABELS,
  TRANG_THAI_LICH_COLORS,
} from '../types';
import '../styles/shared.css';

function formatCurrency(value: number): string {
  return value.toLocaleString('vi-VN');
}

function getLichStatus(status: string | null): { label: string; color: string } {
  if (!status) return { label: 'Chưa có lịch', color: '#94a3b8' };
  return {
    label: TRANG_THAI_LICH_SAN_XUAT_LABELS[status] || status,
    color: TRANG_THAI_LICH_COLORS[status] || '#94a3b8',
  };
}

function getDonStatus(status: string): { label: string; color: string } {
  return {
    label: TRANG_THAI_DON_LABELS[status] || status,
    color: 'var(--color-primary)',
  };
}

export default function GiaoHangPage() {
  const navigate = useNavigate();
  const [donHang, setDonHang] = useState<DonHangGiaoHang[]>([]);
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('bttd_token');
    if (!token) { navigate('/login'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await layDonHangGiaoHang();
      setDonHang(data);
    } catch (err) {
      console.error('Lỗi tải giao hàng:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = donHang.filter(dh =>
    !tuKhoa ||
    dh.maDonHang.toLowerCase().includes(tuKhoa.toLowerCase()) ||
    dh.tenKhachHang.toLowerCase().includes(tuKhoa.toLowerCase()) ||
    dh.diaChiNhan.toLowerCase().includes(tuKhoa.toLowerCase()) ||
    (dh.bienSoXe && dh.bienSoXe.toLowerCase().includes(tuKhoa.toLowerCase()))
  );

  const thongKe = {
    total: donHang.length,
    chuaSanXuat: donHang.filter(d => d.trangThaiLich === 'chua_san_xuat').length,
    dangSanXuat: donHang.filter(d => d.trangThaiLich === 'dang_san_xuat').length,
    hoanThanh: donHang.filter(d => d.trangThaiLich === 'da_xong').length,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header-title">Trạng thái giao hàng</h2>
          <p className="page-header-desc">Theo dõi tiến độ giao hàng của toàn bộ đơn đang vận chuyển</p>
        </div>
      </div>

      {/* KPI giao hàng */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div className="kpi-label">Tổng đơn giao</div>
          <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>{thongKe.total}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #94a3b8' }}>
          <div className="kpi-label">Chưa sản xuất</div>
          <div className="kpi-value" style={{ color: '#94a3b8' }}>{thongKe.chuaSanXuat}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #f97316' }}>
          <div className="kpi-label">Đang sản xuất / giao</div>
          <div className="kpi-value" style={{ color: '#f97316' }}>{thongKe.dangSanXuat}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="kpi-label">Hoàn thành</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{thongKe.hoanThanh}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="search-box">
          <span className="search-box-icon"><FiSearch /></span>
          <input
            type="text"
            placeholder="Tìm mã đơn, khách hàng, biển số xe..."
            value={tuKhoa}
            onChange={e => setTuKhoa(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
          {filtered.length} đơn
        </span>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /><span>Đang tải...</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <FiTruck className="empty-state-icon" />
          <p className="empty-state-text">Không có đơn hàng nào đang giao</p>
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
                  <th>Địa chỉ</th>
                  <th>Mác BT</th>
                  <th>Khối lượng</th>
                  <th>Thành tiền</th>
                  <th>Xe / Tài xế</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái SX</th>
                  <th>Trạng thái ĐH</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((dh, idx) => {
                  const lich = getLichStatus(dh.trangThaiLich);
                  const don = getDonStatus(dh.trangThaiDon);
                  return (
                    <tr key={dh.id}>
                      <td>{idx + 1}</td>
                      <td><strong>{dh.maDonHang}</strong></td>
                      <td>{dh.tenKhachHang}</td>
                      <td style={{ maxWidth: 160 }}>{dh.diaChiNhan}</td>
                      <td>{dh.tenMacBeTong || '—'}</td>
                      <td>
                        {dh.khoiLuongDat} m³
                        {dh.khoiLuongThucTe && (
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block' }}>
                            Thực tế: {dh.khoiLuongThucTe} m³
                          </span>
                        )}
                      </td>
                      <td><strong>{dh.thanhTien?.toLocaleString('vi-VN')} đ</strong></td>
                      <td>
                        {dh.bienSoXe ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{dh.bienSoXe}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                              {dh.tenTaiXe || '—'}
                              {dh.soDienThoaiTaiXe && ` · ${dh.soDienThoaiTaiXe}`}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Chưa phân xe</span>
                        )}
                      </td>
                      <td>{new Date(dh.ngayTaoDon).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            className="status-dot"
                            style={{ backgroundColor: lich.color }}
                          />
                          <span style={{ color: lich.color, fontWeight: 600, fontSize: 12 }}>
                            {lich.label}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${dh.trangThaiDon}`}>
                          {don.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
