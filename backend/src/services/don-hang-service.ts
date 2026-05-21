import { query } from '../config/database';
import { DonHang, ApiResponseWithPagination } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { guiEmailThongBaoDonMoi } from './email-service';
import { guiThongBao } from './thong-bao-service';
import { config } from '../config';

export async function layTatCaDonHang(
  page: number = 1,
  limit: number = 20,
  trangThai?: string,
  tuKhoa?: string
): Promise<ApiResponseWithPagination<DonHang[]>> {
  const offset = (page - 1) * limit;
  let whereClause = 'WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (trangThai) {
    whereClause += ' AND trangThaiDon = @trangThai';
    params.trangThai = trangThai;
  }

  if (tuKhoa) {
    whereClause += ' AND (maDonHang LIKE @tuKhoa OR tenKhachHang LIKE @tuKhoa OR diaChiNhan LIKE @tuKhoa)';
    params.tuKhoa = `%${tuKhoa}%`;
  }

  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM DonHang ${whereClause}`,
    params
  );
  const total = countResult[0]?.total || 0;

  const donHangs = await query<DonHang>(
    `SELECT d.*, t.tenTram as tenTramTron
     FROM DonHang d
     LEFT JOIN TramTron t ON d.idTramTron = t.id
     ${whereClause}
     ORDER BY d.ngayTao DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    { ...params, offset, limit }
  );

  return {
    success: true,
    message: 'Lấy danh sách đơn hàng thành công',
    data: donHangs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function layDonHangTheoId(id: number): Promise<DonHang> {
  const donHangs = await query<DonHang>(
    `SELECT d.*, t.tenTram as tenTramTron
     FROM DonHang d
     LEFT JOIN TramTron t ON d.idTramTron = t.id
     WHERE d.id = @id`,
    { id }
  );

  if (donHangs.length === 0) {
    throw new Error('Không tìm thấy đơn hàng');
  }

  return donHangs[0];
}

export async function taoDonHang(data: Partial<DonHang>, nguoiTaoId: number): Promise<DonHang> {
  const maDonHang = `DH${Date.now().toString().slice(-8)}-${uuidv4().slice(0, 4).toUpperCase()}`;
  const thanhTien = (data.khoiLuongDat || 0) * (data.donGia || 0);
  const conLai = thanhTien;

  const result = await query<DonHang>(
    `INSERT INTO DonHang (
      maDonHang, idKhachHang, idMacBeTong, idTramTron,
      tenKhachHang, diaChiNhan, soDienThoai,
      tenMacBeTong, khoiLuongDat, donGia, thanhTien, conLai,
      thoiGianGiaoDuKien, trangThaiDon, trangThaiHoanThanh,
      nguoiTaoId, ghiChu
    ) VALUES (
      @maDonHang, @idKhachHang, @idMacBeTong, @idTramTron,
      @tenKhachHang, @diaChiNhan, @soDienThoai,
      @tenMacBeTong, @khoiLuongDat, @donGia, @thanhTien, @conLai,
      @thoiGianGiaoDuKien, N'cho_duyet', N'chua_hoan_thanh',
      @nguoiTaoId, @ghiChu
    );
    SELECT * FROM DonHang WHERE id = SCOPE_IDENTITY();`,
    {
      maDonHang,
      idKhachHang: data.idKhachHang || null,
      idMacBeTong: data.idMacBeTong || null,
      idTramTron: data.idTramTron || null,
      tenKhachHang: data.tenKhachHang || '',
      diaChiNhan: data.diaChiNhan || '',
      soDienThoai: data.soDienThoai || '',
      tenMacBeTong: data.tenMacBeTong || '',
      khoiLuongDat: data.khoiLuongDat || 0,
      donGia: data.donGia || 0,
      thanhTien,
      conLai,
      thoiGianGiaoDuKien: data.thoiGianGiaoDuKien || null,
      nguoiTaoId,
      ghiChu: data.ghiChu || null,
    }
  );

  const donHangMoi = result[0];

  // Gửi thông báo realtime qua Socket.IO cho kế toán và admin
  guiThongBao('NEW_ORDER', {
    id: donHangMoi.id,
    maDonHang: donHangMoi.maDonHang,
    tenKhachHang: data.tenKhachHang || '',
  });

  // Gửi email thông báo
  try {
    await guiEmailThongBaoDonMoi(
      config.email.adminEmail,
      maDonHang,
      data.tenKhachHang || '',
      String(data.khoiLuongDat || 0),
      data.diaChiNhan || ''
    );
  } catch (emailError) {
    console.error('Lỗi gửi email thông báo:', emailError);
  }

  return donHangMoi;
}

export async function suaDonHang(id: number, data: Partial<DonHang>): Promise<DonHang> {
  const existing = await layDonHangTheoId(id);

  if (existing.trangThaiDon !== 'cho_duyet') {
    throw new Error('Chỉ có thể sửa đơn hàng đang chờ duyệt');
  }

  const thanhTien = (data.khoiLuongDat || existing.khoiLuongDat) * (data.donGia || existing.donGia);

  await query(
    `UPDATE DonHang SET
      idKhachHang = @idKhachHang, idMacBeTong = @idMacBeTong, idTramTron = @idTramTron,
      tenKhachHang = @tenKhachHang, diaChiNhan = @diaChiNhan, soDienThoai = @soDienThoai,
      tenMacBeTong = @tenMacBeTong, khoiLuongDat = @khoiLuongDat, donGia = @donGia,
      thanhTien = @thanhTien, conLai = @conLai, thoiGianGiaoDuKien = @thoiGianGiaoDuKien,
      ghiChu = @ghiChu, ngayCapNhat = GETDATE()
     WHERE id = @id`,
    {
      id,
      idKhachHang: data.idKhachHang ?? existing.idKhachHang,
      idMacBeTong: data.idMacBeTong ?? existing.idMacBeTong,
      idTramTron: data.idTramTron ?? existing.idTramTron,
      tenKhachHang: data.tenKhachHang ?? existing.tenKhachHang,
      diaChiNhan: data.diaChiNhan ?? existing.diaChiNhan,
      soDienThoai: data.soDienThoai ?? existing.soDienThoai,
      tenMacBeTong: data.tenMacBeTong ?? existing.tenMacBeTong,
      khoiLuongDat: data.khoiLuongDat ?? existing.khoiLuongDat,
      donGia: data.donGia ?? existing.donGia,
      thanhTien,
      conLai: thanhTien - existing.daThanhToan,
      thoiGianGiaoDuKien: data.thoiGianGiaoDuKien ?? existing.thoiGianGiaoDuKien,
      ghiChu: data.ghiChu ?? existing.ghiChu,
    }
  );

  return (await query<DonHang>(`SELECT d.*, t.tenTram as tenTramTron FROM DonHang d LEFT JOIN TramTron t ON d.idTramTron = t.id WHERE d.id = @id`, { id }))[0];
}

export async function duyetDonHang(id: number, nguoiDuyetId: number): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET
      trangThaiDon = N'da_duyet',
      ngayDuyet = GETDATE(),
      nguoiDuyetId = @nguoiDuyetId,
      ngayCapNhat = GETDATE()
     WHERE id = @id`,
    { id, nguoiDuyetId }
  );

  const donHang = (await query<DonHang>(`SELECT d.*, t.tenTram as tenTramTron FROM DonHang d LEFT JOIN TramTron t ON d.idTramTron = t.id WHERE d.id = @id`, { id }))[0];

  guiThongBao('ORDER_APPROVED', { id, maDonHang: donHang.maDonHang });

  return donHang;
}

export async function tuChoiDonHang(id: number, lyDo: string): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET
      trangThaiDon = N'tu_choi',
      lyDoTuChoi = @lyDo,
      ngayCapNhat = GETDATE()
     WHERE id = @id`,
    { id, lyDo }
  );

  const donHang = (await query<DonHang>(`SELECT d.*, t.tenTram as tenTramTron FROM DonHang d LEFT JOIN TramTron t ON d.idTramTron = t.id WHERE d.id = @id`, { id }))[0];

  guiThongBao('ORDER_REJECTED', { id, maDonHang: donHang.maDonHang, lyDo });

  return donHang;
}

export async function capNhatTrangThaiDon(
  id: number,
  trangThaiDon: DonHang['trangThaiDon'],
  ghiChu?: string
): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET trangThaiDon = @trangThaiDon, ghiChu = @ghiChu, ngayCapNhat = GETDATE() WHERE id = @id`,
    { id, trangThaiDon, ghiChu: ghiChu || null }
  );

  const donHang = (await query<DonHang>(`SELECT d.*, t.tenTram as tenTramTron FROM DonHang d LEFT JOIN TramTron t ON d.idTramTron = t.id WHERE d.id = @id`, { id }))[0];

  // Gửi thông báo khi đơn hoàn thành
  if (trangThaiDon === 'da_hoan_thanh') {
    guiThongBao('ORDER_COMPLETED', { id, maDonHang: donHang.maDonHang });
  }

  return donHang;
}

export async function xoaDonHang(id: number): Promise<void> {
  const existing = await layDonHangTheoId(id);

  if (existing.trangThaiDon !== 'cho_duyet' && existing.trangThaiDon !== 'tu_choi') {
    throw new Error('Chỉ có thể xóa đơn hàng chưa duyệt hoặc đã từ chối');
  }

  await query(`DELETE FROM DonHang WHERE id = @id`, { id });
}
