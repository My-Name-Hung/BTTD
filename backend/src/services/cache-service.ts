/**
 * Cached Service Layer
 * Wrapper cho các service để tự động cache kết quả
 */

import cache, { CACHE_KEYS, CACHE_TTL } from '../utils/cache';

/**
 * Wrapper để cache kết quả của bất kỳ async function nào
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const data = await fetcher();
  cache.set(key, data, ttl);
  return data;
}

// ============================================================
// Cached Dashboard Services
// ============================================================

export async function layThongKeDashboardCached() {
  return withCache(
    CACHE_KEYS.DASHBOARD_STATS,
    CACHE_TTL.DASHBOARD_STATS,
    async () => {
      const { layThongKeLanhDao } = await import('../services/lanh-dao-service');
      return layThongKeLanhDao();
    }
  );
}

export async function layDoanhThuTheoThangCached(thangBatDau: string, thangKetThuc: string) {
  return withCache(
    `${CACHE_KEYS.DASHBOARD_REVENUE}:${thangBatDau}:${thangKetThuc}`,
    CACHE_TTL.DASHBOARD_REVENUE,
    async () => {
      const { layDoanhThuLanhDao } = await import('../services/lanh-dao-service');
      return layDoanhThuLanhDao(thangBatDau, thangKetThuc);
    }
  );
}

export async function layDonHangTheoTrangThaiCached() {
  return withCache(
    CACHE_KEYS.DASHBOARD_STATUS,
    CACHE_TTL.DASHBOARD_STATUS,
    async () => {
      const { layDonHangTheoTrangThaiLanhDao } = await import('../services/lanh-dao-service');
      return layDonHangTheoTrangThaiLanhDao();
    }
  );
}

// ============================================================
// Cached Danh Mục Services
// ============================================================

export async function layDanhSachXeCached() {
  return withCache(
    CACHE_KEYS.XE,
    CACHE_TTL.XE,
    async () => {
      const { layDanhSachXe } = await import('../services/tham-so-service');
      return layDanhSachXe();
    }
  );
}

export async function layDanhSachTramTronCached() {
  return withCache(
    CACHE_KEYS.TRAM_TRON,
    CACHE_TTL.TRAM_TRON,
    async () => {
      const { layDanhSachTramTron } = await import('../services/tham-so-service');
      return layDanhSachTramTron();
    }
  );
}

export async function layDanhSachMacBeTongCached() {
  return withCache(
    CACHE_KEYS.MAC_BE_TONG,
    CACHE_TTL.MAC_BE_TONG,
    async () => {
      const { layDanhSachMacBeTong } = await import('../services/tham-so-service');
      return layDanhSachMacBeTong();
    }
  );
}

export async function layDanhSachTaiXeCached() {
  return withCache(
    CACHE_KEYS.TAI_XE,
    CACHE_TTL.TAI_XE,
    async () => {
      const { layDanhSachTaiXe } = await import('../services/tham-so-service');
      return layDanhSachTaiXe();
    }
  );
}

export async function layDanhSachKhachHangCached() {
  return withCache(
    CACHE_KEYS.KHACH_HANG,
    CACHE_TTL.KHACH_HANG,
    async () => {
      const { layDanhSachKhachHang } = await import('../services/tham-so-service');
      return layDanhSachKhachHang();
    }
  );
}

// ============================================================
// Cache Invalidation Helpers
// ============================================================

export function invalidateDanhMucCache() {
  cache.delete(CACHE_KEYS.XE);
  cache.delete(CACHE_KEYS.TRAM_TRON);
  cache.delete(CACHE_KEYS.MAC_BE_TONG);
  cache.delete(CACHE_KEYS.TAI_XE);
  cache.delete(CACHE_KEYS.KHACH_HANG);
}

export function invalidateDashboardCache() {
  cache.delete(CACHE_KEYS.DASHBOARD_STATS);
  cache.delete(CACHE_KEYS.DASHBOARD_REVENUE);
  cache.delete(CACHE_KEYS.DASHBOARD_STATUS);
  // Also delete revenue cache with date ranges
  cache.deletePattern(CACHE_KEYS.DASHBOARD_REVENUE);
}

export function invalidateAllCache() {
  cache.clear();
}
