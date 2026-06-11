import { query, vnNow } from '../config/database';

export interface BangChungDonHang {
  id: number;
  idDonHang: number;
  loai: string;
  fileUrl: string;
  moTa: string | null;
  nguoiTaoId: number | null;
  ngayTao: string | null;
  ngayCapNhat: string | null;
}

/**
 * Lấy danh sách bằng chứng theo đơn hàng
 */
export async function layBangChungTheoDonHang(idDonHang: number): Promise<BangChungDonHang[]> {
  const result = await query<BangChungDonHang>(
    `SELECT * FROM BangChungDonHang WHERE idDonHang = @idDonHang ORDER BY ngayTao DESC`,
    { idDonHang }
  );
  return result;
}

/**
 * Thêm bằng chứng đơn hàng (đã có fileUrl từ upload rồi)
 */
export async function themBangChungDonHang(
  idDonHang: number,
  fileUrl: string,
  loai: 'file' | 'camera' = 'file',
  moTa?: string,
  nguoiTaoId?: number
): Promise<BangChungDonHang> {
  const result = await query<BangChungDonHang>(
    `INSERT INTO BangChungDonHang (idDonHang, loai, fileUrl, moTa, nguoiTaoId, ngayTao, ngayCapNhat)
     OUTPUT INSERTED.*
     VALUES (@idDonHang, @loai, @fileUrl, @moTa, @nguoiTaoId, ${vnNow()}, ${vnNow()})`,
    {
      idDonHang,
      loai,
      fileUrl,
      moTa: moTa || null,
      nguoiTaoId: nguoiTaoId || null,
    }
  );
  return result[0];
}

/**
 * Xóa bằng chứng
 */
export async function xoaBangChungDonHang(id: number): Promise<void> {
  await query(`DELETE FROM BangChungDonHang WHERE id = @id`, { id });
}
