import { query } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
  details: { row: number; message: string; data: Record<string, unknown> }[];
}

export interface ImportHistory {
  id: number;
  loai: string;
  tenFile: string;
  tongSo: number;
  thanhCong: number;
  thatBai: number;
  nguoiTaiId: number;
  nguoiTaiHoTen: string;
  ngayTai: Date;
}

// ===== Lịch sử import =====
export async function layLichSuImport(
  loai: string,
  page = 1,
  limit = 20,
  tuNgay?: string,
  denNgay?: string,
): Promise<{ data: ImportHistory[]; total: number }> {
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1 AND ih.loai = @loai';
  const params: Record<string, unknown> = { loai, offset, limit };

  if (tuNgay) {
    where += ' AND ih.ngayTai >= @tuNgay';
    params.tuNgay = tuNgay;
  }
  if (denNgay) {
    where += ' AND ih.ngayTai <= @denNgay';
    params.denNgay = denNgay + 'T23:59:59';
  }

  const [countRow] = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM ImportHistory ih ${where}`,
    params
  );

  const rows = await query<ImportHistory>(
    `SELECT ih.*, nd.hoTen as nguoiTaiHoTen
     FROM ImportHistory ih
     LEFT JOIN NguoiDung nd ON ih.nguoiTaiId = nd.id
     ${where}
     ORDER BY ih.ngayTai DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params
  );

  return { data: rows, total: countRow?.total || 0 };
}

async function ghiLichSuImport(
  loai: string,
  tenFile: string,
  tongSo: number,
  thanhCong: number,
  thatBai: number,
  nguoiTaiId: number,
): Promise<void> {
  await query(
    `INSERT INTO ImportHistory (loai, tenFile, tongSo, thanhCong, thatBai, nguoiTaiId)
     VALUES (@loai, @tenFile, @tongSo, @thanhCong, @thatBai, @nguoiTaiId)`,
    { loai, tenFile, tongSo, thanhCong, thatBai, nguoiTaiId }
  );
}

