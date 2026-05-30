import { Router, Response } from 'express';
import { body, query as queryValidator } from 'express-validator';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApiResponse } from '../models';
import {
  layTatCaDonHang,
  layDonHangTheoId,
  taoDonHang,
  suaDonHang,
  duyetDonHang,
  tuChoiDonHang,
  capNhatTrangThaiDon,
  xoaDonHang,
} from '../services/don-hang-service';
import { ghiNhatKy } from '../services/access-history-service';

const router = Router();

router.get(
  '/',
  authMiddleware,
  [
    queryValidator('page').optional().isInt({ min: 1 }).toInt(),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    queryValidator('trangThai').optional().trim(),
    queryValidator('tuKhoa').optional().trim(),
  ],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const trangThai = req.query.trangThai as string | undefined;
      const tuKhoa = req.query.tuKhoa as string | undefined;

      const result = await layTatCaDonHang(page, limit, trangThai, tuKhoa);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách đơn hàng';
      res.status(500).json({ success: false, message });
    }
  }
);

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const donHang = await layDonHangTheoId(id);
    res.json({ success: true, message: 'Lấy đơn hàng thành công', data: donHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy đơn hàng';
    res.status(404).json({ success: false, message });
  }
});

/** Lấy đơn hàng của người tạo (sale) */
router.get('/cua-toi', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
      return;
    }

    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const trangThai = req.query.trangThai as string | undefined;
    const tuKhoa = req.query.tuKhoa as string | undefined;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE dh.idNguoiTao = @idNguoiTao';
    if (trangThai) whereClause += ` AND dh.trangThaiDon = @trangThai`;
    if (tuKhoa) whereClause += ` AND (dh.maDonHang LIKE @tuKhoa OR dh.tenKhachHang LIKE @tuKhoa)`;

    const countResult = await (await import('../config/database')).query<{ total: number }>(
      `SELECT COUNT(*) as total FROM DonHang dh ${whereClause}`,
      { idNguoiTao: req.user.id, trangThai, tuKhoa: tuKhoa ? `%${tuKhoa}%` : undefined }
    );
    const total = countResult[0]?.total || 0;

    const data = await (await import('../config/database')).query<any>(
      `SELECT dh.* FROM DonHang dh ${whereClause}
       ORDER BY dh.ngayTao DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { idNguoiTao: req.user.id, trangThai, tuKhoa: tuKhoa ? `%${tuKhoa}%` : undefined, offset, limit }
    );

    res.json({
      success: true,
      message: 'Lấy đơn hàng của bạn thành công',
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy đơn hàng';
    res.status(500).json({ success: false, message });
  }
});

router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'sale'),
  [
    body('tenKhachHang').trim().notEmpty().withMessage('Tên khách hàng là bắt buộc'),
    body('diaChiNhan').trim().notEmpty().withMessage('Địa chỉ nhận là bắt buộc'),
    body('soDienThoai').trim().notEmpty().withMessage('Số điện thoại là bắt buộc'),
    body('khoiLuongDat').isFloat({ min: 0.01 }).withMessage('Khối lượng đặt phải lớn hơn 0'),
    body('donGia').isFloat({ min: 0 }).withMessage('Đơn giá không được âm'),
  ],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
        return;
      }
      const donHang = await taoDonHang(req.body, req.user.id);
      const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
      await ghiNhatKy(req.user.id, 'TAO', 'DonHang', donHang.id, undefined,
        JSON.stringify(req.body), ip);
      res.status(201).json({ success: true, message: 'Tạo đơn hàng thành công', data: donHang });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi tạo đơn hàng';
      res.status(500).json({ success: false, message });
    }
  }
);

router.put('/:id', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Chưa đăng nhập' }); return; }
    const id = parseInt(req.params.id, 10);
    const { updated: donHang, cu } = await suaDonHang(id, req.body);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user.id, 'SUA', 'DonHang', id,
      JSON.stringify(cu),
      JSON.stringify(req.body),
      ip);
    res.json({ success: true, message: 'Cập nhật đơn hàng thành công', data: donHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật đơn hàng';
    res.status(400).json({ success: false, message });
  }
});

router.put('/:id/duyet', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Chưa đăng nhập' }); return; }
    const id = parseInt(req.params.id, 10);
    const donHang = await duyetDonHang(id, req.user.id);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user.id, 'DUYET', 'DonHang', id,
      JSON.stringify({ trangThaiDon: 'cho_duyet' }),
      JSON.stringify({ trangThaiDon: 'da_duyet' }),
      ip);
    res.json({ success: true, message: 'Duyệt đơn hàng thành công', data: donHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi duyệt đơn hàng';
    res.status(400).json({ success: false, message });
  }
});

router.put('/:id/tu-choi', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Chưa đăng nhập' }); return; }
    const id = parseInt(req.params.id, 10);
    const { lyDo } = req.body;
    if (!lyDo) { res.status(400).json({ success: false, message: 'Lý do từ chối là bắt buộc' }); return; }
    const donHang = await tuChoiDonHang(id, lyDo);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user.id, 'TU_CHOI', 'DonHang', id,
      JSON.stringify({ trangThaiDon: 'cho_duyet' }),
      JSON.stringify({ trangThaiDon: 'tu_choi', lyDo }),
      ip);
    res.json({ success: true, message: 'Từ chối đơn hàng thành công', data: donHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi từ chối đơn hàng';
    res.status(400).json({ success: false, message });
  }
});

router.put('/:id/trang-thai', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Chưa đăng nhập' }); return; }
    const id = parseInt(req.params.id, 10);
    const { trangThaiDon, ghiChu } = req.body;
    if (!trangThaiDon) { res.status(400).json({ success: false, message: 'Trạng thái là bắt buộc' }); return; }
    const donHang = await capNhatTrangThaiDon(id, trangThaiDon, ghiChu);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user.id, 'SUA', 'DonHang', id,
      JSON.stringify({ trangThaiDon: donHang.trangThaiDon }),
      JSON.stringify({ trangThaiDon, ghiChu }),
      ip);
    res.json({ success: true, message: 'Cập nhật trạng thái thành công', data: donHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật trạng thái';
    res.status(400).json({ success: false, message });
  }
});

router.delete('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Chưa đăng nhập' }); return; }
    const id = parseInt(req.params.id, 10);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    const cu = await xoaDonHang(id);
    await ghiNhatKy(req.user.id, 'XOA', 'DonHang', id,
      JSON.stringify(cu), undefined, ip);
    res.json({ success: true, message: 'Xóa đơn hàng thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa đơn hàng';
    res.status(400).json({ success: false, message });
  }
});

export default router;
