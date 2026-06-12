import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  taoLichSanXuat,
  layLichSanXuatTheoDonHang,
  layTatCaLichSanXuat,
  layDonHangTheoXe,
  capNhatLichSanXuat,
  xoaLichSanXuatTheoDonHang,
  xacNhanDaGiao,
} from '../services/dieu-phoi-service';
import { ghiNhatKy } from '../services/access-history-service';
import { query } from '../config/database';

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
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user.id, 'TAO', 'LichSanXuat', lich.id, undefined,
      JSON.stringify(req.body), ip);
    res.status(201).json({ success: true, message: 'Tạo lịch sản xuất thành công', data: lich });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

router.get('/don-hang/:idDonHang', authMiddleware, requireRole('admin', 'dieu_phoi', 'ke_toan', 'tram_tron', 'lanh_dao', 'sales', 'sale'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const data = await layLichSanXuatTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Lấy lịch sản xuất thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

/** Lấy đơn hàng theo xe */
router.get('/theo-xe/:idXe', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idXe = parseInt(req.params.idXe, 10);
    const data = await layDonHangTheoXe(idXe);
    res.json({ success: true, message: 'Lấy đơn hàng theo xe thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy đơn hàng theo xe';
    res.status(500).json({ success: false, message });
  }
});

router.put('/:id', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lichCu = (await query<any[]>(`SELECT * FROM LichSanXuat WHERE id = @id`, { id }))[0];
    const lich = await capNhatLichSanXuat(id, req.body);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'SUA', 'LichSanXuat', id,
      JSON.stringify(lichCu),
      JSON.stringify(req.body),
      ip);
    res.json({ success: true, message: 'Cập nhật lịch sản xuất thành công', data: lich });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật lịch sản xuất';
    res.status(400).json({ success: false, message });
  }
});

router.put('/xac-nhan-giao/:idDonHang', authMiddleware, requireRole('admin', 'dieu_phoi', 'ke_toan', 'tram_tron'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const { khoiLuongThucTe } = req.body;
    const dhCu = (await query<any[]>(`SELECT * FROM DonHang WHERE id = @idDonHang`, { idDonHang }))[0];
    const dh = await xacNhanDaGiao(idDonHang, khoiLuongThucTe);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'XAC_NHAN', 'DonHang', idDonHang,
      JSON.stringify(dhCu),
      JSON.stringify({ trangThaiDon: 'da_giao', khoiLuongThucTe }),
      ip);
    res.json({ success: true, message: 'Xác nhận giao hàng thành công', data: dh });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận giao hàng';
    res.status(400).json({ success: false, message });
  }
});

/** Xóa lịch sản xuất theo đơn hàng */
router.delete('/don-hang/:idDonHang', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    await xoaLichSanXuatTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Xóa lịch sản xuất thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

export default router;
