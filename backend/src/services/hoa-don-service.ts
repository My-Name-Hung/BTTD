import { query, vnNow } from "../config/database";
import { DonHang, ThanhToan } from "../models";
import {
  dongBoCongNoKhachHangTheoPhatSinh,
  layDuCuoiCoKhachHang,
} from "./cong-no-khach-hang-service";

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
  loaiThanhToan: "tra_het" | "tra_het_du" | "cong_no" | "cong_no_du";
  hanTraCongNo: Date | null;
  nguoiTaoId: number | null;
  createdAt: Date;
  // Tổng nghĩa vụ GỐC của đơn hàng tại thời điểm lập hóa đơn (= tienBeTongGoc + bv + pp - gt)
  // Lưu vào DB để in hóa đơn hiển thị chính xác "TỔNG NGHĨA VỤ ĐƠN HÀNG"
  tongNghiaVuDon?: number;
  // Tổng nghĩa vụ GỐC của đơn hàng (lúc tạo đơn) + đã thanh toán + bv/pp
  // Alias rõ ràng từ DonHang, dùng để frontend tính công nợ chính xác
  donHangThanhTien?: number;
  donHangDaThanhToan?: number;
  donHangBuVanChuyen?: number;
  donHangChiPhiPhatSinh?: number;
}

interface TaoHoaDonInput {
  idDonHang: number;
  loaiThanhToan: "tra_het" | "tra_het_du" | "cong_no" | "cong_no_du";
  tienBeTong?: number;
  buuVanChuyen?: number;
  phiPhatSinh?: number;
  giamTru?: number;
  ngayLap?: string;
  khachHang?: string;
  loaiXiMang?: string;
  gioDo?: string;
  phuongThucThanhToan?: string;
  ghiChu?: string;
  hanTraCongNo?: string;
  soTienThanhToanTruoc?: number;
  soTienDu?: number;
  soTienDuSuDung?: number;
}

interface HoaDonPhanBo {
  tienBeTongHoaDon: number;
  buuVanChuyenHoaDon: number;
  phiPhatSinhHoaDon: number;
  giamTruHoaDon: number;
  tongCongHoaDon: number;
}

function tinhTongNghiaVuDonHang(dh: DonHang, data: TaoHoaDonInput): number {
  // Tổng nghĩa vụ tài chính của đơn hàng = DonHang.thanhTien (gốc, đã bao gồm
  // bv/pp/gt nếu có lúc tạo đơn). Đây là cơ sở để:
  // 1) Phân bổ giá trị các thành phần (tiền bê tông, bù vận chuyển, ...)
  // 2) Tính "dư" khi khách trả vượt
  // 3) Quyết định đã tất toán hay chưa
  // LƯU Ý: KHÔNG ưu tiên data.tienBeTong gửi từ frontend vì ở công nợ lần 2+
  // frontend tự gán tienBeTong = donHang.conLai (số còn lại phải trả), không phải
  // tổng gốc. Lấy dh.thanhTien đảm bảo mọi lần thanh toán đều dựa trên cùng 1
  // mốc nghĩa vụ gốc.
  const tienBeTongGoc = dh.thanhTien || 0;
  // Vẫn dùng bv/pp/gt từ input để phân bổ đúng tỷ lệ thành phần, fallback về
  // DonHang nếu frontend không gửi.
  const buuVanChuyen =
    data.buuVanChuyen != null
      ? data.buuVanChuyen
      : dh.buVanChuyen || 0;
  const phiPhatSinh =
    data.phiPhatSinh != null
      ? data.phiPhatSinh
      : dh.chiPhiPhatSinh || 0;
  const giamTru = data.giamTru || 0;
  return Math.max(0, tienBeTongGoc + buuVanChuyen + phiPhatSinh - giamTru);
}

