import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import { getSocketIO } from '../socket';
import {
  layLichSuTruyCap,
  layChiTietSession,
  capNhatBannedIp,
  doiMatKhauUser,
  batBuocDangXuat,
  layDanhSachNguoiDungFilter,
} from '../services/access-history-service';

const router = Router();

// Danh sách user cho filter
router.get('/users', authMiddleware, requireRole('admin'), async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layDanhSachNguoiDungFilter();
    res.json({ success: true, message: 'OK', data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Lỗi' });
  }
});

// Danh sách phiên đăng nhập
router.get('/sessions', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const result = await layLichSuTruyCap(page, limit, {
      idNguoiDung: req.query.idNguoiDung ? parseInt(req.query.idNguoiDung as string, 10) : undefined,
      tuNgay: req.query.tuNgay as string | undefined,
      denNgay: req.query.denNgay as string | undefined,
    });
    res.json({
      success: true,
      message: 'OK',
      data: result.data,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Lỗi' });
  }
});

// Chi tiết phiên + logs
router.get('/sessions/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await layChiTietSession(id);
    if (!data) { res.status(404).json({ success: false, message: 'Không tìm thấy phiên' }); return; }
    res.json({ success: true, message: 'OK', data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Lỗi' });
  }
});

// Buộc đăng xuất session
router.post('/sessions/:id/logout', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    await batBuocDangXuat(id);

    // Lấy thông tin phiên để biết userId
    const detail = await layChiTietSession(id);
    if (detail?.session?.idNguoiDung) {
      const io = getSocketIO();
      if (io) {
        io.to(`user:${detail.session.idNguoiDung}`).emit('force_logout', {
          message: 'Bạn đã bị quản trị viên buộc đăng xuất.',
          sessionId: id,
        });
      }
    }

    res.json({ success: true, message: 'Đã buộc đăng xuất' });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Lỗi' });
  }
});

// Đổi mật khẩu user
router.post('/users/:id/reset-password', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { matKhauMoi } = req.body as { matKhauMoi?: string };
    if (!matKhauMoi || matKhauMoi.length < 6) {
      res.status(400).json({ success: false, message: 'Mật khẩu phải từ 6 ký tự' }); return;
    }
    const hash = await bcrypt.hash(matKhauMoi, 10);
    await doiMatKhauUser(id, hash);

    // Bắn socket để user bị đổi mật khẩu phải đăng nhập lại
    const io = getSocketIO();
    if (io) {
      io.to(`user:${id}`).emit('force_logout', {
        message: 'Mật khẩu của bạn đã được đổi. Vui lòng đăng nhập lại.',
        reason: 'password_changed',
      });
    }

    res.json({ success: true, message: 'Đã đổi mật khẩu' });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Lỗi' });
  }
});

// Cấm / bỏ cấm IP
router.post('/users/:id/banned-ip', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { bannedIp } = req.body as { bannedIp?: string | null };
    await capNhatBannedIp(id, bannedIp ?? null);
    res.json({ success: true, message: bannedIp ? 'Đã cấm IP' : 'Đã bỏ cấm IP' });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Lỗi' });
  }
});

export default router;
