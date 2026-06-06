import { query } from '../config/database';

/**
 * Batch API endpoints for optimized frontend performance
 * Reduces N+1 queries by fetching multiple records in a single request
 */

// ============================================================
// BATCH: Lịch sản xuất theo nhiều đơn hàng
// ============================================================
export interface BatchLichSanXuatResult {
  [idDonHang: number]: {
    id: number;
    idDonHang: number;
    idXe: number | null;
    bienSoXe: string | null;
    tenTaiXe: string | null;
    trangThai: string | null;
    ngayTao: string | null;
  } | null;
}

export async function layLichSanXuatBatch(idDonHangs: number[]): Promise<BatchLichSanXuatResult> {
  if (!idDonHangs || idDonHangs.length === 0) {
    return {};
  }

  // Tạo placeholders cho IN clause
  const placeholders = idDonHangs.map((_, i) => `@id${i}`).join(', ');
  const params: Record<string, number> = {};
  idDonHangs.forEach((id, i) => {
    params[`id${i}`] = id;
  });

  const results = await query<{
    idDonHang: number;
    id: number;
    idXe: number | null;
    bienSoXe: string | null;
    tenTaiXe: string | null;
    trangThai: string | null;
    ngayTao: string | null;
  }>(
    `SELECT 
       ls.idDonHang,
       ls.id,
       ls.idXe,
       ls.bienSoXe,
       nd.hoTen as tenTaiXe,
       ls.trangThai,
       CONVERT(varchar, ls.ngayTao, 120) as ngayTao
     FROM LichSanXuat ls
     LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
     WHERE ls.idDonHang IN (${placeholders})
     AND ls.id IN (
       SELECT TOP 1 id FROM LichSanXuat ls2 
       WHERE ls2.idDonHang = ls.idDonHang 
       ORDER BY ls2.ngayTao DESC
     )`,
    params
  );

  // Transform thành map theo idDonHang
  const result: BatchLichSanXuatResult = {};
  idDonHangs.forEach(id => {
    result[id] = null;
  });
  results.forEach(r => {
    result[r.idDonHang] = r;
  });

  return result;
}

// ============================================================
// BATCH: Lịch sử thanh toán theo nhiều đơn hàng
// ============================================================
export interface BatchThanhToanResult {
  [idDonHang: number]: Array<{
    id: number;
    idDonHang: number;
    soTien: number;
    ngayThanhToan: string;
    hinhThuc: string | null;
    ghiChu: string | null;
    nguoiTaoHoTen: string | null;
  }>;
}

export async function layThanhToanBatch(idDonHangs: number[]): Promise<BatchThanhToanResult> {
  if (!idDonHangs || idDonHangs.length === 0) {
    return {};
  }

  const placeholders = idDonHangs.map((_, i) => `@id${i}`).join(', ');
  const params: Record<string, number> = {};
  idDonHangs.forEach((id, i) => {
    params[`id${i}`] = id;
  });

  const results = await query<{
    idDonHang: number;
    id: number;
    soTien: number;
    ngayThanhToan: string;
    hinhThuc: string | null;
    ghiChu: string | null;
    nguoiTaoHoTen: string | null;
  }>(
    `SELECT 
       tt.idDonHang,
       tt.id,
       tt.soTien,
       CONVERT(varchar, tt.ngayThanhToan, 120) as ngayThanhToan,
       tt.hinhThuc,
       tt.ghiChu,
       nd.hoTen as nguoiTaoHoTen
     FROM ThanhToan tt
     LEFT JOIN NguoiDung nd ON tt.nguoiTaoId = nd.id
     WHERE tt.idDonHang IN (${placeholders})
     ORDER BY tt.ngayThanhToan DESC`,
    params
  );

  const result: BatchThanhToanResult = {};
  idDonHangs.forEach(id => {
    result[id] = [];
  });
  results.forEach(r => {
    result[r.idDonHang].push({
      id: r.id,
      idDonHang: r.idDonHang,
      soTien: r.soTien,
      ngayThanhToan: r.ngayThanhToan,
      hinhThuc: r.hinhThuc,
      ghiChu: r.ghiChu,
      nguoiTaoHoTen: r.nguoiTaoHoTen,
    });
  });

  return result;
}

