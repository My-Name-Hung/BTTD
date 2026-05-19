import {
  ApiResponse,
  ApiResponseWithPagination,
  NguoiDung,
  DonHang,
  ThongKeDashboard,
  DoanhThuTheoThang,
  DonHangTheoTrangThai,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('bttd_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
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

export async function dangNhap(
  tenDangNhap: string,
  matKhau: string
): Promise<{ token: string; user: NguoiDung }> {
  const result = await request<{ token: string; user: NguoiDung }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ tenDangNhap, matKhau }),
  });
  localStorage.setItem('bttd_token', result.token);
  localStorage.setItem('bttd_user', JSON.stringify(result.user));
  return result;
}

export async function layThongTinNguoiDung(): Promise<NguoiDung> {
  return request<NguoiDung>('/auth/profile');
}

export async function layDanhSachDonHang(
  page = 1,
  limit = 20,
  trangThai?: string,
  tuKhoa?: string
): Promise<ApiResponseWithPagination<DonHang[]>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (trangThai) params.append('trangThai', trangThai);
  if (tuKhoa) params.append('tuKhoa', tuKhoa);
  return request<ApiResponseWithPagination<DonHang[]>>(`/don-hang?${params}`);
}

export async function layThongKeDashboard(): Promise<ThongKeDashboard> {
  return request<ThongKeDashboard>('/dashboard/tong-quan');
}

export async function layDoanhThuTheoThang(
  thangBatDau = '2025-01',
  thangKetThuc = '2026-12'
): Promise<DoanhThuTheoThang[]> {
  return request<DoanhThuTheoThang[]>(
    `/dashboard/doanh-thu?thangBatDau=${thangBatDau}&thangKetThuc=${thangKetThuc}`
  );
}

export async function layDonHangTheoTrangThai(): Promise<DonHangTheoTrangThai[]> {
  return request<DonHangTheoTrangThai[]>('/dashboard/trang-thai');
}
