import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import { layTrangThaiBaoTri, batBaoTri, tatBaoTri } from '../services/cau-hinh-service';
import { getSocketIO } from '../socket';

const router = Router();

// Lấy trạng thái bảo trì (public — không cần auth)
router.get('/trang-thai', async (_req, res: Response<ApiResponse>) => {
  try {
    const status = await layTrangThaiBaoTri();
    res.json({ success: true, message: 'OK', data: status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi';
    res.status(500).json({ success: false, message });
  }
});

// Bật bảo trì (chỉ admin)
router.post(
  '/bat-bao-tri',
  authMiddleware,
  requireRole('admin'),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const { noiDung, thoiGianBatDau, thoiGianKetThuc } = req.body as {
        noiDung?: string;
        thoiGianBatDau?: string | null;
        thoiGianKetThuc?: string | null;
      };

      if (!noiDung?.trim()) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung bảo trì' });
        return;
      }

      await batBaoTri({ noiDung, thoiGianBatDau, thoiGianKetThuc });

      // Gửi thông báo Socket.IO đến ke_toan và dieu_phoi
      const io = getSocketIO();
      const payload = {
        loai: 'MAINTENANCE',
        tieuDe: '🔧 Hệ thống đang bảo trì',
        noiDung: noiDung,
        thoiGianKetThuc: thoiGianKetThuc ?? null,
        ngayTao: new Date().toISOString(),
      };

      if (io) {
        io.to('role:ke_toan').emit('maintenance', payload);
        io.to('role:dieu_phoi').emit('maintenance', payload);
        io.to('role:kho').emit('maintenance', payload);
      }

      console.log('[Maintenance] Đã bật bảo trì:', noiDung);
      res.json({ success: true, message: 'Đã bật chế độ bảo trì' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi bật bảo trì';
      console.error('[Maintenance]', message);
      res.status(500).json({ success: false, message });
    }
  }
);

// Tắt bảo trì (chỉ admin)
router.post(
  '/tat-bao-tri',
  authMiddleware,
  requireRole('admin'),
  async (_req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      await tatBaoTri();

      // Gửi thông báo hệ thống đã hoạt động lại
      const io = getSocketIO();
      const payload = {
        loai: 'MAINTENANCE_END',
        tieuDe: '✅ Hệ thống đã hoạt động trở lại',
        noiDung: 'Hệ thống đã hoàn tất bảo trì và trở lại bình thường.',
        ngayTao: new Date().toISOString(),
      };

      if (io) {
        io.to('role:ke_toan').emit('maintenance_end', payload);
        io.to('role:dieu_phoi').emit('maintenance_end', payload);
        io.to('role:kho').emit('maintenance_end', payload);
      }

      console.log('[Maintenance] Đã tắt bảo trì');
      res.json({ success: true, message: 'Đã tắt chế độ bảo trì' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi tắt bảo trì';
      console.error('[Maintenance]', message);
      res.status(500).json({ success: false, message });
    }
  }
);

export default router;
