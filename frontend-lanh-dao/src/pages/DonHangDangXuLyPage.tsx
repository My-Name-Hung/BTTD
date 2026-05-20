import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import { layDonHangDangXuLy } from '../services/api';
import { DonHang, TRANG_THAI_DON_LABELS } from '../types';
import '../styles/shared.css';

export default function DonHangDangXuLyPage() {
  const navigate = useNavigate();
  const [donHang, setDonHang] = useState<DonHang[]>([]);
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
      const data = await layDonHangDangXuLy();
      setDonHang(data);
    } catch (err) {
      console.error('Lỗi tải đơn hàng:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = donHang.filter(dh =>
    !tuKhoa ||
    dh.maDonHang.toLowerCase().includes(tuKhoa.toLowerCase()) ||
    dh.tenKhachHang.toLowerCase().includes(tuKhoa.toLowerCase()) ||
    dh.diaChiNhan.toLowerCase().includes(tuKhoa.toLowerCase())
  );

  const demTheoTrangThai = (trangThai: string) =>
    donHang.filter(d => d.trangThaiDon === trangThai).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-header-title">Đơn hàng đang xử lý</h2>
          <p className="page-header-desc">
            Theo dõi toàn bộ đơn đang trong quy trình từ duyệt đến nghiệm thu
          </p>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="kpi-label">Đã duyệt</div>
          <div className="kpi-value" style={{ color: '#3b82f6' }}>{demTheoTrangThai('da_duyet')}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="kpi-label">Đang sản xuất</div>
          <div className="kpi-value" style={{ color: '#8b5cf6' }}>{demTheoTrangThai('dang_san_xuat')}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #f97316' }}>
          <div className="kpi-label">Đang giao</div>
          <div className="kpi-value" style={{ color: '#f97316' }}>{demTheoTrangThai('dang_giao')}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #06b6d4' }}>
          <div className="kpi-label">Đã giao</div>
          <div className="kpi-value" style={{ color: '#06b6d4' }}>{demTheoTrangThai('da_giao')}</div>
        </div>
        <div className="kpi-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="kpi-label">Nghiệm thu</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{demTheoTrangThai('nghiem_thu')}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div className="search-box">
          <span className="search-box-icon"><FiSearch /></span>
          <input
            type="text"
            placeholder="Tìm mã đơn, khách hàng, địa chỉ..."
            value={tuKhoa}
            onChange={e => setTuKhoa(e.target.value)}
          />
        </div>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
          {filtered.length} đơn hàng
        </span>
      </div>

      {loading ? (
        <div className="loading"><div className="loading-spinner" /><span>Đang tải...</span></div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Địa chỉ giao</th>
                  <th>Mác BT</th>
                  <th>Khối lượng</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                  <th>Người tạo</th>
                  <th>Ngày tạo</th>
                  <th>Giao dự kiến</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-secondary)' }}>
                      Không có đơn hàng nào đang xử lý
                    </td>
                  </tr>
                ) : (
                  filtered.map((dh, idx) => (
                    <tr key={dh.id}>
                      <td>{idx + 1}</td>
                      <td><strong>{dh.maDonHang}</strong></td>
                      <td>{dh.tenKhachHang}</td>
                      <td style={{ maxWidth: 180 }}>{dh.diaChiNhan}</td>
                      <td>{dh.tenMacBeTong || '—'}</td>
                      <td>{dh.khoiLuongDat} m³</td>
                      <td>{dh.donGia.toLocaleString('vi-VN')} đ</td>
                      <td><strong>{dh.thanhTien?.toLocaleString('vi-VN')} đ</strong></td>
                      <td>{dh.nguoiTaoHoTen || '—'}</td>
                      <td>{new Date(dh.ngayTaoDon).toLocaleDateString('vi-VN')}</td>
                      <td>
                        {dh.thoiGianGiaoDuKien
                          ? new Date(dh.thoiGianGiaoDuKien).toLocaleDateString('vi-VN')
                          : '—'}
                      </td>
                      <td>
                        <span className={`badge badge-${dh.trangThaiDon}`}>
                          {TRANG_THAI_DON_LABELS[dh.trangThaiDon]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
