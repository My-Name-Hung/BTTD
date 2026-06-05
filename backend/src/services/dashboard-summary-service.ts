/**
 * Dashboard Service - Tổng hợp tất cả dữ liệu dashboard
 * Thay thế 11 API calls riêng biệt bằng 1 API call
 */

import { query } from '../config/database';
import cache, { CACHE_KEYS, CACHE_TTL } from '../utils/cache';

// ============================================================
// Types
// ============================================================

export interface DashboardSummary {
  thongKe: ThongKe;
  doanhThu: DoanhThuItem[];
  trangThai: TrangThaiItem[];
  xe: XeItem[];
  khachHang: KhachHangItem[];
  tramTron: TramTronItem[];
  taiXe: TaiXeItem[];
  thanhToan: ThanhToanStats;
  nghiemThu: NghiemThuStats;
  tram: TramStats[];
  congNo: CongNoItem[];
}

export interface ThongKe {
  tongDon: number;
  donChoDuyet: number;
  donDangXuLy: number;
  donDaHoanThanh: number;
  tongDoanhThu: number;
  tongCongNo: number;
  donQuaHan: number;
}

export interface DoanhThuItem {
  thang: string;
  doanhThu: number;
  soDonHang: number;
}

export interface TrangThaiItem {
  trangThai: string;
  soLuong: number;
}

export interface XeItem {
  id: number;
  bienSo: string;
  tenTaiXe: string | null;
}

export interface KhachHangItem {
  id: number;
  tenKhachHang: string;
  soDienThoai: string;
}

export interface TramTronItem {
  id: number;
  tenTram: string;
  diaChi: string;
}

export interface TaiXeItem {
  id: number;
  hoTen: string;
  soDienThoai: string;
}

export interface ThanhToanStats {
  tongThanhToan: number;
  chuaThanhToan: number;
}

export interface NghiemThuStats {
  choNghiemThu: number;
  daNghiemThu: number;
}

export interface TramStats {
  tenTram: string;
  soDon: number;
}

export interface CongNoItem {
  thang: string;
  congNo: number;
}

// ============================================================
// Main Dashboard API
// ============================================================

