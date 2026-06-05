import { v4 as uuidv4 } from "uuid";
import { query, vnNow } from "../config/database";
import { ApiResponseWithPagination, DonHang } from "../models";
import { guiThongBao } from "./thong-bao-service";

// Map trạng thái đơn hàng sang nhãn hiển thị
export const TRANG_THAI_LABELS: Record<string, string> = {
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  dang_san_xuat: "Đang sản xuất",
  dang_giao: "Đang giao",
  da_giao: "Đã giao",
  nghiem_thu: "Nghiệm thu",
  da_thanh_toan: "Thanh toán",
  da_hoan_thanh: "Hoàn thành",
  tu_choi: "Từ chối",
};

export async function layTatCaDonHang(
  page: number = 1,
  limit: number = 20,
  trangThai?: string,
  tuKhoa?: string,
): Promise<ApiResponseWithPagination<DonHang[]>> {
  const offset = (page - 1) * limit;
  let whereClause = "WHERE 1=1";
  const params: Record<string, unknown> = {};

  if (trangThai) {
    whereClause += " AND d.trangThaiDon = @trangThai";
    params.trangThai = trangThai;
  }

  if (tuKhoa) {
    whereClause +=
      " AND (d.maDonHang LIKE @tuKhoa OR d.tenKhachHang LIKE @tuKhoa OR d.diaChiNhan LIKE @tuKhoa)";
    params.tuKhoa = `%${tuKhoa}%`;
  }

  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM DonHang d ${whereClause}`,
    params,
  );
  const total = countResult[0]?.total || 0;

  const donHangs = await query<DonHang>(
    `SELECT d.*,
            kh.maKhachHang,
            t.tenTram as tenTramTron,
            nt.tenDangNhap as maNguoiTao,
            nt.hoTen as tenNguoiTao,
            nd.tenDangNhap as maNguoiDuyet,
            nd.hoTen as tenNguoiDuyet
     FROM DonHang d
     LEFT JOIN KhachHang kh ON d.idKhachHang = kh.id
     LEFT JOIN TramTron t ON d.idTramTron = t.id
     LEFT JOIN NguoiDung nt ON d.nguoiTaoId = nt.id
     LEFT JOIN NguoiDung nd ON d.nguoiDuyetId = nd.id
     ${whereClause}
     ORDER BY d.ngayTao DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    { ...params, offset, limit },
  );

  return {
    success: true,
    message: "Lấy danh sách đơn hàng thành công",
    data: donHangs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function layDonHangTheoId(id: number): Promise<DonHang> {
  const donHangs = await query<DonHang>(
    `SELECT d.*,
            kh.maKhachHang,
            t.tenTram as tenTramTron,
            m.donGia as giaNiemYet,
            (SELECT TOP 1 hd.giamTru FROM HoaDon hd WHERE hd.idDonHang = d.id ORDER BY hd.id DESC) as giamTru
     FROM DonHang d
     LEFT JOIN KhachHang kh ON d.idKhachHang = kh.id
     LEFT JOIN TramTron t ON d.idTramTron = t.id
     LEFT JOIN MacBeTong m ON d.idMacBeTong = m.id
     WHERE d.id = @id`,
    { id },
  );

  if (donHangs.length === 0) {
    throw new Error("Không tìm thấy đơn hàng");
  }

  return donHangs[0];
}

export async function taoDonHang(
  data: Partial<DonHang>,
  nguoiTaoId: number,
): Promise<DonHang> {
  const maDonHang = `DH${Date.now().toString().slice(-8)}-${uuidv4().slice(0, 4).toUpperCase()}`;
  const chiPhiPhatSinh = data.chiPhiPhatSinh || 0;
  const buVanChuyen = data.buVanChuyen || 0;
  const thanhTien =
    (data.khoiLuongDat || 0) * (data.donGia || 0) +
    chiPhiPhatSinh +
    buVanChuyen;
  const conLai = thanhTien;

  const result = await query<DonHang>(
    `INSERT INTO DonHang (
      maDonHang, idKhachHang, idMacBeTong, idTramTron,
      tenKhachHang, diaChiNhan, soDienThoai,
      tenMacBeTong, khoiLuongDat, donGia, chiPhiPhatSinh, buVanChuyen, thanhTien, conLai,
      thoiGianGiaoDuKien, trangThaiDon, trangThaiHoanThanh,
      nguoiTaoId, ghiChu
    ) VALUES (
      @maDonHang, @idKhachHang, @idMacBeTong, @idTramTron,
      @tenKhachHang, @diaChiNhan, @soDienThoai,
      @tenMacBeTong, @khoiLuongDat, @donGia, @chiPhiPhatSinh, @buVanChuyen, @thanhTien, @conLai,
      @thoiGianGiaoDuKien, N'cho_duyet', N'chua_hoan_thanh',
      @nguoiTaoId, @ghiChu
    );
    SELECT * FROM DonHang WHERE id = SCOPE_IDENTITY();`,
    {
      maDonHang,
      idKhachHang: data.idKhachHang || null,
      idMacBeTong: data.idMacBeTong || null,
      idTramTron: data.idTramTron || null,
      tenKhachHang: data.tenKhachHang || "",
      diaChiNhan: data.diaChiNhan || "",
      soDienThoai: data.soDienThoai || "",
      tenMacBeTong: data.tenMacBeTong || "",
      khoiLuongDat: data.khoiLuongDat || 0,
      donGia: data.donGia || 0,
      chiPhiPhatSinh,
      buVanChuyen,
      thanhTien,
      conLai,
      thoiGianGiaoDuKien: data.thoiGianGiaoDuKien || null,
      nguoiTaoId,
      ghiChu: data.ghiChu || null,
    },
  );

  const donHangMoi = result[0];

  // Gửi thông báo realtime qua Socket.IO cho kế toán và admin
  guiThongBao("NEW_ORDER", {
    id: donHangMoi.id,
    maDonHang: donHangMoi.maDonHang,
    tenKhachHang: data.tenKhachHang || "",
  });

  return donHangMoi;
}

export async function suaDonHang(
  id: number,
  data: Partial<DonHang>,
): Promise<{ updated: DonHang; cu: Partial<DonHang> }> {
  const existing = await layDonHangTheoId(id);

  if (existing.trangThaiDon !== "cho_duyet") {
    throw new Error("Chỉ có thể sửa đơn hàng đang chờ duyệt");
  }

  const cu: Partial<DonHang> = {
    tenKhachHang: existing.tenKhachHang,
    diaChiNhan: existing.diaChiNhan,
    soDienThoai: existing.soDienThoai,
    tenMacBeTong: existing.tenMacBeTong,
    khoiLuongDat: existing.khoiLuongDat,
    donGia: existing.donGia,
    chiPhiPhatSinh: existing.chiPhiPhatSinh,
    buVanChuyen: existing.buVanChuyen,
    thoiGianGiaoDuKien: existing.thoiGianGiaoDuKien,
    ghiChu: existing.ghiChu,
  };

  const khoiLuong = data.khoiLuongDat ?? existing.khoiLuongDat;
  const donGia = data.donGia ?? existing.donGia;
  const chiPhiPhatSinh = data.chiPhiPhatSinh ?? existing.chiPhiPhatSinh ?? 0;
  const buVanChuyen = data.buVanChuyen ?? existing.buVanChuyen ?? 0;
  const thanhTien = khoiLuong * donGia + chiPhiPhatSinh + buVanChuyen;

  await query(
    `UPDATE DonHang SET
      idKhachHang = @idKhachHang, idMacBeTong = @idMacBeTong, idTramTron = @idTramTron,
      tenKhachHang = @tenKhachHang, diaChiNhan = @diaChiNhan, soDienThoai = @soDienThoai,
      tenMacBeTong = @tenMacBeTong, khoiLuongDat = @khoiLuongDat, donGia = @donGia,
      chiPhiPhatSinh = @chiPhiPhatSinh, buVanChuyen = @buVanChuyen,
      thanhTien = @thanhTien, conLai = @conLai, thoiGianGiaoDuKien = @thoiGianGiaoDuKien,
      ghiChu = @ghiChu, ngayCapNhat = ${vnNow()}
     WHERE id = @id`,
    {
      id,
      idKhachHang: data.idKhachHang ?? existing.idKhachHang,
      idMacBeTong: data.idMacBeTong ?? existing.idMacBeTong,
      idTramTron: data.idTramTron ?? existing.idTramTron,
      tenKhachHang: data.tenKhachHang ?? existing.tenKhachHang,
      diaChiNhan: data.diaChiNhan ?? existing.diaChiNhan,
      soDienThoai: data.soDienThoai ?? existing.soDienThoai,
      tenMacBeTong: data.tenMacBeTong ?? existing.tenMacBeTong,
      khoiLuongDat: khoiLuong,
      donGia,
      chiPhiPhatSinh,
      buVanChuyen,
      thanhTien,
      conLai: thanhTien - existing.daThanhToan,
      thoiGianGiaoDuKien:
        data.thoiGianGiaoDuKien ?? existing.thoiGianGiaoDuKien,
      ghiChu: data.ghiChu ?? existing.ghiChu,
    },
  );

  const moi: Partial<DonHang> = {
    tenKhachHang: data.tenKhachHang ?? existing.tenKhachHang,
    diaChiNhan: data.diaChiNhan ?? existing.diaChiNhan,
    soDienThoai: data.soDienThoai ?? existing.soDienThoai,
    tenMacBeTong: data.tenMacBeTong ?? existing.tenMacBeTong,
    khoiLuongDat: khoiLuong,
    donGia,
    chiPhiPhatSinh,
    buVanChuyen,
    thanhTien,
    conLai: thanhTien - existing.daThanhToan,
    thoiGianGiaoDuKien: data.thoiGianGiaoDuKien ?? existing.thoiGianGiaoDuKien,
    ghiChu: data.ghiChu ?? existing.ghiChu,
  };

  const updated = (
    await query<DonHang>(
      `SELECT d.*, kh.maKhachHang, t.tenTram as tenTramTron FROM DonHang d LEFT JOIN KhachHang kh ON d.idKhachHang = kh.id LEFT JOIN TramTron t ON d.idTramTron = t.id WHERE d.id = @id`,
      { id },
    )
  )[0];

  return { updated, cu };
}

export async function duyetDonHang(
  id: number,
  nguoiDuyetId: number,
): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET
      trangThaiDon = N'da_duyet',
      ngayDuyet = ${vnNow()},
      nguoiDuyetId = @nguoiDuyetId,
      ngayCapNhat = ${vnNow()}
     WHERE id = @id`,
    { id, nguoiDuyetId },
  );

  const donHang = (
    await query<DonHang>(
      `SELECT d.*, kh.maKhachHang, t.tenTram as tenTramTron FROM DonHang d LEFT JOIN KhachHang kh ON d.idKhachHang = kh.id LEFT JOIN TramTron t ON d.idTramTron = t.id WHERE d.id = @id`,
      { id },
    )
  )[0];

  guiThongBao("ORDER_APPROVED", { id, maDonHang: donHang.maDonHang });

  // Thông báo ORDER_STATUS_CHANGED - Đã duyệt
  guiThongBao("ORDER_STATUS_CHANGED", {
    id,
    maDonHang: donHang.maDonHang,
    trangThai: "da_duyet",
    trangThaiLabel: "Đã duyệt",
  });

  return donHang;
}

export async function tuChoiDonHang(
  id: number,
  lyDo: string,
): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET
      trangThaiDon = N'tu_choi',
      lyDoTuChoi = @lyDo,
      ngayCapNhat = ${vnNow()}
     WHERE id = @id`,
    { id, lyDo },
  );

  const donHang = (
    await query<DonHang>(
      `SELECT d.*, kh.maKhachHang, t.tenTram as tenTramTron FROM DonHang d LEFT JOIN KhachHang kh ON d.idKhachHang = kh.id LEFT JOIN TramTron t ON d.idTramTron = t.id WHERE d.id = @id`,
      { id },
    )
  )[0];

  guiThongBao("ORDER_REJECTED", { id, maDonHang: donHang.maDonHang, lyDo });

  return donHang;
}

