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

export async function layHoaDonTheoId(id: number): Promise<HoaDon | null> {
  const rows = await query<any[]>(
    `SELECT hd.*,
            dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong,
            dh.khoiLuongDat, dh.donGia, dh.thanhTien, dh.ngayGiao,
            ISNULL(tt.tenTram, '') as tenTramTron,
            ISNULL(tt.diaChi, '') as diaChiTramTron,
            ls.bienSoXe,
            nd.hoTen as tenTaiXe,
            ls.nguoiOmOng, ls.nguoiBatOng, ls.kyThuatCongTrinh
     FROM HoaDon hd
     INNER JOIN DonHang dh ON hd.idDonHang = dh.id
     LEFT JOIN LichSanXuat ls ON dh.id = ls.idDonHang
     LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
     LEFT JOIN TramTron tt ON dh.idTramTron = tt.id
     LEFT JOIN NghiemThu nt ON dh.id = nt.idDonHang
     WHERE hd.id = @id`,
    { id }
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    idDonHang: r.idDonHang,
    maHoaDon: r.maHoaDon,
    soHoaDon: r.soHoaDon,
    ngayLap: r.ngayLap,
    khachHang: r.khachHang,
    loaiXiMang: r.loaiXiMang,
    gioDo: r.gioDo,
    phuongThucThanhToan: r.phuongThucThanhToan,
    ghiChu: r.ghiChu,
    tienBeTong: r.tienBeTong,
    buuVanChuyen: r.buuVanChuyen,
    phiPhatSinh: r.phiPhatSinh,
    giamTru: r.giamTru,
    tongCong: r.tongCong,
    soTienThanhToan: r.soTienThanhToan,
    loaiThanhToan: r.loaiThanhToan,
    hanTraCongNo: r.hanTraCongNo,
    nguoiTaoId: r.nguoiTaoId,
    createdAt: r.createdAt,
    // Join fields
    maDonHang: r.maDonHang,
    tenKhachHang: r.tenKhachHang,
    diaChiNhan: r.diaChiNhan,
    tenMacBeTong: r.tenMacBeTong,
    khoiLuongDat: r.khoiLuongDat,
    donGia: r.donGia,
    thanhTien: r.thanhTien,
    ngayGiao: r.ngayGiao,
    tenTramTron: r.tenTramTron,
    diaChiTramTron: r.diaChiTramTron,
    bienSoXe: r.bienSoXe,
    tenTaiXe: r.tenTaiXe,
    nguoiOmOng: r.nguoiOmOng,
    nguoiBatOng: r.nguoiBatOng,
    kyThuatCongTrinh: r.kyThuatCongTrinh,
    ngayNghiemThu: r.ngayNghiemThu,
  };
}

