import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  taoLichSanXuat,
  layLichSanXuatTheoDonHang,
  layTatCaLichSanXuat,
  capNhatLichSanXuat,
  xacNhanDaGiao,
} from '../services/dieu-phoi-service';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const trangThai = req.query.trangThai as string | undefined;
    const { data, total } = await layTatCaLichSanXuat(page, limit, trangThai);
    res.json({
      success: true,
      message: 'Lấy danh sách lịch sản xuất thành công',
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

router.post('/', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
      return;
    }
    const lich = await taoLichSanXuat(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'Tạo lịch sản xuất thành công', data: lich });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

router.get('/don-hang/:idDonHang', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const data = await layLichSanXuatTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Lấy lịch sản xuất thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

router.put('/:id', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lich = await capNhatLichSanXuat(id, req.body);
    res.json({ success: true, message: 'Cập nhật lịch sản xuất thành công', data: lich });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật lịch sản xuất';
    res.status(400).json({ success: false, message });
  }
});

router.put('/xac-nhan-giao/:idDonHang', authMiddleware, requireRole('admin', 'dieu_phoi', 'ke_toan', 'kho'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const { khoiLuongThucTe } = req.body;
    const dh = await xacNhanDaGiao(idDonHang, khoiLuongThucTe);
    res.json({ success: true, message: 'Xác nhận giao hàng thành công', data: dh });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận giao hàng';
    res.status(400).json({ success: false, message });
  }
});

export default router;
