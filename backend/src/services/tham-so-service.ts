import { query } from '../config/database';
import { KhachHang, MacBeTong, TramTron, Xe, ApiResponseWithPagination } from '../models';

export async function layTatCaKhachHang(
  page: number = 1,
  limit: number = 50,
  tuKhoa?: string
): Promise<ApiResponseWithPagination<KhachHang[]>> {
  const offset = (page - 1) * limit;
  let whereClause = '';
  const params: Record<string, unknown> = { offset, limit };

  if (tuKhoa) {
    whereClause = `WHERE tenKhachHang LIKE @tuKhoa OR soDienThoai LIKE @tuKhoa`;
    params.tuKhoa = `%${tuKhoa}%`;
  }

  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM KhachHang ${whereClause}`,
    params
  );
  const total = countResult[0]?.total || 0;

  const khachHangs = await query<KhachHang>(
    `SELECT * FROM KhachHang ${whereClause}
     ORDER BY ngayTao DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params
  );

  return {
    success: true,
    message: 'Lấy danh sách khách hàng thành công',
    data: khachHangs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function taoKhachHang(data: Partial<KhachHang>): Promise<KhachHang> {
  const result = await query<KhachHang>(
    `INSERT INTO KhachHang (tenKhachHang, diaChi, soDienThoai, email, ghiChu)
     VALUES (@tenKhachHang, @diaChi, @soDienThoai, @email, @ghiChu);
     SELECT * FROM KhachHang WHERE id = SCOPE_IDENTITY();`,
    {
      tenKhachHang: data.tenKhachHang || '',
      diaChi: data.diaChi || null,
      soDienThoai: data.soDienThoai || null,
      email: data.email || null,
      ghiChu: data.ghiChu || null,
    }
  );
  return result[0];
}

export async function suaKhachHang(id: number, data: Partial<KhachHang>): Promise<KhachHang> {
  await query(
    `UPDATE KhachHang SET
      tenKhachHang = @tenKhachHang, diaChi = @diaChi, soDienThoai = @soDienThoai,
      email = @email, ghiChu = @ghiChu, ngayCapNhat = GETDATE()
     WHERE id = @id`,
    {
      id,
      tenKhachHang: data.tenKhachHang,
      diaChi: data.diaChi ?? null,
      soDienThoai: data.soDienThoai ?? null,
      email: data.email ?? null,
      ghiChu: data.ghiChu ?? null,
    }
  );
  return (await query<KhachHang>(`SELECT * FROM KhachHang WHERE id = @id`, { id }))[0];
}

export async function xoaKhachHang(id: number): Promise<void> {
  await query(`DELETE FROM KhachHang WHERE id = @id`, { id });
}

export async function layTatCaMacBeTong(): Promise<MacBeTong[]> {
  return await query<MacBeTong>(
    `SELECT * FROM MacBeTong WHERE trangThai = N'hoat_dong' ORDER BY donGia ASC`
  );
}

export async function taoMacBeTong(data: Partial<MacBeTong>): Promise<MacBeTong> {
  const result = await query<MacBeTong>(
    `INSERT INTO MacBeTong (tenMac, donGia, moTa) VALUES (@tenMac, @donGia, @moTa);
     SELECT * FROM MacBeTong WHERE id = SCOPE_IDENTITY();`,
    {
      tenMac: data.tenMac || '',
      donGia: data.donGia || 0,
      moTa: data.moTa || null,
    }
  );
  return result[0];
}

export async function suaMacBeTong(id: number, data: Partial<MacBeTong>): Promise<MacBeTong> {
  await query(
    `UPDATE MacBeTong SET tenMac = @tenMac, donGia = @donGia, moTa = @moTa WHERE id = @id`,
    { id, tenMac: data.tenMac, donGia: data.donGia, moTa: data.moTa || null }
  );
  return (await query<MacBeTong>(`SELECT * FROM MacBeTong WHERE id = @id`, { id }))[0];
}

export async function layTatCaTramTron(
  tuKhoa?: string,
  trangThai?: string,
  page: number = 1,
  limit: number = 100,
): Promise<ApiResponseWithPagination<TramTron[]>> {
  const offset = (page - 1) * limit;
  let whereClause = '';
  const params: Record<string, unknown> = { offset, limit };

  const conditions: string[] = [];
  if (tuKhoa) {
    conditions.push(`tenTram LIKE @tuKhoa`);
    params.tuKhoa = `%${tuKhoa}%`;
  }
  if (trangThai) {
    conditions.push(`trangThai = @trangThaiFilter`);
    params.trangThaiFilter = trangThai;
  }
  if (conditions.length > 0) {
    whereClause = `WHERE ${conditions.join(' AND ')}`;
  }

  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM TramTron ${whereClause}`,
    params
  );
  const total = countResult[0]?.total || 0;

  const tramTrons = await query<TramTron>(
    `SELECT * FROM TramTron ${whereClause}
     ORDER BY tenTram ASC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params
  );

  return {
    success: true,
    message: 'Lấy danh sách trạm trộn thành công',
    data: tramTrons,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function layTatCaXe(
  trangThai?: string,
  page: number = 1,
  limit: number = 100,
): Promise<ApiResponseWithPagination<Xe[]>> {
  const offset = (page - 1) * limit;
  let whereClause = '';
  const params: Record<string, unknown> = { offset, limit };

  if (trangThai) {
    whereClause = `WHERE trangThai = @trangThai`;
    params.trangThai = trangThai;
  }

  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM Xe ${whereClause}`,
    params
  );
  const total = countResult[0]?.total || 0;

  const xes = await query<Xe>(
    `SELECT * FROM Xe ${whereClause}
     ORDER BY bienSo ASC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params
  );

  return {
    success: true,
    message: 'Lấy danh sách xe thành công',
    data: xes,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function taoXe(data: Partial<Xe>): Promise<Xe> {
  const result = await query<Xe>(
    `INSERT INTO Xe (bienSo, tenTaiXe, soDienThoaiTaiXe, taiTrong, trangThai)
     VALUES (@bienSo, @tenTaiXe, @soDienThoaiTaiXe, @taiTrong, @trangThai);
     SELECT * FROM Xe WHERE id = SCOPE_IDENTITY();`,
    {
      bienSo: data.bienSo || '',
      tenTaiXe: data.tenTaiXe || null,
      soDienThoaiTaiXe: data.soDienThoaiTaiXe || null,
      taiTrong: data.taiTrong || null,
      trangThai: data.trangThai || 'san_sang',
    }
  );
  return result[0];
}

export async function suaXe(id: number, data: Partial<Xe>): Promise<Xe> {
  await query(
    `UPDATE Xe SET bienSo = @bienSo, tenTaiXe = @tenTaiXe, soDienThoaiTaiXe = @soDienThoaiTaiXe,
     taiTrong = @taiTrong, trangThai = @trangThai WHERE id = @id`,
    {
      id,
      bienSo: data.bienSo,
      tenTaiXe: data.tenTaiXe ?? null,
      soDienThoaiTaiXe: data.soDienThoaiTaiXe ?? null,
      taiTrong: data.taiTrong ?? null,
      trangThai: data.trangThai ?? 'san_sang',
    }
  );
  return (await query<Xe>(`SELECT * FROM Xe WHERE id = @id`, { id }))[0];
}

export async function xoaXe(id: number): Promise<void> {
  await query(`DELETE FROM Xe WHERE id = @id`, { id });
}