export async function taiHoaDonDoc(id: number): Promise<Buffer> {
  const hd = await layHoaDonTheoId(id);
  if (!hd) throw new Error('Không tìm thấy hóa đơn');

  const ls = hd as any;
  const COMPANY_NAME = 'CÔNG TY CỔ PHẦN BÊ TÔNG TÂY ĐÔ';
  const COMPANY_ADDR = 'Km14, QL91, P.Phước Thới, TP.Cần Thơ';
  const COMPANY_PHONE = '0292 651 8375';
  const COMPANY_MST = '1801286137';
  const pttt = hd.phuongThucThanhToan === 'chuyen_khoan' ? 'Chuyển khoản' : 'Tiền mặt';
  const loaiTT = hd.loaiThanhToan === 'tra_het' ? 'Trả hết' : 'Công nợ';
  const hanTra = hd.loaiThanhToan === 'cong_no' && hd.hanTraCongNo
    ? `<tr><td><strong>Hạn thanh toán:</strong></td><td>${new Date(hd.hanTraCongNo).toLocaleDateString('vi-VN')}</td></tr>` : '';

  // Thành tiền bê tông = khối lượng x đơn giá
  const khoiLuong = ls.khoiLuongDat || 0;
  const donGia = ls.donGia || 0;
  const thanhTienBeTong = khoiLuong * donGia;

  const rowsChiTiet: string[] = [
    `  <tr><td>1</td><td>Bê tông thương phẩm (${ls.tenMacBeTong || ''})</td><td>m³</td><td style="text-align:right">${khoiLuong}</td><td style="text-align:right">${donGia.toLocaleString('vi-VN')}</td><td style="text-align:right">${thanhTienBeTong.toLocaleString('vi-VN')}</td></tr>`,
  ];
  if ((hd.buuVanChuyen || 0) > 0) rowsChiTiet.push(`  <tr><td>${rowsChiTiet.length + 1}</td><td>Phí bù vận chuyển</td><td></td><td></td><td></td><td style="text-align:right">${hd.buuVanChuyen.toLocaleString('vi-VN')}</td></tr>`);
  if ((hd.phiPhatSinh || 0) > 0) rowsChiTiet.push(`  <tr><td>${rowsChiTiet.length + 1}</td><td>Chi phí phát sinh</td><td></td><td></td><td></td><td style="text-align:right">${hd.phiPhatSinh.toLocaleString('vi-VN')}</td></tr>`);
  if ((hd.giamTru || 0) > 0) rowsChiTiet.push(`  <tr><td>${rowsChiTiet.length + 1}</td><td>Giảm trừ / Khuyến mãi</td><td></td><td></td><td></td><td style="text-align:right;color:#e53935">-${hd.giamTru.toLocaleString('vi-VN')}</td></tr>`);

  const nhanSuRows: string[] = [];
  if (ls.bienSoXe) nhanSuRows.push(`  <tr><td><strong>Xe (Biển số):</strong></td><td>${ls.bienSoXe}</td></tr>`);
  if (ls.tenTaiXe) nhanSuRows.push(`  <tr><td><strong>Tài xế:</strong></td><td>${ls.tenTaiXe}</td></tr>`);
  if (ls.nguoiOmOng) nhanSuRows.push(`  <tr><td><strong>Vận hành bơm:</strong></td><td>${ls.nguoiOmOng}</td></tr>`);
  if (ls.nguoiBatOng) nhanSuRows.push(`  <tr><td><strong>Lắp ống:</strong></td><td>${ls.nguoiBatOng}</td></tr>`);
  if (ls.kyThuatCongTrinh) nhanSuRows.push(`  <tr><td><strong>Kỹ sư công trình:</strong></td><td>${ls.kyThuatCongTrinh}</td></tr>`);
  if (ls.ngayNghiemThu) nhanSuRows.push(`  <tr><td><strong>Ngày nghiệm thu:</strong></td><td>${new Date(ls.ngayNghiemThu).toLocaleDateString('vi-VN')}</td></tr>`);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Hóa đơn ${hd.maHoaDon}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12pt; margin: 0; padding: 0; color: #222; }
  .page { max-width: 800px; margin: 0 auto; padding: 20px; }
  .header { background: #073ceb; color: white; padding: 16px 24px; display: flex; align-items: center; gap: 16px; border-radius: 6px 6px 0 0; }
  .header img { width: 56px; height: 56px; border-radius: 6px; background: white; padding: 3px; object-fit: contain; }
  .header-info h1 { font-size: 15px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .header-info p { font-size: 11px; margin: 0; opacity: 0.9; }
  .title-bar { background: #f0f4ff; text-align: center; padding: 12px; border-bottom: 2px solid #073ceb; }
  .title-bar h2 { color: #073ceb; font-size: 20px; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
  .title-bar p { color: #888; font-size: 11px; margin: 4px 0 0; letter-spacing: 3px; text-transform: uppercase; }
  .meta { display: flex; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid #eee; }
  .meta-block { display: flex; flex-direction: column; gap: 4px; }
  .meta-row { display: flex; gap: 8px; font-size: 12px; }
  .meta-label { font-weight: 600; color: #666; min-width: 120px; }
  .meta-val { font-weight: 700; color: #222; }
  .section { padding: 10px 24px; border-bottom: 1px solid #eee; }
  .section-title { font-size: 10px; font-weight: 700; color: #073ceb; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(7,60,235,0.1); }
  .two-col { display: flex; gap: 32px; }
  .info-row { display: flex; gap: 8px; font-size: 12px; margin-bottom: 4px; }
  .info-label { font-weight: 600; color: #666; min-width: 130px; }
  .info-val { color: #222; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 0; }
  thead tr { background: #073ceb; }
  thead th { color: white; padding: 8px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; text-align: left; }
  thead th.num { text-align: right; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #eee; color: #222; }
  tbody td.num { text-align: right; }
  tbody td.center { text-align: center; }
  tfoot td { padding: 8px; border-top: 2px solid #073ceb; }
  tfoot td.num { text-align: right; font-weight: 700; font-size: 13px; }
  .total-row td { background: #f0f4ff; }
  .so-tien-chu { font-size: 11px; font-style: italic; color: #073ceb; font-weight: 600; text-align: right; padding: 4px 8px 0; }
  .ghi-chu { margin: 8px 24px; padding: 8px 12px; background: #fffbeb; border: 1px solid #f59e0b; border-radius: 4px; font-size: 12px; color: #92400e; }
  .signatures { display: flex; gap: 0; padding: 20px 24px 0; border-top: 1px solid #eee; }
  .sig-col { flex: 1; text-align: center; }
  .sig-col:not(:last-child) { border-right: 1px dashed #ddd; }
  .sig-title { font-size: 11px; font-weight: 700; color: #222; margin: 0 0 4px; }
  .sig-note { font-size: 9px; color: #aaa; font-style: italic; margin: 0 0 36px; }
  .sig-line { border-bottom: 1px solid #aaa; width: 80%; margin: 0 auto; }
  .footer { text-align: center; padding: 16px 24px 8px; border-top: 1px solid #eee; }
  .footer p { font-size: 12px; color: #555; font-style: italic; margin: 0 0 2px; }
  .footer-small { font-size: 10px !important; color: #aaa !important; }
  @media print {
    body { margin: 0; }
    .page { max-width: 100%; padding: 0; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <img src="https://betongtaydo.com/wp-content/uploads/2024/06/Logo-Be-Tong-Tay-Do-xanh-duong-1024x1024.png" alt="Logo">
    <div class="header-info">
      <h1>${COMPANY_NAME}</h1>
      <p>${COMPANY_ADDR}</p>
      <p>ĐT: ${COMPANY_PHONE} – MST: ${COMPANY_MST}</p>
    </div>
  </div>

  <!-- Title -->
  <div class="title-bar">
    <h2>Hóa đơn bán hàng</h2>
    <p>VAT Invoice</p>
  </div>

  <!-- Meta -->
  <div class="meta">
    <div class="meta-block">
      <div class="meta-row"><span class="meta-label">Số hóa đơn:</span><span class="meta-val">${hd.maHoaDon}</span></div>
      <div class="meta-row"><span class="meta-label">Mã đơn hàng:</span><span class="meta-val">${ls.maDonHang || ''}</span></div>
    </div>
    <div class="meta-block">
      <div class="meta-row"><span class="meta-label">Ngày lập:</span><span class="meta-val">${hd.ngayLap ? new Date(hd.ngayLap).toLocaleDateString('vi-VN') : ''}</span></div>
      ${hanTra}
    </div>
  </div>

  <!-- Khách hàng -->
  <div class="section">
    <div class="section-title">Thông tin khách hàng</div>
    <div class="two-col">
      <div>
        <div class="info-row"><span class="info-label">Tên khách hàng:</span><span class="info-val">${hd.khachHang || ls.tenKhachHang || ''}</span></div>
        <div class="info-row"><span class="info-label">Địa chỉ giao hàng:</span><span class="info-val">${ls.diaChiNhan || ''}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Ngày giao hàng:</span><span class="info-val">${ls.ngayGiao ? new Date(ls.ngayGiao).toLocaleDateString('vi-VN') : ''}</span></div>
        <div class="info-row"><span class="info-label">Trạm trộn:</span><span class="info-val">${ls.tenTramTron || ''}</span></div>
      </div>
    </div>
  </div>

  <!-- Sản phẩm -->
  <div class="section">
    <div class="section-title">Thông tin sản phẩm / dịch vụ</div>
    <div class="two-col">
      <div>
        <div class="info-row"><span class="info-label">Mác bê tông:</span><span class="info-val">${ls.tenMacBeTong || ''}</span></div>
        <div class="info-row"><span class="info-label">Loại xi măng:</span><span class="info-val">${hd.loaiXiMang || 'PCB40'}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Khối lượng đặt:</span><span class="info-val">${ls.khoiLuongDat || 0} m³</span></div>
        <div class="info-row"><span class="info-label">Giờ đổ:</span><span class="info-val">${hd.gioDo || ''}</span></div>
      </div>
    </div>
  </div>

  <!-- Bảng chi tiết -->
  <table>
    <thead>
      <tr><th style="width:36px">STT</th><th>Nội dung</th><th style="width:50px;text-align:center">ĐVT</th><th class="num" style="width:70px">Số lượng</th><th class="num" style="width:110px">Đơn giá (đ)</th><th class="num" style="width:130px">Thành tiền (đ)</th></tr>
    </thead>
    <tbody>
      ${rowsChiTiet.join('\n')}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5" class="num">TỔNG CỘNG</td>
        <td class="num">${hd.tongCong.toLocaleString('vi-VN')}</td>
      </tr>
    </tfoot>
  </table>
  <div class="so-tien-chu">Số tiền bằng chữ: ${numberToVietnameseDoc(hd.tongCong)}</div>

  <!-- Thanh toán -->
  <div class="section">
    <div class="section-title">Thông tin thanh toán</div>
    <div class="two-col">
      <div>
        <div class="info-row"><span class="info-label">Phương thức TT:</span><span class="info-val">${pttt}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Loại thanh toán:</span><span class="info-val">${loaiTT}</span></div>
      </div>
    </div>
  </div>

  ${nhanSuRows.length > 0 ? `
  <!-- Nhân sự & xe -->
  <div class="section">
    <div class="section-title">Thông tin nhân sự &amp; xe</div>
    <table style="width:auto">
      <tbody>
        ${nhanSuRows.join('\n')}
      </tbody>
    </table>
  </div>` : ''}

  ${hd.ghiChu ? `<div class="ghi-chu"><strong>Ghi chú:</strong> ${hd.ghiChu}</div>` : ''}

  <!-- Chữ ký -->
  <div class="signatures">
    <div class="sig-col">
      <p class="sig-title">NGƯỜI LẬP HÓA ĐƠN</p>
      <p class="sig-note">(Ký và ghi rõ họ tên)</p>
      <div class="sig-line"></div>
    </div>
    <div class="sig-col">
      <p class="sig-title">KẾ TOÁN TRƯỞNG</p>
      <p class="sig-note">(Ký và ghi rõ họ tên)</p>
      <div class="sig-line"></div>
    </div>
    <div class="sig-col">
      <p class="sig-title">KHÁCH HÀNG</p>
      <p class="sig-note">(Ký và ghi rõ họ tên)</p>
      <div class="sig-line"></div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ của <strong>BÊ TÔNG TÂY ĐÔ</strong>!</p>
    <p class="footer-small">${COMPANY_NAME} • ${COMPANY_ADDR}</p>
  </div>
</div>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}

/** Đọc số thành chữ cho DOC (hỗ trợ đến hàng tỷ) */
function numberToVietnameseDoc(n: number): string {
  if (n === 0) return 'Không đồng';
  if (n < 0) return 'Âm ' + numberToVietnameseDoc(-n);
  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function readThree(num: number): string {
    if (num === 0) return '';
    const h = Math.floor(num / 100);
    const r = num % 100;
    const t = Math.floor(r / 10);
    const u = r % 10;
    let s = '';
    if (h > 0) s += (h === 1 ? 'một' : digits[h]) + ' trăm';
    if (r > 0) {
      if (h > 0) s += ' ';
      if (r < 10) s += digits[u];
      else if (r < 20) s += 'mười' + (u > 0 ? ' ' + digits[u] : '');
      else s += (t === 1 ? 'mười' : digits[t] + ' mươi') + (u > 0 ? ' ' + (u === 1 ? 'mốt' : digits[u]) : '');
    }
    return s;
  }
  const str = Math.round(n).toString();
  const len = str.length;
  const parts: string[] = [];
  for (let i = len; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    const part = parseInt(str.slice(start, i), 10);
    const unitIdx = Math.floor((len - i) / 3);
    const text = readThree(part);
    if (text) parts.unshift(text + (units[unitIdx] ? ' ' + units[unitIdx] : ''));
  }
  return parts.join(' ') + ' đồng';
}
