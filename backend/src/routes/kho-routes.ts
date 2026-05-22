import { Router, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse, ApiResponseWithPagination, LichSanXuat, DonHang } from '../models';
import { xacNhanGiaoThanhCong, layDonHangTheoId } from '../services/don-hang-service';

const router = Router();

// Lấy danh sách lịch sản xuất đã hoàn thành (trangThai='da_xong') - dành cho kho
router.get('/lich-san-xuat', authMiddleware, requireRole('kho'), async (req: AuthRequest, res: Response<ApiResponseWithPagination<LichSanXuat & {
  maDonHang: string;
  tenKhachHang: string;
  diaChiNhan: string;
  tenMacBeTong: string;
  khoiLuongDat: number;
}>>) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const offset = (page - 1) * limit;

    const countResult = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM LichSanXuat WHERE trangThai = N'da_xong'`,
      {}
    );
    const total = countResult[0]?.total || 0;

    const data = await query<(LichSanXuat & {
      maDonHang: string;
      tenKhachHang: string;
      diaChiNhan: string;
      tenMacBeTong: string;
      khoiLuongDat: number;
    })>(
      `SELECT ls.*, dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong, dh.khoiLuongDat
       FROM LichSanXuat ls
       INNER JOIN DonHang dh ON ls.idDonHang = dh.id
       WHERE ls.trangThai = N'da_xong'
       ORDER BY ls.ngayCapNhat DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { offset, limit }
    );

    res.json({
      success: true,
      message: 'Lấy danh sách lịch sản xuất thành công',
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

// Lấy chi tiết đơn hàng - chỉ đơn có LichSanXuat với trangThai='da_xong'
router.get('/don-hang/:id', authMiddleware, requireRole('kho'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.id, 10);

    // Kiểm tra đơn hàng có LichSanXuat với trangThai='da_xong' không
    const lichSanXuat = await query<LichSanXuat>(
      `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang AND trangThai = N'da_xong'`,
      { idDonHang }
    );

    if (lichSanXuat.length === 0) {
      res.status(403).json({ success: false, message: 'Đơn hàng này không có lịch sản xuất đã hoàn thành hoặc không thuộc quyền truy cập của kho' });
      return;
    }

    const donHang = await layDonHangTheoId(idDonHang);

    res.json({ success: true, message: 'Lấy chi tiết đơn hàng thành công', data: { donHang, lichSanXuat: lichSanXuat[0] } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy chi tiết đơn hàng';
    res.status(500).json({ success: false, message });
  }
});

// Xác nhận giao hàng thành công - kho xác nhận đã giao
router.put('/xac-nhan-giao/:idDonHang', authMiddleware, requireRole('kho'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const { khoiLuongThucTe } = req.body;

    // Kiểm tra đơn hàng có LichSanXuat với trangThai='da_xong' không
    const lichSanXuat = await query<LichSanXuat>(
      `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang AND trangThai = N'da_xong'`,
      { idDonHang }
    );

    if (lichSanXuat.length === 0) {
      res.status(403).json({ success: false, message: 'Đơn hàng này không có lịch sản xuất đã hoàn thành hoặc không thuộc quyền truy cập của kho' });
      return;
    }

    const donHang = await xacNhanGiaoThanhCong(idDonHang, khoiLuongThucTe);
    res.json({ success: true, message: 'Xác nhận giao hàng thành công', data: donHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận giao hàng';
    res.status(400).json({ success: false, message });
  }
});

export default router;
