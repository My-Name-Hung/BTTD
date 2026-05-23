import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';

const router = Router();

/** Lấy đơn hàng chờ nghiệm thu (da_giao) cho kỹ thuật */
router.get('/don-hang-cho-nghiem-thu', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
      return;
    }

    const { query } = await import('../config/database');

    const data = await query<any>(
      `SELECT dh.* FROM DonHang dh
       WHERE dh.trangThaiDon IN (N'da_giao', N'nghiem_thu')
       ORDER BY dh.ngayGiao DESC`,
      {}
    );

    res.json({ success: true, message: 'Lấy đơn chờ nghiệm thu thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy đơn chờ nghiệm thu';
    res.status(500).json({ success: false, message });
  }
});

export default router;
