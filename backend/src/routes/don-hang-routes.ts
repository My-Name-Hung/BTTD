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
import { query } from '../config/database';

const router = Router();

/** Lấy danh sách user (sales) cho filter người tạo - chỉ admin/ke_toan/dieu_phoi */
router.get('/nguoi-tao', authMiddleware, requireRole('admin', 'ke_toan', 'dieu_phoi', 'giam_doc_kinh_doanh'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const tuKhoa = (req.query.q as string) || '';
    let whereClause = "WHERE vaiTro IN ('sale', 'admin', 'dieu_phoi', 'ke_toan')";
    const params: Record<string, unknown> = {};
    
    if (tuKhoa) {
      whereClause += " AND (hoTen LIKE @tuKhoa OR tenDangNhap LIKE @tuKhoa)";
      params.tuKhoa = `%${tuKhoa}%`;
    }
    
    const users = await query<any[]>(
      `SELECT id, hoTen, tenDangNhap FROM NguoiDung ${whereClause} ORDER BY hoTen`,
      params
    );
    
    res.json({
      success: true,
      message: 'Lấy danh sách người tạo thành công',
      data: users,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách người tạo';
    res.status(500).json({ success: false, message });
  }
});

router.get(
  '/',
  authMiddleware,
  [
    queryValidator('page').optional().isInt({ min: 1 }).toInt(),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    queryValidator('trangThai').optional().trim(),
    queryValidator('tuKhoa').optional().trim(),
    queryValidator('nguoiTaoId').optional().isInt({ min: 1 }).toInt(),
  ],
  validate([]),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const page = (req.query.page as unknown as number) || 1;
      const limit = (req.query.limit as unknown as number) || 20;
      const trangThai = req.query.trangThai as string | undefined;
      const tuKhoa = req.query.tuKhoa as string | undefined;
      const nguoiTaoId = req.query.nguoiTaoId as number | undefined;

      const vaiTro = req.user?.vaiTro;
      const idTram = req.user?.idTramTron ?? null;

      // Phân quyền xem đơn hàng:
      // - admin, ke_toan, dieu_phoi: xem tất cả
      // - sale: chỉ xem đơn của mình (nguoiTaoId)
      // - tram_tron: chỉ xem đơn thuộc trạm của mình (idTramTron)
      // - tai_xe, ky_thuat: xem tất cả (điều phối/xem đơn)
      const isAdmin = vaiTro === 'admin';
      const isKeToan = vaiTro === 'ke_toan';
      const isDieuPhoi = vaiTro === 'dieu_phoi';
      const isSale = vaiTro === 'sale';
      const isTramTron = vaiTro === 'tram_tron';

      // Neu la sale hoac tram_tron, chuyen huong sang endpoint cua-toi hoac theo-tram
      if (isSale) {
        // Sale xem don cua minh
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE dh.nguoiTaoId = @nguoiTaoId';
        if (trangThai) whereClause += ` AND dh.trangThaiDon = @trangThai`;
        if (tuKhoa) whereClause += ` AND (dh.maDonHang LIKE @tuKhoa OR dh.tenKhachHang LIKE @tuKhoa)`;
        if (nguoiTaoId) whereClause += ` AND dh.nguoiTaoId = @nguoiTaoIdFilter`;

        const dbModule = await import('../config/database');
        const countResult = await dbModule.query<{ total: number }>(
          `SELECT COUNT(*) as total FROM DonHang dh ${whereClause}`,
          { nguoiTaoId: req.user!.id, trangThai, tuKhoa: tuKhoa ? `%${tuKhoa}%` : undefined, nguoiTaoIdFilter: nguoiTaoId }
        );
        const total = countResult[0]?.total || 0;

        const data = await dbModule.query<any>(
          `SELECT dh.*, t.tenTram as tenTramTron,
                  nd.tenDangNhap as maNguoiTao, nd.hoTen as tenNguoiTao
           FROM DonHang dh
           LEFT JOIN TramTron t ON dh.idTramTron = t.id
           LEFT JOIN NguoiDung nd ON dh.nguoiTaoId = nd.id
           ${whereClause}
           ORDER BY dh.ngayTao DESC
           OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
          { nguoiTaoId: req.user!.id, trangThai, tuKhoa: tuKhoa ? `%${tuKhoa}%` : undefined, nguoiTaoIdFilter: nguoiTaoId, offset, limit }
        );

        res.json({
          success: true,
          message: 'Lấy đơn hàng của bạn thành công',
          data,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
        return;
      }

      if (isTramTron && !idTram) {
        res.status(403).json({ success: false, message: 'Tài khoản chưa được gắn trạm trộn nào' });
        return;
      }

      if (isTramTron) {
        // Trạm trộn xem đơn thuộc trạm của mình
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE dh.idTramTron = @idTram';
        if (trangThai) whereClause += ` AND dh.trangThaiDon = @trangThai`;
        if (tuKhoa) whereClause += ` AND (dh.maDonHang LIKE @tuKhoa OR dh.tenKhachHang LIKE @tuKhoa)`;

        const dbModule = await import('../config/database');
        const countResult = await dbModule.query<{ total: number }>(
          `SELECT COUNT(*) as total FROM DonHang dh ${whereClause}`,
          { idTram, trangThai, tuKhoa: tuKhoa ? `%${tuKhoa}%` : undefined }
        );
        const total = countResult[0]?.total || 0;

        const data = await dbModule.query<any>(
          `SELECT dh.*, t.tenTram as tenTramTron,
                  nd.tenDangNhap as maNguoiTao, nd.hoTen as tenNguoiTao
           FROM DonHang dh
           LEFT JOIN TramTron t ON dh.idTramTron = t.id
           LEFT JOIN NguoiDung nd ON dh.nguoiTaoId = nd.id
           ${whereClause}
           ORDER BY dh.ngayTao DESC
           OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
          { idTram, trangThai, tuKhoa: tuKhoa ? `%${tuKhoa}%` : undefined, offset, limit }
        );

        res.json({
          success: true,
          message: 'Lấy đơn hàng theo trạm thành công',
          data,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
        return;
      }

      // admin, ke_toan, dieu_phoi: xem tất cả
      const result = await layTatCaDonHang(page, limit, trangThai, tuKhoa, nguoiTaoId);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách đơn hàng';
      res.status(500).json({ success: false, message });
    }
  }
);

/** Thống kê đơn hàng theo trạng thái */
router.get('/thong-ke', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const vaiTro = req.user?.vaiTro;
    const idTram = req.user?.idTramTron ?? null;
    const isSale = vaiTro === 'sale';
    const isTramTron = vaiTro === 'tram_tron';

    let whereClause = '';
    const params: Record<string, unknown> = {};

    if (isSale) {
      whereClause = 'WHERE dh.nguoiTaoId = @nguoiTaoId';
      params.nguoiTaoId = req.user!.id;
    } else if (isTramTron && idTram) {
      whereClause = 'WHERE dh.idTramTron = @idTram';
      params.idTram = idTram;
    }

    const dbModule = await import('../config/database');

    const statuses = ['cho_duyet', 'cho_ke_toan_duyet', 'da_duyet', 'dang_san_xuat', 'dang_giao', 'da_giao', 'nghiem_thu', 'da_thanh_toan', 'hoan_thanh', 'tu_choi'];
    const stats: Record<string, number> = {};
    for (const status of statuses) {
      const where = whereClause
        ? `${whereClause} AND dh.trangThaiDon = @trangThai`
        : 'WHERE dh.trangThaiDon = @trangThai';
      const result = await dbModule.query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM DonHang dh ${where}`,
        { ...params, trangThai: status }
      );
      stats[status] = result[0]?.cnt || 0;
    }

    const tongRes = await dbModule.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM DonHang dh ${whereClause}`,
      params
    );

    res.json({
      success: true,
      message: 'Lấy thống kê thành công',
      data: {
        tongDon: tongRes[0]?.cnt || 0,
        choDuyet: stats['cho_duyet'] || 0,
        choKeToanDuyet: stats['cho_ke_toan_duyet'] || 0,
        daDuyet: stats['da_duyet'] || 0,
        dangSanXuat: stats['dang_san_xuat'] || 0,
        dangGiao: stats['dang_giao'] || 0,
        daGiao: stats['da_giao'] || 0,
        nghiemThu: stats['nghiem_thu'] || 0,
        daThanhToan: stats['da_thanh_toan'] || 0,
        hoanThanh: stats['hoan_thanh'] || 0,
        tuChoi: stats['tu_choi'] || 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thống kê';
    res.status(500).json({ success: false, message });
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

    let whereClause = 'WHERE dh.nguoiTaoId = @nguoiTaoId';
    if (trangThai) whereClause += ` AND dh.trangThaiDon = @trangThai`;
    if (tuKhoa) whereClause += ` AND (dh.maDonHang LIKE @tuKhoa OR dh.tenKhachHang LIKE @tuKhoa)`;

    const dbModule = await import('../config/database');
    const countResult = await dbModule.query<{ total: number }>(
      `SELECT COUNT(*) as total FROM DonHang dh ${whereClause}`,
      { nguoiTaoId: req.user.id, trangThai, tuKhoa: tuKhoa ? `%${tuKhoa}%` : undefined }
    );
    const total = countResult[0]?.total || 0;

    const data = await dbModule.query<any>(
      `SELECT dh.*, t.tenTram as tenTramTron FROM DonHang dh
       LEFT JOIN TramTron t ON dh.idTramTron = t.id
       ${whereClause}
       ORDER BY dh.ngayTao DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { nguoiTaoId: req.user.id, trangThai, tuKhoa: tuKhoa ? `%${tuKhoa}%` : undefined, offset, limit }
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

/** Lấy đơn hàng theo trạm trộn (tram_tron + admin chọn trạm) */
router.get('/theo-tram', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
      return;
    }

    const isAdmin = req.user.vaiTro === 'admin';
    const idTramUser = req.user.idTramTron ?? null;

    // Admin có thể truyền idTram muốn xem qua query, không truyền → xem tất cả
    const idTramQuery = req.query.idTram ? parseInt(req.query.idTram as string, 10) : null;

    if (!isAdmin && !idTramUser) {
      res.status(403).json({ success: false, message: 'Tài khoản chưa được gắn trạm trộn nào' });
      return;
    }

    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const trangThai = req.query.trangThai as string | undefined;
    const tuKhoa = req.query.tuKhoa as string | undefined;
    const offset = (page - 1) * limit;

    // Admin xem tất cả hoặc chọn 1 trạm cụ thể; tram_tron chỉ xem trạm của mình
    const idTramToUse = isAdmin ? (idTramQuery || null) : idTramUser;

    let whereClause = '';
    const params: Record<string, unknown> = { offset, limit };

    if (idTramToUse) {
      whereClause = 'WHERE dh.idTramTron = @idTram';
      params.idTram = idTramToUse;
    }

    if (trangThai) {
      whereClause += whereClause ? ` AND dh.trangThaiDon = @trangThai` : 'WHERE dh.trangThaiDon = @trangThai';
      params.trangThai = trangThai;
    }

    if (tuKhoa) {
      whereClause += whereClause ? ` AND (dh.maDonHang LIKE @tuKhoa OR dh.tenKhachHang LIKE @tuKhoa)` : 'WHERE (dh.maDonHang LIKE @tuKhoa OR dh.tenKhachHang LIKE @tuKhoa)';
      params.tuKhoa = `%${tuKhoa}%`;
    }

    const dbModule = await import('../config/database');
    const countResult = await dbModule.query<{ total: number }>(
      `SELECT COUNT(*) as total FROM DonHang dh ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    const data = await dbModule.query<any>(
      `SELECT dh.*, t.tenTram as tenTramTron FROM DonHang dh
       LEFT JOIN TramTron t ON dh.idTramTron = t.id
       ${whereClause}
       ORDER BY dh.ngayTao DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      params
    );

    res.json({
      success: true,
      message: 'Lấy đơn hàng theo trạm thành công',
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy đơn hàng';
    res.status(500).json({ success: false, message });
  }
});

// Lấy đơn hàng giao trong ngày (dùng cho tính bù vận chuyển)
router.get('/giao-trong-ngay', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const ngayGiao = req.query.ngayGiao as string;
    if (!ngayGiao) {
      res.status(400).json({ success: false, message: 'Thiếu tham số ngayGiao' });
      return;
    }
    const dbModule = await import('../config/database');
    const data = await dbModule.query<any[]>(
      `SELECT * FROM DonHang
       WHERE CAST(ngayGiao AS DATE) = CAST(@ngayGiao AS DATE)
         AND trangThaiDon NOT IN (N'tu_choi', N'cho_duyet')
       ORDER BY ngayTao ASC`,
      { ngayGiao }
    );
    res.json({ success: true, message: 'Lấy đơn trong ngày thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy đơn trong ngày';
    res.status(500).json({ success: false, message });
  }
});

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

router.put('/:id', authMiddleware, requireRole('admin', 'dieu_phoi', 'ke_toan', 'sale'), async (req: AuthRequest, res: Response<ApiResponse>) => {
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

router.put('/:id/duyet', authMiddleware, requireRole('admin', 'giam_doc_kinh_doanh', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Chưa đăng nhập' }); return; }
    const id = parseInt(req.params.id, 10);
    const donHang = await duyetDonHang(id, req.user.id, req.user.vaiTro);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';

    let tuTrangThai: string;
    let denTrangThai: string;
    if (req.user.vaiTro === 'admin') {
      // Admin xác định bước dựa trên trạng thái hiện tại
      tuTrangThai = donHang.trangThaiDon === 'cho_duyet' ? 'cho_duyet' : 'cho_ke_toan_duyet';
      denTrangThai = donHang.trangThaiDon === 'cho_duyet' ? 'cho_ke_toan_duyet' : 'da_duyet';
    } else if (req.user.vaiTro === 'giam_doc_kinh_doanh') {
      tuTrangThai = 'cho_duyet';
      denTrangThai = 'cho_ke_toan_duyet';
    } else {
      tuTrangThai = 'cho_ke_toan_duyet';
      denTrangThai = 'da_duyet';
    }

    await ghiNhatKy(req.user.id, 'DUYET', 'DonHang', id,
      JSON.stringify({ trangThaiDon: tuTrangThai }),
      JSON.stringify({ trangThaiDon: denTrangThai }),
      ip);
    res.json({ success: true, message: 'Duyệt đơn hàng thành công', data: donHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi duyệt đơn hàng';
    res.status(400).json({ success: false, message });
  }
});

router.put('/:id/tu-choi', authMiddleware, requireRole('admin', 'giam_doc_kinh_doanh', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Chưa đăng nhập' }); return; }
    const id = parseInt(req.params.id, 10);
    const { lyDo } = req.body;
    if (!lyDo) { res.status(400).json({ success: false, message: 'Lý do từ chối là bắt buộc' }); return; }

    // Kiểm tra trạng thái phù hợp với vai trò
    const donHangHienTai = await layDonHangTheoId(id);
    if (req.user.vaiTro === 'giam_doc_kinh_doanh' && donHangHienTai.trangThaiDon !== 'cho_duyet') {
      res.status(400).json({ success: false, message: 'Bạn chỉ có thể từ chối đơn đang chờ bạn duyệt' });
      return;
    }
    if (req.user.vaiTro === 'ke_toan' && donHangHienTai.trangThaiDon !== 'cho_ke_toan_duyet') {
      res.status(400).json({ success: false, message: 'Bạn chỉ có thể từ chối đơn đang chờ kế toán duyệt' });
      return;
    }

    const donHang = await tuChoiDonHang(id, lyDo);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    const tuTrangThai = req.user.vaiTro === 'giam_doc_kinh_doanh' ? 'cho_duyet' : 'cho_ke_toan_duyet';
    await ghiNhatKy(req.user.id, 'TU_CHOI', 'DonHang', id,
      JSON.stringify({ trangThaiDon: tuTrangThai }),
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
