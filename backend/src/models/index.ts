// Mô hình dữ liệu cho toàn bộ hệ thống Bê Tông Tây Đô

export interface CauHinhHeThong {
  id: number;
  khoa: string;
  giaTri: string;
  ngayCapNhat: Date | string;
}

export interface NguoiDung {
  id: number;
  tenDangNhap: string;
  matKhau: string;
  hoTen: string;
  email: string | null;
  soDienThoai: string | null;
  vaiTro:
    | "admin"
    | "giam_doc_kinh_doanh"
    | "ke_toan"
    | "dieu_phoi"
    | "lanh_dao"
    | "tram_tron"
    | "sale"
    | "tai_xe"
    | "ky_thuat";
  idTramTron?: number | null;
  trangThai: "hoat_dong" | "khong_hoat_dong";
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface KhachHang {
  id: number;
  maKhachHang: string | null;
  tenKhachHang: string;
  diaChi: string | null;
  soDienThoai: string | null;
  email: string | null;
  ghiChu: string | null;
  nhom: string | null;
  mstCccd: string | null;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface MacBeTong {
  id: number;
  tenMac: string;
  donGia: number;
  chiPhiPhatSinh: number;
  buVanChuyen: number;
  moTa: string | null;
  trangThai: string;
  ngayTao: Date;
}

export interface TramTron {
  id: number;
  tenTram: string;
  diaChi: string | null;
  soDienThoai: string | null;
  trangThai: string;
  ngayTao: Date;
}

export interface Xe {
  id: number;
  bienSo: string;
  idTaiKhoan: number | null;
  tenTaiXe: string | null;
  soDienThoaiTaiXe: string | null;
  taiTrong: number | null;
  trangThai: "san_sang" | "dang_giao" | "bao_tri";
  ngayTao: Date;
}

export interface DonHang {
  id: number;
  maDonHang: string;
  idKhachHang: number | null;
  idMacBeTong: number | null;
  idTramTron: number | null;

  tenKhachHang: string;
  diaChiNhan: string;
  soDienThoai: string;

  tenMacBeTong: string | null;
  khoiLuongDat: number;
  khoiLuongThucTe: number | null;
  donGia: number;
  chiPhiPhatSinh: number;
  buVanChuyen: number;
  thanhTien: number | null;

  thoiGianGiaoDuKien: Date | string | null;
  ngayTaoDon: Date | string;
  ngayDuyet: Date | string | null;
  ngayGiao: Date | string | null;
  ngayNghiemThu: Date | string | null;

  trangThaiDon:
    | "cho_duyet"
    | "cho_ke_toan_duyet"
    | "da_duyet"
    | "dang_san_xuat"
    | "dang_giao"
    | "da_giao"
    | "nghiem_thu"
    | "da_thanh_toan"
    | "da_hoan_thanh";
  trangThaiHoanThanh: "chua_hoan_thanh" | "dang_hoan_thanh" | "da_hoan_thanh";

  nguoiTaoId: number | null;
  nguoiDuyetId: number | null;
  nguoiDuyetGDKDId: number | null;
  ghiChu: string | null;
  lyDoTuChoi: string | null;

  daThanhToan: number;
  conLai: number | null;

  // Hạng mục / cấu kiện
  hangMuc: string | null;
  // Phương pháp đổ
  phuongPhapDo: "do_xa" | "do_bom" | null;
  loaiBom: "bom_ngang" | "bom_can" | null;
  chieuDaiBom: number | null;
  kieuNoi: "khong_dau" | "noi_dau" | "noi_dit" | null;
  chieuDaiNoi: number | null;
  // Thông tin giao hàng
  nguoiNhanHang: string | null;
  giaTienTamTinh: number | null;

  ngayTao: Date | string;
  ngayCapNhat: Date | string;

  // Fields từ JOIN để export
  tenTramTron?: string | null;
  maNguoiTao?: string | null;
  tenNguoiTao?: string | null;
  maNguoiDuyet?: string | null;
  tenNguoiDuyet?: string | null;
}

export interface LichSanXuat {
  id: number;
  idDonHang: number;
  idXe: number | null;
  idTramTron: number | null;
  idTaiXe: number | null;
  kyThuatCongTrinh: string | null;
  nguoiOmOng: string | null;
  nguoiBatOng: string | null;
  phuongAnDo: string | null;
  bienSoXe: string | null;
  thoiGianTron: Date | null;
  thoiGianXuatBen: Date | null;
  thoiGianDenCangDat: Date | null;
  thoiGianBatDauDo: Date | null;
  thoiGianKetThucDo: Date | null;
  ghiChu: string | null;
  driveLink: string | null;
  trangThai: "chua_san_xuat" | "dang_san_xuat" | "da_xong";
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface NghiemThu {
  id: number;
  idDonHang: number;
  khoiLuongXacNhan: number | null;
  khoiLuongThucTe: number | null;
  chatLuong: "dat" | "khong_dat" | null;
  bienBanFile: string | null;
  bienBanSo: string | null;
  ngayLapBienBan: Date | null;
  nguoiLap: string | null;
  nguoiKy: string | null;
  chucVu: string | null;
  daGuiKhach: boolean;
  ngayGuiKhach: Date | null;
  ghiChu: string | null;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface ThanhToan {
  id: number;
  idDonHang: number;
  soTien: number;
  hinhThuc: "tien_mat" | "chuyen_khoan" | "truct_hop_dong" | null;
  ngayThanhToan: Date;
  nguoiNhan: string | null;
  ghiChu: string | null;
  nguoiTaoId: number | null;
  ngayTao: Date;
}

export interface CongNo {
  id: number;
  idDonHang: number;
  tongTien: number;
  daThanhToan: number;
  conLai: number;
  ngayBatDau: Date | null;
  hanThanhToan: Date | null;
  trangThai:
    | "chua_thanh_toan"
    | "dang_thanh_toan"
    | "da_thanh_toan"
    | "qua_han";
  ghiChu: string | null;
  nhom: string | null;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface NhatKyHeThong {
  id: number;
  idNguoiDung: number | null;
  hanhDong: string;
  bangDuocTacDong: string | null;
  banGhiId: number | null;
  noiDungCu: string | null;
  noiDungMoi: string | null;
  ipAddress: string | null;
  thoiGian: Date;
}

export interface CongNoKhachHang {
  id: number;
  maKhachHang: string | null;
  tenKhachHang: string;
  duDauNo: number;
  duDauCo: number;
  phatSinhNo: number;
  phatSinhCo: number;
  duCuoiNo: number;
  duCuoiCo: number;
  nhom: string | null;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface CongNoKhachHangGroup {
  nhom: string;
  items: CongNoKhachHang[];
  tongDuDauNo: number;
  tongDuDauCo: number;
  tongPhatSinhNo: number;
  tongPhatSinhCo: number;
  tongDuCuoiNo: number;
  tongDuCuoiCo: number;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface PhanTrang {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponseWithPagination<T = unknown> extends ApiResponse<T> {
  pagination: PhanTrang;
}

// Auth types
export interface JwtPayload {
  id: number;
  tenDangNhap: string;
  hoTen: string;
  vaiTro: string;
  idTramTron?: number | null;
  sessionId: number;
}

export interface LoginRequest {
  tenDangNhap: string;
  matKhau: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<NguoiDung, "matKhau">;
}

// Dashboard types
export interface ThongKeDashboard {
  tongDonHang: number;
  donChoDuyet: number;
  donDangXuLy: number;
  donDaHoanThanh: number;
  tongDoanhThu: number;
  tongCongNo: number;
  donQuaHan: number;
}

export interface DoanhThuTheoThang {
  thang: string;
  doanhThu: number;
  soDonHang: number;
}

export interface DonHangTheoTrangThai {
  trangThai: string;
  soLuong: number;
}
