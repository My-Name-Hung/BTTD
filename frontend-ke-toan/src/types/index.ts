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

export interface NguoiDung {
  id: number;
  tenDangNhap: string;
  hoTen: string;
  email: string | null;
  soDienThoai: string | null;
  vaiTro: "admin" | "ke_toan" | "dieu_phoi" | "lanh_dao" | "tram_tron" | "sale" | "tai_xe" | "ky_thuat";
  idTramTron?: number | null;
  trangThai: "hoat_dong" | "khong_hoat_dong";
  ngayTao?: string | Date;
  ngayCapNhat?: string | Date;
}

export interface KhachHang {
  id: number;
  tenKhachHang: string;
  diaChi: string | null;
  soDienThoai: string | null;
  email: string | null;
  ghiChu: string | null;
}

export interface MacBeTong {
  id: number;
  tenMac: string;
  donGia: number;
  moTa: string | null;
}

export interface TramTron {
  id: number;
  tenTram: string;
  diaChi: string | null;
  soDienThoai: string | null;
  trangThai: "hoat_dong" | "khong_hoat_dong";
}

export interface Xe {
  id: number;
  bienSo: string;
  idTaiKhoan: number | null;
  tenTaiXe: string | null;
  soDienThoaiTaiXe: string | null;
  taiTrong: number | null;
  trangThai: "san_sang" | "dang_giao" | "bao_tri";
}

export interface MaintenanceStatus {
  isMaintenance: boolean;
  noiDung: string | null;
  thoiGianBatDau: string | null;
  thoiGianKetThuc: string | null;
  daLich: boolean;
}

export interface DonHang {
  id: number;
  maDonHang: string;
  idKhachHang: number | null;
  idMacBeTong: number | null;
  idTramTron: number | null;
  tenTramTron: string | null;
  tenKhachHang: string;
  diaChiNhan: string;
  soDienThoai: string;
  tenMacBeTong: string | null;
  khoiLuongDat: number;
  khoiLuongThucTe: number | null;
  donGia: number;
  giaNiemYet?: number | null;
  thanhTien: number | null;
  chiPhiPhatSinh?: number;
  buVanChuyen?: number;
  giamTru?: number;
  thoiGianGiaoDuKien: string | null;
  ngayTaoDon: string;
  ngayDuyet: string | null;
  ngayGiao: string | null;
  ngayNghiemThu: string | null;
  trangThaiDon:
    | "cho_duyet"
    | "da_duyet"
    | "tu_choi"
    | "dang_san_xuat"
    | "dang_giao"
    | "da_giao"
    | "nghiem_thu"
    | "da_nghiem_thu"
    | "da_thanh_toan"
    | "hoan_thanh";
  trangThaiHoanThanh: "chua_hoan_thanh" | "dang_hoan_thanh" | "da_hoan_thanh";
  nguoiTaoId: number | null;
  nguoiDuyetId: number | null;
  ghiChu: string | null;
  lyDoTuChoi: string | null;
  daThanhToan: number;
  conLai: number | null;
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
  tenTaiXe: string | null;
  thoiGianTron: string | null;
  thoiGianXuatBen: string | null;
  thoiGianDenCangDat: string | null;
  thoiGianBatDauDo: string | null;
  thoiGianKetThucDo: string | null;
  ghiChu: string | null;
  driveLink: string | null;
  trangThai: "chua_san_xuat" | "dang_san_xuat" | "da_xong";
}

export interface NghiemThu {
  id: number;
  idDonHang: number;
  khoiLuongXacNhan: number | null;
  khoiLuongThucTe: number | null;
  chatLuong: "dat" | "khong_dat" | "chua" | null;
  bienBanFile: string | string[] | null;
  bienBanFiles?: string[];
  bienBanSo: string | null;
  ngayLapBienBan: string | null;
  nguoiLap: string | null;
  nguoiKy: string | null;
  chucVu: string | null;
  daGuiKhach: boolean;
  ngayGuiKhach: string | null;
  ghiChu: string | null;
}

export interface ThanhToan {
  id: number;
  idDonHang: number;
  soTien: number;
  hinhThuc: "tien_mat" | "chuyen_khoan" | "truct_hop_dong" | null;
  ngayThanhToan: string;
  nguoiNhan: string | null;
  ghiChu: string | null;
}

