import { query, vnNow } from '../config/database';

export interface LoginSession {
  id: number;
  idNguoiDung: number;
  tokenHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  thaoTac: string;
  ngayTao: Date;
  ngayKetThuc: Date | null;
  hoTen: string;
  vaiTro: string;
}

export interface SessionDetail {
  session: LoginSession;
  logs: {
    id: number;
    hanhDong: string;
    bangDuocTacDong: string | null;
    banGhiId: number | null;
    noiDungCu: string | null;
    noiDungMoi: string | null;
    ipAddress: string | null;
    thoiGian: Date;
  }[];
}

// Ghi phiên đăng nhập — tạo dòng mới, đánh dấu dòng cũ (nếu có) là dang_xuat
export async function ghiDangNhap(
  idNguoiDung: number,
  tokenHash: string,
  ipAddress: string,
  userAgent: string,
): Promise<number> {
  // Đánh dấu tất cả phiên cũ của user là dang_xuat
  await query(
    `UPDATE LoginSession SET thaoTac = N'dang_xuat', ngayKetThuc = ${vnNow()}
     WHERE idNguoiDung = @idNguoiDung AND thaoTac = N'dang_nhap'`,
    { idNguoiDung },
  );

  // Tạo phiên mới
  const result = await query<{ id: number }>(
    `INSERT INTO LoginSession (idNguoiDung, tokenHash, ipAddress, userAgent, thaoTac)
     OUTPUT INSERTED.id
     VALUES (@idNguoiDung, @tokenHash, @ipAddress, @userAgent, N'dang_nhap')`,
    { idNguoiDung, tokenHash, ipAddress, userAgent },
  );
  return result[0]?.id ?? 0;
}

// Ghi phiên đăng xuất
export async function ghiDangXuat(sessionId: number): Promise<void> {
  await query(
    `UPDATE LoginSession SET thaoTac = N'dang_xuat', ngayKetThuc = ${vnNow()} WHERE id = @id`,
    { id: sessionId },
  );
}

// Ghi log thao tác
export async function ghiNhatKy(
  idNguoiDung: number | null,
  hanhDong: string,
  bang?: string,
  banGhiId?: number,
  noiDungCu?: string,
  noiDungMoi?: string,
  ipAddress?: string,
): Promise<void> {
  await query(
    `INSERT INTO NhatKyHeThong (idNguoiDung, hanhDong, bangDuocTacDong, banGhiId, noiDungCu, noiDungMoi, ipAddress)
     VALUES (@idNguoiDung, @hanhDong, @bangDuocTacDong, @banGhiId, @noiDungCu, @noiDungMoi, @ipAddress)`,
    {
      idNguoiDung,
      hanhDong,
      bangDuocTacDong: bang ?? null,
      banGhiId: banGhiId ?? null,
      noiDungCu: noiDungCu ?? null,
      noiDungMoi: noiDungMoi ?? null,
      ipAddress: ipAddress ?? null,
    },
  );
}

// Lấy danh sách phiên đăng nhập (cho admin)
export async function layLichSuTruyCap(
  page = 1,
  limit = 20,
  opts?: { idNguoiDung?: number; tuNgay?: string; denNgay?: string },
): Promise<{ data: LoginSession[]; total: number }> {
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params: Record<string, unknown> = { offset, limit };

  if (opts?.idNguoiDung) {
    where += ' AND ls.idNguoiDung = @idNguoiDung';
    params.idNguoiDung = opts.idNguoiDung;
  }
  if (opts?.tuNgay) {
    where += ' AND ls.ngayTao >= @tuNgay';
    params.tuNgay = opts.tuNgay;
  }
  if (opts?.denNgay) {
    where += ' AND ls.ngayTao <= @denNgay';
    params.denNgay = opts.denNgay + 'T23:59:59';
  }

  const [countRow] = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM (
       SELECT ROW_NUMBER() OVER (PARTITION BY idNguoiDung ORDER BY ngayTao DESC) as rn
       FROM LoginSession ls
       ${where}
     ) t WHERE t.rn = 1`,
    params,
  );

  const rows = await query<LoginSession>(
    `SELECT * FROM (
       SELECT ls.id, ls.idNguoiDung, ls.tokenHash, ls.ipAddress, ls.userAgent,
              ls.thaoTac, ls.ngayTao, ls.ngayKetThuc, nd.hoTen, nd.vaiTro,
              ROW_NUMBER() OVER (PARTITION BY ls.idNguoiDung ORDER BY ls.ngayTao DESC) as rn
       FROM LoginSession ls
       LEFT JOIN NguoiDung nd ON ls.idNguoiDung = nd.id
       ${where}
     ) t WHERE t.rn = 1
     ORDER BY t.ngayTao DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params,
  );

  return { data: rows, total: countRow?.total || 0 };
}