function phanBoGiaTriHoaDon(params: {
  loaiThanhToan: TaoHoaDonInput["loaiThanhToan"];
  tongNghiaVu: number;
  tongDaThanhToanTruocDo: number;
  tienBeTongGoc: number;
  buuVanChuyen: number;
  phiPhatSinh: number;
  giamTru: number;
  soTienTheHienKyNay: number;
  tongThuMoi?: number;
}): HoaDonPhanBo {
  const {
    loaiThanhToan,
    tongNghiaVu,
    tongDaThanhToanTruocDo,
    tienBeTongGoc,
    buuVanChuyen,
    phiPhatSinh,
    giamTru,
    soTienTheHienKyNay,
    tongThuMoi = soTienTheHienKyNay,
  } = params;

  const soTienMucTieu = Math.max(0, Math.min(soTienTheHienKyNay, tongNghiaVu));

  if (loaiThanhToan === "tra_het" || loaiThanhToan === "tra_het_du") {
    return {
      tienBeTongHoaDon: tienBeTongGoc,
      buuVanChuyenHoaDon: buuVanChuyen,
      phiPhatSinhHoaDon: phiPhatSinh,
      giamTruHoaDon: giamTru,
      tongCongHoaDon: tongNghiaVu,
    };
  }

  const tienBeTongDaPhuTruocDo = Math.min(
    tongDaThanhToanTruocDo,
    tienBeTongGoc,
  );
  const tienBeTongConLai = Math.max(0, tienBeTongGoc - tienBeTongDaPhuTruocDo);

  // Khi khách trả đủ/vượt nghĩa vụ TÍNH CỘNG DỒN (trước đó + kỳ này),
  // lấy 100% giá trị các thành phần. Đây là điều kiện để hóa đơn tất toán
  // hiển thị đúng tổng gốc (vd: đơn 350k, lần 1 trả 150k, lần 2 trả 200k
  // → tổng cộng dồn 350k = tongNghiaVu → lấy 100% thành phần).
  const tongCongDon = tongDaThanhToanTruocDo + tongThuMoi;
  const isTraDu = tongCongDon >= tongNghiaVu;
  if (isTraDu) {
    return {
      tienBeTongHoaDon: tienBeTongGoc,
      buuVanChuyenHoaDon: buuVanChuyen,
      phiPhatSinhHoaDon: phiPhatSinh,
      giamTruHoaDon: giamTru,
      tongCongHoaDon: Math.max(0, tongNghiaVu),
    };
  }

  // Phan bo theo ty le: soTienTheHienKyNay / tongNghiaVu
  const soTienPhanBo = Math.min(soTienTheHienKyNay, tongNghiaVu);
  const tyLe = tongNghiaVu > 0 ? soTienPhanBo / tongNghiaVu : 0;

  const tienBeTongHoaDon = Math.round(tienBeTongConLai * tyLe * 100) / 100;
  const buuVanChuyenHoaDon = Math.round(buuVanChuyen * tyLe * 100) / 100;
  const phiPhatSinhHoaDon = Math.round(phiPhatSinh * tyLe * 100) / 100;
  const giamTruHoaDon = Math.round(giamTru * tyLe * 100) / 100;

  // tongCongHoaDon = soTienTheHienKyNay (so tien thuc nhan), khong phu thuoc vao tong cac thanh phan
  const tongCongHoaDon = Math.max(0, soTienTheHienKyNay);

  return {
    tienBeTongHoaDon,
    buuVanChuyenHoaDon,
    phiPhatSinhHoaDon,
    giamTruHoaDon,
    tongCongHoaDon: Math.max(0, tongCongHoaDon),
  };
}

