import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  layThongKeDashboard,
  layDoanhThuTheoThang,
  layDonHangTheoTrangThai,
} from '../services/dashboard-service';

const router = Router();

router.get('/tong-quan', authMiddleware, async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layThongKeDashboard();
    res.json({ success: true, message: 'Lấy thống kê thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thống kê';
    res.status(500).json({ success: false, message });
  }
});

router.get('/doanh-thu', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const thangBatDau = (req.query.thangBatDau as string) || '2025-01';
    const thangKetThuc = (req.query.thangKetThuc as string) || '2026-12';
    const data = await layDoanhThuTheoThang(thangBatDau, thangKetThuc);
    res.json({ success: true, message: 'Lấy doanh thu thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy doanh thu';
    res.status(500).json({ success: false, message });
  }
});

router.get('/trang-thai', authMiddleware, async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layDonHangTheoTrangThai();
    res.json({ success: true, message: 'Lấy thống kê trạng thái thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thống kê trạng thái';
    res.status(500).json({ success: false, message });
  }
});

export default router;
