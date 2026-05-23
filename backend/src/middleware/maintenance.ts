import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AuthRequest, ApiResponse } from '../models';

/**
 * Middleware kiểm tra chế độ bảo trì.
 * Tất cả role bị block NGOẠI TRỪ: admin
 * Khi bảo trì = 1, chỉ admin được phép truy cập.
 */
export async function maintenanceMiddleware(
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> {
  try {
    // Admin luôn được qua
    if (req.user?.vaiTro === 'admin') {
      next();
      return;
    }

    const configs = await query<CauHinhHeThong>(
      `SELECT * FROM CauHinhHeThong WHERE khoa = @khoa`,
      { khoa: 'CHE_DO_BAO_TRI' }
    );

    const isMaintenance = configs.length > 0 && configs[0].giaTri === '1';

    if (isMaintenance) {
      res.status(503).json({
        success: false,
        message: 'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
      });
      return;
    }

    next();
  } catch {
    // Nếu lỗi query DB, cho phép đi tiếp để không chặn toàn bộ hệ thống
    next();
  }
}

interface CauHinhHeThong {
  id: number;
  khoa: string;
  giaTri: string;
}