export async function taoHoaDon(
  data: TaoHoaDonInput,
  nguoiTaoId: number,
): Promise<HoaDon> {
  const donHang = await query<DonHang>(`SELECT * FROM DonHang WHERE id = @id`, {
    id: data.idDonHang,
  });

  if (donHang.length === 0) {
    throw new Error("Không tìm thấy đơn hàng");
  }

  const dh = donHang[0];
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const soHoaDon = `BBTD-${randomNum}-${dh.maDonHang}`;
  const maHoaDon = soHoaDon;

  // Ưu tiên tiền bê tông do frontend gửi lên (từ XuatHoaDonPage)
  // Fallback về khoiLuongDat * donGia nếu frontend không gửi
  const tienBeTongGoc =
    data.tienBeTong != null
      ? data.tienBeTong
      : (dh.khoiLuongDat || 0) * (dh.donGia || 0);
  const buuVanChuyen = data.buuVanChuyen || 0;
  const phiPhatSinh = data.phiPhatSinh || 0;
  const giamTru = data.giamTru || 0;
  const tongNghiaVu = tinhTongNghiaVuDonHang(dh, data);
  const tongDaThanhToanTruocDo = Math.max(0, dh.daThanhToan || 0);
  const tongConLaiTruocKhiLap = Math.max(
    0,
    tongNghiaVu - tongDaThanhToanTruocDo,
  );

  const soTienThanhToanTruoc = Math.max(0, data.soTienThanhToanTruoc || 0);
  const soTienDu = Math.max(0, data.soTienDu || 0);
  const duCuoiCoHienTai = await layDuCuoiCoKhachHang({
    idKhachHang: dh.idKhachHang || null,
    maKhachHang: dh.maKhachHang || null,
    tenKhachHang: dh.tenKhachHang || data.khachHang || "",
  });
  const soTienDuSuDung = Math.min(
    Math.max(0, data.soTienDuSuDung || 0),
    duCuoiCoHienTai,
    tongConLaiTruocKhiLap,
  );
  const tongThanhToanHieuLuc = Math.min(
    tongConLaiTruocKhiLap,
    soTienThanhToanTruoc + soTienDuSuDung,
  );

  const soTienThuMoi =
    data.loaiThanhToan === "tra_het"
      ? tongConLaiTruocKhiLap
      : data.loaiThanhToan === "tra_het_du"
        ? tongConLaiTruocKhiLap + soTienDu
        : data.loaiThanhToan === "cong_no_du"
          ? soTienThanhToanTruoc + soTienDu
          : soTienThanhToanTruoc;

  const phanBoHoaDon = phanBoGiaTriHoaDon({
    loaiThanhToan: data.loaiThanhToan,
    tongNghiaVu,
    tongDaThanhToanTruocDo,
    tienBeTongGoc,
    buuVanChuyen,
    phiPhatSinh,
    giamTru,
    // soTienTheHienKyNay = số tiền thực tế khách trả kỳ này (đã bao gồm cả dư sử dụng)
    soTienTheHienKyNay:
      data.loaiThanhToan === "tra_het" || data.loaiThanhToan === "tra_het_du"
        ? tongConLaiTruocKhiLap
        : soTienThuMoi,
    tongThuMoi: soTienThuMoi,
  });

  // tongCong = soTienThuMoi (số tiền thực nhận), không bị giới hạn bởi tongThanhToanHieuLuc
  const soTienThanhToan = soTienThuMoi;

  const result = await query<HoaDon>(
    `INSERT INTO HoaDon (
      idDonHang, maHoaDon, soHoaDon, ngayLap, khachHang, loaiXiMang, gioDo,
      phuongThucThanhToan, ghiChu, tienBeTong, buuVanChuyen, phiPhatSinh,
      giamTru, tongCong, soTienThanhToan, loaiThanhToan, hanTraCongNo, nguoiTaoId,
      tongNghiaVuDon
    ) VALUES (
      @idDonHang, @maHoaDon, @soHoaDon, @ngayLap, @khachHang, @loaiXiMang, @gioDo,
      @phuongThucThanhToan, @ghiChu, @tienBeTong, @buuVanChuyen, @phiPhatSinh,
      @giamTru, @tongCong, @soTienThanhToan, @loaiThanhToan, @hanTraCongNo, @nguoiTaoId,
      @tongNghiaVuDon
    );
    SELECT * FROM HoaDon WHERE id = SCOPE_IDENTITY();`,
    {
      idDonHang: data.idDonHang,
      maHoaDon,
      soHoaDon,
      ngayLap: data.ngayLap ? new Date(data.ngayLap) : new Date(),
      khachHang: data.khachHang || dh.tenKhachHang || "",
      loaiXiMang: data.loaiXiMang || "",
      gioDo: data.gioDo || "",
      phuongThucThanhToan: data.phuongThucThanhToan || "tien_mat",
      ghiChu: data.ghiChu || "",
      tienBeTong: phanBoHoaDon.tienBeTongHoaDon,
      buuVanChuyen: phanBoHoaDon.buuVanChuyenHoaDon,
      phiPhatSinh: phanBoHoaDon.phiPhatSinhHoaDon,
      giamTru: phanBoHoaDon.giamTruHoaDon,
      tongCong: phanBoHoaDon.tongCongHoaDon,
      soTienThanhToan,
      loaiThanhToan: data.loaiThanhToan,
      hanTraCongNo: data.hanTraCongNo ? new Date(data.hanTraCongNo) : null,
      nguoiTaoId,
      // Lưu tổng nghĩa vụ GỐC của đơn tại thời điểm lập hóa đơn
      // (dùng cho in hóa đơn, hiển thị "TỔNG NGHĨA VỤ ĐƠN HÀNG" chính xác)
      tongNghiaVuDon: tongNghiaVu,
    },
  );

  const hoaDon = result[0];

  if (data.loaiThanhToan === "tra_het" || data.loaiThanhToan === "tra_het_du") {
    await query<ThanhToan>(
      `INSERT INTO ThanhToan (idDonHang, soTien, hinhThuc, ngayThanhToan, nguoiNhan, ghiChu, nguoiTaoId)
       VALUES (@idDonHang, @soTien, @hinhThuc, ${vnNow()}, @nguoiNhan, @ghiChu, @nguoiTaoId);`,
      {
        idDonHang: data.idDonHang,
        soTien: soTienThuMoi,
        hinhThuc: data.phuongThucThanhToan || "tien_mat",
        nguoiNhan: "",
        ghiChu:
          data.loaiThanhToan === "tra_het_du"
            ? `Hóa đơn trả hết dư ${maHoaDon}`
            : `Hóa đơn ${maHoaDon}`,
        nguoiTaoId,
      },
    );

    await query(
      `UPDATE DonHang SET
        daThanhToan = @daThanhToan, conLai = 0,
        trangThaiDon = N'da_thanh_toan', trangThaiHoanThanh = N'da_hoan_thanh',
        ngayCapNhat = ${vnNow()}
       WHERE id = @id`,
      {
        id: data.idDonHang,
        daThanhToan: tongNghiaVu,
      },
    );

    await dongBoCongNoKhachHangTheoPhatSinh({
      idKhachHang: dh.idKhachHang || null,
      maKhachHang: dh.maKhachHang || null,
      tenKhachHang: dh.tenKhachHang || data.khachHang || "",
      nhom: dh.nhom || null,
      phatSinhNoTang: tongNghiaVu,
      phatSinhCoTang: soTienThuMoi + soTienDuSuDung,
    });
  }

  if (data.loaiThanhToan === "cong_no" || data.loaiThanhToan === "cong_no_du") {
    const daThanhToanMoi = tongDaThanhToanTruocDo + tongThanhToanHieuLuc;
    const conLaiMoi = Math.max(0, tongNghiaVu - daThanhToanMoi);
    const daTatToan = conLaiMoi <= 0;

    if (soTienThuMoi > 0) {
      await query<ThanhToan>(
        `INSERT INTO ThanhToan (idDonHang, soTien, hinhThuc, ngayThanhToan, nguoiNhan, ghiChu, nguoiTaoId)
         VALUES (@idDonHang, @soTien, @hinhThuc, ${vnNow()}, @nguoiNhan, @ghiChu, @nguoiTaoId);`,
        {
          idDonHang: data.idDonHang,
          soTien: soTienThuMoi,
          hinhThuc: data.phuongThucThanhToan || "tien_mat",
          nguoiNhan: "",
          ghiChu:
            data.loaiThanhToan === "cong_no_du"
              ? `Thanh toán công nợ lần tiếp theo cho hóa đơn ${maHoaDon}`
              : `Thanh toán trước cho hóa đơn công nợ ${maHoaDon}`,
          nguoiTaoId,
        },
      );
    }

    await query(
      `UPDATE DonHang SET
        daThanhToan = @daThanhToan, conLai = @conLai,
        trangThaiDon = CASE WHEN @daTatToan = 1 THEN N'da_thanh_toan' ELSE trangThaiDon END,
        trangThaiHoanThanh = CASE WHEN @daTatToan = 1 THEN N'da_hoan_thanh' ELSE trangThaiHoanThanh END,
        ngayCapNhat = ${vnNow()}
       WHERE id = @id`,
      {
        id: data.idDonHang,
        daThanhToan: daThanhToanMoi,
        conLai: conLaiMoi,
        daTatToan: daTatToan ? 1 : 0,
      },
    );

    await query(
      `IF EXISTS (SELECT * FROM CongNo WHERE idDonHang = @idDonHang)
       BEGIN
         UPDATE CongNo
         SET tongTien = @tongTien,
             daThanhToan = @daThanhToan,
             conLai = @conLai,
             ngayBatDau = COALESCE(ngayBatDau, CAST(GETDATE() AS DATE)),
             hanThanhToan = COALESCE(@hanThanhToan, hanThanhToan),
             trangThai = CASE WHEN @conLai <= 0 THEN N'da_thanh_toan' ELSE N'chua_thanh_toan' END,
             ngayCapNhat = ${vnNow()}
         WHERE idDonHang = @idDonHang;
       END
       ELSE
       BEGIN
         INSERT INTO CongNo (idDonHang, tongTien, daThanhToan, conLai, ngayBatDau, hanThanhToan, trangThai)
         VALUES (
           @idDonHang,
           @tongTien,
           @daThanhToan,
           @conLai,
           CAST(GETDATE() AS DATE),
           @hanThanhToan,
           CASE WHEN @conLai <= 0 THEN N'da_thanh_toan' ELSE N'chua_thanh_toan' END
         );
       END`,
      {
        idDonHang: data.idDonHang,
        tongTien: tongNghiaVu,
        daThanhToan: daThanhToanMoi,
        conLai: conLaiMoi,
        hanThanhToan: data.hanTraCongNo ? new Date(data.hanTraCongNo) : null,
      },
    );

    await dongBoCongNoKhachHangTheoPhatSinh({
      idKhachHang: dh.idKhachHang || null,
      maKhachHang: dh.maKhachHang || null,
      tenKhachHang: dh.tenKhachHang || data.khachHang || "",
      nhom: dh.nhom || null,
      // phatSinhNo chỉ ghi nhận phần còn lại sau thanh toán, không phải toàn bộ tổng nghĩa vụ
      phatSinhNoTang: conLaiMoi,
      phatSinhCoTang: soTienThuMoi + soTienDuSuDung,
    });
  }

  return hoaDon;
}

