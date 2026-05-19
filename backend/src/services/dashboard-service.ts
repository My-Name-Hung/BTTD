import { query } from '../config/database';
import {
  ThongKeDashboard,
  DoanhThuTheoThang,
  DonHangTheoTrangThai,
} from '../models';

export async function layThongKeDashboard(): Promise<ThongKeDashboard> {
  const [tongDonHang] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang`
  );

  const [donChoDuyet] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon = N'cho_duyet'`
  );

  const [donDangXuLy] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon NOT IN (N'cho_duyet', N'nghiem_thu', N'da_thanh_toan', N'tu_choi')`
  );

  const [donDaHoanThanh] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiHoanThanh = N'da_hoan_thanh'`
  );

  const [tongDoanhThu] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(thanhTien), 0) as tong FROM DonHang WHERE trangThaiDon = N'da_thanh_toan'`
  );

  const [tongCongNo] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(conLai), 0) as tong FROM DonHang WHERE conLai > 0 AND trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')`
  );

  const [donQuaHan] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM CongNo WHERE trangThai = N'qua_han'`
  );

  return {
    tongDonHang: tongDonHang?.soLuong || 0,
    donChoDuyet: donChoDuyet?.soLuong || 0,
    donDangXuLy: donDangXuLy?.soLuong || 0,
    donDaHoanThanh: donDaHoanThanh?.soLuong || 0,
    tongDoanhThu: tongDoanhThu?.tong || 0,
    tongCongNo: tongCongNo?.tong || 0,
    donQuaHan: donQuaHan?.soLuong || 0,
  };
}

export async function layDoanhThuTheoThang(
  thangBatDau: string,
  thangKetThuc: string
): Promise<DoanhThuTheoThang[]> {
  return await query<DoanhThuTheoThang>(
    `SELECT
       FORMAT(ngayTao, 'yyyy-MM') as thang,
       ISNULL(SUM(thanhTien), 0) as doanhThu,
       COUNT(*) as soDonHang
     FROM DonHang
     WHERE trangThaiDon = N'da_thanh_toan'
       AND FORMAT(ngayTao, 'yyyy-MM') BETWEEN @thangBatDau AND @thangKetThuc
     GROUP BY FORMAT(ngayTao, 'yyyy-MM')
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
