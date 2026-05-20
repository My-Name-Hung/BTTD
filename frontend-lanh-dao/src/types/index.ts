// ============================================================
// Types cho Dashboard Lãnh đạo — Bê Tông Tây Đô
// ============================================================

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
  vaiTro: 'admin' | 'ke_toan' | 'dieu_phoi' | 'lanh_dao';
  trangThai: 'hoat_dong' | 'khong_hoat_dong';
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
  thanhTien: number | null;
  thoiGianGiaoDuKien: string | null;
  ngayTaoDon: string;
  ngayDuyet: string | null;
  ngayGiao: string | null;
  ngayNghiemThu: string | null;
  trangThaiDon:
    | 'cho_duyet'
    | 'da_duyet'
    | 'dang_san_xuat'
    | 'dang_giao'
    | 'da_giao'
    | 'nghiem_thu'
    | 'da_thanh_toan'
    | 'tu_choi';
  trangThaiHoanThanh: 'chua_hoan_thanh' | 'dang_hoan_thanh' | 'da_hoan_thanh';
  nguoiTaoId: number | null;
  nguoiDuyetId: number | null;
  ghiChu: string | null;
  lyDoTuChoi: string | null;
  daThanhToan: number;
  conLai: number | null;
  nguoiTaoHoTen?: string | null;
  nguoiDuyetHoTen?: string | null;
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

export interface DoanhThuTheoMac {
  tenMac: string;
  tongDoanhThu: number;
  soDonHang: number;
}

export interface DoanhThuTongHop {
  tongDonHang: number;
  tongDoanhThu: number;
  tongCongNo: number;
  soDonQuaHan: number;
  doanhThuThangNay: number;
  doanhThuThangTruoc: number;
  tiLeTangTruong: number;
}

export interface DonHangGiaoHang {
  id: number;
  maDonHang: string;
  tenKhachHang: string;
  diaChiNhan: string;
  soDienThoai: string;
  tenMacBeTong: string | null;
  khoiLuongDat: number;
  khoiLuongThucTe: number | null;
  thanhTien: number | null;
  thoiGianGiaoDuKien: string | null;
  ngayTaoDon: string;
  trangThaiDon: string;
  trangThaiLich: string | null;
  bienSoXe: string | null;
  tenTaiXe: string | null;
  soDienThoaiTaiXe: string | null;
}

export interface CongNoTongHop {
  id: number;
  maDonHang: string;
  tenKhachHang: string;
  tongTien: number;
  daThanhToan: number;
  conLai: number;
  ngayBatDau: string | null;
  hanThanhToan: string | null;
  trangThai: string;
  soNgayQuaHan: number;
  ghiChu: string | null;
  ngayTao: string;
}

export interface CanhBaoDonHang {
  id: number;
  maDonHang: string;
  tenKhachHang: string;
  diaChiNhan: string;
  tenMacBeTong: string | null;
  khoiLuongDat: number;
  thanhTien: number | null;
  conLai: number;
  ngayTaoDon: string;
  thoiGianGiaoDuKien: string | null;
  trangThaiDon: string;
  loaiCanhBao: 'don_tre' | 'cong_no' | 'qua_han';
  moTa: string;
}

// ============================================================
// Labels & Colors
// ============================================================

export const TRANG_THAI_DON_LABELS: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  dang_san_xuat: 'Đang sản xuất',
  dang_giao: 'Đang giao',
  da_giao: 'Đã giao',
  nghiem_thu: 'Nghiệm thu',
  da_thanh_toan: 'Đã thanh toán',
  tu_choi: 'Từ chối',
};

export const TRANG_THAI_DON_COLORS: Record<string, string> = {
  cho_duyet: '#f59e0b',
  da_duyet: '#3b82f6',
  dang_san_xuat: '#8b5cf6',
  dang_giao: '#f97316',
  da_giao: '#06b6d4',
  nghiem_thu: '#6366f1',
  da_thanh_toan: '#10b981',
  tu_choi: '#ef4444',
};

export const TRANG_THAI_LICH_SAN_XUAT_LABELS: Record<string, string> = {
  chua_san_xuat: 'Chưa sản xuất',
  dang_san_xuat: 'Đang sản xuất',
  da_xong: 'Hoàn thành',
};

export const TRANG_THAI_LICH_COLORS: Record<string, string> = {
  chua_san_xuat: '#94a3b8',
  dang_san_xuat: '#f97316',
  da_xong: '#10b981',
};

export const TRANG_THAI_CONG_NO_LABELS: Record<string, string> = {
  chua_thanh_toan: 'Chưa thanh toán',
  dang_thanh_toan: 'Đang thanh toán',
  da_thanh_toan: 'Đã thanh toán',
  qua_han: 'Quá hạn',
};

export const TRANG_THAI_CONG_NO_COLORS: Record<string, string> = {
  chua_thanh_toan: '#f59e0b',
  dang_thanh_toan: '#3b82f6',
  da_thanh_toan: '#10b981',
  qua_han: '#ef4444',
};