// ============================================================
// BATCH: Hóa đơn theo nhiều đơn hàng
// ============================================================
export interface HoaDonBatchItem {
  id: number;
  idDonHang: number;
  soHoaDon: string | null;
  tongCong: number;
  giamTru: number | null;
  loaiThanhToan: string | null;
  ngayTao: string;
  tenNguoiTao: string | null;
}

export interface BatchHoaDonResult {
  [idDonHang: number]: HoaDonBatchItem[] | null;
}

export async function layHoaDonBatch(idDonHangs: number[]): Promise<BatchHoaDonResult> {
  if (!idDonHangs || idDonHangs.length === 0) {
    return {};
  }

  const placeholders = idDonHangs.map((_, i) => `@id${i}`).join(', ');
  const params: Record<string, number> = {};
  idDonHangs.forEach((id, i) => {
    params[`id${i}`] = id;
  });

  const results = await query<HoaDonBatchItem>(
    `SELECT
       hd.idDonHang,
       hd.id,
       hd.soHoaDon,
       hd.tongCong,
       hd.giamTru,
       hd.loaiThanhToan,
       CONVERT(varchar, hd.ngayTao, 120) as ngayTao,
       nd.hoTen as tenNguoiTao
     FROM HoaDon hd
     LEFT JOIN NguoiDung nd ON hd.nguoiTaoId = nd.id
     WHERE hd.idDonHang IN (${placeholders})
     ORDER BY hd.idDonHang, hd.ngayTao ASC`,
    params
  );

  const result: BatchHoaDonResult = {};
  idDonHangs.forEach(id => {
    result[id] = [];
  });
  results.forEach(r => {
    if (!result[r.idDonHang]) {
      result[r.idDonHang] = [];
    }
    result[r.idDonHang]!.push({
      id: r.id,
      idDonHang: r.idDonHang,
      soHoaDon: r.soHoaDon,
      tongCong: r.tongCong,
      giamTru: r.giamTru,
      loaiThanhToan: r.loaiThanhToan,
      ngayTao: r.ngayTao,
      tenNguoiTao: r.tenNguoiTao,
    });
  });

  return result;
}

// ============================================================
// BATCH: Nghiệm thu theo nhiều đơn hàng
// ============================================================
export interface BatchNghiemThuResult {
  [idDonHang: number]: {
    id: number;
    idDonHang: number;
    ketQua: string;
    ngayNghiemThu: string;
    tenNguoiNghiemThu: string | null;
    ghiChu: string | null;
    bienBanFile: string | null;
  } | null;
}

export async function layNghiemThuBatch(idDonHangs: number[]): Promise<BatchNghiemThuResult> {
  if (!idDonHangs || idDonHangs.length === 0) {
    return {};
  }

  const placeholders = idDonHangs.map((_, i) => `@id${i}`).join(', ');
  const params: Record<string, number> = {};
  idDonHangs.forEach((id, i) => {
    params[`id${i}`] = id;
  });

  const results = await query<{
    idDonHang: number;
    id: number;
    ketQua: string;
    ngayNghiemThu: string;
    tenNguoiNghiemThu: string | null;
    ghiChu: string | null;
    bienBanFile: string | null;
  }>(
    `SELECT 
       nt.idDonHang,
       nt.id,
       nt.chatLuong as ketQua,
       CONVERT(varchar, nt.ngayNghiemThu, 120) as ngayNghiemThu,
       nt.tenNguoiNghiemThu,
       nt.ghiChu,
       nt.bienBanFile
     FROM NghiemThu nt
     WHERE nt.idDonHang IN (${placeholders})`,
    params
  );

  const result: BatchNghiemThuResult = {};
  idDonHangs.forEach(id => {
    result[id] = null;
  });
  results.forEach(r => {
    if (!result[r.idDonHang]) {
      result[r.idDonHang] = r;
    }
  });

  return result;
}