export async function capNhatTrangThaiDon(
  id: number,
  trangThaiDon: DonHang["trangThaiDon"],
  ghiChu?: string,
): Promise<DonHang> {
  await query(
    `UPDATE DonHang SET trangThaiDon = @trangThaiDon, ghiChu = @ghiChu, ngayCapNhat = ${vnNow()} WHERE id = @id`,
    { id, trangThaiDon, ghiChu: ghiChu || null },
  );

  const donHang = (
    await query<DonHang>(
      `SELECT d.*, kh.maKhachHang, t.tenTram as tenTramTron FROM DonHang d LEFT JOIN KhachHang kh ON d.idKhachHang = kh.id LEFT JOIN TramTron t ON d.idTramTron = t.id WHERE d.id = @id`,
      { id },
    )
  )[0];

  const trangThaiLabel = TRANG_THAI_LABELS[trangThaiDon] || trangThaiDon;

  // Gửi thông báo cho mọi bước
  if (trangThaiDon === "da_hoan_thanh") {
    guiThongBao("ORDER_COMPLETED", {
      id,
      maDonHang: donHang.maDonHang,
      trangThaiLabel,
    });
  } else {
    guiThongBao("ORDER_STATUS_CHANGED", {
      id,
      maDonHang: donHang.maDonHang,
      trangThai: trangThaiDon,
      trangThaiLabel,
    });
  }

  return donHang;
}

