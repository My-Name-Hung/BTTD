import { Router, Response } from 'express';
import { query, vnNow } from '../config/database';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse, ApiResponseWithPagination, LichSanXuat, DonHang } from '../models';
import { xacNhanGiaoThanhCong, layDonHangTheoId } from '../services/don-hang-service';
import { guiThongBao } from '../services/thong-bao-service';
import { ghiNhatKy } from '../services/access-history-service';

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
router.get('/lich-san-xuat', authMiddleware, requireRole('admin', 'tram_tron', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponseWithPagination<LichSanXuatWithDonHang>>) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const offset = (page - 1) * limit;

    // Lấy danh sách idDonHang có trạng thái phù hợp
    const donHangQuery = `
      SELECT DISTINCT dh.id as idDonHang
      FROM DonHang dh
      INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
      WHERE dh.trangThaiDon IN (N'dang_san_xuat', N'dang_giao', N'da_giao')
    `;
    const donHangIds = await query<{ idDonHang: number }>(donHangQuery, {});
    const total = donHangIds.length;

    // Lấy chi tiết từng dòng LichSanXuat (mỗi trạm trộn 1 dòng)
    const data = await query<any>(
      `SELECT 
        dh.id as idDonHang,
        dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong, dh.khoiLuongDat, dh.trangThaiDon, dh.ngayTao, dh.ngayGiao,
        ls.id, ls.idTramTron, ls.trangThai, ls.thoiGianTron, ls.thoiGianBatDauDo,
        ISNULL(tt.tenTram, N'Không xác định') as tenTram,
        nd.hoTen as tenTaiXe, ls.bienSoXe,
        -- Tính tổng số khối đã trộn của tất cả trạm cho đơn này
        (SELECT ISNULL(SUM(ls2.khoiLuongDaTron), 0) FROM LichSanXuat ls2 WHERE ls2.idDonHang = dh.id AND ls2.trangThai = N'da_xong') as tongKhoiLuongDaTron
       FROM LichSanXuat ls
       INNER JOIN DonHang dh ON ls.idDonHang = dh.id
       LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
       LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
       WHERE dh.trangThaiDon IN (N'dang_san_xuat', N'dang_giao', N'da_giao')
       ORDER BY dh.ngayTao DESC`,
      {}
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
router.get('/don-hang/:id', authMiddleware, requireRole('admin', 'tram_tron'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.id, 10);

    // Kiểm tra đơn hàng có LichSanXuat không (bất kỳ trạng thái nào)
    const lichSanXuatList = await query<any>(
      `SELECT ls.*,
              nd.hoTen as tenTaiXe
       FROM LichSanXuat ls
       LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
       WHERE ls.idDonHang = @idDonHang`,
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

// Xác nhận sản xuất xong - kho xác nhận đã sản xuất xong (dang_san_xuat -> dang_giao hoặc giữ nguyên nếu còn khối lại)
router.put('/xac-nhan-san-xuat-xong/:idDonHang', authMiddleware, requireRole('admin', 'tram_tron', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const { khoiLuongDaTron, ngayGioDo, idXe, bienSoXe, ghiChuXe } = req.body;

    // DEBUG
    console.log('[DEBUG] xac-nhan-san-xuat-xong:', {
      idDonHang,
      khoiLuongDaTron,
      ngayGioDo,
      idXe,
      bienSoXe
    });

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

    // Lấy idTramTron của user (nếu có)
    const idTram = req.user?.idTramTron ?? null;

    // Lấy lịch sản xuất của trạm này (hoặc tất cả nếu là admin/dieu_phoi)
    let lichQuery = `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang`;
    let lichParams: any = { idDonHang };
    
    if (!['admin', 'dieu_phoi'].includes(req.user?.vaiTro || '')) {
      lichQuery += ` AND idTramTron = @idTram`;
      lichParams.idTram = idTram;
    }

    const lichSanXuatList = await query<LichSanXuat>(lichQuery, lichParams);

    if (lichSanXuatList.length === 0) {
      res.status(403).json({ success: false, message: 'Đơn hàng này không có lịch sản xuất cho trạm của bạn' });
      return;
    }

    // Lấy lịch sản xuất đầu tiên để cập nhật
    const lichCanCapNhat = lichSanXuatList[0];

    // Cập nhật thông tin vào lịch sản xuất
    // Lấy idTaiXe từ bảng Xe (idTaiKhoan = id tài xế trong NguoiDung)
    let idTaiXeValue: number | null = null;
    if (idXe) {
      const xeInfo = await query<{ idTaiKhoan: number | null }>(
        `SELECT idTaiKhoan FROM Xe WHERE id = @idXe`,
        { idXe }
      );
      if (xeInfo.length > 0) {
        idTaiXeValue = xeInfo[0].idTaiKhoan || null;
      }
    }

    await query(
      `UPDATE LichSanXuat SET
        khoiLuongDaTron = @khoiLuongDaTron,
        thoiGianBatDauDo = @thoiGianBatDauDo,
        idXe = @idXe,
        bienSoXe = @bienSoXe,
        ghiChuXe = @ghiChuXe,
        idTaiXe = @idTaiXe,
        trangThai = N'da_xong',
        ngayCapNhat = ${vnNow()}
       WHERE id = @id`,
      {
        id: lichCanCapNhat.id,
        khoiLuongDaTron: khoiLuongDaTron != null ? khoiLuongDaTron : null,
        thoiGianBatDauDo: ngayGioDo || null,
        idXe: idXe || null,
        bienSoXe: bienSoXe || null,
        ghiChuXe: ghiChuXe || null,
        idTaiXe: idTaiXeValue,
      }
    );

    // Tính tổng số khối đã trộn của TẤT CẢ các trạm cho đơn này (bao gồm cả giá trị 0)
    // Query riêng để đảm bảo lấy đúng giá trị sau khi UPDATE
    const tongKhoiLuongDaTron = await query<{ tong: number }>(
      `SELECT SUM(khoiLuongDaTron) as tong FROM LichSanXuat WHERE idDonHang = @idDonHang AND trangThai = N'da_xong' AND khoiLuongDaTron IS NOT NULL`,
      { idDonHang }
    );

    // DEBUG
    console.log('[DEBUG] sau khi SUM:', {
      tongKhoiLuongDaTron,
      khoiLuongDat: donHang[0].khoiLuongDat
    });

    const tongDaTron = tongKhoiLuongDaTron[0]?.tong || 0;
    const khoiLuongDat = donHang[0].khoiLuongDat || 0;
    const conLai = khoiLuongDat - tongDaTron;

    // Nếu còn khối lại > 0 → giữ nguyên trạng thái dang_san_xuat (cho phép thêm trạm khác)
    // Nếu đủ khối (conLai <= 0) → chuyển sang dang_giao
    let newTrangThai = 'dang_san_xuat';
    let message = 'Đã xác nhận sản xuất xong cho trạm này. Còn ' + conLai + ' m³ chưa trộn.';

    if (conLai <= 0) {
      newTrangThai = 'dang_giao';
      message = 'Đã xác nhận sản xuất xong. Chuyển sang trạng thái đang giao.';
    }

    await query(
      `UPDATE DonHang SET trangThaiDon = @trangThai, ngayCapNhat = ${vnNow()} WHERE id = @id`,
      { id: idDonHang, trangThai: newTrangThai }
    );

    const updatedDonHang = await layDonHangTheoId(idDonHang);

    guiThongBao('ORDER_STATUS_CHANGED', {
      id: idDonHang,
      maDonHang: updatedDonHang.maDonHang,
      trangThai: newTrangThai,
      trangThaiLabel: newTrangThai === 'dang_giao' ? 'Đang giao' : 'Đang sản xuất',
    });

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'XAC_NHAN_SX_XONG', 'DonHang', idDonHang,
      JSON.stringify({ khoiLuongDaTron }),
      JSON.stringify({ trangThai: newTrangThai, conLai }),
      ip);

    res.json({ 
      success: true, 
      message, 
      data: {
        donHang: updatedDonHang,
        tongKhoiLuongDaTron: tongDaTron,
        khoiLuongConLai: Math.max(0, conLai),
        daDuKhối: conLai <= 0
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận sản xuất xong';
    res.status(400).json({ success: false, message });
  }
});

// Xác nhận giao hàng thành công - kho xác nhận đã giao xong (dang_giao -> da_giao)
router.put('/xac-nhan-giao/:idDonHang', authMiddleware, requireRole('admin', 'tram_tron'), async (req: AuthRequest, res: Response<ApiResponse>) => {
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

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'XAC_NHAN', 'DonHang', idDonHang,
      JSON.stringify({ trangThaiDon: 'dang_giao' }),
      JSON.stringify({ trangThaiDon: 'da_giao', khoiLuongThucTe }),
      ip);

    res.json({ success: true, message: 'Xác nhận giao hàng thành công', data: updatedDonHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận giao hàng';
    res.status(400).json({ success: false, message });
  }
});

export default router;
