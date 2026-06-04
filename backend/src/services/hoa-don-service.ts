import { query, vnNow } from '../config/database';
import { DonHang, ThanhToan } from '../models';

export interface HoaDon {
  id: number;
  idDonHang: number;
  maHoaDon: string;
  soHoaDon: string;
  ngayLap: Date | null;
  khachHang: string;
  loaiXiMang: string;
  gioDo: string;
  phuongThucThanhToan: string;
  ghiChu: string;
  tienBeTong: number;
  buuVanChuyen: number;
  phiPhatSinh: number;
  giamTru: number;
  tongCong: number;
  soTienThanhToan: number;
  loaiThanhToan: 'tra_het' | 'cong_no';
  hanTraCongNo: Date | null;
  nguoiTaoId: number | null;
  createdAt: Date;
}

interface TaoHoaDonInput {
  idDonHang: number;
  loaiThanhToan: 'tra_het' | 'cong_no';
  buuVanChuyen?: number;
  phiPhatSinh?: number;
  giamTru?: number;
  soTienThanhToan?: number;
  ngayLap?: string;
  khachHang?: string;
  loaiXiMang?: string;
  gioDo?: string;
  phuongThucThanhToan?: string;
  ghiChu?: string;
  hanTraCongNo?: string;
}

export async function taoHoaDon(data: TaoHoaDonInput, nguoiTaoId: number): Promise<HoaDon> {
  const donHang = await query<DonHang>(
    `SELECT * FROM DonHang WHERE id = @id`,
    { id: data.idDonHang }
  );

  if (donHang.length === 0) {
    throw new Error('Không tìm thấy đơn hàng');
  }

  const dh = donHang[0];
  // Sinh mã hóa đơn: BBTD-xxxx-MADONHANG
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const soHoaDon = `BBTD-${randomNum}-${dh.maDonHang}`;
  const maHoaDon = soHoaDon;

  // Tiền bê tông = số tiền thanh toán trước (nếu có) hoặc tổng thanh tiền đơn hàng
  // Khi user nhập "tiền thanh toán trước" ở tab công nợ -> đó chính là tienBeTong
  const tienBeTong = data.soTienThanhToan || dh.thanhTien || 0;
  const buuVanChuyen = data.buuVanChuyen || 0;
  const phiPhatSinh = data.phiPhatSinh || 0;
  const giamTru = data.giamTru || 0;
  // tổng hóa đơn = tiền bê tông + bù vận chuyển + phí phát sinh - giảm trừ
  const tongCong = tienBeTong + buuVanChuyen + phiPhatSinh - giamTru;

  const result = await query<HoaDon>(
    `INSERT INTO HoaDon (
      idDonHang, maHoaDon, soHoaDon, ngayLap, khachHang, loaiXiMang, gioDo,
      phuongThucThanhToan, ghiChu, tienBeTong, buuVanChuyen, phiPhatSinh,
      giamTru, tongCong, soTienThanhToan, loaiThanhToan, hanTraCongNo, nguoiTaoId
    ) VALUES (
      @idDonHang, @maHoaDon, @soHoaDon, @ngayLap, @khachHang, @loaiXiMang, @gioDo,
      @phuongThucThanhToan, @ghiChu, @tienBeTong, @buuVanChuyen, @phiPhatSinh,
      @giamTru, @tongCong, @soTienThanhToan, @loaiThanhToan, @hanTraCongNo, @nguoiTaoId
    );
    SELECT * FROM HoaDon WHERE id = SCOPE_IDENTITY();`,
    {
      idDonHang: data.idDonHang,
      maHoaDon,
      soHoaDon,
      ngayLap: data.ngayLap ? new Date(data.ngayLap) : new Date(),
      khachHang: data.khachHang || dh.tenKhachHang || '',
      loaiXiMang: data.loaiXiMang || '',
      gioDo: data.gioDo || '',
      phuongThucThanhToan: data.phuongThucThanhToan || 'tien_mat',
      ghiChu: data.ghiChu || '',
      tienBeTong,
      buuVanChuyen,
      phiPhatSinh,
      giamTru,
      tongCong,
      soTienThanhToan: tienBeTong,
      loaiThanhToan: data.loaiThanhToan,
      hanTraCongNo: data.hanTraCongNo ? new Date(data.hanTraCongNo) : null,
      nguoiTaoId,
    }
  );

  const hoaDon = result[0];

  // Nếu là trả hết: tạo bản ghi thanh toán + cập nhật đơn hàng
  if (data.loaiThanhToan === 'tra_het') {
    await query<ThanhToan>(
      `INSERT INTO ThanhToan (idDonHang, soTien, hinhThuc, ngayThanhToan, nguoiNhan, ghiChu, nguoiTaoId)
       VALUES (@idDonHang, @soTien, @hinhThuc, ${vnNow()}, @nguoiNhan, @ghiChu, @nguoiTaoId);`,
      {
        idDonHang: data.idDonHang,
        soTien: tongCong,
        hinhThuc: data.phuongThucThanhToan || 'tien_mat',
        nguoiNhan: '',
        ghiChu: `Hóa đơn ${maHoaDon}`,
        nguoiTaoId,
      }
    );

    await query(
      `UPDATE DonHang SET
        daThanhToan = @daThanhToan, conLai = 0,
        trangThaiDon = N'da_thanh_toan', trangThaiHoanThanh = N'da_hoan_thanh',
        ngayCapNhat = ${vnNow()}
       WHERE id = @id`,
      {
        id: data.idDonHang,
        daThanhToan: tongCong,
      }
    );
  }

  // Nếu là công nợ (thanh toán 1 phần): tạo bản ghi thanh toán + cập nhật đơn hàng
  if (data.loaiThanhToan === 'cong_no') {
    // Lấy đơn hàng hiện tại để tính lại daThanhToan
    const dhHienTai = (await query<DonHang>(
      `SELECT * FROM DonHang WHERE id = @id`, { id: data.idDonHang }
    ))[0];
    const daThanhToanMoi = (dhHienTai.daThanhToan || 0) + tongCong;
    const conLaiMoi = (dhHienTai.thanhTien || 0) - daThanhToanMoi;

    await query<ThanhToan>(
      `INSERT INTO ThanhToan (idDonHang, soTien, hinhThuc, ngayThanhToan, nguoiNhan, ghiChu, nguoiTaoId)
       VALUES (@idDonHang, @soTien, @hinhThuc, ${vnNow()}, @nguoiNhan, @ghiChu, @nguoiTaoId);`,
      {
        idDonHang: data.idDonHang,
        soTien: tongCong,
        hinhThuc: data.phuongThucThanhToan || 'tien_mat',
        nguoiNhan: '',
        ghiChu: `Hóa đơn công nợ ${maHoaDon}`,
        nguoiTaoId,
      }
    );

    await query(
      `UPDATE DonHang SET
        daThanhToan = @daThanhToan, conLai = @conLai,
        trangThaiDon = CASE WHEN @conLai <= 0 THEN N'da_thanh_toan' ELSE trangThaiDon END,
        trangThaiHoanThanh = CASE WHEN @conLai <= 0 THEN N'da_hoan_thanh' ELSE trangThaiHoanThanh END,
        ngayCapNhat = ${vnNow()}
       WHERE id = @id`,
      {
        id: data.idDonHang,
        daThanhToan: daThanhToanMoi,
        conLai: conLaiMoi < 0 ? 0 : conLaiMoi,
      }
    );
  }

  return hoaDon;
}

