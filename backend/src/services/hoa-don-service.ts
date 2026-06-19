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
  // Phần dư khi khách trả vượt nghĩa vụ (chỉ > 0 với HĐ trả hết dư / công nợ dư)
  soTienDu: number;
  loaiThanhToan: "tra_het" | "tra_het_du" | "cong_no" | "cong_no_du";
  hanTraCongNo: Date | null;
  nguoiTaoId: number | null;
  createdAt: Date;
  // Tổng nghĩa vụ GỐC của đơn hàng tại thời điểm lập hóa đơn (= tienBeTongGoc + bv + pp - gt)
  // Lưu vào DB để in hóa đơn hiển thị chính xác "TỔNG NGHĨA VỤ ĐƠN HÀNG"
  tongNghiaVuDon?: number;
  // Snapshot cứng "Công nợ còn lại" tại thời điểm lập hóa đơn
  // Ưu tiên dùng để in "Công nợ còn lại" trên hóa đơn, giữ nguyên giá trị
  // của thời điểm lập dù DonHang.conLai có thay đổi sau này.
  congNoConLai?: number;
  // Tổng nghĩa vụ GỐC của đơn hàng (lúc tạo đơn) + đã thanh toán + bv/pp
  // Alias rõ ràng từ DonHang, dùng để frontend tính công nợ chính xác
  donHangThanhTien?: number;
  donHangDonGia?: number;
  donHangDaThanhToan?: number;
  donHangBuVanChuyen?: number;
  donHangChiPhiPhatSinh?: number;
  // Còn lại (chưa thanh toán) của đơn tại thời điểm query — alias từ DonHang.conLai
  donHangConLai?: number;
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

// Lấy thông tin GỐC của đơn từ HĐ lần đầu tiên (id nhỏ nhất) đã lưu trong DB.
// Đây là nguồn chính xác nhất vì:
// - Ở HĐ lần 1, kế toán có thể đã thêm bv/pp/gt tại form xuất HĐ
//   (khi đó dh.thanhTien, dh.buVanChuyen, dh.chiPhiPhatSinh trên DonHang
//   KHÔNG được cập nhật — chỉ HoaDon lưu).
// - Ở HĐ lần 2+, frontend không gửi lại bv/pp/gt (form chỉ auto-fill
//   tienBeTong = conLai, các trường bv/pp/gt để trống → gửi 0).
//   Nếu lấy bv/pp/gt từ input/data sẽ trả về 0 → tongNghiaVu lần 2 sai
//   (vd: gốc 600k = 500k tiền BT + 100k bv/pp, lần 2 backend tính 500k
//   → dư cuối cùng báo sai 200k thay vì 50k).
//
// QUAN TRỌNG — nguồn tongNghiaVu phải ỔN ĐỊNH giữa các lần thanh toán:
// Mỗi đơn hàng chỉ có MỘT tongNghiaVuDon chuẩn, áp dụng cho mọi lần thanh toán.
// Nếu lần 1 lưu tongNghiaVuDon = 400k (chưa có bv/pp), và ở lần 2 kế toán
// muốn thêm bv 100k → tongNghiaVuDon lần 2 = 500k, mâu thuẫn với lần 1.
// Giải pháp: lấy tongNghiaVuDon từ HĐ đầu tiên làm CHUẨN, áp dụng cho
// mọi lần sau. Nếu cần thay đổi nghĩa vụ, kế toán phải xóa HĐ cũ hoặc
// chỉnh sửa qua nghiệp vụ khác (vd: tạo đơn mới).
//
// Thứ tự ưu tiên khi tính tongNghiaVu:
// 1) tongNghiaVuDon từ HĐ đầu tiên (nếu có) — đảm bảo ổn định giữa các lần
// 2) Tính từ dh.thanhTien + bv/pp input + dh.buVanChuyen/dh.chiPhiPhatSinh
//    (chỉ áp dụng khi tạo HĐ lần đầu)
async function layTongNghiaVuVaBvPpGtGoc(
  idDonHang: number,
): Promise<{
  tongNghiaVuGoc: number | null;
  buuVanChuyen: number;
  phiPhatSinh: number;
  giamTru: number;
  coHoaDonDauTien: boolean;
}> {
  try {
    const rows = await query<{
      tongNghiaVuDon: number;
      buuVanChuyen: number;
      phiPhatSinh: number;
      giamTru: number;
    }>(
      `SELECT TOP 1 tongNghiaVuDon, buuVanChuyen, phiPhatSinh, giamTru
       FROM HoaDon
       WHERE idDonHang = @idDonHang
       ORDER BY id ASC`,
      { idDonHang },
    );
    if (rows.length > 0) {
      return {
        tongNghiaVuGoc: Number(rows[0].tongNghiaVuDon) || 0,
        buuVanChuyen: Number(rows[0].buuVanChuyen) || 0,
        phiPhatSinh: Number(rows[0].phiPhatSinh) || 0,
        giamTru: Number(rows[0].giamTru) || 0,
        coHoaDonDauTien: true,
      };
    }
  } catch {
    // ignore — fallback xuống tính từ dh.thanhTien + input
  }
  return {
    tongNghiaVuGoc: null,
    buuVanChuyen: 0,
    phiPhatSinh: 0,
    giamTru: 0,
    coHoaDonDauTien: false,
  };
}

