import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import { layDashboardSummary } from '../services/dashboard-summary-service';

const router = Router();

/**
 * GET /api/dashboard/tong-hop
 * Lấy tất cả dữ liệu dashboard trong 1 request
 * Thay thế 11 API calls riêng biệt
 */
router.get('/tong-hop', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const summary = await layDashboardSummary();
    res.json({
      success: true,
      message: 'Lấy dữ liệu dashboard thành công',
      data: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy dữ liệu dashboard';
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message });
  }
});

export default router;
