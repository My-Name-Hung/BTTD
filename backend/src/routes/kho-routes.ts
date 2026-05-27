import { Router, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse, ApiResponseWithPagination, LichSanXuat, DonHang } from '../models';
import { xacNhanGiaoThanhCong, layDonHangTheoId } from '../services/don-hang-service';
import { guiThongBao } from '../services/thong-bao-service';

const router = Router();

interface LichSanXuatWithDonHang extends LichSanXuat {
  maDonHang: string;
  tenKhachHang: string;
  diaChiNhan: string;
  tenMacBeTong: string;
  khoiLuongDat: number;
  trangThaiDon: string;
  ngayTaoDon: Date | null;
  ngayGiao: Date | null;
}

// Lấy danh sách lịch sản xuất - tất cả đơn có lịch sản xuất (dang_san_xuat, dang_giao, da_giao)
router.get('/lich-san-xuat', authMiddleware, requireRole('kho'), async (req: AuthRequest, res: Response<ApiResponseWithPagination<LichSanXuatWithDonHang>>) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const offset = (page - 1) * limit;

    const countResult = await query<{ total: number }>(
      `SELECT COUNT(*) as total FROM LichSanXuat ls
       INNER JOIN DonHang dh ON ls.idDonHang = dh.id
       WHERE dh.trangThaiDon IN (N'dang_san_xuat', N'dang_cho_giao', N'dang_giao', N'da_giao')`,
      {}
    );
    const total = countResult[0]?.total || 0;

    const data = await query<LichSanXuatWithDonHang>(
      `SELECT ls.*, dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong, dh.khoiLuongDat, dh.trangThaiDon, dh.ngayTao as ngayTaoDon, dh.ngayGiao
       FROM LichSanXuat ls
       INNER JOIN DonHang dh ON ls.idDonHang = dh.id
       WHERE dh.trangThaiDon IN (N'dang_san_xuat', N'dang_cho_giao', N'dang_giao', N'da_giao')
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

// Lấy chi tiết đơn hàng - đơn có lịch sản xuất (bất kỳ trạng thái nào)
router.get('/don-hang/:id', authMiddleware, requireRole('kho'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.id, 10);

    // Kiểm tra đơn hàng có LichSanXuat không (bất kỳ trạng thái nào)
    const lichSanXuatList = await query<LichSanXuat>(
      `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang`,
      { idDonHang }
    );

    if (lichSanXuatList.length === 0) {
      res.status(403).json({ success: false, message: 'Đơn hàng này không có lịch sản xuất hoặc không thuộc quyền truy cập của kho' });
      return;
    }

    const donHang = await layDonHangTheoId(idDonHang);

    res.json({ success: true, message: 'Lấy chi tiết đơn hàng thành công', data: { donHang, lichSanXuat: lichSanXuatList[0] } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy chi tiết đơn hàng';
    res.status(500).json({ success: false, message });
  }
});

// Xác nhận sản xuất xong - kho xác nhận đã sản xuất xong (dang_san_xuat -> dang_cho_giao)
router.put('/xac-nhan-bat-dau-giao/:idDonHang', authMiddleware, requireRole('kho'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);

    // Kiểm tra đơn hàng tồn tại
    const donHang = await query<DonHang>(
      `SELECT * FROM DonHang WHERE id = @id`,
      { id: idDonHang }
    );

    if (donHang.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      return;
    }

    // Kiểm tra trạng thái phải là dang_san_xuat
    if (donHang[0].trangThaiDon !== 'dang_san_xuat') {
      res.status(400).json({ success: false, message: 'Chỉ có thể xác nhận sản xuất xong đơn hàng đang sản xuất' });
      return;
    }

    // Kiểm tra có lịch sản xuất không
    const lichSanXuat = await query<LichSanXuat>(
      `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang`,
      { idDonHang }
    );

    if (lichSanXuat.length === 0) {
      res.status(403).json({ success: false, message: 'Đơn hàng này không có lịch sản xuất' });
      return;
    }

    // Cập nhật trạng thái sang dang_cho_giao (đang chờ giao hàng)
    await query(
      `UPDATE DonHang SET trangThaiDon = N'dang_cho_giao', ngayCapNhat = GETDATE() WHERE id = @id`,
      { id: idDonHang }
    );

    const updatedDonHang = await layDonHangTheoId(idDonHang);

    guiThongBao('ORDER_STATUS_CHANGED', {
      id: idDonHang,
      maDonHang: updatedDonHang.maDonHang,
      trangThai: 'dang_cho_giao',
      trangThaiLabel: 'Đang chờ giao',
    });

    res.json({ success: true, message: 'Xác nhận sản xuất xong thành công', data: updatedDonHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận sản xuất xong';
    res.status(400).json({ success: false, message });
  }
});

// Xác nhận giao hàng thành công - kho xác nhận đã giao xong (dang_giao -> da_giao)
router.put('/xac-nhan-giao/:idDonHang', authMiddleware, requireRole('kho'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const { khoiLuongThucTe } = req.body;

    // Kiểm tra đơn hàng tồn tại
    const donHang = await query<DonHang>(
      `SELECT * FROM DonHang WHERE id = @id`,
      { id: idDonHang }
    );

    if (donHang.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      return;
    }

    // Kiểm tra trạng thái phải là dang_giao
    if (donHang[0].trangThaiDon !== 'dang_giao') {
      res.status(400).json({ success: false, message: 'Chỉ có thể xác nhận giao hàng thành công đơn hàng đang giao' });
      return;
    }

    // Kiểm tra có lịch sản xuất không
    const lichSanXuat = await query<LichSanXuat>(
      `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang`,
      { idDonHang }
    );

    if (lichSanXuat.length === 0) {
      res.status(403).json({ success: false, message: 'Đơn hàng này không có lịch sản xuất' });
      return;
    }

    const updatedDonHang = await xacNhanGiaoThanhCong(idDonHang, khoiLuongThucTe);

    // Thông báo cho điều phối: kho đã giao thành công
    guiThongBao('DELIVERY_COMPLETED', {
      id: idDonHang,
      maDonHang: updatedDonHang.maDonHang,
      khoiLuong: khoiLuongThucTe || updatedDonHang.khoiLuongThucTe || 0,
    });

    res.json({ success: true, message: 'Xác nhận giao hàng thành công', data: updatedDonHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận giao hàng';
    res.status(400).json({ success: false, message });
  }
});

export default router;