export async function xoaDonHang(id: number): Promise<DonHang> {
  const existing = await layDonHangTheoId(id);

  // Xóa các bản ghi liên quan trước
  await query(`DELETE FROM LichSanXuat WHERE idDonHang = @id`, { id });
  await query(`DELETE FROM NghiemThu WHERE idDonHang = @id`, { id });
  await query(`DELETE FROM ThanhToan WHERE idDonHang = @id`, { id });
  await query(`DELETE FROM DonHang WHERE id = @id`, { id });
  return existing;
}

export async function xacNhanGiaoThanhCong(
  idDonHang: number,
  khoiLuongThucTe?: number,
): Promise<DonHang> {
  const kltt =
    khoiLuongThucTe != null && !isNaN(khoiLuongThucTe) ? khoiLuongThucTe : null;
  await query(
    `UPDATE DonHang SET
      trangThaiDon = N'da_giao',
      khoiLuongThucTe = @khoiLuongThucTe,
      ngayGiao = ${vnNow()},
      ngayCapNhat = ${vnNow()}
     WHERE id = @id`,
    { id: idDonHang, khoiLuongThucTe: kltt },
  );

  return (
    await query<DonHang>(
      `SELECT d.*, kh.maKhachHang, t.tenTram as tenTramTron FROM DonHang d LEFT JOIN KhachHang kh ON d.idKhachHang = kh.id LEFT JOIN TramTron t ON d.idTramTron = t.id WHERE d.id = @id`,
      { id: idDonHang },
    )
  )[0];
}
