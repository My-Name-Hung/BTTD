import { query } from '../config/database';
import { NghiemThu, DonHang } from '../models';
import { guiThongBao } from './thong-bao-service';

export async function taoNghiemThu(data: Partial<NghiemThu>): Promise<NghiemThu> {
  const result = await query<NghiemThu>(
    `INSERT INTO NghiemThu (
      idDonHang, khoiLuongXacNhan, khoiLuongThucTe, chatLuong,
      bienBanSo, ngayLapBienBan, nguoiLap, nguoiKy, chucVu, ghiChu
    ) VALUES (
      @idDonHang, @khoiLuongXacNhan, @khoiLuongThucTe, @chatLuong,
      @bienBanSo, @ngayLapBienBan, @nguoiLap, @nguoiKy, @chucVu, @ghiChu
    );
    SELECT * FROM NghiemThu WHERE id = SCOPE_IDENTITY();`,
    {
      idDonHang: data.idDonHang,
      khoiLuongXacNhan: data.khoiLuongXacNhan || null,
      khoiLuongThucTe: data.khoiLuongThucTe || null,
      chatLuong: data.chatLuong || 'dat',
      bienBanSo: data.bienBanSo || null,
      ngayLapBienBan: data.ngayLapBienBan || null,
      nguoiLap: data.nguoiLap || null,
      nguoiKy: data.nguoiKy || null,
      chucVu: data.chucVu || null,
      ghiChu: data.ghiChu || null,
    }
  );

  await query(
    `UPDATE DonHang SET trangThaiDon = N'nghiem_thu', ngayNghiemThu = GETDATE(), ngayCapNhat = GETDATE() WHERE id = @id`,
    { id: data.idDonHang }
  );

  const donHang = (await query<DonHang>(`SELECT * FROM DonHang WHERE id = @id`, { id: data.idDonHang }))[0];
  guiThongBao('ACCEPTANCE_SUBMITTED', { id: data.idDonHang, maDonHang: donHang.maDonHang });

  return result[0];
}

export async function layNghiemThuTheoDonHang(idDonHang: number): Promise<NghiemThu | null> {
  const results = await query<NghiemThu>(
    `SELECT * FROM NghiemThu WHERE idDonHang = @idDonHang`,
    { idDonHang }
  );
  return results[0] || null;
}

export async function capNhatNghiemThu(id: number, data: Partial<NghiemThu>): Promise<NghiemThu> {
  const existing = await query<NghiemThu>(`SELECT * FROM NghiemThu WHERE id = @id`, { id });
  if (existing.length === 0) {
    throw new Error('Không tìm thấy biên bản nghiệm thu');
  }

  await query(
    `UPDATE NghiemThu SET
      khoiLuongXacNhan = @khoiLuongXacNhan, khoiLuongThucTe = @khoiLuongThucTe,
      chatLuong = @chatLuong, bienBanSo = @bienBanSo, ngayLapBienBan = @ngayLapBienBan,
      nguoiLap = @nguoiLap, nguoiKy = @nguoiKy, chucVu = @chucVu,
      daGuiKhach = @daGuiKhach, ngayGuiKhach = @ngayGuiKhach, ghiChu = @ghiChu,
      ngayCapNhat = GETDATE()
     WHERE id = @id`,
    {
      id,
      khoiLuongXacNhan: data.khoiLuongXacNhan ?? existing[0].khoiLuongXacNhan,
      khoiLuongThucTe: data.khoiLuongThucTe ?? existing[0].khoiLuongThucTe,
      chatLuong: data.chatLuong ?? existing[0].chatLuong,
      bienBanSo: data.bienBanSo ?? existing[0].bienBanSo,
      ngayLapBienBan: data.ngayLapBienBan ?? existing[0].ngayLapBienBan,
      nguoiLap: data.nguoiLap ?? existing[0].nguoiLap,
      nguoiKy: data.nguoiKy ?? existing[0].nguoiKy,
      chucVu: data.chucVu ?? existing[0].chucVu,
      daGuiKhach: data.daGuiKhach ?? existing[0].daGuiKhach,
      ngayGuiKhach: data.daGuiKhach ? new Date() : existing[0].ngayGuiKhach,
      ghiChu: data.ghiChu ?? existing[0].ghiChu,
    }
  );

  return (await query<NghiemThu>(`SELECT * FROM NghiemThu WHERE id = @id`, { id }))[0];
}

export async function xacNhanNghiemThu(idDonHang: number): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET
      trangThaiHoanThanh = N'dang_hoan_thanh',
      ngayCapNhat = GETDATE()
     WHERE id = @id`,
    { id: idDonHang }
  );

  const donHang = (await query<DonHang>(`SELECT * FROM DonHang WHERE id = @id`, { id: idDonHang }))[0];
  guiThongBao('VOLUME_CONFIRMED', { id: idDonHang, maDonHang: donHang.maDonHang, khoiLuong: donHang.khoiLuongThucTe || donHang.khoiLuongDat });

  return donHang;
}
