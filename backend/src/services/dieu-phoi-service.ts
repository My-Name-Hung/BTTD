import { query, vnNow } from '../config/database';
import { LichSanXuat, DonHang } from '../models';
import { guiThongBao } from './thong-bao-service';

export async function taoLichSanXuat(
  data: Partial<LichSanXuat>,
  nguoiTaoId: number
): Promise<LichSanXuat> {
  // Kiểm tra đơn hàng tồn tại
  const donHang = await query<DonHang>(
    `SELECT * FROM DonHang WHERE id = @idDonHang`,
    { idDonHang: data.idDonHang }
  );

  if (donHang.length === 0) {
    throw new Error('Không tìm thấy đơn hàng');
  }

  // Kiểm tra đã có lịch sản xuất cho TRẠM NÀY chưa (tránh trùng lặp)
  const existingLich = await query<{ id: number }>(
    `SELECT id FROM LichSanXuat WHERE idDonHang = @idDonHang AND idTramTron = @idTramTron AND trangThai != N'da_xong'`,
    { idDonHang: data.idDonHang, idTramTron: data.idTramTron }
  );
  if (existingLich.length > 0) {
    throw new Error('Đơn hàng này đã có lịch sản xuất cho trạm trộn này. Vui lòng cập nhật lịch hiện có hoặc hoàn thành lịch cũ trước khi tạo mới.');
  }

  // Lấy idTramTron từ form (do người dùng chọn khi lên lịch SX)
  const idTramTron = data.idTramTron || null;

  // Kiểm tra đơn hàng đã có lịch sản xuất nào chưa (để tránh gửi thông báo trùng lặp)
  // Chỉ gửi thông báo "tạo lịch" khi đơn hàng chưa từng có lịch sản xuất
  // (kể cả lịch đã hoàn thành) và đơn hàng chưa ở trạng thái sản xuất
  const existingAllLich = await query<{ id: number }>(
    `SELECT id FROM LichSanXuat WHERE idDonHang = @idDonHang`,
    { idDonHang: data.idDonHang }
  );
  const isFirstLich = existingAllLich.length === 0 && donHang[0].trangThaiDon === 'da_duyet';

  // Cập nhật tram trộn vào đơn hàng nếu được chọn
  if (idTramTron) {
    await query(
      `UPDATE DonHang SET idTramTron = @idTramTron, ngayCapNhat = ${vnNow()} WHERE id = @id`,
      { id: data.idDonHang, idTramTron }
    );
  }

  // Chỉ cập nhật trạng thái và gửi thông báo khi TẠO LỊCH ĐẦU TIÊN cho đơn hàng
  // Khi thêm trạm thứ 2, thứ 3... thì không gửi thông báo nữa
  if (isFirstLich) {
    await query(
      `UPDATE DonHang SET trangThaiDon = N'dang_san_xuat', ngayCapNhat = ${vnNow()} WHERE id = @id`,
      { id: data.idDonHang }
    );
  }

  // Lấy idTaiXe từ bảng Xe (qua idTaiKhoan)
  let idTaiXe: number | null = null;
  if (data.idXe) {
    const xe = await query<{ idTaiKhoan: number | null }>(
      `SELECT idTaiKhoan FROM Xe WHERE id = @idXe`,
      { idXe: data.idXe }
    );
    if (xe.length > 0 && xe[0].idTaiKhoan) {
      idTaiXe = xe[0].idTaiKhoan;
    }
  }

  const result = await query<LichSanXuat>(
    `INSERT INTO LichSanXuat (
      idDonHang, idXe, idTramTron, idTaiXe, kyThuatCongTrinh, nguoiOmOng, nguoiBatOng,
      phuongAnDo, bienSoXe, trangThai, ghiChu, driveLink
    ) VALUES (
      @idDonHang, @idXe, @idTramTron, @idTaiXe, @kyThuatCongTrinh, @nguoiOmOng, @nguoiBatOng,
      @phuongAnDo, @bienSoXe, N'chua_san_xuat', @ghiChu, @driveLink
    );
    SELECT * FROM LichSanXuat WHERE id = SCOPE_IDENTITY();`,
    {
      idDonHang: data.idDonHang,
      idXe: data.idXe || null,
      idTramTron,
      idTaiXe,
      kyThuatCongTrinh: data.kyThuatCongTrinh || null,
      nguoiOmOng: data.nguoiOmOng || null,
      nguoiBatOng: data.nguoiBatOng || null,
      phuongAnDo: data.phuongAnDo || null,
      bienSoXe: data.bienSoXe || null,
      ghiChu: data.ghiChu || null,
      driveLink: data.driveLink || null,
    }
  );

  // Thông báo cho kho: có đơn hàng cần giao (CHỈ gửi khi tạo lịch đầu tiên)
  if (isFirstLich) {
    guiThongBao('PRODUCTION_SCHEDULED', {
      id: data.idDonHang,
      maDonHang: donHang[0].maDonHang,
      tenKhachHang: donHang[0].tenKhachHang,
      khoiLuong: donHang[0].khoiLuongDat,
    });

    // Thông báo ORDER_STATUS_CHANGED - Đang sản xuất
    guiThongBao('ORDER_STATUS_CHANGED', {
      id: data.idDonHang,
      maDonHang: donHang[0].maDonHang,
      trangThai: 'dang_san_xuat',
      trangThaiLabel: 'Đang sản xuất',
    });
  }

  return result[0];
}

