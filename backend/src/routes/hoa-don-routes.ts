import { Router, Response } from 'express';
import { body } from 'express-validator';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApiResponse } from '../models';
import { taoHoaDon, layHoaDonTheoDonHang, taiHoaDonDoc, layHoaDonTheoId } from '../services/hoa-don-service';
import { ghiNhatKy } from '../services/access-history-service';

const router = Router();

// Tạo hóa đơn cho đơn hàng
router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'ke_toan'),
  [
    body('idDonHang').isInt({ min: 1 }).withMessage('ID đơn hàng không hợp lệ'),
    body('loaiThanhToan').isIn(['tra_het', 'cong_no']).withMessage('Loại thanh toán không hợp lệ'),
  ],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
        return;
      }
      const hoaDon = await taoHoaDon(req.body, req.user.id);
      const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
      await ghiNhatKy(req.user.id, 'TAO', 'HoaDon', hoaDon.id, undefined,
        JSON.stringify(req.body), ip);
      res.status(201).json({ success: true, message: 'Tạo hóa đơn thành công', data: hoaDon });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi tạo hóa đơn';
      res.status(500).json({ success: false, message });
    }
  }
);

// Lấy hóa đơn theo ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await layHoaDonTheoId(id);
    res.json({ success: true, message: 'Lấy hóa đơn thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy hóa đơn';
    res.status(500).json({ success: false, message });
  }
});

// Lấy hóa đơn theo đơn hàng
router.get('/don-hang/:idDonHang', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const data = await layHoaDonTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Lấy hóa đơn thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy hóa đơn';
    res.status(500).json({ success: false, message });
  }
});

// Tải hóa đơn dạng DOC
router.get('/tai/:id/doc', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const docContent = await taiHoaDonDoc(id);
    res.setHeader('Content-Type', 'application/vnd.ms-word');
    res.setHeader('Content-Disposition', `attachment; filename=hoa-don-${id}.doc`);
    res.send(docContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tải hóa đơn';
    res.status(500).json({ success: false, message });
  }
});

export default router;
