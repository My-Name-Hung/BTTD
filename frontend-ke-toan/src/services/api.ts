import {
  ApiResponse,
  ApiResponseWithPagination,
  CongNo,
  DoanhThuTheoThang,
  DonHang,
  DonHangTheoTrangThai,
  KhachHang,
  LichSanXuat,
  MacBeTong,
  NghiemThu,
  NguoiDung,
  ThanhToan,
  ThongKeDashboard,
  TramTron,
  Xe,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

function getToken(): string | null {
  return localStorage.getItem("bttd_token");
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  // Auto-logout when token is invalid or expired
  if (response.status === 401) {
    localStorage.removeItem("bttd_token");
    localStorage.removeItem("bttd_user");
    window.location.href = "/login";
    throw new Error("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại");
  }

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.message);
  }

  return data.data as T;
}

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
  const res = await fetch(`${BASE_URL}/don-hang?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json as ApiResponseWithPagination<DonHang[]>;
}

export async function layDonHang(id: number): Promise<DonHang> {
  return request<DonHang>(`/don-hang/${id}`);
}

export async function taoDonHang(data: Partial<DonHang>): Promise<DonHang> {
  return request<DonHang>("/don-hang", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function suaDonHang(
  id: number,
  data: Partial<DonHang>,
): Promise<DonHang> {
  return request<DonHang>(`/don-hang/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function duyetDonHang(id: number): Promise<DonHang> {
  return request<DonHang>(`/don-hang/${id}/duyet`, { method: "PUT" });
}

export async function tuChoiDonHang(
  id: number,
  lyDo: string,
): Promise<DonHang> {
  return request<DonHang>(`/don-hang/${id}/tu-choi`, {
    method: "PUT",
    body: JSON.stringify({ lyDo }),
  });
}

export async function xoaDonHang(id: number): Promise<void> {
  await request(`/don-hang/${id}`, { method: "DELETE" });
}

export async function layThongKeDashboard(): Promise<ThongKeDashboard> {
  return request<ThongKeDashboard>("/dashboard/tong-quan");
}

export async function layDoanhThuTheoThang(
  thangBatDau = "2025-01",
  thangKetThuc = "2026-12",
): Promise<DoanhThuTheoThang[]> {
  return request<DoanhThuTheoThang[]>(
    `/dashboard/doanh-thu?thangBatDau=${thangBatDau}&thangKetThuc=${thangKetThuc}`,
  );
}

export async function layDonHangTheoTrangThai(): Promise<
  DonHangTheoTrangThai[]
> {
  return request<DonHangTheoTrangThai[]>("/dashboard/trang-thai");
}

export async function layDanhSachKhachHang(
  page = 1,
  limit = 50,
  tuKhoa?: string,
): Promise<ApiResponseWithPagination<KhachHang[]>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (tuKhoa) params.append("tuKhoa", tuKhoa);
  const res = await fetch(`${BASE_URL}/tham-so/khach-hang?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json as ApiResponseWithPagination<KhachHang[]>;
}

export async function taoKhachHang(
  data: Partial<KhachHang>,
): Promise<KhachHang> {
  return request<KhachHang>("/tham-so/khach-hang", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function suaKhachHang(
  id: number,
  data: Partial<KhachHang>,
): Promise<KhachHang> {
  return request<KhachHang>(`/tham-so/khach-hang/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function xoaKhachHang(id: number): Promise<void> {
  await request(`/tham-so/khach-hang/${id}`, { method: "DELETE" });
}

export async function layDanhSachMacBeTong(): Promise<MacBeTong[]> {
  return request<MacBeTong[]>("/tham-so/mac-be-tong");
}

export async function taoMacBeTong(
  data: Partial<MacBeTong>,
): Promise<MacBeTong> {
  return request<MacBeTong>("/tham-so/mac-be-tong", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function layDanhSachTramTron(
  tuKhoa?: string,
  trangThai?: string,
): Promise<TramTron[]> {
  const params = new URLSearchParams();
  if (tuKhoa) params.append("tuKhoa", tuKhoa);
  if (trangThai) params.append("trangThai", trangThai);
  const url = `/tham-so/tram-tron${params.size ? `?${params}` : ""}`;
  const res = await request<TramTron[]>(url);
  return res ?? [];
}

export async function layDanhSachXe(trangThai?: string): Promise<Xe[]> {
  const url = trangThai ? `/tham-so/xe?trangThai=${trangThai}` : "/tham-so/xe";
  const res = await request<Xe[]>(url);
  return res ?? [];
}

export async function taoXe(data: Partial<Xe>): Promise<Xe> {
  return request<Xe>("/tham-so/xe", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function taoLichSanXuat(
  data: Partial<LichSanXuat>,
): Promise<LichSanXuat> {
  return request<LichSanXuat>("/dieu-phoi", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function layLichSanXuat(
  idDonHang: number,
): Promise<LichSanXuat[]> {
  return request<LichSanXuat[]>(`/dieu-phoi/don-hang/${idDonHang}`);
}

export async function layTatCaLichSanXuat(): Promise<LichSanXuat[]> {
  return request<LichSanXuat[]>("/dieu-phoi");
}

export async function capNhatLichSanXuat(
  id: number,
  data: Partial<LichSanXuat>,
): Promise<LichSanXuat> {
  return request<LichSanXuat>(`/dieu-phoi/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function xacNhanDaGiao(
  idDonHang: number,
  khoiLuongThucTe?: number,
): Promise<DonHang> {
  return request<DonHang>(`/dieu-phoi/xac-nhan-giao/${idDonHang}`, {
    method: "PUT",
    body: JSON.stringify({ khoiLuongThucTe }),
  });
}

export async function taoNghiemThu(
  data: Partial<NghiemThu>,
): Promise<NghiemThu> {
  return request<NghiemThu>("/nghiem-thu", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function layNghiemThu(
  idDonHang: number,
): Promise<NghiemThu | null> {
  return request<NghiemThu | null>(`/nghiem-thu/don-hang/${idDonHang}`);
}

export async function xacNhanNghiemThu(idDonHang: number): Promise<DonHang> {
  return request<DonHang>(`/nghiem-thu/xac-nhan/${idDonHang}`, {
    method: "PUT",
  });
}

export async function layDanhSachCongNo(
  page = 1,
  limit = 20,
  trangThai?: string,
): Promise<ApiResponseWithPagination<CongNo[]>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (trangThai) params.append("trangThai", trangThai);
  const res = await fetch(`${BASE_URL}/thanh-toan/cong-no?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json as ApiResponseWithPagination<CongNo[]>;
}

export async function taoCongNo(
  idDonHang: number,
  ngayBatDau?: string,
  hanThanhToan?: string,
): Promise<CongNo> {
  return request<CongNo>("/thanh-toan/cong-no", {
    method: "POST",
    body: JSON.stringify({ idDonHang, ngayBatDau, hanThanhToan }),
  });
}

export async function taoThanhToan(data: {
  idDonHang: number;
  soTien: number;
  hinhThuc?: string;
  nguoiNhan?: string;
  ghiChu?: string;
}): Promise<ThanhToan> {
  return request<ThanhToan>("/thanh-toan", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function layLichSuThanhToan(
  idDonHang: number,
): Promise<ThanhToan[]> {
  return request<ThanhToan[]>(`/thanh-toan/don-hang/${idDonHang}`);
}

// ===== QUAN LY (ADMIN) =====

export async function layDanhSachNguoiDung(
  page = 1,
  limit = 50,
  tuKhoa?: string,
): Promise<ApiResponseWithPagination<NguoiDung[]>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (tuKhoa) params.append("tuKhoa", tuKhoa);
  const res = await fetch(`${BASE_URL}/quan-ly/nguoi-dung?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json as ApiResponseWithPagination<NguoiDung[]>;
}

export async function taoNguoiDung(data: {
  tenDangNhap: string;
  matKhau: string;
  hoTen: string;
  email?: string;
  soDienThoai?: string;
  vaiTro: string;
}): Promise<NguoiDung> {
  return request<NguoiDung>("/quan-ly/nguoi-dung", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function suaNguoiDung(
  id: number,
  data: {
    hoTen: string;
    email?: string;
    soDienThoai?: string;
    vaiTro: string;
    trangThai?: string;
    matKhauMoi?: string;
  },
): Promise<NguoiDung> {
  return request<NguoiDung>(`/quan-ly/nguoi-dung/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function xoaNguoiDung(id: number): Promise<void> {
  await request(`/quan-ly/nguoi-dung/${id}`, { method: "DELETE" });
}

export async function taoTramTron(data: Partial<TramTron>): Promise<TramTron> {
  return request<TramTron>("/tham-so/tram-tron", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function suaTramTron(
  id: number,
  data: Partial<TramTron>,
): Promise<TramTron> {
  return request<TramTron>(`/tham-so/tram-tron/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function xoaTramTron(id: number): Promise<void> {
  await request(`/tham-so/tram-tron/${id}`, { method: "DELETE" });
}

export async function suaXe(id: number, data: Partial<Xe>): Promise<Xe> {
  return request<Xe>(`/tham-so/xe/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function xoaXe(id: number): Promise<void> {
  await request(`/tham-so/xe/${id}`, { method: "DELETE" });
}

export async function suaMacBeTong(
  id: number,
  data: Partial<MacBeTong>,
): Promise<MacBeTong> {
  return request<MacBeTong>(`/tham-so/mac-be-tong/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function xoaMacBeTong(id: number): Promise<void> {
  await request(`/tham-so/mac-be-tong/${id}`, { method: "DELETE" });
}

// ===== NOTIFICATIONS =====
export async function layDanhSachThongBao(
  page = 1,
  limit = 20,
  isRead?: boolean,
): Promise<{ data: import('../types').ThongBao[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (isRead !== undefined) params.append("isRead", String(isRead));
  const res = await fetch(`${BASE_URL}/notifications?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return { data: json.data || [], total: json.pagination?.total || 0 };
}

export async function danhDauDaDocThongBao(id: number): Promise<void> {
  await request(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function danhDauTatCaDaDocThongBao(): Promise<void> {
  await request(`/notifications/read-all`, { method: "PATCH" });
}

export async function xoaThongBao(id: number): Promise<void> {
  await request(`/notifications/${id}`, { method: "DELETE" });
}