// Helper: wrap query để không crash dashboard nếu 1 query lỗi
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[Dashboard] Query error: ${err instanceof Error ? err.message : err}`);
    return fallback;
  }
}

function getDefaultThongKe(): ThongKe {
  return {
    tongDon: 0,
    donChoDuyet: 0,
    donDangXuLy: 0,
    donDaHoanThanh: 0,
    tongDoanhThu: 0,
    tongCongNo: 0,
    donQuaHan: 0,
  };
}

function getDefaultThanhToan(): ThanhToanStats {
  return { tongThanhToan: 0, chuaThanhToan: 0 };
}

function getDefaultNghiemThu(): NghiemThuStats {
  return { choNghiemThu: 0, daNghiemThu: 0 };
}

export async function layDashboardSummary(): Promise<DashboardSummary> {
  // Check cache first
  const cached = cache.get<DashboardSummary>(CACHE_KEYS.DASHBOARD_STATS);
  if (cached) {
    return cached;
  }

  // Run all queries in parallel với error handling riêng
  const [
    thongKeResult,
    doanhThuResult,
    trangThaiResult,
    xeResult,
    khachHangResult,
    tramTronResult,
    taiXeResult,
    thanhToanResult,
    nghiemThuResult,
    tramResult,
    congNoResult,
  ] = await Promise.all([
    safeQuery(getThongKe, getDefaultThongKe()),
    safeQuery(getDoanhThu, []),
    safeQuery(getTrangThai, []),
    safeQuery(getXe, []),
    safeQuery(getKhachHang, []),
    safeQuery(getTramTron, []),
    safeQuery(getTaiXe, []),
    safeQuery(getThanhToanStats, getDefaultThanhToan()),
    safeQuery(getNghiemThuStats, getDefaultNghiemThu()),
    safeQuery(getTramStats, []),
    safeQuery(getCongNo, []),
  ]);

  const summary: DashboardSummary = {
    thongKe: thongKeResult,
    doanhThu: doanhThuResult,
    trangThai: trangThaiResult,
    xe: xeResult,
    khachHang: khachHangResult,
    tramTron: tramTronResult,
    taiXe: taiXeResult,
    thanhToan: thanhToanResult,
    nghiemThu: nghiemThuResult,
    tram: tramResult,
    congNo: congNoResult,
  };

  // Cache the result
  cache.set(CACHE_KEYS.DASHBOARD_STATS, summary, CACHE_TTL.DASHBOARD_STATS);

  return summary;
}

// ============================================================
// Individual Queries (Private)
// ============================================================

async function getThongKe(): Promise<ThongKe> {
  const [tongDon] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon <> N'tu_choi'`
  );

  const [donChoDuyet] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon = N'cho_duyet'`
  );

  const [donDangXuLy] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon IN (N'da_duyet', N'dang_san_xuat', N'dang_giao', N'da_giao', N'nghiem_thu')`
  );

  const [donDaHoanThanh] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiHoanThanh = N'da_hoan_thanh'`
  );

  const [tongDoanhThu] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(thanhTien), 0) as tong FROM DonHang WHERE trangThaiDon = N'da_thanh_toan'`
  );

  const [tongCongNo] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(conLai), 0) as tong FROM DonHang WHERE conLai > 0 AND trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')`
  );

  const [donQuaHan] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM CongNo WITH (NOLOCK) WHERE trangThai = N'qua_han'`
  );

  return {
    tongDon: tongDon?.soLuong || 0,
    donChoDuyet: donChoDuyet?.soLuong || 0,
    donDangXuLy: donDangXuLy?.soLuong || 0,
    donDaHoanThanh: donDaHoanThanh?.soLuong || 0,
    tongDoanhThu: tongDoanhThu?.tong || 0,
    tongCongNo: tongCongNo?.tong || 0,
    donQuaHan: donQuaHan?.soLuong || 0,
  };
}

async function getDoanhThu(): Promise<DoanhThuItem[]> {
  // Last 12 months
  const thangBatDau = new Date();
  thangBatDau.setMonth(thangBatDau.getMonth() - 11);
  const thangBatDauStr = thangBatDau.toISOString().slice(0, 7);

  return query<DoanhThuItem>(
    `SELECT
       FORMAT(ngayTao, 'yyyy-MM') as thang,
       ISNULL(SUM(thanhTien), 0) as doanhThu,
       COUNT(*) as soDonHang
     FROM DonHang
     WHERE trangThaiDon = N'da_thanh_toan'
       AND FORMAT(ngayTao, 'yyyy-MM') >= @thangBatDau
     GROUP BY FORMAT(ngayTao, 'yyyy-MM')
     ORDER BY thang`,
    { thangBatDau: thangBatDauStr }
  );
}

async function getTrangThai(): Promise<TrangThaiItem[]> {
  return query<TrangThaiItem>(
    `SELECT trangThaiDon as trangThai, COUNT(*) as soLuong
     FROM DonHang WITH (NOLOCK)
     WHERE trangThaiDon <> N'tu_choi'
     GROUP BY trangThaiDon`
  );
}

async function getXe(): Promise<XeItem[]> {
  return query<XeItem>(
    `SELECT TOP 50 id, bienSo, tenTaiXe FROM Xe WHERE trangThai = N'hoat_dong' ORDER BY bienSo`
  );
}

async function getKhachHang(): Promise<KhachHangItem[]> {
  return query<KhachHangItem>(
    `SELECT TOP 50 id, tenKhachHang, soDienThoai FROM KhachHang ORDER BY tenKhachHang`
  );
}

async function getTramTron(): Promise<TramTronItem[]> {
  return query<TramTronItem>(
    `SELECT TOP 50 id, tenTram, diaChi FROM TramTron WHERE trangThai = N'hoat_dong' ORDER BY tenTram`
  );
}

async function getTaiXe(): Promise<TaiXeItem[]> {
  return query<TaiXeItem>(
    `SELECT TOP 50 id, hoTen, soDienThoai FROM NguoiDung WHERE vaiTro = N'tai_xe' AND trangThai = N'hoat_dong' ORDER BY hoTen`
  );
}

async function getThanhToanStats(): Promise<ThanhToanStats> {
  const [tongThanhToan] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(soTien), 0) as tong FROM ThanhToan`
  );

  const [chuaThanhToan] = await query<{ tong: number }>(
    `SELECT ISNULL(SUM(conLai), 0) as tong FROM DonHang WHERE conLai > 0 AND trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')`
  );

  return {
    tongThanhToan: tongThanhToan?.tong || 0,
    chuaThanhToan: chuaThanhToan?.tong || 0,
  };
}

async function getNghiemThuStats(): Promise<NghiemThuStats> {
  const [choNghiemThu] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon = N'da_giao'`
  );

  const [daNghiemThu] = await query<{ soLuong: number }>(
    `SELECT COUNT(*) as soLuong FROM DonHang WHERE trangThaiDon = N'nghiem_thu'`
  );

  return {
    choNghiemThu: choNghiemThu?.soLuong || 0,
    daNghiemThu: daNghiemThu?.soLuong || 0,
  };
}

async function getTramStats(): Promise<TramStats[]> {
  return query<TramStats>(
    `SELECT TOP 10
       ISNULL(t.tenTram, N'Không xác định') as tenTram,
       COUNT(*) as soDon
     FROM DonHang dh
     LEFT JOIN TramTron t ON dh.idTramTron = t.id
     WHERE dh.trangThaiDon <> N'tu_choi'
     GROUP BY t.tenTram
     ORDER BY soDon DESC`
  );
}

async function getCongNo(): Promise<CongNoItem[]> {
  // Last 6 months
  const thangBatDau = new Date();
  thangBatDau.setMonth(thangBatDau.getMonth() - 5);
  const thangBatDauStr = thangBatDau.toISOString().slice(0, 7);

  return query<CongNoItem>(
    `SELECT
       FORMAT(ngayTao, 'yyyy-MM') as thang,
       ISNULL(SUM(conLai), 0) as congNo
     FROM DonHang
     WHERE trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')
       AND conLai > 0
       AND FORMAT(ngayTao, 'yyyy-MM') >= @thangBatDau
     GROUP BY FORMAT(ngayTao, 'yyyy-MM')
     ORDER BY thang`,
    { thangBatDau: thangBatDauStr }
  );
}
