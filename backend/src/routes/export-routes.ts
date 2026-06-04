import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import * as exportService from '../services/export-service';

const router = Router();

// ==================== ĐƠN HÀNG ====================
router.get(
  '/don-hang',
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const vaiTro = req.user?.vaiTro || '';
      const userId = req.user?.id || 0;
      const trangThai = req.query.trangThai as string | undefined;
      const tuKhoa = req.query.tuKhoa as string | undefined;

      const data = await exportService.layDonHangExport(vaiTro, userId, trangThai, tuKhoa);

      res.json({
        success: true,
        message: 'Xuất đơn hàng thành công',
        data,
      });
    } catch (error) {
      console.error('Export don hang error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi xuất đơn hàng',
      });
    }
  }
);

// ==================== KHÁCH HÀNG ====================
router.get(
  '/khach-hang',
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const data = await exportService.layKhachHangExport();

      res.json({
        success: true,
        message: 'Xuất khách hàng thành công',
        data,
      });
    } catch (error) {
      console.error('Export khach hang error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi xuất khách hàng',
      });
    }
  }
);

// ==================== MÁC BÊ TÔNG ====================
router.get(
  '/mac-be-tong',
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const data = await exportService.layMacBeTongExport();

      res.json({
        success: true,
        message: 'Xuất mác bê tông thành công',
        data,
      });
    } catch (error) {
      console.error('Export mac be tong error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi xuất mác bê tông',
      });
    }
  }
);

// ==================== TRẠM TRỘN ====================
router.get(
  '/tram-tron',
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const data = await exportService.layTramTronExport();

      res.json({
        success: true,
        message: 'Xuất trạm trộn thành công',
        data,
      });
    } catch (error) {
      console.error('Export tram tron error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi xuất trạm trộn',
      });
    }
  }
);

// ==================== XE ====================
router.get(
  '/xe',
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const data = await exportService.layXeExport();

      res.json({
        success: true,
        message: 'Xuất xe thành công',
        data,
      });
    } catch (error) {
      console.error('Export xe error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi xuất xe',
      });
    }
  }
);

// ==================== NGƯỜI DÙNG ====================
router.get(
  '/nguoi-dung',
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const data = await exportService.layNguoiDungExport();

      res.json({
        success: true,
        message: 'Xuất người dùng thành công',
        data,
      });
    } catch (error) {
      console.error('Export nguoi dung error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi xuất người dùng',
      });
    }
  }
);

// ==================== LỊCH SẢN XUẤT ====================
router.get(
  '/lich-san-xuat',
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const trangThai = req.query.trangThai as string | undefined;
      const data = await exportService.layLichSanXuatExport(trangThai);

      res.json({
        success: true,
        message: 'Xuất lịch sản xuất thành công',
        data,
      });
    } catch (error) {
      console.error('Export lich san xuat error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi xuất lịch sản xuất',
      });
    }
  }
);

// ==================== THANH TOÁN ====================
router.get(
  '/thanh-toan',
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const data = await exportService.layThanhToanExport();

      res.json({
        success: true,
        message: 'Xuất thanh toán thành công',
        data,
      });
    } catch (error) {
      console.error('Export thanh toan error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi xuất thanh toán',
      });
    }
  }
);

// ==================== CÔNG NỢ ====================
router.get(
  '/cong-no',
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const data = await exportService.layCongNoExport();

      res.json({
        success: true,
        message: 'Xuất công nợ thành công',
        data,
      });
    } catch (error) {
      console.error('Export cong no error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Lỗi xuất công nợ',
      });
    }
  }
);

export default router;
