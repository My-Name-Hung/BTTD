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

const BASE_URL =
  import.meta.env.VITE_API_URL || "https://bttd.onrender.com/api";

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

export async function layDanhSachTaiXe(): Promise<{ id: number; hoTen: string; soDienThoai: string | null }[]> {
  return request<{ id: number; hoTen: string; soDienThoai: string | null }[]>("/tham-so/tai-xe");
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

export async function xacNhanNghiemThu(idDonHang: number, loai: 'da' | 'chua' = 'da'): Promise<DonHang> {
  const params = loai === 'chua' ? '?loai=chua' : '';
  return request<DonHang>(`/nghiem-thu/xac-nhan/${idDonHang}${params}`, {
    method: "PUT",
  });
}

// Xác nhận nghiệm thu kèm upload file trong 1 request
export async function xacNhanNghiemThuUploadFile(
  idDonHang: number,
  file: File,
): Promise<{ donHang: DonHang; bienBanFile: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${BASE_URL}/nghiem-thu/xac-nhan-upload/${idDonHang}`,
    {
      method: "POST",
      headers: { Authorization: token ? `Bearer ${token}` : "" },
      body: formData,
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || "Lỗi xác nhận nghiệm thu");
  }
  return result.data;
}

export async function uploadBienBanNghiemThu(
  idDonHang: number,
  file: File,
): Promise<{ bienBanFile: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${BASE_URL}/nghiem-thu/upload/${idDonHang}`,
    {
      method: "POST",
      headers: { Authorization: token ? `Bearer ${token}` : "" },
      body: formData,
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || "Lỗi tải file biên bản nghiệm thu");
  }
  return result.data;
}

export async function layDanhSachCongNo(
  page = 1,
  limit = 20,
  opts?: { trangThai?: string; nhom?: string; search?: string },
): Promise<ApiResponseWithPagination<CongNo[]>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (opts?.trangThai) params.append("trangThai", opts.trangThai);
  if (opts?.nhom) params.append("nhom", opts.nhom);
  if (opts?.search) params.append("search", opts.search);
  const res = await fetch(`${BASE_URL}/thanh-toan/cong-no?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json as ApiResponseWithPagination<CongNo[]>;
}

export async function layCongNoGrouped(search?: string, nhom?: string): Promise<CongNoGroup[]> {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (nhom) params.append("nhom", nhom);
  const res = await fetch(`${BASE_URL}/thanh-toan/cong-no/grouped?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data as CongNoGroup[];
}

