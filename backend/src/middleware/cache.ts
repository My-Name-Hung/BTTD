/**
 * Cache Middleware for Express
 * Áp dụng caching cho các endpoint cụ thể
 */

import { Request, Response, NextFunction } from 'express';
import cache, { CACHE_KEYS, CACHE_TTL } from '../utils/cache';

// Extend Request to include cache key
declare global {
  namespace Express {
    interface Request {
      cacheKey?: string;
      cacheTTL?: number;
      skipCache?: boolean;
    }
  }
}

/**
 * Middleware để cache response cho GET requests
 */
export function cacheMiddleware(key: string, ttl: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Chỉ cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    req.cacheKey = key;
    req.cacheTTL = ttl;
    next();
  };
}

/**
 * Middleware để skip cache (ví dụ: khi có query param)
 */
export function skipCacheMiddleware(_req: Request, _res: Response, next: NextFunction) {
  _req.skipCache = true;
  next();
}

/**
 * Cache lookup và set response
 */
export function cacheResponse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip if not GET or skipCache is set
  if (req.method !== 'GET' || req.skipCache || !req.cacheKey) {
    next();
    return;
  }

  const key = req.cacheKey;
  const cached = cache.get(key);

  if (cached !== undefined) {
    // Return cached response
    res.json(cached);
    return;
  }

  // Override res.json to cache the response
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    // Only cache successful responses
    if (data.success !== false) {
      cache.set(key, data, req.cacheTTL);
    }
    return originalJson(data);
  };

  next();
}

/**
 * Helper để invalidate cache khi data thay đổi
 */
export function invalidateCache(pattern?: string): void {
  if (pattern) {
    cache.deletePattern(pattern);
  } else {
    cache.clear();
  }
}

// Pre-configured cache middlewares cho các endpoint phổ biến
export const cacheMiddlewares = {
  // Danh mục
  xe: cacheMiddleware(CACHE_KEYS.XE, CACHE_TTL.XE),
  tramTron: cacheMiddleware(CACHE_KEYS.TRAM_TRON, CACHE_TTL.TRAM_TRON),
  macBeTong: cacheMiddleware(CACHE_KEYS.MAC_BE_TONG, CACHE_TTL.MAC_BE_TONG),
  taiXe: cacheMiddleware(CACHE_KEYS.TAI_XE, CACHE_TTL.TAI_XE),
  khachHang: cacheMiddleware(CACHE_KEYS.KHACH_HANG, CACHE_TTL.KHACH_HANG),

  // Dashboard
  dashboardStats: cacheMiddleware(CACHE_KEYS.DASHBOARD_STATS, CACHE_TTL.DASHBOARD_STATS),
};

export default {
  cacheMiddleware,
  skipCacheMiddleware,
  cacheResponse,
  invalidateCache,
  cacheMiddlewares,
};
