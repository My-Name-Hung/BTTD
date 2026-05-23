import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';

const router = Router();

/** Lấy đơn hàng của tài xế đang giao */
router.get('/don-hang-cua-toi', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
      return;
    }

    const { query } = await import('../config/database');
    const { idNguoiDung } = req.query;

    const data = await query<any>(
      `SELECT dh.* FROM DonHang dh
       INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
       WHERE ls.idTaiXe = @idTaiXe
         AND dh.trangThaiDon IN (N'dang_giao')
       ORDER BY dh.ngayGiao DESC`,
      { idTaiXe: idNguoiDung || req.user.id }
    );

    res.json({ success: true, message: 'Lấy đơn giao thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy đơn giao';
    res.status(500).json({ success: false, message });
  }
});

/** Tài xế cập nhật trạng thái giao */
router.put('/cap-nhat-giao/:idDonHang', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
      return;
    }

    const idDonHang = parseInt(req.params.idDonHang, 10);
    const { trangThai, khoiLuongThucTe } = req.body;
    const { query, xacNhanGiaoThanhCong } = await import('../services/don-hang-service');
    const { guiThongBao } = await import('../services/thong-bao-service');

    const donHang = await query<any>(
      `SELECT * FROM DonHang WHERE id = @id`,
      { id: idDonHang }
    );

    if (donHang.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      return;
    }

    if (trangThai === 'da_giao') {
      const updated = await xacNhanGiaoThanhCong(idDonHang, khoiLuongThucTe);
      guiThongBao('DELIVERY_COMPLETED', {
        id: idDonHang,
        maDonHang: updated.maDonHang,
        khoiLuong: khoiLuongThucTe || updated.khoiLuongThucTe || 0,
      });
      res.json({ success: true, message: 'Xác nhận đã giao thành công', data: updated });
    } else {
      await query(
        `UPDATE DonHang SET trangThaiDon = N'dang_giao', ngayCapNhat = GETDATE() WHERE id = @id`,
        { id: idDonHang }
      );
      const updated = (await query<any>(`SELECT * FROM DonHang WHERE id = @id`, { id: idDonHang }))[0];
      res.json({ success: true, message: 'Đã cập nhật trạng thái đang giao', data: updated });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật trạng thái giao';
    res.status(500).json({ success: false, message });
  }
});

export default router;
