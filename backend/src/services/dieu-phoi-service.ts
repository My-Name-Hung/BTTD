import { query } from '../config/database';
import { LichSanXuat, DonHang } from '../models';
import { guiThongBao } from './thong-bao-service';

export async function taoLichSanXuat(
  data: Partial<LichSanXuat>,
  nguoiTaoId: number
): Promise<LichSanXuat> {
  const donHang = await query<DonHang>(
    `SELECT * FROM DonHang WHERE id = @idDonHang`,
    { idDonHang: data.idDonHang }
  );

  if (donHang.length === 0) {
    throw new Error('Không tìm thấy đơn hàng');
  }

  await query(
    `UPDATE DonHang SET trangThaiDon = N'dang_san_xuat', ngayCapNhat = GETDATE() WHERE id = @id`,
    { id: data.idDonHang }
  );

  const result = await query<LichSanXuat>(
    `INSERT INTO LichSanXuat (
      idDonHang, idXe, kyThuatCongTrinh, nguoiOmOng, nguoiBatOng,
      phuongAnDo, bienSoXe, trangThai, ghiChu, driveLink
    ) VALUES (
      @idDonHang, @idXe, @kyThuatCongTrinh, @nguoiOmOng, @nguoiBatOng,
      @phuongAnDo, @bienSoXe, N'chua_san_xuat', @ghiChu, @driveLink
    );
    SELECT * FROM LichSanXuat WHERE id = SCOPE_IDENTITY();`,
    {
      idDonHang: data.idDonHang,
      idXe: data.idXe || null,
      kyThuatCongTrinh: data.kyThuatCongTrinh || null,
      nguoiOmOng: data.nguoiOmOng || null,
      nguoiBatOng: data.nguoiBatOng || null,
      phuongAnDo: data.phuongAnDo || null,
      bienSoXe: data.bienSoXe || null,
      ghiChu: data.ghiChu || null,
      driveLink: data.driveLink || null,
    }
  );

  // Thông báo cho kho: có đơn hàng cần giao
  guiThongBao('PRODUCTION_SCHEDULED', {
    id: data.idDonHang,
    maDonHang: donHang[0].maDonHang,
    tenKhachHang: donHang[0].tenKhachHang,
    khoiLuong: donHang[0].khoiLuongDat,
  });

  // Thông báo ORDER_STATUS_CHANGED - Đang sản xuất
  guiThongBao('ORDER_STATUS_CHANGED', {
    id: data.idDonHang,
    maDonHang: donHang[0].maDonHang,
    trangThai: 'dang_san_xuat',
    trangThaiLabel: 'Đang sản xuất',
  });

  return result[0];
}

export async function layLichSanXuatTheoDonHang(idDonHang: number): Promise<LichSanXuat[]> {
  return await query<LichSanXuat>(
    `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang ORDER BY ngayTao DESC`,
    { idDonHang }
  );
}

export async function layTatCaLichSanXuat(
  page: number = 1,
  limit: number = 50,
  trangThai?: string
): Promise<{ data: LichSanXuat[]; total: number }> {
  const offset = (page - 1) * limit;
  let whereClause = 'WHERE 1=1';
  const params: Record<string, unknown> = { offset, limit };

  if (trangThai) {
    whereClause += ' AND ls.trangThai = @trangThai';
    params.trangThai = trangThai;
  }

  const [countResult] = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM LichSanXuat ls ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  const data = await query<LichSanXuat>(
    `SELECT ls.*, dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong, dh.khoiLuongDat
     FROM LichSanXuat ls
     LEFT JOIN DonHang dh ON ls.idDonHang = dh.id
     ${whereClause}
     ORDER BY ls.ngayTao DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params
  );

  return { data, total };
}

export async function capNhatLichSanXuat(
  id: number,
  data: Partial<LichSanXuat>
): Promise<LichSanXuat> {
  await query(
    `UPDATE LichSanXuat SET
      idXe = @idXe, kyThuatCongTrinh = @kyThuatCongTrinh,
      nguoiOmOng = @nguoiOmOng, nguoiBatOng = @nguoiBatOng,
      phuongAnDo = @phuongAnDo, bienSoXe = @bienSoXe,
      thoiGianTron = @thoiGianTron, thoiGianXuatBen = @thoiGianXuatBen,
      thoiGianDenCangDat = @thoiGianDenCangDat,
      thoiGianBatDauDo = @thoiGianBatDauDo, thoiGianKetThucDo = @thoiGianKetThucDo,
      trangThai = @trangThai, ghiChu = @ghiChu, driveLink = @driveLink,
      ngayCapNhat = GETDATE()
     WHERE id = @id`,
    {
      id,
      idXe: data.idXe ?? null,
      kyThuatCongTrinh: data.kyThuatCongTrinh ?? null,
      nguoiOmOng: data.nguoiOmOng ?? null,
      nguoiBatOng: data.nguoiBatOng ?? null,
      phuongAnDo: data.phuongAnDo ?? null,
      bienSoXe: data.bienSoXe ?? null,
      thoiGianTron: data.thoiGianTron ?? null,
      thoiGianXuatBen: data.thoiGianXuatBen ?? null,
      thoiGianDenCangDat: data.thoiGianDenCangDat ?? null,
      thoiGianBatDauDo: data.thoiGianBatDauDo ?? null,
      thoiGianKetThucDo: data.thoiGianKetThucDo ?? null,
      trangThai: data.trangThai ?? 'chua_san_xuat',
      ghiChu: data.ghiChu ?? null,
      driveLink: data.driveLink ?? null,
    }
  );

  const [updated] = await query<LichSanXuat>(`SELECT * FROM LichSanXuat WHERE id = @id`, { id });

  if (data.trangThai === 'da_xong') {
    await query(
      `UPDATE DonHang SET trangThaiDon = N'dang_giao', ngayCapNhat = GETDATE() WHERE id = @id`,
      { id: updated.idDonHang }
    );

    // Lấy thông tin đơn hàng để thông báo
    const dh = await query<DonHang>(`SELECT * FROM DonHang WHERE id = @id`, { id: updated.idDonHang });

    // Thông báo ORDER_STATUS_CHANGED - Đang giao
    guiThongBao('ORDER_STATUS_CHANGED', {
      id: updated.idDonHang,
      maDonHang: dh[0].maDonHang,
      trangThai: 'dang_giao',
      trangThaiLabel: 'Đang giao',
    });

    // Thông báo cho kho bắt đầu giao
    guiThongBao('DELIVERY_STARTED', {
      id: updated.idDonHang,
      maDonHang: dh[0].maDonHang,
      bienSoXe: data.bienSoXe || '',
    });
  }

  return updated;
}

export async function xacNhanDaGiao(idDonHang: number): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET
      trangThaiDon = N'da_giao',
      ngayGiao = GETDATE(),
      ngayCapNhat = GETDATE()
     WHERE id = @id`,
    { id: idDonHang }
  );

  const donHang = await query<DonHang>(`SELECT * FROM DonHang WHERE id = @id`, { id: idDonHang });

  // Thông báo ORDER_STATUS_CHANGED - Đã giao
  guiThongBao('ORDER_STATUS_CHANGED', {
    id: idDonHang,
    maDonHang: donHang[0].maDonHang,
    trangThai: 'da_giao',
    trangThaiLabel: 'Đã giao',
  });

  // Thông báo chờ nghiệm thu
  guiThongBao('DELIVERY_COMPLETED', {
    id: idDonHang,
    maDonHang: donHang[0].maDonHang,
    khoiLuong: donHang[0].khoiLuongThucTe || donHang[0].khoiLuongDat,
  });

  return donHang[0];
}
