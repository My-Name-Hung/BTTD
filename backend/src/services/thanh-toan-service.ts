import { query, vnNow } from '../config/database';
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
     VALUES (@idDonHang, @soTien, @hinhThuc, ${vnNow()}, @nguoiNhan, @ghiChu, @nguoiTaoId);
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
      ngayCapNhat = ${vnNow()}
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
         UPDATE CongNo SET daThanhToan = @daThanhToan, conLai = @conLai, ngayCapNhat = ${vnNow()} WHERE idDonHang = @idDonHang;
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
      `UPDATE DonHang SET trangThaiDon = N'da_hoan_thanh', trangThaiHoanThanh = N'hoan_thanh', ngayCapNhat = ${vnNow()} WHERE id = @id`,
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
  opts?: { trangThai?: string; nhom?: string; search?: string }
): Promise<ApiResponseWithPagination<CongNo[]>> {
  const offset = (page - 1) * limit;
  let whereClause = 'WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (opts?.trangThai) {
    whereClause += ' AND cn.trangThai = @trangThai';
    params.trangThai = opts.trangThai;
  }
  if (opts?.nhom) {
    whereClause += ' AND cn.nhom = @nhom';
    params.nhom = opts.nhom;
  }
  if (opts?.search) {
    whereClause += ' AND (dh.maDonHang LIKE @search OR dh.tenKhachHang LIKE @search)';
    params.search = `%${opts.search}%`;
  }

  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM CongNo cn JOIN DonHang dh ON cn.idDonHang = dh.id ${whereClause}`,
    params
  );
  const total = countResult[0]?.total || 0;

  const congNos = await query<CongNo>(
    `SELECT cn.*, dh.maDonHang, dh.tenKhachHang, dh.thanhTien
     FROM CongNo cn
     JOIN DonHang dh ON cn.idDonHang = dh.id
     ${whereClause}
     ORDER BY cn.nhom ASC, cn.ngayTao DESC
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
       UPDATE CongNo SET tongTien = @tongTien, conLai = @conLai, ngayBatDau = @ngayBatDau, hanThanhToan = @hanThanhToan, ngayCapNhat = ${vnNow()}
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

export async function layCongNoTheoId(id: number): Promise<CongNo | null> {
  const result = await query<CongNo>(
    `SELECT cn.*, dh.maDonHang, dh.tenKhachHang
     FROM CongNo cn
     JOIN DonHang dh ON cn.idDonHang = dh.id
     WHERE cn.id = @id`,
    { id }
  );
  return result[0] || null;
}

export async function suaCongNo(
  id: number,
  data: {
    tongTien?: number;
    daThanhToan?: number;
    conLai?: number;
    ngayBatDau?: string | null;
    hanThanhToan?: string | null;
    trangThai?: string;
    ghiChu?: string | null;
    nhom?: string | null;
  }
): Promise<CongNo> {
  const existing = await layCongNoTheoId(id);
  if (!existing) {
    throw new Error('Không tìm thấy công nợ');
  }

  const tongTien = data.tongTien ?? existing.tongTien;
  const daThanhToan = data.daThanhToan ?? existing.daThanhToan;
  const conLai = data.conLai ?? (tongTien - daThanhToan);
  const trangThai = data.trangThai ?? existing.trangThai;

  await query(
    `UPDATE CongNo
     SET tongTien = @tongTien,
         daThanhToan = @daThanhToan,
         conLai = @conLai,
         ngayBatDau = @ngayBatDau,
         hanThanhToan = @hanThanhToan,
         trangThai = @trangThai,
         ghiChu = @ghiChu,
         nhom = @nhom,
         ngayCapNhat = ${vnNow()}
     WHERE id = @id`,
    {
      id,
      tongTien,
      daThanhToan,
      conLai,
      ngayBatDau: data.ngayBatDau !== undefined ? data.ngayBatDau : existing.ngayBatDau,
      hanThanhToan: data.hanThanhToan !== undefined ? data.hanThanhToan : existing.hanThanhToan,
      trangThai,
      ghiChu: data.ghiChu !== undefined ? data.ghiChu : existing.ghiChu,
      nhom: data.nhom !== undefined ? data.nhom : existing.nhom,
    }
  );

  // Cập nhật lại đơn hàng tương ứng
  await query(
    `UPDATE DonHang SET daThanhToan = @daThanhToan, conLai = @conLai, ngayCapNhat = ${vnNow()} WHERE id = @idDonHang`,
    { daThanhToan, conLai, idDonHang: existing.idDonHang }
  );

  const updated = await layCongNoTheoId(id);
  return updated!;
}

export async function xoaCongNo(id: number): Promise<void> {
  await query(`DELETE FROM CongNo WHERE id = @id`, { id });
}

export async function layDanhSachNhomCongNo(): Promise<{ nhom: string; soLuong: number }[]> {
  const rows = await query<{ nhom: string; soLuong: number }[]>(
    `SELECT nhom, COUNT(*) as soLuong
     FROM CongNo
     WHERE nhom IS NOT NULL AND nhom <> ''
     GROUP BY nhom
     ORDER BY MIN(ngayTao) ASC`
  );
  return rows;
}

export interface CongNoGroup {
  nhom: string;
  items: (CongNo & { maDonHang?: string; tenKhachHang?: string })[];
  tongCongNo: number;
  tongDaThanhToan: number;
  tongConLai: number;
}

export async function layCongNoTheoNhom(
  search?: string,
  nhomFilter?: string
): Promise<CongNoGroup[]> {
  let whereClause = 'WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (search) {
    whereClause += ' AND (dh.maDonHang LIKE @search OR dh.tenKhachHang LIKE @search)';
    params.search = `%${search}%`;
  }
  if (nhomFilter) {
    whereClause += ' AND cn.nhom = @nhomFilter';
    params.nhomFilter = nhomFilter;
  }

  const rows = await query<CongNo & { maDonHang?: string; tenKhachHang?: string }>(
    `SELECT cn.*, dh.maDonHang, dh.tenKhachHang
     FROM CongNo cn
     JOIN DonHang dh ON cn.idDonHang = dh.id
     ${whereClause}
     ORDER BY cn.nhom ASC, cn.ngayTao DESC`,
    params
  );

  // Group by nhom
  const groupMap = new Map<string, CongNoGroup>();

  for (const row of rows) {
    const nhom = row.nhom || 'Chưa phân nhóm';
    if (!groupMap.has(nhom)) {
      groupMap.set(nhom, { nhom, items: [], tongCongNo: 0, tongDaThanhToan: 0, tongConLai: 0 });
    }
    const g = groupMap.get(nhom)!;
    g.items.push(row);
    g.tongCongNo += row.tongTien;
    g.tongDaThanhToan += row.daThanhToan;
    g.tongConLai += row.conLai;
  }

  return Array.from(groupMap.values());
}