export async function layLichSanXuatTheoDonHang(idDonHang: number): Promise<any[]> {
  return await query<any[]>(
    `SELECT ls.*,
            nd.hoTen as tenTaiXe
     FROM LichSanXuat ls
     LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
     WHERE ls.idDonHang = @idDonHang
     ORDER BY ls.ngayTao DESC`,
    { idDonHang }
  );
}

export async function layTatCaLichSanXuat(
  page: number = 1,
  limit: number = 50,
  trangThai?: string
): Promise<{ data: any[]; total: number }> {
  const offset = (page - 1) * limit;
  let whereClause = 'WHERE 1=1';
  const params: Record<string, unknown> = { offset, limit };

  if (trangThai) {
    whereClause += ' AND ls.trangThai = @trangThai';
    params.trangThai = trangThai;
  }

  const [countResult] = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM LichSanXuat ls ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;

  const data = await query<any>(
    `SELECT ls.*,
            dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong, dh.khoiLuongDat, dh.trangThaiDon,
            ISNULL(tt.tenTram, N'Không xác định') as tenTram,
            nd.hoTen as tenTaiXe
     FROM LichSanXuat ls
     LEFT JOIN DonHang dh ON ls.idDonHang = dh.id
     LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
     LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
     ${whereClause}
     ORDER BY ls.ngayTao DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params
  );

  return { data, total };
}

export async function capNhatLichSanXuat(
  id: number,
  data: Partial<LichSanXuat>
): Promise<LichSanXuat> {
  // Lấy idTaiXe từ bảng Xe nếu có đổi xe
  let idTaiXe: number | null = null;
  if (data.idXe) {
    const xe = await query<{ idTaiKhoan: number | null }>(
      `SELECT idTaiKhoan FROM Xe WHERE id = @idXe`,
      { idXe: data.idXe }
    );
    if (xe.length > 0 && xe[0].idTaiKhoan) {
      idTaiXe = xe[0].idTaiKhoan;
    }
  }

  // Cập nhật tram trộn vào đơn hàng nếu được chọn
  if (data.idTramTron) {
    const [ls] = await query<{ idDonHang: number }>(`SELECT idDonHang FROM LichSanXuat WHERE id = @id`, { id });
    if (ls) {
      await query(
        `UPDATE DonHang SET idTramTron = @idTramTron, ngayCapNhat = ${vnNow()} WHERE id = @idDonHang`,
        { idDonHang: ls.idDonHang, idTramTron: data.idTramTron }
      );
    }
  }

  await query(
    `UPDATE LichSanXuat SET
      idXe = @idXe, idTaiXe = @idTaiXe, idTramTron = @idTramTron, kyThuatCongTrinh = @kyThuatCongTrinh,
      nguoiOmOng = @nguoiOmOng, nguoiBatOng = @nguoiBatOng,
      phuongAnDo = @phuongAnDo, bienSoXe = @bienSoXe,
      thoiGianTron = @thoiGianTron, thoiGianXuatBen = @thoiGianXuatBen,
      thoiGianDenCangDat = @thoiGianDenCangDat,
      thoiGianBatDauDo = @thoiGianBatDauDo, thoiGianKetThucDo = @thoiGianKetThucDo,
      trangThai = @trangThai, ghiChu = @ghiChu, driveLink = @driveLink,
      ngayCapNhat = ${vnNow()}
     WHERE id = @id`,
    {
      id,
      idXe: data.idXe ?? null,
      idTaiXe: idTaiXe ?? data.idTaiXe ?? null,
      idTramTron: data.idTramTron ?? null,
      kyThuatCongTrinh: data.kyThuatCongTrinh ?? null,
      nguoiOmOng: data.nguoiOmOng ?? null,
      nguoiBatOng: data.nguoiBatOng ?? null,
      phuongAnDo: data.phuongAnDo ?? null,
      bienSoXe: data.bienSoXe ?? null,
      thoiGianTron: data.thoiGianTron ?? null,
      thoiGianXuatBen: data.thoiGianXuatBen ?? null,
      thoiGianDenCangDat: data.thoiGianDenCangDat ?? null,
      thoiGianBatDauDo: data.thoiGianBatDauDo ?? null,
      thoiGianKetThucDo: data.thoiGianKetThucDo ?? null,
      trangThai: data.trangThai ?? 'chua_san_xuat',
      ghiChu: data.ghiChu ?? null,
      driveLink: data.driveLink ?? null,
    }
  );

  const [updated] = await query<LichSanXuat>(`SELECT * FROM LichSanXuat WHERE id = @id`, { id });
  if (!updated) {
    throw new Error('Không tìm thấy lịch sản xuất');
  }

  // Lấy thông tin đơn hàng để dùng cho thông báo
  const dh = await query<DonHang>(`SELECT * FROM DonHang WHERE id = @id`, { id: updated.idDonHang });
  const donHangInfo = dh[0];

  if (data.trangThai === 'da_xong') {
    await query(
      `UPDATE DonHang SET trangThaiDon = N'dang_giao', ngayCapNhat = ${vnNow()} WHERE id = @id`,
      { id: updated.idDonHang }
    );

    // Thông báo ORDER_STATUS_CHANGED - Đang giao
    guiThongBao('ORDER_STATUS_CHANGED', {
      id: updated.idDonHang,
      maDonHang: donHangInfo.maDonHang,
      trangThai: 'dang_giao',
      trangThaiLabel: 'Đang giao',
    });

    // Thông báo cho kho bắt đầu giao
    guiThongBao('DELIVERY_STARTED', {
      id: updated.idDonHang,
      maDonHang: donHangInfo.maDonHang,
      bienSoXe: data.bienSoXe || '',
    });
  } else {
    // Sửa lịch sản xuất thông thường → thông báo cho kho và điều phối
    const tramInfo = await query<{ tenTram: string }>(
      `SELECT tenTram FROM TramTron WHERE id = @id`,
      { id: updated.idTramTron }
    );
    guiThongBao('SCHEDULE_UPDATED', {
      id: updated.idDonHang,
      maDonHang: donHangInfo.maDonHang,
      tenTram: tramInfo[0]?.tenTram || '',
    });
  }

  return updated;
}

export async function xacNhanDaGiao(idDonHang: number): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET
      trangThaiDon = N'da_giao',
      ngayGiao = ${vnNow()},
      ngayCapNhat = ${vnNow()}
     WHERE id = @id`,
    { id: idDonHang }
  );

  const donHang = await query<DonHang>(`SELECT * FROM DonHang WHERE id = @id`, { id: idDonHang });

  // Thông báo ORDER_STATUS_CHANGED - Đã giao
  guiThongBao('ORDER_STATUS_CHANGED', {
    id: idDonHang,
    maDonHang: donHang[0].maDonHang,
    trangThai: 'da_giao',
    trangThaiLabel: 'Đã giao',
  });

  // Thông báo chờ nghiệm thu
  guiThongBao('DELIVERY_COMPLETED', {
    id: idDonHang,
    maDonHang: donHang[0].maDonHang,
    khoiLuong: donHang[0].khoiLuongThucTe || donHang[0].khoiLuongDat,
  });

  return donHang[0];
}

export async function layDonHangTheoXe(idXe: number): Promise<any[]> {
  return await query<any[]>(
    `SELECT dh.*,
            ls.bienSoXe, ls.ngayTao as ngayTaoLichSX,
            nd.hoTen as tenTaiXe
     FROM LichSanXuat ls
     INNER JOIN DonHang dh ON ls.idDonHang = dh.id
     LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
     WHERE ls.idXe = @idXe
     ORDER BY ls.ngayTao DESC`,
    { idXe }
  );
}

export async function xoaLichSanXuat(id: number): Promise<void> {
  await query(`DELETE FROM LichSanXuat WHERE id = @id`, { id });
}
