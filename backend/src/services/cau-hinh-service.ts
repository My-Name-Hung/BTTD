/**
 * Service quản lý cấu hình hệ thống (key/value)
 */
import { query } from '../config/database';
import { CauHinh, MaintenanceStatus } from '../models/cau-hinh-model';

const KEY_MAINTENANCE = 'dang_bao_tri';

export async function layGiaTri(khoa: string): Promise<string | null> {
  const rows = await query<{ giaTri: string }[]>(
    `SELECT giaTri FROM CauHinh WHERE khoa = @khoa`,
    { khoa }
  );
  return rows[0]?.giaTri ?? null;
}

export async function datGiaTri(khoa: string, giaTri: string): Promise<void> {
  await query(
    `IF EXISTS (SELECT 1 FROM CauHinh WHERE khoa = @khoa)
     UPDATE CauHinh SET giaTri = @giaTri, ngayCapNhat = GETDATE() WHERE khoa = @khoa
     ELSE
     INSERT INTO CauHinh (khoa, giaTri) VALUES (@khoa, @giaTri)`,
    { khoa, giaTri }
  );
}

export async function xoaKhoa(khoa: string): Promise<void> {
  await query(`DELETE FROM CauHinh WHERE khoa = @khoa`, { khoa });
}

/**
 * Lấy trạng thái bảo trì hiện tại
 */
export async function layTrangThaiBaoTri(): Promise<MaintenanceStatus> {
  const raw = await layGiaTri(KEY_MAINTENANCE);
  if (!raw) {
    return { isMaintenance: false, noiDung: null, thoiGianBatDau: null, thoiGianKetThuc: null, daLich: false };
  }
  try {
    const data = JSON.parse(raw);
    return {
      isMaintenance: true,
      noiDung: data.noiDung ?? null,
      thoiGianBatDau: data.thoiGianBatDau ?? null,
      thoiGianKetThuc: data.thoiGianKetThuc ?? null,
      daLich: data.daLich ?? false,
    };
  } catch {
    return { isMaintenance: true, noiDung: null, thoiGianBatDau: null, thoiGianKetThuc: null, daLich: false };
  }
}

/**
 * Bật chế độ bảo trì
 */
export async function batBaoTri(payload: {
  noiDung: string;
  thoiGianBatDau?: string | null;
  thoiGianKetThuc?: string | null;
}): Promise<void> {
  const data = JSON.stringify({
    noiDung: payload.noiDung,
    thoiGianBatDau: payload.thoiGianBatDau ?? new Date().toISOString(),
    thoiGianKetThuc: payload.thoiGianKetThuc ?? null,
    daLich: !!(payload.thoiGianBatDau || payload.thoiGianKetThuc),
  });
  await datGiaTri(KEY_MAINTENANCE, data);
}

/**
 * Tắt chế độ bảo trì
 */
export async function tatBaoTri(): Promise<void> {
  await xoaKhoa(KEY_MAINTENANCE);
}