// CongNoKhachHang (Bravo)
export async function layCongNoKhachHangGrouped(search?: string, nhom?: string): Promise<CongNoKhachHangGroup[]> {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (nhom) params.append("nhom", nhom);
  const res = await fetch(`${BASE_URL}/cong-no-khach-hang/grouped?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data as CongNoKhachHangGroup[];
}

export async function layDanhSachNhomCongNoKhachHang(): Promise<{ nhom: string; soLuong: number }[]> {
  const res = await fetch(`${BASE_URL}/cong-no-khach-hang/nhom/list`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data as { nhom: string; soLuong: number }[];
}

export async function suaCongNoKhachHang(id: number, data: {
  maKhachHang?: string;
  tenKhachHang?: string;
  duDauNo?: number;
  duDauCo?: number;
  phatSinhNo?: number;
  phatSinhCo?: number;
  duCuoiNo?: number;
  duCuoiCo?: number;
  nhom?: string;
}): Promise<CongNoKhachHang> {
  return request<CongNoKhachHang>(`/cong-no-khach-hang/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function xoaCongNoKhachHang(id: number): Promise<void> {
  return request<void>(`/cong-no-khach-hang/${id}`, { method: "DELETE" });
}

export async function importCongNoKhachHang(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/import/cong-no-khach-hang`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data as ImportResult;
}

export async function layDanhSachNhomCongNo(): Promise<{ nhom: string; soLuong: number }[]> {
  const res = await fetch(`${BASE_URL}/thanh-toan/cong-no/nhom/list`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data as { nhom: string; soLuong: number }[];
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

export async function suaCongNo(id: number, data: {
  tongTien?: number;
  daThanhToan?: number;
  conLai?: number;
  ngayBatDau?: string | null;
  hanThanhToan?: string | null;
  trangThai?: string;
  ghiChu?: string | null;
  nhom?: string | null;
}): Promise<CongNo> {
  return request<CongNo>(`/thanh-toan/cong-no/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function xoaCongNo(id: number): Promise<void> {
  return request<void>(`/thanh-toan/cong-no/${id}`, {
    method: "DELETE",
  });
}

export async function layCongNoTheoId(id: number): Promise<CongNo> {
  return request<CongNo>(`/thanh-toan/cong-no/${id}`);
}

export async function importCongNo(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/import/cong-no`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
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

export async function resetThongBaoNgayCu(): Promise<{ deleted: number }> {
  const res = await request<{ data: { deleted: number } }>('/notifications/reset', { method: 'POST' });
  return res.data;
}

// ===== IMPORT =====
export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
  details: { row: number; message: string; data: Record<string, unknown> }[];
}

export interface ImportHistory {
  id: number;
  loai: string;
  tenFile: string;
  tongSo: number;
  thanhCong: number;
  thatBai: number;
  nguoiTaiHoTen: string;
  ngayTai: string;
}

export async function layLichSuImport(
  loai: string,
  page = 1,
  limit = 20,
  tuNgay?: string,
  denNgay?: string,
): Promise<{ data: ImportHistory[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const params = new URLSearchParams({ loai, page: String(page), limit: String(limit) });
  if (tuNgay) params.append('tuNgay', tuNgay);
  if (denNgay) params.append('denNgay', denNgay);
  const res = await fetch(`${BASE_URL}/import/lich-su?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return { data: json.data || [], pagination: json.pagination };
}

async function importFile(
  endpoint: string,
  file: File,
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data as ImportResult;
}

export const importDonHang = (file: File) => importFile('/import/don-hang', file);
export const importKhachHang = (file: File) => importFile('/import/khach-hang', file);
export const importNguoiDung = (file: File) => importFile('/import/nguoi-dung', file);
export const importPhuongTien = (file: File) => importFile('/import/phuong-tien', file);
export const importMacBeTong = (file: File) => importFile('/import/mac-be-tong', file);

// ===== CẤU HÌNH HỆ THỐNG =====
export async function layTrangThaiBaoTri(): Promise<import('../types').MaintenanceStatus> {
  const res = await fetch(`${BASE_URL}/cau-hinh/trang-thai`);
  const json = await res.json();
  return json.data as import('../types').MaintenanceStatus;
}

export async function batBaoTri(payload: {
  noiDung: string;
  thoiGianBatDau?: string | null;
  thoiGianKetThuc?: string | null;
}): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/cau-hinh/bat-bao-tri`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
}

export async function tatBaoTri(): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/cau-hinh/tat-bao-tri`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
}

// ===== KHO =====
// Lấy danh sách lịch sản xuất (tất cả đơn có lịch sx)
export async function layLichSanXuatKho(): Promise<any[]> {
  return request<any[]>("/kho/lich-san-xuat");
}

// Lấy chi tiết đơn hàng cho kho (kèm lịch sx)
export async function layDonHangKho(idDonHang: number): Promise<{ donHang: any; lichSanXuat: any | null }> {
  return request<{ donHang: any; lichSanXuat: any | null }>(`/kho/don-hang/${idDonHang}`);
}

// Kho xác nhận bắt đầu giao (dang_san_xuat -> dang_giao)
export async function xacNhanBatDauGiao(idDonHang: number): Promise<any> {
  return request<any>(`/kho/xac-nhan-bat-dau-giao/${idDonHang}`, {
    method: "PUT",
  });
}

// Kho xác nhận đã giao thành công (dang_giao -> da_giao)
export async function xacNhanDaGiaoKho(
  idDonHang: number,
  khoiLuongThucTe?: number,
): Promise<any> {
  return request<any>(`/kho/xac-nhan-giao/${idDonHang}`, {
    method: "PUT",
    body: JSON.stringify({ khoiLuongThucTe }),
  });
}

// ===== SALE — lấy đơn của mình =====
export async function layDonHangCuaToi(
  page = 1,
  limit = 20,
  trangThai?: string,
): Promise<ApiResponseWithPagination<DonHang[]>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (trangThai) params.append("trangThai", trangThai);
  const res = await fetch(`${BASE_URL}/don-hang/cua-toi?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json as ApiResponseWithPagination<DonHang[]>;
}

// ===== TÀI XẾ — lấy đơn giao của mình =====
export async function layDonHangGiaoCuaToi(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/tai-xe/don-hang-cua-toi`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data || [];
}

// Tài xế cập nhật trạng thái giao
export async function taiXeCapNhatTrangThaiGiao(
  idDonHang: number,
  trangThai: 'dang_giao' | 'da_giao',
  khoiLuongThucTe?: number,
): Promise<DonHang> {
  return request<DonHang>(`/tai-xe/cap-nhat-giao/${idDonHang}`, {
    method: "PUT",
    body: JSON.stringify({ trangThai, khoiLuongThucTe }),
  });
}

// Tài xế thống kê đơn hàng
export async function layThongKeTaiXe(): Promise<{ tongDon: number; chuaGiao: number; daGiao: number }> {
  const res = await fetch(`${BASE_URL}/tai-xe/thong-ke`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// Tài xế lịch sử giao hàng
export async function layLichSuGiaoHangTaiXe(): Promise<DonHang[]> {
  const res = await fetch(`${BASE_URL}/tai-xe/lich-su-giao`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data || [];
}

// ===== KỸ THUẬT — lấy đơn chờ nghiệm thu =====
export async function layDonHangChoNghiemThu(): Promise<DonHang[]> {
  const res = await fetch(`${BASE_URL}/ky-thuat/don-hang-cho-nghiem-thu`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data || [];
}

// ===== ACCESS HISTORY — Lịch sử truy cập =====
export async function layDanhSachNguoiDungAccess(): Promise<{ id: number; hoTen: string; vaiTro: string }[]> {
  return request(`/access-history/users`);
}

export async function layLichSuTruyCap(opts?: {
  idNguoiDung?: number; tuNgay?: string; denNgay?: string; page?: number; limit?: number;
}): Promise<ApiResponseWithPagination<AccessSession[]>> {
  const params = new URLSearchParams();
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.idNguoiDung) params.set('idNguoiDung', String(opts.idNguoiDung));
  if (opts?.tuNgay) params.set('tuNgay', opts.tuNgay);
  if (opts?.denNgay) params.set('denNgay', opts.denNgay);
  const res = await fetch(`${BASE_URL}/access-history/sessions?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json;
}

export async function layChiTietAccessSession(sessionId: number): Promise<AccessSessionDetail> {
  return request(`/access-history/sessions/${sessionId}`);
}

export async function batBuocDangXuatSession(sessionId: number): Promise<void> {
  return request(`/access-history/sessions/${sessionId}/logout`, { method: 'POST' });
}

export async function resetMatKhauUser(userId: number, matKhauMoi: string): Promise<void> {
  return request(`/access-history/users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ matKhauMoi }),
  });
}

export async function capNhatBannedIp(userId: number, bannedIp: string | null): Promise<void> {
  return request(`/access-history/users/${userId}/banned-ip`, {
    method: 'POST',
    body: JSON.stringify({ bannedIp }),
  });
}
