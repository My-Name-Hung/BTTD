import { Router, Response } from 'express';
import { body } from 'express-validator';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import { dangNhap, layThongTinNguoiDung, doiMatKhau } from '../services/auth-service';
import { ghiDangXuat } from '../services/access-history-service';
import { getClientIp } from '../utils/ip-utils';

const router = Router();

router.post(
  '/login',
  [
    body('tenDangNhap').trim().notEmpty().withMessage('Tên đăng nhập là bắt buộc'),
    body('matKhau').notEmpty().withMessage('Mật khẩu là bắt buộc'),
  ],
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const ipAddress = getClientIp(req);
      const userAgent = req.headers['user-agent'] || '';
      const result = await dangNhap(req.body, ipAddress, userAgent);
      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi đăng nhập';
      res.status(401).json({ success: false, message });
    }
  }
);

router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (req.user?.sessionId) {
      await ghiDangXuat(req.user.sessionId);
    }
    res.json({ success: true, message: 'Đăng xuất thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Lỗi đăng xuất' });
  }
});

router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
      return;
    }
    const user = await layThongTinNguoiDung(req.user.id);
    res.json({ success: true, message: 'Lấy thông tin thành công', data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông tin';
    res.status(500).json({ success: false, message });
  }
});

router.post(
  '/change-password',
  authMiddleware,
  [
    body('matKhauCu').notEmpty().withMessage('Mật khẩu cũ là bắt buộc'),
    body('matKhauMoi')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự'),
  ],
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
        return;
      }
      const { matKhauCu, matKhauMoi } = req.body;
      await doiMatKhau(req.user.id, matKhauCu, matKhauMoi);
      res.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi đổi mật khẩu';
      res.status(400).json({ success: false, message });
    }
  }
);

export default router;