async function tinhTongNghiaVuDonHang(
  dh: DonHang,
  data: TaoHoaDonInput,
  goc: {
    tongNghiaVuGoc: number | null;
    buuVanChuyen: number;
    phiPhatSinh: number;
    giamTru: number;
    coHoaDonDauTien: boolean;
  },
): Promise<number> {
  // Nếu đã có HĐ đầu tiên → dùng tongNghiaVuDon của HĐ đầu làm CHUẨN
  // để mọi lần thanh toán hiển thị cùng 1 tổng nghĩa vụ (tránh trường hợp
  // lần 1 lưu 400k, lần 2 lưu 500k gây ra tienDuCuoi sai).
  if (goc.coHoaDonDauTien && goc.tongNghiaVuGoc != null) {
    return Math.max(0, goc.tongNghiaVuGoc);
  }
  // Tạo HĐ lần đầu: tính từ dh.thanhTien + bv/pp input + dh fallback
  const tienBeTongGoc = dh.thanhTien || 0;
  const inputBv = data.buuVanChuyen || 0;
  const inputPp = data.phiPhatSinh || 0;
  const inputGt = data.giamTru || 0;
  const buuVanChuyen = inputBv > 0 ? inputBv : dh.buVanChuyen || 0;
  const phiPhatSinh = inputPp > 0 ? inputPp : dh.chiPhiPhatSinh || 0;
  const giamTru = inputGt;
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

  // Tiền bê tông phân bổ theo tỷ lệ (phần còn lại sau khi trừ đã trả trước đó)
  const tienBeTongHoaDon = Math.round(tienBeTongConLai * tyLe * 100) / 100;
  // Bù vận chuyển, chi phí phát sinh, giảm trừ: LUÔN lưu giá trị GỐC
  // (như kế toán đã nhập ở form Xuất hóa đơn), KHÔNG chia tỷ lệ theo kỳ.
  // Lý do: bảng in hóa đơn cần hiển thị đúng giá trị user nhập (vd: 100.000)
  // ở MỌI lần thanh toán, không bị auto scale thành 17.400 khi khách
  // trả 1 phần. Tổng cộng vẫn đúng vì tongCongHoaDon = soTienTheHienKyNay
  // (số tiền thực nhận kỳ này, không phụ thuộc tổng thành phần).
  const buuVanChuyenHoaDon = buuVanChuyen;
  const phiPhatSinhHoaDon = phiPhatSinh;
  const giamTruHoaDon = giamTru;

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

  // Lấy tongNghiaVuDon + bv/pp/gt gốc từ HĐ đầu tiên (id nhỏ nhất) đã lưu trong DB.
  // Nguồn chính xác nhất để đảm bảo tongNghiaVu ỔN ĐỊNH giữa các lần thanh toán
  // (tránh tình trạng lần 1 lưu 400k, lần 2 lưu 500k do kế toán thêm bv/pp
  // ở lần 2 nhưng HĐ đầu đã chốt ở 400k).
  const goc = await layTongNghiaVuVaBvPpGtGoc(data.idDonHang);
  // Tiền bê tông: lấy từ bvPpGtGoc nếu có, fallback từ data/dh
  const tienBeTongGoc =
    data.tienBeTong != null
      ? data.tienBeTong
      : (dh.khoiLuongDat || 0) * (dh.donGia || 0);
  const buuVanChuyen =
    (data.buuVanChuyen || 0) > 0
      ? data.buuVanChuyen || 0
      : Number(goc.buuVanChuyen) || 0;
  const phiPhatSinh =
    (data.phiPhatSinh || 0) > 0
      ? data.phiPhatSinh || 0
      : Number(goc.phiPhatSinh) || 0;
  const giamTru =
    (data.giamTru || 0) > 0 ? data.giamTru || 0 : Number(goc.giamTru) || 0;
  const tongNghiaVu = await tinhTongNghiaVuDonHang(dh, data, goc);
  const tongDaThanhToanTruocDo = Math.max(0, dh.daThanhToan || 0);
  const tongConLaiTruocKhiLap = Math.max(
    0,
    tongNghiaVu - tongDaThanhToanTruocDo,
  );

  // Đếm số hóa đơn đã có cho đơn này để xác định HĐ hiện tại có phải lần đầu
  // (HĐ đầu tiên mới được phép tự động cập nhật DonHang.phuongThucThanhToan
  // theo loại hóa đơn thực tế; các lần sau giữ nguyên giá trị đã chốt từ lần 1).
  const soHoaDonHienCo = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM HoaDon WHERE idDonHang = @idDonHang`,
    { idDonHang: data.idDonHang },
  );
  const laHoaDonDauTien = (soHoaDonHienCo[0]?.soLuong || 0) === 0;

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

  // Snapshot cứng "Công nợ còn lại" tại thời điểm lập hóa đơn này.
  // Lưu riêng trên HĐ để in lại hóa đơn cũ vẫn hiển thị đúng số nợ của
  // thời điểm đó, không bị ảnh hưởng bởi DonHang.conLai khi khách trả hết.
  // - tra_het / tra_het_du: đã tất toán → congNoConLai = 0
  // - cong_no: còn lại = tongNghiaVu - (đã trả trước + phần hiệu lực kỳ này)
  //   = tongNghiaVu - (tongDaThanhToanTruocDo + tongThanhToanHieuLuc)
  // - cong_no_du: khách trả vượt → có thể âm (nhưng clamp về 0)
  const tongDaThanhToanSauKyNay = tongDaThanhToanTruocDo + tongThanhToanHieuLuc;
  const congNoConLaiSnapshot = Math.max(
    0,
    tongNghiaVu - tongDaThanhToanSauKyNay,
  );

  const result = await query<HoaDon>(
    `INSERT INTO HoaDon (
      idDonHang, maHoaDon, soHoaDon, ngayLap, khachHang, loaiXiMang, gioDo,
      phuongThucThanhToan, ghiChu, tienBeTong, buuVanChuyen, phiPhatSinh,
      giamTru, tongCong, soTienThanhToan, soTienDu, loaiThanhToan, hanTraCongNo, nguoiTaoId,
      tongNghiaVuDon, congNoConLai
    ) VALUES (
      @idDonHang, @maHoaDon, @soHoaDon, @ngayLap, @khachHang, @loaiXiMang, @gioDo,
      @phuongThucThanhToan, @ghiChu, @tienBeTong, @buuVanChuyen, @phiPhatSinh,
      @giamTru, @tongCong, @soTienThanhToan, @soTienDu, @loaiThanhToan, @hanTraCongNo, @nguoiTaoId,
      @tongNghiaVuDon, @congNoConLai
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
      // Lưu phần dư riêng (chỉ > 0 với HĐ trả hết dư / công nợ dư)
      // Frontend dùng để cộng dồn chính xác tổng "phần thực trừ nghĩa vụ"
      // tránh tienDuCuoi báo sai.
      soTienDu: soTienDu,
      loaiThanhToan: data.loaiThanhToan,
      hanTraCongNo: data.hanTraCongNo ? new Date(data.hanTraCongNo) : null,
      nguoiTaoId,
      // Lưu tổng nghĩa vụ GỐC của đơn tại thời điểm lập hóa đơn
      // (dùng cho in hóa đơn, hiển thị "TỔNG NGHĨA VỤ ĐƠN HÀNG" chính xác)
      tongNghiaVuDon: tongNghiaVu,
      // Snapshot "Công nợ còn lại" tại thời điểm lập hóa đơn này
      // (in lại hóa đơn cũ vẫn hiển thị đúng số nợ của thời điểm đó)
      congNoConLai: congNoConLaiSnapshot,
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

    // Auto cập nhật phương thức thanh toán của đơn hàng theo loại HĐ thực tế
    // (chỉ áp dụng cho HĐ đầu tiên - các lần sau giữ nguyên giá trị đã chốt
    // từ lần đầu, tránh ghi đè khi kế toán lập thêm HĐ bổ sung).
    if (laHoaDonDauTien) {
      const phuongThucMoi =
        data.loaiThanhToan === "tra_het_du" ? "tra_het_du" : "tra_het";
      await query(
        `UPDATE DonHang SET phuongThucThanhToan = @phuongThucThanhToan
         WHERE id = @id`,
        { id: data.idDonHang, phuongThucThanhToan: phuongThucMoi },
      );
    }

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

    // Auto cập nhật phương thức thanh toán của đơn hàng theo loại HĐ thực tế
    // (chỉ áp dụng cho HĐ đầu tiên - các lần sau giữ nguyên giá trị đã chốt
    // từ lần đầu, tránh ghi đè khi kế toán lập thêm HĐ bổ sung).
    if (laHoaDonDauTien) {
      const phuongThucMoi =
        data.loaiThanhToan === "cong_no_du" ? "cong_no_du" : "cong_no";
      await query(
        `UPDATE DonHang SET phuongThucThanhToan = @phuongThucThanhToan
         WHERE id = @id`,
        { id: data.idDonHang, phuongThucThanhToan: phuongThucMoi },
      );
    }

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
  // JOIN thêm các field từ DonHang + snapshot từ HoaDon (tongNghiaVuDon, congNoConLai)
  // để frontend (ChiTietDonHangPage, dashboard...) hiển thị bảng hóa đơn đầy đủ
  // giống trang InHoaDonPage, không cần gọi thêm API cho từng hóa đơn.
  const rows = (await query(
    `SELECT hd.*,
            dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong,
            dh.khoiLuongDat, dh.donGia, dh.ngayGiao, dh.conLai as donHangConLai,
            dh.thanhTien as donHangThanhTien,
            dh.daThanhToan as donHangDaThanhToan,
            dh.buVanChuyen as donHangBuVanChuyen,
            dh.chiPhiPhatSinh as donHangChiPhiPhatSinh,
            dh.hangMuc, dh.phuongPhapDo, dh.loaiBom, dh.chieuDaiBom, dh.kieuNoi, dh.chieuDaiNoi
     FROM HoaDon hd
     INNER JOIN DonHang dh ON hd.idDonHang = dh.id
     WHERE hd.idDonHang = @idDonHang
     ORDER BY hd.id ASC`,
    { idDonHang },
  )) as any[];
  return rows.map((r) => ({
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
    soTienDu: r.soTienDu || 0,
    loaiThanhToan: r.loaiThanhToan,
    hanTraCongNo: r.hanTraCongNo,
    nguoiTaoId: r.nguoiTaoId,
    createdAt: r.createdAt,
    tongNghiaVuDon: r.tongNghiaVuDon,
    congNoConLai: r.congNoConLai || 0,
    maDonHang: r.maDonHang,
    tenKhachHang: r.tenKhachHang,
    diaChiNhan: r.diaChiNhan,
    tenMacBeTong: r.tenMacBeTong,
    khoiLuongDat: r.khoiLuongDat,
    donGia: r.donGia,
    donHangDonGia: r.donGia,
    thanhTien: r.thanhTien,
    ngayGiao: r.ngayGiao,
    donHangThanhTien: r.donHangThanhTien,
    donHangDaThanhToan: r.donHangDaThanhToan,
    donHangBuVanChuyen: r.donHangBuVanChuyen,
    donHangChiPhiPhatSinh: r.donHangChiPhiPhatSinh,
    hangMuc: r.hangMuc,
    phuongPhapDo: r.phuongPhapDo,
    loaiBom: r.loaiBom,
    chieuDaiBom: r.chieuDaiBom,
    kieuNoi: r.kieuNoi,
    chieuDaiNoi: r.chieuDaiNoi,
    donHangConLai: r.donHangConLai,
  }));
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
    soTienDu: r.soTienDu || 0,
    loaiThanhToan: r.loaiThanhToan,
    hanTraCongNo: r.hanTraCongNo,
    nguoiTaoId: r.nguoiTaoId,
    createdAt: r.createdAt,
    // Tổng nghĩa vụ GỐC của đơn tại thời điểm lập hóa đơn (lưu trong HoaDon.tongNghiaVuDon)
    // Đây là nguồn chính xác nhất cho "TỔNG NGHĨA VỤ ĐƠN HÀNG" hiển thị trên hóa đơn
    tongNghiaVuDon: r.tongNghiaVuDon,
    // Snapshot "Công nợ còn lại" tại thời điểm lập hóa đơn (lưu trong HoaDon.congNoConLai)
    // Ưu tiên dùng để in "Công nợ còn lại" trên hóa đơn, giữ nguyên giá trị của
    // thời điểm lập dù DonHang.conLai có thay đổi sau này khi khách thanh toán hết.
    congNoConLai: r.congNoConLai || 0,
    maDonHang: r.maDonHang,
    tenKhachHang: r.tenKhachHang,
    diaChiNhan: r.diaChiNhan,
    tenMacBeTong: r.tenMacBeTong,
    khoiLuongDat: r.khoiLuongDat,
    donGia: r.donGia,
    // Đơn giá GỐC của đơn hàng (dh.donGia) — dùng để hiển thị "Đơn giá" trên
    // hóa đơn ổn định giữa các lần, không bị phân bổ tỷ lệ.
    donHangDonGia: r.donGia,
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