export async function layHoaDonTheoDonHang(idDonHang: number): Promise<HoaDon[]> {
  return await query<HoaDon[]>(
    `SELECT * FROM HoaDon WHERE idDonHang = @idDonHang ORDER BY id DESC`,
    { idDonHang }
  );
}

export async function taiHoaDonDoc(id: number): Promise<Buffer> {
  const hoaDonArr = await query<HoaDon[]>(
    `SELECT hd.*, dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong,
            dh.khoiLuongDat, dh.donGia, dh.thanhTien
     FROM HoaDon hd
     INNER JOIN DonHang dh ON hd.idDonHang = dh.id
     WHERE hd.id = @id`,
    { id }
  );

  if (hoaDonArr.length === 0) {
    throw new Error('Không tìm thấy hóa đơn');
  }

  const hd = hoaDonArr[0];
  const dh = hoaDonArr[0] as any;

  // Tạo nội dung DOC đơn giản (HTML có thể mở bằng Word)
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; margin: 40px; }
  h1 { text-align: center; color: #073ceb; }
  h2 { text-align: center; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  td, th { border: 1px solid #ddd; padding: 8px; }
  th { background: #f5f5f5; }
  .header { text-align: center; margin-bottom: 30px; }
  .info-table td:first-child { font-weight: bold; width: 30%; }
  .total-row { font-weight: bold; background: #f9f9f9; }
  .center { text-align: center; }
</style>
</head>
<body>
<div class="header">
  <h1>CÔNG TY BÊ TÔNG TÂY ĐÔ</h1>
  <p>Địa chỉ: ... | Điện thoại: ...</p>
  <h2>HÓA ĐƠN BÁN HÀNG</h2>
  <p><strong>Số: ${hd.maHoaDon}</strong></p>
  <p>Ngày: ${hd.ngayLap ? new Date(hd.ngayLap).toLocaleDateString('vi-VN') : ''}</p>
</div>

<table class="info-table">
  <tr><td>Mã đơn hàng:</td><td>${dh.maDonHang || ''}</td></tr>
  <tr><td>Khách hàng:</td><td>${hd.khachHang || dh.tenKhachHang || ''}</td></tr>
  <tr><td>Địa chỉ giao hàng:</td><td>${dh.diaChiNhan || ''}</td></tr>
  <tr><td>Mác bê tông:</td><td>${dh.tenMacBeTong || ''}</td></tr>
  <tr><td>Khối lượng:</td><td>${dh.khoiLuongDat || 0} m³</td></tr>
  <tr><td>Đơn giá:</td><td>${(dh.donGia || 0).toLocaleString('vi-VN')} đ/m³</td></tr>
  <tr><td>Loại xi măng:</td><td>${hd.loaiXiMang || ''}</td></tr>
  <tr><td>Giờ đổ:</td><td>${hd.gioDo || ''}</td></tr>
  <tr><td>Phương thức thanh toán:</td><td>${hd.phuongThucThanhToan === 'chuyen_khoan' ? 'Chuyển khoản' : 'Tiền mặt'}</td></tr>
  <tr><td>Loại thanh toán:</td><td>${hd.loaiThanhToan === 'tra_het' ? 'Trả hết' : 'Công nợ'}</td></tr>
  ${hd.loaiThanhToan === 'cong_no' && hd.hanTraCongNo ? `<tr><td>Hạn trả công nợ:</td><td>${new Date(hd.hanTraCongNo).toLocaleDateString('vi-VN')}</td></tr>` : ''}
  ${hd.ghiChu ? `<tr><td>Ghi chú:</td><td>${hd.ghiChu}</td></tr>` : ''}
</table>

<table>
  <thead>
    <tr><th>Nội dung</th><th class="center">Số lượng</th><th class="center">Đơn giá</th><th class="center">Thành tiền</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Bê tông thương phẩm (${dh.tenMacBeTong || ''})</td>
      <td class="center">${dh.khoiLuongDat || 0} m³</td>
      <td class="center">${(dh.donGia || 0).toLocaleString('vi-VN')} đ</td>
      <td class="center">${(dh.thanhTien || 0).toLocaleString('vi-VN')} đ</td>
    </tr>
    ${hd.buuVanChuyen > 0 ? `<tr><td>Bù vận chuyển</td><td></td><td></td><td class="center">${hd.buuVanChuyen.toLocaleString('vi-VN')} đ</td></tr>` : ''}
    ${hd.phiPhatSinh > 0 ? `<tr><td>Chi phí phát sinh</td><td></td><td></td><td class="center">${hd.phiPhatSinh.toLocaleString('vi-VN')} đ</td></tr>` : ''}
    ${hd.giamTru > 0 ? `<tr><td>Giảm trừ / Khuyến mãi</td><td></td><td></td><td class="center">-${hd.giamTru.toLocaleString('vi-VN')} đ</td></tr>` : ''}
    <tr class="total-row">
      <td colspan="3"><strong>TỔNG CỘNG</strong></td>
      <td class="center"><strong>${hd.tongCong.toLocaleString('vi-VN')} đ</strong></td>
    </tr>
  </tbody>
</table>

<p style="margin-top: 40px; text-align: center;">
  <em>Cảm ơn quý khách đã sử dụng dịch vụ của Bê Tông Tây Đô!</em>
</p>

<p style="margin-top: 20px;">
  <strong>Người lập hóa đơn</strong><br/><br/><br/>
  <em>(Ký và ghi rõ họ tên)</em>
</p>

<p style="text-align: right;">
  <strong>Khách hàng</strong><br/><br/><br/>
  <em>(Ký và ghi rõ họ tên)</em>
</p>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}
