import { Router, Response } from 'express';
import { body, query as queryValidator } from 'express-validator';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApiResponse } from '../models';
import {
  taoThanhToan,
  layThanhToanTheoDonHang,
  layTatCaCongNo,
  taoCongNo,
  suaCongNo,
  xoaCongNo,
  layCongNoTheoId,
  layDanhSachNhomCongNo,
  layCongNoTheoNhom,
} from '../services/thanh-toan-service';
import { ghiNhatKy } from '../services/access-history-service';

const router = Router();

router.get(
  '/cong-no',
  authMiddleware,
  [
    queryValidator('page').optional().isInt({ min: 1 }).toInt(),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    queryValidator('trangThai').optional().trim(),
    queryValidator('nhom').optional().trim(),
    queryValidator('search').optional().trim(),
  ],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const trangThai = req.query.trangThai as string | undefined;
      const nhom = req.query.nhom as string | undefined;
      const search = req.query.search as string | undefined;
      const result = await layTatCaCongNo(page, limit, { trangThai, nhom, search });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi lấy công nợ';
      res.status(500).json({ success: false, message });
    }
  }
);

router.post('/cong-no', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const { idDonHang, ngayBatDau, hanThanhToan } = req.body;
    if (!idDonHang) {
      res.status(400).json({ success: false, message: 'ID đơn hàng là bắt buộc' });
      return;
    }
    const congNo = await taoCongNo(idDonHang, ngayBatDau, hanThanhToan);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'TAO', 'CongNo', congNo.id, undefined,
      JSON.stringify(req.body), ip);
    res.status(201).json({ success: true, message: 'Tạo công nợ thành công', data: congNo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo công nợ';
    res.status(500).json({ success: false, message });
  }
});

router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'ke_toan'),
  [body('idDonHang').isInt({ min: 1 }).withMessage('ID đơn hàng không hợp lệ'), body('soTien').isFloat({ min: 0.01 }).withMessage('Số tiền phải lớn hơn 0')],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
        return;
      }
      const thanhToan = await taoThanhToan(req.body, req.user.id);
      const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
      await ghiNhatKy(req.user.id, 'THANH_TOAN', 'ThanhToan', req.body.idDonHang,
      JSON.stringify({ soTien: 0 }),
      JSON.stringify(req.body),
      ip);
      res.status(201).json({ success: true, message: 'Ghi nhận thanh toán thành công', data: thanhToan });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi ghi nhận thanh toán';
      res.status(500).json({ success: false, message });
    }
  }
);

router.get('/don-hang/:idDonHang', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const data = await layThanhToanTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Lấy lịch sử thanh toán thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sử thanh toán';
    res.status(500).json({ success: false, message });
  }
});

/** Lấy công nợ theo nhóm + subtotal */
router.get('/cong-no/grouped', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const search = req.query.search as string | undefined;
    const nhom = req.query.nhom as string | undefined;
    const groups = await layCongNoTheoNhom(search, nhom);
    res.json({ success: true, message: 'Lấy công nợ theo nhóm thành công', data: groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy công nợ';
    res.status(500).json({ success: false, message });
  }
});

/** Lấy danh sách nhóm công nợ */
router.get('/cong-no/nhom/list', authMiddleware, async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const groups = await layDanhSachNhomCongNo();
    res.json({ success: true, message: 'Lấy danh sách nhóm thành công', data: groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách nhóm';
    res.status(500).json({ success: false, message });
  }
});

/** Lấy chi tiết công nợ theo ID */
router.get('/cong-no/:id', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'ID không hợp lệ' }); return; }
    const congNo = await layCongNoTheoId(id);
    if (!congNo) { res.status(404).json({ success: false, message: 'Không tìm thấy công nợ' }); return; }
    res.json({ success: true, message: 'Lấy công nợ thành công', data: congNo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy công nợ';
    res.status(500).json({ success: false, message });
  }
});

/** Sửa công nợ */
router.put('/cong-no/:id', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'ID không hợp lệ' }); return; }
    const { tongTien, daThanhToan, conLai, ngayBatDau, hanThanhToan, trangThai, ghiChu, nhom } = req.body;
    const cu = (await query<any[]>(`SELECT * FROM CongNo WHERE id = @id`, { id }))[0];
    const congNo = await suaCongNo(id, { tongTien, daThanhToan, conLai, ngayBatDau, hanThanhToan, trangThai, ghiChu, nhom });
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'SUA', 'CongNo', id,
      JSON.stringify(cu),
      JSON.stringify(req.body),
      ip);
    res.json({ success: true, message: 'Cập nhật công nợ thành công', data: congNo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật công nợ';
    res.status(500).json({ success: false, message });
  }
});

/** Xóa công nợ */
router.delete('/cong-no/:id', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'ID không hợp lệ' }); return; }
    const cu = (await query<any[]>(`SELECT * FROM CongNo WHERE id = @id`, { id }))[0];
    await xoaCongNo(id);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'XOA', 'CongNo', id,
      JSON.stringify(cu), undefined, ip);
    res.json({ success: true, message: 'Xóa công nợ thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa công nợ';
    res.status(500).json({ success: false, message });
  }
});

export default router;
