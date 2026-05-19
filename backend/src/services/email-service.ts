import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

export async function guiEmailThongBaoDonMoi(
  emailNguoiNhan: string,
  maDonHang: string,
  tenKhachHang: string,
  khoiLuong: string,
  diaChi: string
): Promise<void> {
  const noiDung = `
Kính chào Quý Kế Toán,

Có đơn hàng mới cần duyệt:

- Mã đơn: ${maDonHang}
- Khách hàng: ${tenKhachHang}
- Khối lượng: ${khoiLuong} m³
- Địa chỉ giao: ${diaChi}
- Thời gian tạo: ${new Date().toLocaleString('vi-VN')}

Vui lòng đăng nhập hệ thống để duyệt đơn.

Trân trọng,
Hệ thống Bê Tông Tây Đô
  `.trim();

  await transporter.sendMail({
    from: `"Bê Tông Tây Đô" <${config.email.user}>`,
    to: emailNguoiNhan,
    subject: `[BTTD] Đơn hàng mới cần duyệt - ${maDonHang}`,
    text: noiDung,
  });
}

export async function guiEmailThongBaoTrangThai(
  emailNguoiNhan: string,
  maDonHang: string,
  trangThai: string,
  ghiChu?: string
): Promise<void> {
  const noiDung = `
Kính chào,

Đơn hàng ${maDonHang} đã được cập nhật trạng thái:

- Trạng thái mới: ${trangThai}
${ghiChu ? `- Ghi chú: ${ghiChu}` : ''}
- Thời gian cập nhật: ${new Date().toLocaleString('vi-VN')}

Trân trọng,
Hệ thống Bê Tông Tây Đô
  `.trim();

  await transporter.sendMail({
    from: `"Bê Tông Tây Đô" <${config.email.user}>`,
    to: emailNguoiNhan,
    subject: `[BTTD] Cập nhật đơn hàng ${maDonHang} - ${trangThai}`,
    text: noiDung,
  });
}

export async function guiEmailThongBaoThanhToan(
  emailNguoiNhan: string,
  maDonHang: string,
  soTien: string,
  conLai: string
): Promise<void> {
  const noiDung = `
Kính chào,

Thanh toán cho đơn hàng ${maDonHang} đã được ghi nhận:

- Số tiền thanh toán: ${soTien} VNĐ
- Còn lại: ${conLai} VNĐ

Trân trọng,
Hệ thống Bê Tông Tây Đô
  `.trim();

  await transporter.sendMail({
    from: `"Bê Tông Tây Đô" <${config.email.user}>`,
    to: emailNguoiNhan,
    subject: `[BTTD] Thanh toán đơn hàng ${maDonHang}`,
    text: noiDung,
  });
}