// ===== Import đơn hàng =====
export async function importDonHang(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult['errors'] = [];
  const details: ImportResult['details'] = [];
  let success = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      const tenKhachHang = String(r['Tên khách hàng'] || r['tenKhachHang'] || '').trim();
      const diaChiNhan = String(r['Địa chỉ nhận'] || r['diaChiNhan'] || '').trim();
      const soDienThoai = String(r['Số điện thoại'] || r['soDienThoai'] || '').trim();
      const tenMacBeTong = String(r['Tên mác bê tông'] || r['tenMacBeTong'] || '').trim();
      const khoiLuongDat = parseFloat(String(r['Khối lượng đặt'] || r['khoiLuongDat'] || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
      const donGia = parseFloat(String(r['Đơn giá'] || r['donGia'] || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
      const thoiGianGiaoDuKien = r['Thời gian giao dự kiến'] || r['thoiGianGiaoDuKien'] || null;
      const ghiChu = String(r['Ghi chú'] || r['ghiChu'] || '').trim();

      if (!tenKhachHang) {
        errors.push(`Dòng ${rowNum}: Thiếu tên khách hàng`);
        details.push({ row: rowNum, message: 'Thiếu tên khách hàng', data: r });
        continue;
      }
      if (!diaChiNhan) {
        errors.push(`Dòng ${rowNum}: Thiếu địa chỉ nhận`);
        details.push({ row: rowNum, message: 'Thiếu địa chỉ nhận', data: r });
        continue;
      }

      const maDonHang = `DH${Date.now().toString().slice(-8)}-${uuidv4().slice(0, 4).toUpperCase()}`;
      const thanhTien = khoiLuongDat * donGia;
      const conLai = thanhTien;

      const sql = `INSERT INTO DonHang (
          maDonHang, tenKhachHang, diaChiNhan, soDienThoai,
          tenMacBeTong, khoiLuongDat, donGia, thanhTien, conLai,
          thoiGianGiaoDuKien, trangThaiDon, trangThaiHoanThanh,
          nguoiTaoId, ghiChu
        ) VALUES (
          @maDonHang, @tenKhachHang, @diaChiNhan, @soDienThoai,
          @tenMacBeTong, @khoiLuongDat, @donGia, @thanhTien, @conLai,
          @thoiGianGiaoDuKien, N'cho_duyet', N'chua_hoan_thanh',
          @nguoiTaoId, @ghiChu
        )`;
      const params = {
          maDonHang,
          tenKhachHang,
          diaChiNhan,
          soDienThoai,
          tenMacBeTong,
          khoiLuongDat,
          donGia,
          thanhTien,
          conLai,
          thoiGianGiaoDuKien: thoiGianGiaoDuKien ? new Date(String(thoiGianGiaoDuKien)) : null,
          nguoiTaoId,
          ghiChu: ghiChu || null,
      };
      console.log(`[IMPORT] Row ${rowNum} - SQL:`, sql);
      console.log(`[IMPORT] Row ${rowNum} - Params:`, JSON.stringify(params));
      await query(sql, params);
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport('don_hang', tenFile, rows.length, success, failed, nguoiTaiId);
  return { total: rows.length, success, failed, errors, details };
}

// ===== Import khách hàng =====
export async function importKhachHang(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult['errors'] = [];
  const details: ImportResult['details'] = [];
  let success = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      const tenKhachHang = String(r['Tên khách hàng'] || r['tenKhachHang'] || '').trim();
      const diaChi = String(r['Địa chỉ'] || r['diaChi'] || '').trim();
      const soDienThoai = String(r['Số điện thoại'] || r['soDienThoai'] || '').trim();
      const email = String(r['Email'] || r['email'] || '').trim();
      const ghiChu = String(r['Ghi chú'] || r['ghiChu'] || '').trim();

      if (!tenKhachHang) {
        errors.push(`Dòng ${rowNum}: Thiếu tên khách hàng`);
        details.push({ row: rowNum, message: 'Thiếu tên khách hàng', data: r });
        continue;
      }

      await query(
        `INSERT INTO KhachHang (tenKhachHang, diaChi, soDienThoai, email, ghiChu)
         VALUES (@tenKhachHang, @diaChi, @soDienThoai, @email, @ghiChu)`,
        {
          tenKhachHang,
          diaChi: diaChi || null,
          soDienThoai: soDienThoai || null,
          email: email || null,
          ghiChu: ghiChu || null,
        }
      );
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport('khach_hang', tenFile, rows.length, success, failed, nguoiTaiId);
  return { total: rows.length, success, failed, errors, details };
}

// ===== Import người dùng =====
export async function importNguoiDung(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult['errors'] = [];
  const details: ImportResult['details'] = [];
  let success = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      const tenDangNhap = String(r['Tên đăng nhập'] || r['tenDangNhap'] || '').trim();
      const matKhau = String(r['Mật khẩu'] || r['matKhau'] || '').trim();
      const hoTen = String(r['Họ tên'] || r['hoTen'] || '').trim();
      const email = String(r['Email'] || r['email'] || '').trim();
      const soDienThoai = String(r['Số điện thoại'] || r['soDienThoai'] || '').trim();
      const vaiTro = String(r['Vai trò'] || r['vaiTro'] || 'ke_toan').trim().toLowerCase();

      if (!tenDangNhap) {
        errors.push(`Dòng ${rowNum}: Thiếu tên đăng nhập`);
        details.push({ row: rowNum, message: 'Thiếu tên đăng nhập', data: r });
        continue;
      }
      if (!matKhau) {
        errors.push(`Dòng ${rowNum}: Thiếu mật khẩu`);
        details.push({ row: rowNum, message: 'Thiếu mật khẩu', data: r });
        continue;
      }
      if (!hoTen) {
        errors.push(`Dòng ${rowNum}: Thiếu họ tên`);
        details.push({ row: rowNum, message: 'Thiếu họ tên', data: r });
        continue;
      }

      const validRoles = ['admin', 'ke_toan', 'dieu_phoi', 'lanh_dao'];
      const normalizedRole = validRoles.includes(vaiTro) ? vaiTro : 'ke_toan';

      const hashed = await bcrypt.hash(matKhau, 10);
      await query(
        `INSERT INTO NguoiDung (tenDangNhap, matKhau, hoTen, email, soDienThoai, vaiTro)
         VALUES (@tenDangNhap, @matKhau, @hoTen, @email, @soDienThoai, @vaiTro)`,
        {
          tenDangNhap,
          matKhau: hashed,
          hoTen,
          email: email || null,
          soDienThoai: soDienThoai || null,
          vaiTro: normalizedRole,
        }
      );
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport('nguoi_dung', tenFile, rows.length, success, failed, nguoiTaiId);
  return { total: rows.length, success, failed, errors, details };
}

// ===== Import phương tiện =====
export async function importPhuongTien(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult['errors'] = [];
  const details: ImportResult['details'] = [];
  let success = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      const bienSo = String(r['Biển số'] || r['bienSo'] || '').trim();
      const tenTaiXe = String(r['Tên tài xế'] || r['tenTaiXe'] || '').trim();
      const soDienThoaiTaiXe = String(r['SĐT tài xế'] || r['soDienThoaiTaiXe'] || '').trim();
      const taiTrong = parseFloat(String(r['Tải trọng'] || r['taiTrong'] || '0').replace(/[^\d.,]/g, '').replace(',', '.'));

      if (!bienSo) {
        errors.push(`Dòng ${rowNum}: Thiếu biển số xe`);
        details.push({ row: rowNum, message: 'Thiếu biển số xe', data: r });
        continue;
      }

      await query(
        `INSERT INTO Xe (bienSo, tenTaiXe, soDienThoaiTaiXe, taiTrong, trangThai)
         VALUES (@bienSo, @tenTaiXe, @soDienThoaiTaiXe, @taiTrong, N'san_sang')`,
        {
          bienSo: bienSo.toUpperCase(),
          tenTaiXe: tenTaiXe || null,
          soDienThoaiTaiXe: soDienThoaiTaiXe || null,
          taiTrong: taiTrong || null,
        }
      );
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport('phuong_tien', tenFile, rows.length, success, failed, nguoiTaiId);
  return { total: rows.length, success, failed, errors, details };
}