export async function layHoaDonTheoDonHang(idDonHang: number): Promise<any[]> {
  return (await query(
    `SELECT * FROM HoaDon WHERE idDonHang = @idDonHang ORDER BY id DESC`,
    { idDonHang },
  )) as any[];
}

export async function layHoaDonTheoId(id: number): Promise<HoaDon | null> {
  const rows = (await query(
    `SELECT hd.*,
            dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong,
            dh.khoiLuongDat, dh.donGia, dh.ngayGiao, dh.conLai as donHangConLai,
            -- Tổng nghĩa vụ GỐC của đơn hàng (= lúc tạo đơn) + đã thanh toán + bv/pp
            -- để frontend tính "Công nợ còn lại" / "SỐ TIỀN TRẢ KỲ NÀY" / "DƯ" chính xác
            -- ở mọi lần thanh toán, kể cả khi HoaDon.tongCong đã bị chia tỷ lệ.
            -- LƯU Ý: KHÔNG select dh.thanhTien đè lên hd.thanhTien (HoaDon không có
            -- cột này nhưng dùng alias rõ ràng để tránh nhầm lẫn).
            dh.thanhTien as donHangThanhTien,
            dh.daThanhToan as donHangDaThanhToan,
            dh.buVanChuyen as donHangBuVanChuyen,
            dh.chiPhiPhatSinh as donHangChiPhiPhatSinh,
            dh.hangMuc, dh.phuongPhapDo, dh.loaiBom, dh.chieuDaiBom, dh.kieuNoi, dh.chieuDaiNoi,
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
    { id },
  )) as any[];
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
    // Tổng nghĩa vụ GỐC của đơn tại thời điểm lập hóa đơn (lưu trong HoaDon.tongNghiaVuDon)
    // Đây là nguồn chính xác nhất cho "TỔNG NGHĨA VỤ ĐƠN HÀNG" hiển thị trên hóa đơn
    tongNghiaVuDon: r.tongNghiaVuDon,
    maDonHang: r.maDonHang,
    tenKhachHang: r.tenKhachHang,
    diaChiNhan: r.diaChiNhan,
    tenMacBeTong: r.tenMacBeTong,
    khoiLuongDat: r.khoiLuongDat,
    donGia: r.donGia,
    thanhTien: r.thanhTien,
    ngayGiao: r.ngayGiao,
    // Tổng nghĩa vụ GỐC của đơn hàng (alias rõ ràng, không bị ghi đè bởi hd.*)
    donHangThanhTien: r.donHangThanhTien,
    donHangDaThanhToan: r.donHangDaThanhToan,
    donHangBuVanChuyen: r.donHangBuVanChuyen,
    donHangChiPhiPhatSinh: r.donHangChiPhiPhatSinh,
    tenTramTron: r.tenTramTron,
    diaChiTramTron: r.diaChiTramTron,
    bienSoXe: r.bienSoXe,
    tenTaiXe: r.tenTaiXe,
    nguoiOmOng: r.nguoiOmOng,
    nguoiBatOng: r.nguoiBatOng,
    kyThuatCongTrinh: r.kyThuatCongTrinh,
    ngayNghiemThu: r.ngayNghiemThu,
    donHangConLai: r.donHangConLai,
    // Hạng mục / phương pháp đổ
    hangMuc: r.hangMuc,
    phuongPhapDo: r.phuongPhapDo,
    loaiBom: r.loaiBom,
    chieuDaiBom: r.chieuDaiBom,
    kieuNoi: r.kieuNoi,
    chieuDaiNoi: r.chieuDaiNoi,
  };
}

export async function taiHoaDonDoc(id: number): Promise<Buffer> {
  const hd = await layHoaDonTheoId(id);
  if (!hd) throw new Error("Không tìm thấy hóa đơn");

  const ls = hd as any;
  const COMPANY_NAME = "CÔNG TY CỔ PHẦN BÊ TÔNG TÂY ĐÔ";
  const COMPANY_ADDR = "Km14, QL91, P.Phước Thới, TP.Cần Thơ";
  const COMPANY_PHONE = "0292 651 8375";
  const COMPANY_MST = "1801286137";

  const date = hd.ngayLap ? new Date(hd.ngayLap) : new Date();
  const currency = (n: number) => Number(n || 0).toLocaleString("vi-VN");

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hóa đơn ${hd.maHoaDon}</title>
</head>
<body>
  <h1>${COMPANY_NAME}</h1>
  <p>${COMPANY_ADDR}</p>
  <p>Điện thoại: ${COMPANY_PHONE} - MST: ${COMPANY_MST}</p>
  <h2>Hóa đơn ${hd.maHoaDon}</h2>
  <p>Khách hàng: ${hd.khachHang}</p>
  <p>Tổng cộng: ${currency(hd.tongCong)} đ</p>
</body>
</html>`;

  return Buffer.from(html, "utf-8");
}
