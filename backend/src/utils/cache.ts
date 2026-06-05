/**
 * Simple In-Memory Cache for Node.js
 * Dùng cho việc cache data ít thay đổi
 */

interface CacheItem<T> {
  value: T;
  timestamp: number;
  ttl: number; // milliseconds
}

export class SimpleCache {
  private cache: Map<string, CacheItem<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default
    this.startCleanup();
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value as T;
  }

  /**
   * Set cached value
   */
  set<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Delete keys matching pattern
   */
  deletePattern(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Get or fetch with cache
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Start periodic cleanup of expired items
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now - item.timestamp > item.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60 * 1000); // Cleanup every minute
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const cache = new SimpleCache(5 * 60 * 1000); // 5 minutes default TTL

// Cache keys constants
export const CACHE_KEYS = {
  // Danh mục - ít thay đổi
  XE: 'danh_muc:xe',
  TRAM_TRON: 'danh_muc:tram_tron',
  MAC_BE_TONG: 'danh_muc:mac_be_tong',
  TAI_XE: 'danh_muc:tai_xe',
  KHACH_HANG: 'danh_muc:khach_hang',

  // Dashboard stats - thay đổi thường xuyên
  DASHBOARD_STATS: 'dashboard:stats',
  DASHBOARD_REVENUE: 'dashboard:revenue',
  DASHBOARD_STATUS: 'dashboard:status',

  // Người dùng
  USER_PROFILE: (id: number) => `user:${id}`,
} as const;

// TTL constants (milliseconds)
export const CACHE_TTL = {
  XE: 60 * 60 * 1000,              // 1 giờ
  TRAM_TRON: 60 * 60 * 1000,       // 1 giờ
  MAC_BE_TONG: 24 * 60 * 60 * 1000, // 24 giờ
  TAI_XE: 60 * 60 * 1000,          // 1 giờ
  KHACH_HANG: 30 * 60 * 1000,       // 30 phút
  DASHBOARD_STATS: 5 * 60 * 1000,    // 5 phút
  DASHBOARD_REVENUE: 5 * 60 * 1000,  // 5 phút
  DASHBOARD_STATUS: 5 * 60 * 1000,   // 5 phút
  USER_PROFILE: 30 * 60 * 1000,      // 30 phút
} as const;

export default cache;
