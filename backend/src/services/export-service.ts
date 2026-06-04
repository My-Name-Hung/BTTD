import { query } from '../config/database';
import { DonHang, NguoiDung, KhachHang, MacBeTong, TramTron, Xe, LichSanXuat } from '../models';

// ==================== ĐƠN HÀNG ====================
export interface ExportDonHang {
  id: number;
  maDonHang: string;
  tenKhachHang: string;
  diaChiNhan: string;
  soDienThoai: string;
  tenMacBeTong: string | null;
  tenTramTron: string | null;
  khoiLuongDat: number;
  khoiLuongThucTe: number | null;
  donGia: number;
  thanhTien: number | null;
  daThanhToan: number;
  conLai: number | null;
  thoiGianGiaoDuKien: string | null;
  ngayTaoDon: string;
  trangThaiDon: string;
  // User info (chỉ admin/ke_toan)
  maNguoiTao: string | null;
  tenNguoiTao: string | null;
  maNguoiDuyet: string | null;
  tenNguoiDuyet: string | null;
}

export async function layDonHangExport(
  vaiTro: string,
  userId: number,
  trangThai?: string,
  tuKhoa?: string
): Promise<ExportDonHang[]> {
  let whereClause = 'WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (trangThai) {
    whereClause += ' AND d.trangThaiDon = @trangThai';
    params.trangThai = trangThai;
  }

  if (tuKhoa) {
    whereClause += ' AND (d.maDonHang LIKE @tuKhoa OR d.tenKhachHang LIKE @tuKhoa OR d.diaChiNhan LIKE @tuKhoa)';
    params.tuKhoa = `%${tuKhoa}%`;
  }

  // Phân quyền: sale/dieu_phoi chỉ xem đơn của mình
  if (vaiTro === 'sale' || vaiTro === 'dieu_phoi') {
    whereClause += ' AND d.nguoiTaoId = @nguoiTaoId';
    params.nguoiTaoId = userId;
  }

  const data = await query<any>(
    `SELECT d.id, d.maDonHang, d.tenKhachHang, d.diaChiNhan, d.soDienThoai,
            d.tenMacBeTong, t.tenTram as tenTramTron,
            d.khoiLuongDat, d.khoiLuongThucTe, d.donGia, d.thanhTien,
            d.daThanhToan, d.conLai,
            d.thoiGianGiaoDuKien, d.ngayTaoDon, d.trangThaiDon,
            nt.tenDangNhap as maNguoiTao, nt.hoTen as tenNguoiTao,
            nd.tenDangNhap as maNguoiDuyet, nd.hoTen as tenNguoiDuyet
     FROM DonHang d
     LEFT JOIN TramTron t ON d.idTramTron = t.id
     LEFT JOIN NguoiDung nt ON d.nguoiTaoId = nt.id
     LEFT JOIN NguoiDung nd ON d.nguoiDuyetId = nd.id
     ${whereClause}
     ORDER BY d.ngayTao DESC`,
    params
  );

  return data.map((dh: any) => ({
    ...dh,
    thoiGianGiaoDuKien: dh.thoiGianGiaoDuKien ? new Date(dh.thoiGianGiaoDuKien).toISOString() : null,
    ngayTaoDon: dh.ngayTaoDon ? new Date(dh.ngayTaoDon).toISOString() : null,
  }));
}

// ==================== KHÁCH HÀNG ====================
export interface ExportKhachHang {
  id: number;
  maKhachHang: string | null;
  tenKhachHang: string;
  nhom: string | null;
  diaChi: string | null;
  soDienThoai: string | null;
  email: string | null;
  ghiChu: string | null;
}

export async function layKhachHangExport(): Promise<ExportKhachHang[]> {
  const data = await query<any>(
    `SELECT id, maKhachHang, tenKhachHang, nhom, diaChi, soDienThoai, email, ghiChu
     FROM KhachHang
     ORDER BY tenKhachHang ASC`
  );
  return data;
}