export interface CongNo {
  id: number;
  idDonHang: number;
  tongTien: number;
  daThanhToan: number;
  conLai: number;
  ngayBatDau: string | null;
  hanThanhToan: string | null;
  trangThai:
    | "chua_thanh_toan"
    | "dang_thanh_toan"
    | "da_thanh_toan"
    | "qua_han";
  ghiChu: string | null;
  nhom: string | null;
  maDonHang?: string;
  tenKhachHang?: string;
  thanhTien?: number;
}

export interface CongNoGroup {
  nhom: string;
  items: CongNo[];
  tongCongNo: number;
  tongDaThanhToan: number;
  tongConLai: number;
}

export interface HoaDon {
  id: number;
  idDonHang: number;
  maHoaDon: string;
  soHoaDon: string;
  ngayLap: string | null;
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
  hanTraCongNo: string | null;
  maDonHang?: string;
  tenMacBeTong?: string;
  khoiLuongDat?: number;
  donGia?: number;
  thanhTien?: number;
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

export interface ThongKeDashboard {
  tongDonHang: number;
  donChoDuyet: number;
  donDangXuLy: number;
  donDaHoanThanh: number;
  tongDoanhThu: number;
  tongCongNo: number;
  donQuaHan: number;
  tongDonTaiXe?: number;
  chuaGiaoTaiXe?: number;
  daGiaoTaiXe?: number;
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

export interface ThongBao {
  id: number;
  tieuDe: string;
  noiDung: string;
  role: string;
  loai: string;
  idThamChieu?: number;
  duongDan?: string;
  isRead: boolean;
  ngayTao: string;
}

export interface PopupNotification {
  id: number;
  tieuDe: string;
  noiDung: string;
  loai: string;
  duongDan?: string;
  ngayTao?: string;
}

export const NOTIFICATION_TYPE_ICONS: Record<string, string> = {
  NEW_ORDER: '📦',
  ORDER_APPROVED: '✅',
  ORDER_REJECTED: '❌',
  PAYMENT_RECEIVED: '💰',
  SCHEDULE_UPDATED: '📋',
  ORDER_COMPLETED: '🏁',
  ORDER_LATE: '⚠️',
  NEED_APPROVAL: '⏳',
  ACCEPTANCE_SUBMITTED: '📄',
  VOLUME_CONFIRMED: '📏',
  PAYMENT_NEEDED: '💳',
  DELIVERY_CONFIRMED: '🚚',
};

export const TRANG_THAI_DON_LABELS: Record<string, string> = {
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  tu_choi: "Từ chối",
  dang_san_xuat: "Đang sản xuất",
  dang_giao: "Đang giao",
  da_giao: "Đã giao",
  nghiem_thu: "Nghiệm thu",
  da_nghiem_thu: "Đã nghiệm thu",
  da_thanh_toan: "Đã thanh toán",
  da_hoan_thanh: "Hoàn thành",
  hoan_thanh: "Hoàn thành",
};

export const TRANG_THAI_DON_COLORS: Record<string, string> = {
  cho_duyet: "#f59e0b",
  da_duyet: "#3b82f6",
  tu_choi: "#ef4444",
  dang_san_xuat: "#8b5cf6",
  dang_giao: "#ea580c",
  da_giao: "#06b6d4",
  nghiem_thu: "#6366f1",
  da_nghiem_thu: "#795548",
  da_thanh_toan: "#eab308",
  hoan_thanh: "#22c55e",
};

export interface AccessSession {
  id: number;
  idNguoiDung: number;
  tokenHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  thaoTac: string;
  ngayTao: string | Date;
  ngayKetThuc: string | Date | null;
  hoTen: string;
  vaiTro: string;
}

export interface AccessLogItem {
  id: number;
  hanhDong: string;
  bangDuocTacDong: string | null;
  banGhiId: number | null;
  noiDungCu: string | null;
  noiDungMoi: string | null;
  ipAddress: string | null;
  thoiGian: string | Date;
}

export interface AccessSessionDetail {
  session: AccessSession;
  logs: AccessLogItem[];
}
