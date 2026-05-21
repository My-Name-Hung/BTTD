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
  vaiTro: "admin" | "ke_toan" | "dieu_phoi" | "lanh_dao";
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
  tenTaiXe: string | null;
  soDienThoaiTaiXe: string | null;
  taiTrong: number | null;
  trangThai: "san_sang" | "dang_giao" | "bao_tri";
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
  thanhTien: number | null;
  thoiGianGiaoDuKien: string | null;
  ngayTaoDon: string;
  ngayDuyet: string | null;
  ngayGiao: string | null;
  ngayNghiemThu: string | null;
  trangThaiDon:
    | "cho_duyet"
    | "da_duyet"
    | "dang_san_xuat"
    | "dang_giao"
    | "da_giao"
    | "nghiem_thu"
    | "da_thanh_toan"
    | "tu_choi";
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
  kyThuatCongTrinh: string | null;
  nguoiOmOng: string | null;
  nguoiBatOng: string | null;
  phuongAnDo: string | null;
  bienSoXe: string | null;
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
  chatLuong: "dat" | "khong_dat" | null;
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
  maDonHang?: string;
  tenKhachHang?: string;
  thanhTien?: number;
}

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
  dang_san_xuat: "Đang sản xuất",
  dang_giao: "Đang giao",
  da_giao: "Đã giao",
  nghiem_thu: "Nghiệm thu",
  da_thanh_toan: "Đã thanh toán",
  tu_choi: "Từ chối",
};

export const TRANG_THAI_DON_COLORS: Record<string, string> = {
  cho_duyet: "#f59e0b",
  da_duyet: "#3b82f6",
  dang_san_xuat: "#8b5cf6",
  dang_giao: "#f97316",
  da_giao: "#06b6d4",
  nghiem_thu: "#6366f1",
  da_thanh_toan: "#10b981",
  tu_choi: "#ef4444",
};