// ==================== MÁC BÊ TÔNG ====================
export interface ExportMacBeTong {
  id: number;
  tenMac: string;
  donGia: number;
  moTa: string | null;
}

export async function layMacBeTongExport(): Promise<ExportMacBeTong[]> {
  const data = await query<any>(
    `SELECT id, tenMac, donGia, moTa
     FROM MacBeTong
     ORDER BY tenMac ASC`
  );
  return data;
}

// ==================== TRẠM TRỘN ====================
export interface ExportTramTron {
  id: number;
  tenTram: string;
  diaChi: string | null;
  soDienThoai: string | null;
  trangThai: string;
}

export async function layTramTronExport(): Promise<ExportTramTron[]> {
  const data = await query<any>(
    `SELECT id, tenTram, diaChi, soDienThoai, trangThai
     FROM TramTron
     ORDER BY tenTram ASC`
  );
  return data;
}

// ==================== XE ====================
export interface ExportXe {
  id: number;
  bienSo: string;
  tenTaiXe: string | null;
  soDienThoai: string | null;
  trangThai: string;
}

export async function layXeExport(): Promise<ExportXe[]> {
  const data = await query<any>(
    `SELECT x.id, x.bienSo, nd.hoTen as tenTaiXe, nd.soDienThoai, x.trangThai
     FROM Xe x
     LEFT JOIN NguoiDung nd ON x.idTaiKhoan = nd.id
     ORDER BY x.bienSo ASC`
  );
  return data;
}

// ==================== NGƯỜI DÙNG ====================
export interface ExportNguoiDung {
  id: number;
  tenDangNhap: string;
  hoTen: string | null;
  email: string | null;
  soDienThoai: string | null;
  vaiTro: string;
  trangThai: string;
  ngayTao: string;
}

export async function layNguoiDungExport(): Promise<ExportNguoiDung[]> {
  const data = await query<any>(
    `SELECT id, tenDangNhap, hoTen, email, soDienThoai, vaiTro, trangThai, ngayTao
     FROM NguoiDung
     ORDER BY id DESC`
  );
  return data.map((nd: any) => ({
    ...nd,
    ngayTao: nd.ngayTao ? new Date(nd.ngayTao).toISOString() : null,
  }));
}

// ==================== LỊCH SẢN XUẤT ====================
export interface ExportLichSanXuat {
  id: number;
  maDonHang: string | null;
  tenKhachHang: string | null;
  tenMacBeTong: string | null;
  khoiLuongDat: number | null;
  bienSoXe: string | null;
  tenTaiXe: string | null;
  trangThai: string;
  thoiGianTron: string | null;
  thoiGianXuatBen: string | null;
  diaChiNhan: string | null;
}

export async function layLichSanXuatExport(trangThai?: string): Promise<ExportLichSanXuat[]> {
  let whereClause = '';
  const params: Record<string, unknown> = {};

  if (trangThai) {
    whereClause = 'WHERE ls.trangThai = @trangThai';
    params.trangThai = trangThai;
  }

  const data = await query<any>(
    `SELECT ls.id, dh.maDonHang, dh.tenKhachHang, dh.tenMacBeTong, dh.khoiLuongDat,
            ls.bienSoXe, nd.hoTen as tenTaiXe, ls.trangThai,
            ls.thoiGianTron, ls.thoiGianXuatBen, dh.diaChiNhan
     FROM LichSanXuat ls
     LEFT JOIN DonHang dh ON ls.idDonHang = dh.id
     LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
     ${whereClause}
     ORDER BY ls.id DESC`,
    params
  );

  return data.map((ls: any) => ({
    ...ls,
    thoiGianTron: ls.thoiGianTron ? new Date(ls.thoiGianTron).toISOString() : null,
    thoiGianXuatBen: ls.thoiGianXuatBen ? new Date(ls.thoiGianXuatBen).toISOString() : null,
  }));
}

