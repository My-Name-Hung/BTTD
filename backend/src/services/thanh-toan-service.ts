import { query } from '../config/database';
import { ThanhToan, CongNo, DonHang, ApiResponseWithPagination } from '../models';
import { guiThongBao } from './thong-bao-service';

const THANH_TOAN = 'da_thanh_toan';
const DA_HOAN_THANH = 'da_hoan_thanh';
const CHUA_THANH_TOAN = 'chua_thanh_toan';

export async function taoThanhToan(
  data: Partial<ThanhToan>,
  nguoiTaoId: number
): Promise<ThanhToan> {
  const donHang = await query<DonHang>(
    `SELECT * FROM DonHang WHERE id = @id`,
    { id: data.idDonHang }
  );

  if (donHang.length === 0) {
    throw new Error('Không tìm thấy đơn hàng');
  }

  const result = await query<ThanhToan>(
    `INSERT INTO ThanhToan (idDonHang, soTien, hinhThuc, ngayThanhToan, nguoiNhan, ghiChu, nguoiTaoId)
     VALUES (@idDonHang, @soTien, @hinhThuc, GETDATE(), @nguoiNhan, @ghiChu, @nguoiTaoId);
     SELECT * FROM ThanhToan WHERE id = SCOPE_IDENTITY();`,
    {
      idDonHang: data.idDonHang,
      soTien: data.soTien || 0,
      hinhThuc: data.hinhThuc || 'tien_mat',
      nguoiNhan: data.nguoiNhan || null,
      ghiChu: data.ghiChu || null,
      nguoiTaoId,
    }
  );

  const thanhToanMoi = result[0];
  const donHangHienTai = donHang[0];
  const daThanhToanMoi = donHangHienTai.daThanhToan + thanhToanMoi.soTien;
  const conLaiMoi = donHangHienTai.thanhTien - daThanhToanMoi;

  const trangThaiMoi =
    conLaiMoi <= 0 ? THANH_TOAN : donHangHienTai.trangThaiDon;
  const hoanThanhMoi =
    conLaiMoi <= 0 ? DA_HOAN_THANH : donHangHienTai.trangThaiHoanThanh;

  await query(
    `UPDATE DonHang SET
      daThanhToan = @daThanhToan, conLai = @conLai,
      trangThaiDon = @trangThaiDon, trangThaiHoanThanh = @trangThaiHoanThanh,
      ngayCapNhat = GETDATE()
     WHERE id = @id`,
    {
      id: data.idDonHang,
      daThanhToan: daThanhToanMoi,
      conLai: conLaiMoi < 0 ? 0 : conLaiMoi,
      trangThaiDon: trangThaiMoi,
      trangThaiHoanThanh: hoanThanhMoi,
    }
  );

  if (conLaiMoi > 0) {
    await query(
      `IF EXISTS (SELECT * FROM CongNo WHERE idDonHang = @idDonHang)
       BEGIN
         UPDATE CongNo SET daThanhToan = @daThanhToan, conLai = @conLai, ngayCapNhat = GETDATE() WHERE idDonHang = @idDonHang;
       END
       ELSE
       BEGIN
         INSERT INTO CongNo (idDonHang, tongTien, daThanhToan, conLai, trangThai)
         VALUES (@idDonHang, @tongTien, @daThanhToan, @conLai, @trangThai_cn);
       END`,
      {
        idDonHang: data.idDonHang,
        daThanhToan: daThanhToanMoi,
        conLai: conLaiMoi < 0 ? 0 : conLaiMoi,
        tongTien: donHangHienTai.thanhTien,
        trangThai_cn: CHUA_THANH_TOAN,
      }
    );
  }

  // Gửi thông báo thanh toán
  guiThongBao('PAYMENT_RECEIVED', {
    id: data.idDonHang,
    maDonHang: donHangHienTai.maDonHang,
    tenKhachHang: donHangHienTai.tenKhachHang,
    soTien: thanhToanMoi.soTien,
  });

  // Nếu đơn hoàn thành (đã thanh toán đủ), thông báo ORDER_COMPLETED
  if (conLaiMoi <= 0) {
    guiThongBao('ORDER_COMPLETED', {
      id: data.idDonHang,
      maDonHang: donHangHienTai.maDonHang,
    });

    // Cập nhật trạng thái thành hoàn thành
    await query(
      `UPDATE DonHang SET trangThaiDon = N'da_hoan_thanh', trangThaiHoanThanh = N'hoan_thanh', ngayCapNhat = GETDATE() WHERE id = @id`,
      { id: data.idDonHang }
    );
  }

  return thanhToanMoi;
}

export async function layThanhToanTheoDonHang(idDonHang: number): Promise<ThanhToan[]> {
  return await query<ThanhToan>(
    `SELECT * FROM ThanhToan WHERE idDonHang = @idDonHang ORDER BY ngayTao DESC`,
    { idDonHang }
  );
}

export async function layTatCaCongNo(
  page: number = 1,
  limit: number = 20,
  trangThai?: string
): Promise<ApiResponseWithPagination<CongNo[]>> {
  const offset = (page - 1) * limit;
  let whereClause = 'WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (trangThai) {
    whereClause += ' AND cn.trangThai = @trangThai';
    params.trangThai = trangThai;
  }

  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM CongNo cn ${whereClause}`,
    params
  );
  const total = countResult[0]?.total || 0;

  const congNos = await query<CongNo>(
    `SELECT cn.*, dh.maDonHang, dh.tenKhachHang, dh.thanhTien
     FROM CongNo cn
     JOIN DonHang dh ON cn.idDonHang = dh.id
     ${whereClause}
     ORDER BY cn.ngayTao DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    { ...params, offset, limit }
  );

  return {
    success: true,
    message: 'Lấy danh sách công nợ thành công',
    data: congNos,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function taoCongNo(
  idDonHang: number,
  ngayBatDau?: string,
  hanThanhToan?: string
): Promise<CongNo> {
  const donHang = await query<DonHang>(
    `SELECT * FROM DonHang WHERE id = @id`,
    { id: idDonHang }
  );

  if (donHang.length === 0) {
    throw new Error('Không tìm thấy đơn hàng');
  }

  const dh = donHang[0];

  const result = await query<CongNo>(
    `IF EXISTS (SELECT * FROM CongNo WHERE idDonHang = @idDonHang)
     BEGIN
       UPDATE CongNo SET tongTien = @tongTien, conLai = @conLai, ngayBatDau = @ngayBatDau, hanThanhToan = @hanThanhToan, ngayCapNhat = GETDATE()
       WHERE idDonHang = @idDonHang;
       SELECT * FROM CongNo WHERE idDonHang = @idDonHang;
     END
     ELSE
     BEGIN
       INSERT INTO CongNo (idDonHang, tongTien, daThanhToan, conLai, ngayBatDau, hanThanhToan, trangThai)
       VALUES (@idDonHang, @tongTien, @daThanhToan, @conLai, @ngayBatDau, @hanThanhToan, @trangThai_cn2);
       SELECT * FROM CongNo WHERE id = SCOPE_IDENTITY();
     END`,
    {
      idDonHang,
      tongTien: dh.thanhTien,
      daThanhToan: dh.daThanhToan,
      conLai: dh.conLai,
      ngayBatDau: ngayBatDau || null,
      hanThanhToan: hanThanhToan || null,
      trangThai_cn2: CHUA_THANH_TOAN,
    }
  );

  return result[0];
}
