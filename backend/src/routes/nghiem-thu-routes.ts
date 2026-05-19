import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  taoNghiemThu,
  layNghiemThuTheoDonHang,
  capNhatNghiemThu,
  xacNhanNghiemThu,
} from '../services/nghiem-thu-service';

const router = Router();

router.post('/', authMiddleware, requireRole('admin', 'ke_toan', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const nghiemThu = await taoNghiemThu(req.body);
    res.status(201).json({ success: true, message: 'Tạo biên bản nghiệm thu thành công', data: nghiemThu });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo biên bản nghiệm thu';
    res.status(500).json({ success: false, message });
  }
});

router.get('/don-hang/:idDonHang', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const data = await layNghiemThuTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Lấy nghiệm thu thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy nghiệm thu';
    res.status(500).json({ success: false, message });
  }
});

router.put('/:id', authMiddleware, requireRole('admin', 'ke_toan', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const nghiemThu = await capNhatNghiemThu(id, req.body);
    res.json({ success: true, message: 'Cập nhật nghiệm thu thành công', data: nghiemThu });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật nghiệm thu';
    res.status(400).json({ success: false, message });
  }
});

router.put('/xac-nhan/:idDonHang', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const dh = await xacNhanNghiemThu(idDonHang);
    res.json({ success: true, message: 'Xác nhận nghiệm thu thành công', data: dh });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận nghiệm thu';
    res.status(400).json({ success: false, message });
  }
});

export default router;
