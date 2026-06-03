import { query } from '../config/database';
import {
  ThongKeDashboard,
  DoanhThuTheoThang,
  DonHangTheoTrangThai,
} from '../models';

export interface ThongKeThanhToan {
  daThanhToan: number;
  chuaThanhToan: number;
  congNo: number;
}

export interface ThongKeNghiemThu {
  daNghiemThu: number;
  chuaNghiemThu: number;
  dangNghiemThu: number;
}

export interface ThongKeTramTron {
  tramTron: string;
  soDonHang: number;
  doanhThu: number;
}

export interface CongNoTheoThang {
  thang: string;
  congNoCu: number;
  congNoMoi: number;
}

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

// Thống kê thanh toán
export async function layThongKeThanhToan(): Promise<ThongKeThanhToan> {
  const result = await query<ThongKeThanhToan>(`
    SELECT
      (SELECT ISNULL(SUM(daThanhToan), 0) FROM DonHang WHERE trangThaiDon IN (N'da_thanh_toan', N'hoan_thanh')) AS daThanhToan,
      (SELECT ISNULL(SUM(thanhTien - daThanhToan), 0) FROM DonHang WHERE (thanhTien - daThanhToan) > 0 AND trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')) AS chuaThanhToan,
      (SELECT ISNULL(SUM(thanhTien - daThanhToan), 0) FROM DonHang WHERE (thanhTien - daThanhToan) > 0 AND trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')) AS congNo
  `);
  return result[0] || { daThanhToan: 0, chuaThanhToan: 0, congNo: 0 };
}

// Thống kê nghiệm thu
export async function layThongKeNghiemThu(): Promise<ThongKeNghiemThu> {
  const result = await query<ThongKeNghiemThu>(`
    SELECT
      (SELECT COUNT(*) FROM DonHang WHERE trangThaiDon IN (N'da_nghiem_thu', N'da_thanh_toan', N'hoan_thanh')) AS daNghiemThu,
      (SELECT COUNT(*) FROM DonHang WHERE trangThaiDon IN (N'da_giao')) AS chuaNghiemThu,
      (SELECT COUNT(*) FROM DonHang WHERE trangThaiDon IN (N'nghiem_thu')) AS dangNghiemThu
  `);
  return result[0] || { daNghiemThu: 0, chuaNghiemThu: 0, dangNghiemThu: 0 };
}

// Thống kê theo trạm trộn
export async function layThongKeTheoTramTron(): Promise<ThongKeTramTron[]> {
  return await query<ThongKeTramTron>(`
    SELECT
      ISNULL(tt.tenTram, N'Không xác định') AS tramTron,
      COUNT(dh.id) AS soDonHang,
      ISNULL(SUM(dh.thanhTien), 0) AS doanhThu
    FROM DonHang dh
    LEFT JOIN TramTron tt ON dh.idTramTron = tt.id
    WHERE dh.trangThaiDon IN (N'da_thanh_toan', N'hoan_thanh')
    GROUP BY tt.tenTram
    ORDER BY doanhThu DESC
  `);
}

// Công nợ theo tháng (6 tháng gần nhất)
export async function layCongNoTheoThang(): Promise<CongNoTheoThang[]> {
  return await query<CongNoTheoThang>(`
    SELECT
      CONVERT(char(7), ngayTao, 120) as thang,
      ISNULL(SUM(thanhTien - daThanhToan), 0) as congNoCu
    FROM DonHang
    WHERE trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')
      AND CONVERT(char(7), ngayTao, 120) >= CONVERT(char(7), DATEADD(MONTH, -6, GETDATE()), 120)
    GROUP BY CONVERT(char(7), ngayTao, 120)
    ORDER BY thang
  `);
}
