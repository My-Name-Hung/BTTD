import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload, ApiResponse } from '../models';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Verify JWT token — dùng chung cho cả REST API middleware và Socket.IO
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Không tìm thấy token xác thực',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token đã hết hạn, vui lòng đăng nhập lại',
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Token không hợp lệ hoặc đã hết hạn',
      });
    }
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response<ApiResponse>, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập',
      });
      return;
    }

    const normalize = (s: string) => s.replace(/_/g, '').toLowerCase();
    const userRole = normalize(req.user.vaiTro || '');
    const allowed = roles.map(normalize);

    // Admin có full access
    if (userRole === 'admin') {
      next();
      return;
    }

    if (!allowed.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
      return;
    }

    next();
  };
}
