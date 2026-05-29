import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  layCongNoKhachHangGrouped,
  layDanhSachNhomCongNoKhachHang,
  suaCongNoKhachHang,
  xoaCongNoKhachHang,
} from '../services/cong-no-khach-hang-service';

const router = Router();

/** Lấy công nợ theo nhóm (Bravo) */
router.get('/cong-no-khach-hang/grouped', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const search = req.query.search as string | undefined;
    const nhom = req.query.nhom as string | undefined;
    const data = await layCongNoKhachHangGrouped({ nhom, search });
    res.json({ success: true, message: 'Lấy công nợ thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy công nợ';
    res.status(500).json({ success: false, message });
  }
});

/** Lấy danh sách nhóm */
router.get('/cong-no-khach-hang/nhom/list', authMiddleware, async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layDanhSachNhomCongNoKhachHang();
    res.json({ success: true, message: 'Lấy danh sách nhóm thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách nhóm';
    res.status(500).json({ success: false, message });
  }
});

/** Sửa công nợ khách hàng */
router.put('/cong-no-khach-hang/:id', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'ID không hợp lệ' }); return; }
    const data = await suaCongNoKhachHang(id, req.body);
    res.json({ success: true, message: 'Cập nhật thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật';
    res.status(500).json({ success: false, message });
  }
});

/** Xóa công nợ khách hàng */
router.delete('/cong-no-khach-hang/:id', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'ID không hợp lệ' }); return; }
    await xoaCongNoKhachHang(id);
    res.json({ success: true, message: 'Xóa thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa';
    res.status(500).json({ success: false, message });
  }
});

export default router;
