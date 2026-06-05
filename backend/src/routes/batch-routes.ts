import { Router, Response } from 'express';
import { body } from 'express-validator';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApiResponse } from '../models';
import {
  layLichSanXuatBatch,
  layThanhToanBatch,
  layHoaDonBatch,
  layNghiemThuBatch,
} from '../services/batch-service';

const router = Router();

/**
 * POST /api/batch/lich-san-xuat
 * Lấy lịch sản xuất cho nhiều đơn hàng cùng lúc
 */
router.post(
  '/lich-san-xuat',
  authMiddleware,
  [body('ids').isArray({ min: 1 }).withMessage('ids phải là mảng không rỗng')],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const { ids } = req.body as { ids: number[] };
      const result = await layLichSanXuatBatch(ids);
      res.json({
        success: true,
        message: 'Lấy lịch sản xuất thành công',
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sản xuất';
      res.status(500).json({ success: false, message });
    }
  }
);

/**
 * POST /api/batch/thanh-toan
 * Lấy lịch sử thanh toán cho nhiều đơn hàng cùng lúc
 */
router.post(
  '/thanh-toan',
  authMiddleware,
  [body('ids').isArray({ min: 1 }).withMessage('ids phải là mảng không rỗng')],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const { ids } = req.body as { ids: number[] };
      const result = await layThanhToanBatch(ids);
      res.json({
        success: true,
        message: 'Lấy lịch sử thanh toán thành công',
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sử thanh toán';
      res.status(500).json({ success: false, message });
    }
  }
);

/**
 * POST /api/batch/hoa-don
 * Lấy hóa đơn cho nhiều đơn hàng cùng lúc
 */
router.post(
  '/hoa-don',
  authMiddleware,
  [body('ids').isArray({ min: 1 }).withMessage('ids phải là mảng không rỗng')],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const { ids } = req.body as { ids: number[] };
      const result = await layHoaDonBatch(ids);
      res.json({
        success: true,
        message: 'Lấy hóa đơn thành công',
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi lấy hóa đơn';
      res.status(500).json({ success: false, message });
    }
  }
);

/**
 * POST /api/batch/nghiem-thu
 * Lấy nghiệm thu cho nhiều đơn hàng cùng lúc
 */
router.post(
  '/nghiem-thu',
  authMiddleware,
  [body('ids').isArray({ min: 1 }).withMessage('ids phải là mảng không rỗng')],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const { ids } = req.body as { ids: number[] };
      const result = await layNghiemThuBatch(ids);
      res.json({
        success: true,
        message: 'Lấy nghiệm thu thành công',
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi lấy nghiệm thu';
      res.status(500).json({ success: false, message });
    }
  }
);

export default router;
