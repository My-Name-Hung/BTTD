import { query, vnNow } from '../config/database';
import { ApiResponseWithPagination, DonHang, CongNo, ThongKeDashboard, DoanhThuTheoThang, DonHangTheoTrangThai } from '../models';

// ============================================================
// Dashboard lãnh đạo — thống kê tổng quan
// ============================================================

export async function layThongKeLanhDao(): Promise<ThongKeDashboard> {
  const [tongDonHang] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon <> N'tu_choi'`
  );

  const [donChoDuyet] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon = N'cho_duyet'`
  );

  const [donDangXuLy] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon IN (N'da_duyet', N'dang_san_xuat', N'dang_giao', N'da_giao', N'nghiem_thu')`
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

// ============================================================
// Doanh thu theo tháng (leader)
// ============================================================

export async function layDoanhThuLanhDao(
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

// ============================================================
// Doanh thu theo mác bê tông
// ============================================================

export interface DoanhThuTheoMac {
  tenMac: string;
  tongDoanhThu: number;
  soDonHang: number;
}

export async function layDoanhThuTheoMac(
  thangBatDau: string,
  thangKetThuc: string
): Promise<DoanhThuTheoMac[]> {
  return await query<DoanhThuTheoMac>(
    `SELECT
       ISNULL(dh.tenMacBeTong, N'Không xác định') as tenMac,
       ISNULL(SUM(dh.thanhTien), 0) as tongDoanhThu,
       COUNT(*) as soDonHang
     FROM DonHang dh
     WHERE dh.trangThaiDon = N'da_thanh_toan'
       AND FORMAT(dh.ngayTao, 'yyyy-MM') BETWEEN @thangBatDau AND @thangKetThuc
     GROUP BY dh.tenMacBeTong
     ORDER BY tongDoanhThu DESC`,
    { thangBatDau, thangKetThuc }
  );
}

// ============================================================
// Đơn hàng theo trạng thái
// ============================================================

export async function layDonHangTheoTrangThaiLanhDao(): Promise<DonHangTheoTrangThai[]> {
  return await query<DonHangTheoTrangThai>(
    `SELECT trangThaiDon as trangThai, COUNT(*) as soLuong
     FROM DonHang
     WHERE trangThaiDon <> N'tu_choi'
     GROUP BY trangThaiDon`
  );
}

// ============================================================
// Đơn đang xử lý (leader view)
// ============================================================

export async function layDonHangDangXuLyLanhDao(): Promise<DonHang[]> {
  return await query<DonHang>(
    `SELECT TOP 50
       dh.*,
       nd.hoTen as nguoiTaoHoTen,
       nd2.hoTen as nguoiDuyetHoTen
     FROM DonHang dh
     LEFT JOIN NguoiDung nd ON dh.nguoiTaoId = nd.id
     LEFT JOIN NguoiDung nd2 ON dh.nguoiDuyetId = nd2.id
     WHERE dh.trangThaiDon IN (N'da_duyet', N'dang_san_xuat', N'dang_giao', N'da_giao', N'nghiem_thu')
     ORDER BY dh.ngayCapNhat DESC`
  );
}

// ============================================================
// Trạng thái giao hàng
// ============================================================

export interface DonHangGiaoHang {
  id: number;
  maDonHang: string;
  tenKhachHang: string;
  diaChiNhan: string;
  soDienThoai: string;
  tenMacBeTong: string | null;
  khoiLuongDat: number;
  khoiLuongThucTe: number | null;
  thanhTien: number | null;
  thoiGianGiaoDuKien: string | null;
  ngayTaoDon: string;
  trangThaiDon: string;
  trangThaiLich: string | null;
  bienSoXe: string | null;
  tenTaiXe: string | null;
  soDienThoaiTaiXe: string | null;
}

export async function layDonHangGiaoHang(): Promise<DonHangGiaoHang[]> {
  return await query<DonHangGiaoHang>(
    `SELECT TOP 100
       dh.id,
       dh.maDonHang,
       dh.tenKhachHang,
       dh.diaChiNhan,
       dh.soDienThoai,
       dh.tenMacBeTong,
       dh.khoiLuongDat,
       dh.khoiLuongThucTe,
       dh.thanhTien,
       CONVERT(varchar, dh.thoiGianGiaoDuKien, 120) as thoiGianGiaoDuKien,
       CONVERT(varchar, dh.ngayTaoDon, 120) as ngayTaoDon,
       dh.trangThaiDon,
       ls.trangThai as trangThaiLich,
       ls.bienSoXe,
       xe.tenTaiXe,
       xe.soDienThoaiTaiXe
     FROM DonHang dh
     LEFT JOIN LichSanXuat ls ON dh.id = ls.idDonHang
       AND ls.id = (SELECT TOP 1 id FROM LichSanXuat WHERE idDonHang = dh.id ORDER BY ngayTao DESC)
     LEFT JOIN Xe xe ON ls.idXe = xe.id
     WHERE dh.trangThaiDon IN (N'dang_giao', N'da_giao', N'nghiem_thu', N'dang_san_xuat')
     ORDER BY dh.ngayCapNhat DESC`
  );
}

// ============================================================
// Công nợ tổng hợp
// ============================================================

export interface CongNoTongHop {
  id: number;
  maDonHang: string;
  tenKhachHang: string;
  tongTien: number;
  daThanhToan: number;
  conLai: number;
  ngayBatDau: string | null;
  hanThanhToan: string | null;
  trangThai: string;
  soNgayQuaHan: number;
  ghiChu: string | null;
  ngayTao: string;
}

export async function layTatCaCongNoLanhDao(): Promise<CongNoTongHop[]> {
  return await query<CongNoTongHop>(
    `SELECT
       cn.id,
       dh.maDonHang,
       dh.tenKhachHang,
       cn.tongTien,
       cn.daThanhToan,
       cn.conLai,
       CONVERT(varchar, cn.ngayBatDau, 103) as ngayBatDau,
       CONVERT(varchar, cn.hanThanhToan, 103) as hanThanhToan,
       cn.trangThai,
       CASE
         WHEN cn.trangThai = N'qua_han' THEN DATEDIFF(DAY, cn.hanThanhToan, GETUTCDATE())
         WHEN cn.hanThanhToan < GETUTCDATE() AND cn.trangThai <> N'da_thanh_toan' THEN DATEDIFF(DAY, cn.hanThanhToan, GETUTCDATE())
         ELSE 0
       END as soNgayQuaHan,
       cn.ghiChu,
       CONVERT(varchar, cn.ngayTao, 120) as ngayTao
     FROM CongNo cn
     JOIN DonHang dh ON cn.idDonHang = dh.id
     WHERE cn.conLai > 0
     ORDER BY
       CASE WHEN cn.trangThai = N'qua_han' THEN 0 ELSE 1 END,
       cn.conLai DESC`
  );
}

// ============================================================
// Cảnh báo đơn trễ / chưa thanh toán
// ============================================================

export interface CanhBaoDonHang {
  id: number;
  maDonHang: string;
  tenKhachHang: string;
  diaChiNhan: string;
  tenMacBeTong: string | null;
  khoiLuongDat: number;
  thanhTien: number | null;
  conLai: number;
  ngayTaoDon: string;
  thoiGianGiaoDuKien: string | null;
  trangThaiDon: string;
  loaiCanhBao: 'don_tre' | 'cong_no' | 'qua_han';
  moTa: string;
}

export async function layDanhSachCanhBao(): Promise<CanhBaoDonHang[]> {
  const results: CanhBaoDonHang[] = [];

  // Đơn trễ giao (quá thời gian giao dự kiến hơn 2 ngày)
  const donTre = await query<CanhBaoDonHang>(
    `SELECT TOP 20
       dh.id,
       dh.maDonHang,
       dh.tenKhachHang,
       dh.diaChiNhan,
       dh.tenMacBeTong,
       dh.khoiLuongDat,
       dh.thanhTien,
       dh.conLai,
       CONVERT(varchar, dh.ngayTaoDon, 120) as ngayTaoDon,
       CONVERT(varchar, dh.thoiGianGiaoDuKien, 120) as thoiGianGiaoDuKien,
       dh.trangThaiDon,
       'don_tre' as loaiCanhBao,
       N'Đơn hàng quá thời gian giao dự kiến ' +
         CAST(DATEDIFF(DAY, dh.thoiGianGiaoDuKien, GETUTCDATE()) AS NVARCHAR) +
         N' ngày' as moTa
     FROM DonHang dh
     WHERE dh.trangThaiDon NOT IN (N'da_thanh_toan', N'tu_choi')
       AND dh.thoiGianGiaoDuKien < DATEADD(DAY, -2, GETUTCDATE())
     ORDER BY dh.thoiGianGiaoDuKien ASC`
  );
  results.push(...donTre);

  // Công nợ chưa thanh toán
  const congNo = await query<CanhBaoDonHang>(
    `SELECT TOP 20
       dh.id,
       dh.maDonHang,
       dh.tenKhachHang,
       dh.diaChiNhan,
       dh.tenMacBeTong,
       dh.khoiLuongDat,
       dh.thanhTien,
       dh.conLai,
       CONVERT(varchar, dh.ngayTaoDon, 120) as ngayTaoDon,
       CONVERT(varchar, dh.thoiGianGiaoDuKien, 120) as thoiGianGiaoDuKien,
       dh.trangThaiDon,
       CASE WHEN cn.trangThai = N'qua_han' THEN 'qua_han' ELSE 'cong_no' END as loaiCanhBao,
       CASE
         WHEN cn.trangThai = N'qua_han' THEN N'Công nợ quá hạn thanh toán ' + CAST(DATEDIFF(DAY, cn.hanThanhToan, GETUTCDATE()) AS NVARCHAR) + N' ngày'
         ELSE N'Công nợ chưa thanh toán - Còn nợ ' + FORMAT(cn.conLai, 'N0') + N' đ'
       END as moTa
     FROM DonHang dh
     JOIN CongNo cn ON dh.id = cn.idDonHang
     WHERE dh.conLai > 0
       AND dh.trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')
     ORDER BY
       CASE WHEN cn.trangThai = N'qua_han' THEN 0 ELSE 1 END,
       cn.conLai DESC`
  );
  results.push(...congNo);

  return results.sort((a, b) => {
    if (a.loaiCanhBao === 'qua_han' && b.loaiCanhBao !== 'qua_han') return -1;
    if (b.loaiCanhBao === 'qua_han' && a.loaiCanhBao !== 'qua_han') return 1;
    return 0;
  });
}

// ============================================================
// Tổng hợp doanh thu
// ============================================================

export interface DoanhThuTongHop {
  tongDonHang: number;
  tongDoanhThu: number;
  tongCongNo: number;
  soDonQuaHan: number;
  doanhThuThangNay: number;
  doanhThuThangTruoc: number;
  tiLeTangTruong: number;
}

export async function layDoanhThuTongHop(): Promise<DoanhThuTongHop> {
  const thangNay = new Date().toISOString().slice(0, 7);
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const thangTruoc = d.toISOString().slice(0, 7);

  const [thangNayDT] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(thanhTien), 0) as tong FROM DonHang
     WHERE trangThaiDon = N'da_thanh_toan' AND FORMAT(ngayTao, 'yyyy-MM') = @thang`,
    { thang: thangNay }
  );

  const [thangTruocDT] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(thanhTien), 0) as tong FROM DonHang
     WHERE trangThaiDon = N'da_thanh_toan' AND FORMAT(ngayTao, 'yyyy-MM') = @thang`,
    { thang: thangTruoc }
  );

  const [tongCongNoData] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(conLai), 0) as tong FROM CongNo WHERE trangThai <> N'da_thanh_toan'`
  );

  const [soDonQuaHan] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM CongNo WHERE trangThai = N'qua_han'`
  );

  const [tongDon] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon = N'da_thanh_toan'`
  );

  const [tongDoanhThuData] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(thanhTien), 0) as tong FROM DonHang WHERE trangThaiDon = N'da_thanh_toan'`
  );

  const dtNay = thangNayDT?.tong || 0;
  const dtTruoc = thangTruocDT?.tong || 0;
  const tiLeTangTruong = dtTruoc > 0 ? ((dtNay - dtTruoc) / dtTruoc) * 100 : 0;

  return {
    tongDonHang: tongDon?.soLuong || 0,
    tongDoanhThu: tongDoanhThuData?.tong || 0,
    tongCongNo: tongCongNoData?.tong || 0,
    soDonQuaHan: soDonQuaHan?.soLuong || 0,
    doanhThuThangNay: dtNay,
    doanhThuThangTruoc: dtTruoc,
    tiLeTangTruong: Math.round(tiLeTangTruong * 10) / 10,
  };
}
