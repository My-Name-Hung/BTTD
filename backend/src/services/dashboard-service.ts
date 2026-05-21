import { query } from '../config/database';
import {
  ThongKeDashboard,
  DoanhThuTheoThang,
  DonHangTheoTrangThai,
} from '../models';

export async function layThongKeDashboard(): Promise<ThongKeDashboard> {
  // Gộp 7 query COUNT riêng lẻ thành 1 query duy nhất — giảm 6 round-trip DB
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
      (SELECT COUNT(*) FROM DonHang WHERE trangThaiDon NOT IN (N'cho_duyet', N'nghiem_thu', N'da_thanh_toan', N'tu_choi')) AS donDangXuLy,
      (SELECT COUNT(*) FROM DonHang WHERE trangThaiHoanThanh = N'da_hoan_thanh') AS donDaHoanThanh,
      (SELECT ISNULL(SUM(thanhTien), 0) FROM DonHang WHERE trangThaiDon = N'da_thanh_toan') AS tongDoanhThu,
      (SELECT ISNULL(SUM(conLai), 0) FROM DonHang WHERE conLai > 0 AND trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')) AS tongCongNo
  `);

  const [donQuaHan] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM CongNo WHERE trangThai = N'qua_han'`
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
     WHERE trangThaiDon = N'da_thanh_toan'
       AND CONVERT(char(7), ngayTao, 120) BETWEEN @thangBatDau AND @thangKetThuc
     GROUP BY CONVERT(char(7), ngayTao, 120)
     ORDER BY thang`,
    { thangBatDau, thangKetThuc }
  );
}

export async function layDonHangTheoTrangThai(): Promise<DonHangTheoTrangThai[]> {
  return await query<DonHangTheoTrangThai>(
    `SELECT trangThaiDon as trangThai, COUNT(*) as soLuong
     FROM DonHang
     GROUP BY trangThaiDon`
  );
}
