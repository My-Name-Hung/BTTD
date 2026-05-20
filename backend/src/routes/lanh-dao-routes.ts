import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  layThongKeLanhDao,
  layDoanhThuLanhDao,
  layDoanhThuTheoMac,
  layDonHangTheoTrangThaiLanhDao,
  layDonHangDangXuLyLanhDao,
  layDonHangGiaoHang,
  layTatCaCongNoLanhDao,
  layDanhSachCanhBao,
  layDoanhThuTongHop,
} from '../services/lanh-dao-service';

const router = Router();

// Tất cả routes cần xác thực và role lãnh đạo hoặc admin
router.use(authMiddleware);
router.use(requireRole('lanh_dao', 'admin'));

// GET /api/lanh-dao/dashboard/tong-quan
router.get('/dashboard/tong-quan', async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layThongKeLanhDao();
    res.json({ success: true, message: 'Lấy thống kê tổng quan thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thống kê';
    res.status(500).json({ success: false, message });
  }
});

// GET /api/lanh-dao/dashboard/doanh-thu
router.get('/dashboard/doanh-thu', async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const thangBatDau = (req.query.thangBatDau as string) || '2025-01';
    const thangKetThuc = (req.query.thangKetThuc as string) || '2026-12';
    const data = await layDoanhThuLanhDao(thangBatDau, thangKetThuc);
    res.json({ success: true, message: 'Lấy doanh thu thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy doanh thu';
    res.status(500).json({ success: false, message });
  }
});

// GET /api/lanh-dao/dashboard/doanh-thu-theo-mac
router.get('/dashboard/doanh-thu-theo-mac', async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const thangBatDau = (req.query.thangBatDau as string) || '2025-01';
    const thangKetThuc = (req.query.thangKetThuc as string) || '2026-12';
    const data = await layDoanhThuTheoMac(thangBatDau, thangKetThuc);
    res.json({ success: true, message: 'Lấy doanh thu theo mác thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi';
    res.status(500).json({ success: false, message });
  }
});

// GET /api/lanh-dao/dashboard/trang-thai
router.get('/dashboard/trang-thai', async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layDonHangTheoTrangThaiLanhDao();
    res.json({ success: true, message: 'Lấy thống kê trạng thái thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy trạng thái';
    res.status(500).json({ success: false, message });
  }
});

// GET /api/lanh-dao/dashboard/tong-hop
router.get('/dashboard/tong-hop', async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layDoanhThuTongHop();
    res.json({ success: true, message: 'Lấy tổng hợp doanh thu thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi';
    res.status(500).json({ success: false, message });
  }
});

// GET /api/lanh-dao/don-hang/dang-xu-ly
router.get('/don-hang/dang-xu-ly', async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layDonHangDangXuLyLanhDao();
    res.json({ success: true, message: 'Lấy đơn đang xử lý thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy đơn hàng';
    res.status(500).json({ success: false, message });
  }
});

// GET /api/lanh-dao/giao-hang
router.get('/giao-hang', async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layDonHangGiaoHang();
    res.json({ success: true, message: 'Lấy trạng thái giao hàng thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy giao hàng';
    res.status(500).json({ success: false, message });
  }
});

// GET /api/lanh-dao/cong-no
router.get('/cong-no', async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layTatCaCongNoLanhDao();
    res.json({ success: true, message: 'Lấy công nợ thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy công nợ';
    res.status(500).json({ success: false, message });
  }
});

// GET /api/lanh-dao/canh-bao
router.get('/canh-bao', async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layDanhSachCanhBao();
    res.json({ success: true, message: 'Lấy cảnh báo thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy cảnh báo';
    res.status(500).json({ success: false, message });
  }
});

export default router;
