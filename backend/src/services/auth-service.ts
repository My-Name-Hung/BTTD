import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, vnNow } from '../config/database';
import { config } from '../config';
import { NguoiDung, LoginRequest, LoginResponse, JwtPayload } from '../models';
import { ghiDangNhap } from './access-history-service';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function dangNhap(
  data: LoginRequest,
  ipAddress?: string,
  userAgent?: string,
): Promise<LoginResponse> {
  const users = await query<NguoiDung>(
    `SELECT * FROM NguoiDung WHERE tenDangNhap = @tenDangNhap AND trangThai = N'hoat_dong'`,
    { tenDangNhap: data.tenDangNhap }
  );

  if (users.length === 0) {
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
  }

  const user = users[0];

  // Kiểm tra IP bị cấm (nếu cột bannedIp tồn tại)
  try {
    const ipRows = await query<{ id: number; bannedIp: string | null }>(
      `SELECT TOP 1 id, bannedIp FROM NguoiDung WHERE id = @id AND bannedIp IS NOT NULL`,
      { id: user.id },
    );
    if (ipRows.length > 0 && ipRows[0].bannedIp && ipAddress) {
      const bannedList = ipRows[0].bannedIp.split(',').map((ip: string) => ip.trim()).filter(Boolean);
      if (bannedList.includes(ipAddress)) {
        throw new Error(`Địa chỉ IP "${ipAddress}" đã bị cấm truy cập`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('bị cấm')) throw err;
    // Cột chưa tồn tại hoặc lỗi khác → bỏ qua kiểm tra IP
  }

  // Kiểm tra IP bị cấm
  if ((user as any).bannedIp && ipAddress) {
    const bannedList = (user as any).bannedIp.split(',').map((ip: string) => ip.trim()).filter(Boolean);
    if (bannedList.includes(ipAddress)) {
      throw new Error(`Địa chỉ IP "${ipAddress}" đã bị cấm truy cập`);
    }
  }

  const isValidPassword = await bcrypt.compare(data.matKhau, user.matKhau);
  if (!isValidPassword) {
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
  }

  // Ghi session đăng nhập trước để lấy sessionId
  let sessionId = 0;
  try {
    sessionId = await ghiDangNhap(user.id, '', ipAddress || '', userAgent || '');
  } catch { /* bỏ qua lỗi ghi session */ }

  const payload: JwtPayload = {
    id: user.id,
    tenDangNhap: user.tenDangNhap,
    hoTen: user.hoTen,
    vaiTro: user.vaiTro,
    idTramTron: (user as any).idTramTron ?? null,
    sessionId,
  };

  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });

  // Cập nhật tokenHash cho session vừa tạo
  if (sessionId > 0) {
    try {
      await query(
        `UPDATE LoginSession SET tokenHash = @tokenHash WHERE id = @id`,
        { id: sessionId, tokenHash: hashToken(token) },
      );
    } catch { /* bỏ qua */ }
  }

  const { matKhau: _, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword as Omit<NguoiDung, 'matKhau'>,
  };
}

export async function layThongTinNguoiDung(id: number): Promise<Omit<NguoiDung, 'matKhau'>> {
  const users = await query<NguoiDung>(
    `SELECT * FROM NguoiDung WHERE id = @id`,
    { id }
  );

  if (users.length === 0) {
    throw new Error('Không tìm thấy người dùng');
  }

  const { matKhau: _, ...userWithoutPassword } = users[0];
  return userWithoutPassword;
}

export async function doiMatKhau(
  id: number,
  matKhauCu: string,
  matKhauMoi: string
): Promise<void> {
  const users = await query<NguoiDung>(
    `SELECT * FROM NguoiDung WHERE id = @id`,
    { id }
  );

  if (users.length === 0) {
    throw new Error('Không tìm thấy người dùng');
  }

  const isValid = await bcrypt.compare(matKhauCu, users[0].matKhau);
  if (!isValid) {
    throw new Error('Mật khẩu cũ không đúng');
  }

  const hashedPassword = await bcrypt.hash(matKhauMoi, 10);
  await query(
    `UPDATE NguoiDung SET matKhau = @matKhau, ngayCapNhat = ${vnNow()} WHERE id = @id`,
    { matKhau: hashedPassword, id }
  );
}
