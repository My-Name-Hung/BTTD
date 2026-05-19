import { query } from '../config/database';
import { LichSanXuat, DonHang } from '../models';

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

  return result[0];
}

export async function layLichSanXuatTheoDonHang(idDonHang: number): Promise<LichSanXuat[]> {
  return await query<LichSanXuat>(
    `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang ORDER BY ngayTao DESC`,
    { idDonHang }
  );
}

export async function layTatCaLichSanXuat(): Promise<LichSanXuat[]> {
  return await query<LichSanXuat>(
    `SELECT * FROM LichSanXuat ORDER BY ngayTao DESC`
  );
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
  }

  return updated;
}

export async function xacNhanDaGiao(idDonHang: number, khoiLuongThucTe?: number): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET
      trangThaiDon = N'da_giao',
      khoiLuongThucTe = @khoiLuongThucTe,
      ngayGiao = GETDATE(),
      ngayCapNhat = GETDATE()
     WHERE id = @id`,
    { id: idDonHang, khoiLuongThucTe: khoiLuongThucTe || null }
  );

  return (await query<DonHang>(`SELECT * FROM DonHang WHERE id = @id`, { id: idDonHang }))[0];
}