// Lấy chi tiết phiên + logs
export async function layChiTietSession(sessionId: number): Promise<SessionDetail | null> {
  const sessions = await query<LoginSession>(
    `SELECT ls.*, nd.hoTen, nd.vaiTro
     FROM LoginSession ls
     LEFT JOIN NguoiDung nd ON ls.idNguoiDung = nd.id
     WHERE ls.id = @id`,
    { id: sessionId },
  );
  if (sessions.length === 0) return null;

  const logs = await query<SessionDetail['logs'][0]>(
    `SELECT * FROM NhatKyHeThong
     WHERE idNguoiDung = @uid
     ORDER BY thoiGian DESC`,
    { uid: sessions[0].idNguoiDung },
  );

  return { session: sessions[0], logs };
}

// Lấy session đang hoạt động theo token hash
export async function laySessionTheoToken(tokenHash: string): Promise<LoginSession | null> {
  const rows = await query<LoginSession>(
    `SELECT ls.*, nd.hoTen, nd.vaiTro
     FROM LoginSession ls
     LEFT JOIN NguoiDung nd ON ls.idNguoiDung = nd.id
     WHERE ls.tokenHash = @tokenHash AND ls.thaoTac = N'dang_nhap'`,
    { tokenHash },
  );
  return rows[0] ?? null;
}

// Cấm/bỏ cấm IP user
export async function capNhatBannedIp(idNguoiDung: number, bannedIp: string | null): Promise<void> {
  await query(
    `UPDATE NguoiDung SET bannedIp = @bannedIp, ngayCapNhat = ${vnNow()} WHERE id = @id`,
    { id: idNguoiDung, bannedIp: bannedIp ?? null },
  );
}

// Đổi mật khẩu user (admin reset)
export async function doiMatKhauUser(
  idNguoiDung: number,
  matKhauMoi: string,
  ipAddress?: string,
): Promise<void> {
  await query(
    `UPDATE NguoiDung SET matKhau = @matKhau, ngayCapNhat = ${vnNow()} WHERE id = @id`,
    { id: idNguoiDung, matKhau: matKhauMoi },
  );
}

// Buộc đăng xuất session
export async function batBuocDangXuat(sessionId: number): Promise<void> {
  await query(
    `UPDATE LoginSession SET thaoTac = N'dang_xuat', ngayKetThuc = ${vnNow()} WHERE id = @id`,
    { id: sessionId },
  );
}

// Lấy thông tin user + bannedIp
export async function layThongTinUser(idNguoiDung: number): Promise<{ id: number; hoTen: string; bannedIp: string | null } | null> {
  const rows = await query<{ id: number; hoTen: string; bannedIp: string | null }>(
    `SELECT id, hoTen, bannedIp FROM NguoiDung WHERE id = @id`,
    { id: idNguoiDung },
  );
  return rows[0] ?? null;
}

// Lấy danh sách user cho filter
export async function layDanhSachNguoiDungFilter(): Promise<{ id: number; hoTen: string; vaiTro: string }[]> {
  return query(`SELECT id, hoTen, vaiTro FROM NguoiDung ORDER BY hoTen ASC`);
}
