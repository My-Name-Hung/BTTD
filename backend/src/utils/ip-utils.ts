import { Request } from "express";

/**
 * Lấy địa chỉ IP thực của client từ request
 * Hỗ trợ: X-Forwarded-For, X-Real-IP, và proxy IPv6 mapped IPv4
 */
export function getClientIp(req: Request): string {
  // 1. X-Forwarded-For - danh sách IP từ các proxy trước đó
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(",")[0].trim();
  }

  // 2. X-Real-IP - IP thực (thường từ nginx)
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // 3. Fallback về req.ip (cần trust proxy được bật)
  const ip = req.ip || "";
  // Loại bỏ prefix IPv6 mapped IPv4 (::ffff:127.0.0.1 -> 127.0.0.1)
  return ip.replace(/^::ffff:/, "");
}
