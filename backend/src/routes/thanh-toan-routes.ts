import { Router, Response } from 'express';
import { body, query as queryValidator } from 'express-validator';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApiResponse } from '../models';
import {
  taoThanhToan,
  layThanhToanTheoDonHang,
  layTatCaCongNo,
  taoCongNo,
} from '../services/thanh-toan-service';

const router = Router();

router.get(
  '/cong-no',
  authMiddleware,
  [
    queryValidator('page').optional().isInt({ min: 1 }).toInt(),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    queryValidator('trangThai').optional().trim(),
  ],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const trangThai = req.query.trangThai as string | undefined;
      const result = await layTatCaCongNo(page, limit, trangThai);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi lấy công nợ';
      res.status(500).json({ success: false, message });
    }
  }
);

router.post('/cong-no', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const { idDonHang, ngayBatDau, hanThanhToan } = req.body;
    if (!idDonHang) {
      res.status(400).json({ success: false, message: 'ID đơn hàng là bắt buộc' });
      return;
    }
    const congNo = await taoCongNo(idDonHang, ngayBatDau, hanThanhToan);
    res.status(201).json({ success: true, message: 'Tạo công nợ thành công', data: congNo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo công nợ';
    res.status(500).json({ success: false, message });
  }
});

router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'ke_toan'),
  [body('idDonHang').isInt({ min: 1 }).withMessage('ID đơn hàng không hợp lệ'), body('soTien').isFloat({ min: 0.01 }).withMessage('Số tiền phải lớn hơn 0')],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
        return;
      }
      const thanhToan = await taoThanhToan(req.body, req.user.id);
      res.status(201).json({ success: true, message: 'Ghi nhận thanh toán thành công', data: thanhToan });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi ghi nhận thanh toán';
      res.status(500).json({ success: false, message });
    }
  }
);

router.get('/don-hang/:idDonHang', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const data = await layThanhToanTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Lấy lịch sử thanh toán thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sử thanh toán';
    res.status(500).json({ success: false, message });
  }
});

export default router;
