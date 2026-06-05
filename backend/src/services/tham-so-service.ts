import { query, vnNow } from '../config/database';
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
    whereClause = `WHERE maKhachHang LIKE @tuKhoa OR tenKhachHang LIKE @tuKhoa OR soDienThoai LIKE @tuKhoa`;
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
  const tenKH = data.tenKhachHang || '';

  // Tự sinh mã khách hàng nếu chưa có
  let maKH = data.maKhachHang?.trim() || null;
  if (!maKH) {
    const countResult = await query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM KhachHang`,
      {}
    );
    const nextNum = (countResult[0]?.cnt || 0) + 1;
    maKH = 'KH' + String(nextNum).padStart(4, '0');
  }

  const result = await query<KhachHang>(
    `INSERT INTO KhachHang (maKhachHang, tenKhachHang, diaChi, soDienThoai, email, ghiChu, nhom)
     VALUES (@maKhachHang, @tenKhachHang, @diaChi, @soDienThoai, @email, @ghiChu, @nhom);
     SELECT * FROM KhachHang WHERE id = SCOPE_IDENTITY();`,
    {
      maKhachHang: maKH,
      tenKhachHang: tenKH,
      diaChi: data.diaChi || null,
      soDienThoai: data.soDienThoai || null,
      email: data.email || null,
      ghiChu: data.ghiChu || null,
      nhom: data.nhom || null,
    }
  );
  const kh = result[0];

  // Đồng thời tạo dòng công nợ cho khách hàng mới (tất cả giá trị = 0)
  // Dùng MERGE để tránh lỗi trùng nếu đã tồn tại (do import công nợ chạy trước)
  await query(
    `MERGE INTO CongNoKhachHang AS target
     USING (SELECT 1 as src) AS source
     ON (target.tenKhachHang = @tenKhachHang)
     WHEN NOT MATCHED THEN
       INSERT (maKhachHang, tenKhachHang, nhom)
       VALUES (@maKhachHang, @tenKhachHang, @nhom);`,
    {
      maKhachHang: maKH,
      tenKhachHang: tenKH,
      nhom: data.nhom || null,
    }
  );

  return kh;
}

export async function suaKhachHang(id: number, data: Partial<KhachHang>): Promise<KhachHang> {
  const sets: string[] = [
    'tenKhachHang = @tenKhachHang',
    'diaChi = @diaChi',
    'soDienThoai = @soDienThoai',
    'email = @email',
    'ghiChu = @ghiChu',
    'maKhachHang = @maKhachHang',
    'nhom = @nhom',
    `ngayCapNhat = ${vnNow()}`,
  ];
  await query(
    `UPDATE KhachHang SET ${sets.join(', ')} WHERE id = @id`,
    {
      id,
      tenKhachHang: data.tenKhachHang,
      diaChi: data.diaChi ?? null,
      soDienThoai: data.soDienThoai ?? null,
      email: data.email ?? null,
      ghiChu: data.ghiChu ?? null,
      maKhachHang: data.maKhachHang ?? null,
      nhom: data.nhom ?? null,
    }
  );

  // Cập nhật lại maKhachHang và nhom trong bảng CongNoKhachHang nếu có thay đổi
  if (data.maKhachHang !== undefined || data.nhom !== undefined) {
    await query(
      `UPDATE CongNoKhachHang SET
         maKhachHang = ISNULL(@maKhachHang, maKhachHang),
         tenKhachHang = ISNULL(@tenKhachHang, tenKhachHang),
         nhom = ISNULL(@nhom, nhom),
         ngayCapNhat = ${vnNow()}
       WHERE maKhachHang = (SELECT maKhachHang FROM KhachHang WHERE id = @id)
          OR tenKhachHang = @tenKhachHang`,
      {
        maKhachHang: data.maKhachHang ?? null,
        tenKhachHang: data.tenKhachHang,
        nhom: data.nhom ?? null,
        id,
      }
    );
  }

  return (await query<KhachHang>(`SELECT * FROM KhachHang WHERE id = @id`, { id }))[0];
}

export async function xoaKhachHang(id: number): Promise<void> {
  await query(`DELETE FROM KhachHang WHERE id = @id`, { id });
}

export async function layTatCaMacBeTong(): Promise<MacBeTong[]> {
  return await query<MacBeTong>(
    `SELECT * FROM MacBeTong WHERE trangThai = N'hoat_dong' ORDER BY chiPhiPhatSinh ASC`
  );
}

export async function taoMacBeTong(data: Partial<MacBeTong>): Promise<MacBeTong> {
  const result = await query<MacBeTong>(
    `INSERT INTO MacBeTong (tenMac, donGia, chiPhiPhatSinh, buVanChuyen, moTa) VALUES (@tenMac, @donGia, @chiPhiPhatSinh, @buVanChuyen, @moTa);
     SELECT * FROM MacBeTong WHERE id = SCOPE_IDENTITY();`,
    {
      tenMac: data.tenMac || '',
      donGia: data.donGia || 0,
      chiPhiPhatSinh: data.chiPhiPhatSinh || 0,
      buVanChuyen: data.buVanChuyen || 0,
      moTa: data.moTa || null,
    }
  );
  return result[0];
}

export async function suaMacBeTong(id: number, data: Partial<MacBeTong>): Promise<MacBeTong> {
  await query(
    `UPDATE MacBeTong SET tenMac = @tenMac, donGia = @donGia, chiPhiPhatSinh = @chiPhiPhatSinh, buVanChuyen = @buVanChuyen, moTa = @moTa WHERE id = @id`,
    { id, tenMac: data.tenMac, donGia: data.donGia || 0, chiPhiPhatSinh: data.chiPhiPhatSinh, buVanChuyen: data.buVanChuyen, moTa: data.moTa || null }
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

export async function layTatCaTaiXe(): Promise<{ id: number; hoTen: string; soDienThoai: string | null }[]> {
  return await query<{ id: number; hoTen: string; soDienThoai: string | null }>(
    `SELECT id, hoTen, soDienThoai FROM NguoiDung WHERE vaiTro = N'tai_xe' AND trangThai = N'hoat_dong' ORDER BY hoTen ASC`
  );
}

export async function taoXe(data: Partial<Xe>): Promise<Xe> {
  // Lấy thông tin tài xế nếu có idTaiKhoan
  let tenTaiXe: string | null = data.tenTaiXe || null;
  let soDienThoaiTaiXe: string | null = data.soDienThoaiTaiXe || null;
  if (data.idTaiKhoan) {
    const taiXe = await query<{ hoTen: string; soDienThoai: string | null }>(
      `SELECT hoTen, soDienThoai FROM NguoiDung WHERE id = @id`,
      { id: data.idTaiKhoan }
    );
    if (taiXe.length > 0) {
      tenTaiXe = taiXe[0].hoTen;
      soDienThoaiTaiXe = taiXe[0].soDienThoai;
    }
  }

  const result = await query<Xe>(
    `INSERT INTO Xe (bienSo, idTaiKhoan, tenTaiXe, soDienThoaiTaiXe, taiTrong, trangThai)
     VALUES (@bienSo, @idTaiKhoan, @tenTaiXe, @soDienThoaiTaiXe, @taiTrong, @trangThai);
     SELECT * FROM Xe WHERE id = SCOPE_IDENTITY();`,
    {
      bienSo: data.bienSo || '',
      idTaiKhoan: data.idTaiKhoan || null,
      tenTaiXe,
      soDienThoaiTaiXe,
      taiTrong: data.taiTrong || null,
      trangThai: data.trangThai || 'san_sang',
    }
  );
  return result[0];
}

export async function suaXe(id: number, data: Partial<Xe>): Promise<Xe> {
  // Lấy thông tin tài xế nếu có idTaiKhoan
  let tenTaiXe: string | null = data.tenTaiXe ?? null;
  let soDienThoaiTaiXe: string | null = data.soDienThoaiTaiXe ?? null;
  if (data.idTaiKhoan) {
    const taiXe = await query<{ hoTen: string; soDienThoai: string | null }>(
      `SELECT hoTen, soDienThoai FROM NguoiDung WHERE id = @id`,
      { id: data.idTaiKhoan }
    );
    if (taiXe.length > 0) {
      tenTaiXe = taiXe[0].hoTen;
      soDienThoaiTaiXe = taiXe[0].soDienThoai;
    }
  }

  await query(
    `UPDATE Xe SET bienSo = @bienSo, idTaiKhoan = @idTaiKhoan, tenTaiXe = @tenTaiXe, soDienThoaiTaiXe = @soDienThoaiTaiXe,
     taiTrong = @taiTrong, trangThai = @trangThai WHERE id = @id`,
    {
      id,
      bienSo: data.bienSo,
      idTaiKhoan: data.idTaiKhoan ?? null,
      tenTaiXe,
      soDienThoaiTaiXe,
      taiTrong: data.taiTrong ?? null,
      trangThai: data.trangThai ?? 'san_sang',
    }
  );
  return (await query<Xe>(`SELECT * FROM Xe WHERE id = @id`, { id }))[0];
}

export async function xoaXe(id: number): Promise<void> {
  await query(`DELETE FROM Xe WHERE id = @id`, { id });
}
