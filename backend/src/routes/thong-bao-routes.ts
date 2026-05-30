import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  layDanhSachThongBao,
  laySoThongBaoChuaDoc,
  danhDauDaDoc,
  danhDauTatCaDaDoc,
  xoaThongBao,
  resetThongBaoQuaHan,
} from '../services/thong-bao-service';
import { ghiNhatKy } from '../services/access-history-service';
import { ApiResponse } from '../models';

const router = Router();

// Lấy danh sách thông báo
router.get('/', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const vaiTro = req.user?.vaiTro as string;
    if (!vaiTro) {
      return res.status(403).json({ success: false, message: 'Không xác định vai trò người dùng' });
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const isReadParam = req.query.isRead as string | undefined;
    const isRead = isReadParam === undefined ? undefined : isReadParam === 'true';

    const { data, total } = await layDanhSachThongBao(vaiTro, page, limit, isRead);

    res.json({
      success: true,
      message: 'Lấy danh sách thông báo thành công',
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông báo';
    console.error('[ThongBao]', message);
    res.status(500).json({ success: false, message });
  }
});

// Lấy số thông báo chưa đọc
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const vaiTro = req.user?.vaiTro as string;
    if (!vaiTro) {
      return res.status(403).json({ success: false, message: 'Không xác định vai trò' });
    }
    const count = await laySoThongBaoChuaDoc(vaiTro);
    res.json({ success: true, message: 'OK', data: { count } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi';
    res.status(500).json({ success: false, message });
  }
});

// Đánh dấu 1 thông báo đã đọc
router.patch('/:id/read', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }
    await danhDauDaDoc(id);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'DOC', 'ThongBao', id, undefined,
      `Đánh dấu đã đọc thông báo #${id}`, ip);
    res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi';
    res.status(500).json({ success: false, message });
  }
});

// Đánh dấu tất cả thông báo đã đọc
router.patch('/read-all', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const vaiTro = req.user?.vaiTro as string;
    if (!vaiTro) {
      return res.status(403).json({ success: false, message: 'Không xác định vai trò' });
    }
    await danhDauTatCaDaDoc(vaiTro);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'DOC', 'ThongBao', undefined, undefined,
      `Đánh dấu đã đọc tất cả thông báo`, ip);
    res.json({ success: true, message: 'Đã đánh dấu tất cả đã đọc' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi';
    res.status(500).json({ success: false, message });
  }
});

// Xóa thông báo
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    }
    await xoaThongBao(id);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'XOA', 'ThongBao', id, undefined,
      `Xóa thông báo #${id}`, ip);
    res.json({ success: true, message: 'Xóa thông báo thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi';
    res.status(500).json({ success: false, message });
  }
});

// Reset thông báo ngày hôm trước (auto gọi bởi cron hoặc frontend)
router.post('/reset', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const deleted = await resetThongBaoQuaHan();
    console.log(`[ThongBao] Đã reset ${deleted} thông báo ngày cũ`);
    res.json({ success: true, message: `Đã xóa ${deleted} thông báo ngày cũ`, data: { deleted } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi reset thông báo';
    console.error('[ThongBao] Reset error:', message);
    res.status(500).json({ success: false, message });
  }
});

export default router;