// ==================== THANH TOÁN ====================
export interface ExportThanhToan {
  id: number;
  maDonHang: string;
  tenKhachHang: string;
  tenMacBeTong: string | null;
  khoiLuongDat: number;
  thanhTien: number | null;
  daThanhToan: number;
  conLai: number | null;
  ngayTaoDon: string;
}

export async function layThanhToanExport(): Promise<ExportThanhToan[]> {
  const data = await query<any>(
    `SELECT dh.id, dh.maDonHang, dh.tenKhachHang, dh.tenMacBeTong, dh.khoiLuongDat,
            dh.thanhTien, dh.daThanhToan, dh.conLai, dh.ngayTaoDon
     FROM DonHang dh
     WHERE dh.trangThaiDon NOT IN ('tu_choi', 'cho_duyet')
     ORDER BY dh.ngayTaoDon DESC`
  );

  return data.map((dh: any) => ({
    ...dh,
    ngayTaoDon: dh.ngayTaoDon ? new Date(dh.ngayTaoDon).toISOString() : null,
  }));
}

// ==================== CÔNG NỢ ====================
export interface ExportCongNo {
  id: number;
  nhom: string | null;
  maKhachHang: string | null;
  tenKhachHang: string;
  duDauNo: number;
  duDauCo: number;
  phatSinhNo: number;
  phatSinhCo: number;
  duCuoiNo: number;
  duCuoiCo: number;
}

export async function layCongNoExport(): Promise<ExportCongNo[]> {
  // Lấy danh sách khách hàng
  const khachHangs = await query<any>(
    `SELECT id, maKhachHang, tenKhachHang, nhom
     FROM KhachHang
     ORDER BY tenKhachHang ASC`
  );

  // Lấy tất cả đơn hàng đã duyệt (không từ chối)
  const donHangs = await query<any>(
    `SELECT id, tenKhachHang, thanhTien, daThanhToan
     FROM DonHang
     WHERE trangThaiDon NOT IN ('tu_choi')`
  );

  // Lấy tất cả thanh toán
  const thanhToans = await query<any>(
    `SELECT tt.id, dh.tenKhachHang, tt.soTien
     FROM ThanhToan tt
     LEFT JOIN DonHang dh ON tt.idDonHang = dh.id`
  );

  // Tính công nợ theo từng khách hàng
  const result: ExportCongNo[] = [];

  for (const kh of khachHangs) {
    // Lọc đơn hàng của khách hàng này (theo tên)
    const dhCuaKH = donHangs.filter((dh: any) => dh.tenKhachHang === kh.tenKhachHang);
    const ttCuaKH = thanhToans.filter((tt: any) => tt.tenKhachHang === kh.tenKhachHang);

    // Tính dư đầu (giả định = 0)
    const duDauNo = 0;
    const duDauCo = 0;

    // Phát sinh nợ = tổng (thành tiền - đã thanh toán) của đơn hàng
    let phatSinhNo = 0;
    for (const dh of dhCuaKH) {
      const conLai = (dh.thanhTien || 0) - (dh.daThanhToan || 0);
      if (conLai > 0) phatSinhNo += conLai;
    }

    // Phát sinh có = tổng số tiền thanh toán
    let phatSinhCo = 0;
    for (const tt of ttCuaKH) {
      phatSinhCo += tt.soTien || 0;
    }

    result.push({
      id: kh.id,
      nhom: kh.nhom || null,
      maKhachHang: kh.maKhachHang || null,
      tenKhachHang: kh.tenKhachHang,
      duDauNo,
      duDauCo,
      phatSinhNo: Math.round(phatSinhNo * 100) / 100,
      phatSinhCo: Math.round(phatSinhCo * 100) / 100,
      duCuoiNo: Math.round((duDauNo + phatSinhNo) * 100) / 100,
      duCuoiCo: Math.round((duDauCo + phatSinhCo) * 100) / 100,
    });
  }

  return result;
}
