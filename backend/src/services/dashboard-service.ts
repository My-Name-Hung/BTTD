import { query } from '../config/database';
import {
  ThongKeDashboard,
  DoanhThuTheoThang,
  DonHangTheoTrangThai,
} from '../models';

export async function layThongKeDashboard(): Promise<ThongKeDashboard> {
  // Gộp query COUNT riêng lẻ thành 1 query duy nhất
  const results = await query<{
    tongDonHang: number;
    donChoDuyet: number;
    donDangXuLy: number;
    donDaHoanThanh: number;
    tongDoanhThu: number;
    tongCongNo: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM DonHang) AS tongDonHang,
      (SELECT COUNT(*) FROM DonHang WHERE trangThaiDon = N'cho_duyet') AS donChoDuyet,
      (SELECT COUNT(*) FROM DonHang WHERE trangThaiDon IN (N'da_duyet', N'dang_san_xuat', N'dang_giao', N'da_giao', N'nghiem_thu')) AS donDangXuLy,
      (SELECT COUNT(*) FROM DonHang WHERE trangThaiDon IN (N'da_thanh_toan', N'hoan_thanh')) AS donDaHoanThanh,
      (SELECT ISNULL(SUM(thanhTien), 0) FROM DonHang WHERE trangThaiDon IN (N'da_thanh_toan', N'hoan_thanh')) AS tongDoanhThu,
      (SELECT ISNULL(SUM(thanhTien - daThanhToan), 0) FROM DonHang WHERE (thanhTien - daThanhToan) > 0 AND trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')) AS tongCongNo
  `);

  const [donQuaHan] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon = N'hoan_thanh' AND daThanhToan < thanhTien AND DATEDIFF(DAY, ngayGiao, GETDATE()) > 30`
  );

  const r = results[0];
  return {
    tongDonHang: r?.tongDonHang || 0,
    donChoDuyet: r?.donChoDuyet || 0,
    donDangXuLy: r?.donDangXuLy || 0,
    donDaHoanThanh: r?.donDaHoanThanh || 0,
    tongDoanhThu: r?.tongDoanhThu || 0,
    tongCongNo: r?.tongCongNo || 0,
    donQuaHan: donQuaHan?.soLuong || 0,
  };
}

export async function layDoanhThuTheoThang(
  thangBatDau: string,
  thangKetThuc: string
): Promise<DoanhThuTheoThang[]> {
  // CONVERT(char(7), ngayTao, 120) = 'yyyy-MM' nhanh hon FORMAT() vi FORMAT() la scalar function ton computational
  return await query<DoanhThuTheoThang>(
    `SELECT
       CONVERT(char(7), ngayTao, 120) as thang,
       ISNULL(SUM(thanhTien), 0) as doanhThu,
       COUNT(*) as soDonHang
     FROM DonHang
     WHERE trangThaiDon IN (N'da_thanh_toan', N'hoan_thanh')
       AND CONVERT(char(7), ngayTao, 120) BETWEEN @thangBatDau AND @thangKetThuc
     GROUP BY CONVERT(char(7), ngayTao, 120)
     ORDER BY thang`,
    { thangBatDau, thangKetThuc }
  );
}

export async function layDonHangTheoTrangThai(): Promise<DonHangTheoTrangThai[]> {
  // Return all status types with 0 if no data
  const ALL_STATUSES = [
    'cho_duyet', 'da_duyet', 'tu_choi', 'dang_san_xuat',
    'dang_giao', 'da_giao', 'nghiem_thu', 'da_nghiem_thu',
    'da_thanh_toan', 'hoan_thanh'
  ];

  const data = await query<DonHangTheoTrangThai>(
    `SELECT trangThaiDon as trangThai, COUNT(*) as soLuong
     FROM DonHang
     GROUP BY trangThaiDon`
  );

  // Create map from existing data
  const dataMap: Record<string, number> = {};
  data.forEach(item => {
    dataMap[item.trangThai] = item.soLuong;
  });

  // Return all statuses with their counts (0 if not found)
  return ALL_STATUSES.map(status => ({
    trangThai: status,
    soLuong: dataMap[status] || 0
  }));
}
