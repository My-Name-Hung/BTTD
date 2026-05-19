import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { config } from '../config';
import { NguoiDung, LoginRequest, LoginResponse, JwtPayload } from '../models';

export async function dangNhap(data: LoginRequest): Promise<LoginResponse> {
  const users = await query<NguoiDung>(
    `SELECT * FROM NguoiDung WHERE tenDangNhap = @tenDangNhap AND trangThai = N'hoat_dong'`,
    { tenDangNhap: data.tenDangNhap }
  );

  if (users.length === 0) {
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
  }

  const user = users[0];
  const isValidPassword = await bcrypt.compare(data.matKhau, user.matKhau);

  if (!isValidPassword) {
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
  }

  const payload: JwtPayload = {
    id: user.id,
    tenDangNhap: user.tenDangNhap,
    hoTen: user.hoTen,
    vaiTro: user.vaiTro,
  };

  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const { matKhau: _, ...userWithoutPassword } = user;

  return {
    token,
    user: userWithoutPassword,
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
    `UPDATE NguoiDung SET matKhau = @matKhau, ngayCapNhat = GETDATE() WHERE id = @id`,
    { matKhau: hashedPassword, id }
  );
}
