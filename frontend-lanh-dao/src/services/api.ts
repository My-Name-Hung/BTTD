// ============================================================
// API Service — Dashboard Lãnh Đạo Bê Tông Tây Đô
// ============================================================

import {
  ApiResponse,
  ApiResponseWithPagination,
  CanhBaoDonHang,
  CongNoTongHop,
  DoanhThuTheoMac,
  DoanhThuTheoThang,
  DoanhThuTongHop,
  DonHang,
  DonHangGiaoHang,
  DonHangTheoTrangThai,
  NguoiDung,
  ThongKeDashboard,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "https://apibttd.ximangtaydo.vn/api";

// ============================================================
// Helpers
// ============================================================

function getToken(): string | null {
  return localStorage.getItem("bttd_token");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data as T;
}

// ============================================================
// Auth
// ============================================================

export async function dangNhap(
  tenDangNhap: string,
  matKhau: string,
): Promise<{ token: string; user: NguoiDung }> {
  const result = await request<{ token: string; user: NguoiDung }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ tenDangNhap, matKhau }),
    },
  );
  localStorage.setItem("bttd_token", result.token);
  localStorage.setItem("bttd_user", JSON.stringify(result.user));
  return result;
}

export async function layThongTinNguoiDung(): Promise<NguoiDung> {
  return request<NguoiDung>("/auth/profile");
}

export function layThongTinHienTai(): NguoiDung | null {
  const saved = localStorage.getItem("bttd_user");
  return saved ? JSON.parse(saved) : null;
}

// ============================================================
// Dashboard Lãnh Đạo
// ============================================================

export async function layThongKeLanhDao(): Promise<ThongKeDashboard> {
  return request<ThongKeDashboard>("/lanh-dao/dashboard/tong-quan");
}

export async function layDoanhThuLanhDao(
  thangBatDau = "2025-01",
  thangKetThuc = "2026-12",
): Promise<DoanhThuTheoThang[]> {
  return request<DoanhThuTheoThang[]>(
    `/lanh-dao/dashboard/doanh-thu?thangBatDau=${thangBatDau}&thangKetThuc=${thangKetThuc}`,
  );
}

export async function layDoanhThuTheoMac(
  thangBatDau = "2025-01",
  thangKetThuc = "2026-12",
): Promise<DoanhThuTheoMac[]> {
  return request<DoanhThuTheoMac[]>(
    `/lanh-dao/dashboard/doanh-thu-theo-mac?thangBatDau=${thangBatDau}&thangKetThuc=${thangKetThuc}`,
  );
}

export async function layDonHangTheoTrangThai(): Promise<
  DonHangTheoTrangThai[]
> {
  return request<DonHangTheoTrangThai[]>("/lanh-dao/dashboard/trang-thai");
}

export async function layDoanhThuTongHop(): Promise<DoanhThuTongHop> {
  return request<DoanhThuTongHop>("/lanh-dao/dashboard/tong-hop");
}

// ============================================================
// Đơn hàng đang xử lý
// ============================================================

export async function layDonHangDangXuLy(): Promise<DonHang[]> {
  return request<DonHang[]>("/lanh-dao/don-hang/dang-xu-ly");
}

// ============================================================
// Giao hàng
// ============================================================

export async function layDonHangGiaoHang(): Promise<DonHangGiaoHang[]> {
  return request<DonHangGiaoHang[]>("/lanh-dao/giao-hang");
}

// ============================================================
// Công nợ
// ============================================================

export async function layCongNoLanhDao(): Promise<CongNoTongHop[]> {
  return request<CongNoTongHop[]>("/lanh-dao/cong-no");
}

// ============================================================
// Cảnh báo
// ============================================================

export async function layDanhSachCanhBao(): Promise<CanhBaoDonHang[]> {
  return request<CanhBaoDonHang[]>("/lanh-dao/canh-bao");
}

// ============================================================
// DonHang generic (tìm kiếm)
// ============================================================

export async function layDanhSachDonHang(
  page = 1,
  limit = 20,
  trangThai?: string,
  tuKhoa?: string,
): Promise<ApiResponseWithPagination<DonHang[]>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (trangThai) params.append("trangThai", trangThai);
  if (tuKhoa) params.append("tuKhoa", tuKhoa);
  return request<ApiResponseWithPagination<DonHang[]>>(`/don-hang?${params}`);
}

export async function layDonHangTheoId(id: number): Promise<DonHang> {
  return request<DonHang>(`/don-hang/${id}`);
}
