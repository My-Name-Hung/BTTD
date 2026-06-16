import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  taoLichSanXuat,
  layLichSanXuatTheoDonHang,
  layTatCaLichSanXuat,
  layDonHangTheoXe,
  capNhatLichSanXuat,
  xoaLichSanXuatTheoDonHang,
  xoaLichSanXuat,
  xacNhanDaGiao,
} from '../services/dieu-phoi-service';
import { ghiNhatKy } from '../services/access-history-service';
import { guiThongBao } from '../services/thong-bao-service';
import { query, vnNow } from '../config/database';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const trangThai = req.query.trangThai as string | undefined;
    const { data, total } = await layTatCaLichSanXuat(page, limit, trangThai);
    res.json({
      success: true,
      message: 'Lấy danh sách lịch sản xuất thành công',
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

router.post('/', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
      return;
    }
    const lich = await taoLichSanXuat(req.body, req.user.id);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user.id, 'TAO', 'LichSanXuat', lich.id, undefined,
      JSON.stringify(req.body), ip);
    res.status(201).json({ success: true, message: 'Tạo lịch sản xuất thành công', data: lich });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

router.get('/don-hang/:idDonHang', authMiddleware, requireRole('admin', 'dieu_phoi', 'ke_toan', 'tram_tron', 'lanh_dao', 'sales', 'sale', 'tai_xe', 'ky_thuat'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const vaiTro = req.user?.vaiTro;
    const userId = req.user?.id;
    const dbModule = await import('../config/database');
    let data: any[];

    if (vaiTro === 'tai_xe' && userId) {
      // Tài xế chỉ xem lịch sản xuất thuộc xe của mình
      data = await dbModule.query<any[]>(
        `SELECT ls.*,
                nd.hoTen as tenTaiXe,
                ISNULL(tt.tenTram, N'Không xác định') as tenTram
           FROM LichSanXuat ls
           LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
           LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
           INNER JOIN Xe xe ON ls.idXe = xe.id
           WHERE ls.idDonHang = @idDonHang AND xe.idTaiKhoan = @userId
           ORDER BY ls.ngayTao ASC`,
        { idDonHang, userId }
      );
    } else {
      data = await layLichSanXuatTheoDonHang(idDonHang);
    }
    res.json({ success: true, message: 'Lấy lịch sản xuất thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

/** Lấy đơn hàng theo xe */
router.get('/theo-xe/:idXe', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idXe = parseInt(req.params.idXe, 10);
    const data = await layDonHangTheoXe(idXe);
    res.json({ success: true, message: 'Lấy đơn hàng theo xe thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy đơn hàng theo xe';
    res.status(500).json({ success: false, message });
  }
});

router.put('/:id', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lichCu = (await query<any[]>(`SELECT * FROM LichSanXuat WHERE id = @id`, { id }))[0];
    const lich = await capNhatLichSanXuat(id, req.body);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'SUA', 'LichSanXuat', id,
      JSON.stringify(lichCu),
      JSON.stringify(req.body),
      ip);
    res.json({ success: true, message: 'Cập nhật lịch sản xuất thành công', data: lich });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật lịch sản xuất';
    res.status(400).json({ success: false, message });
  }
});

router.put('/xac-nhan-giao/:idDonHang', authMiddleware, requireRole('admin', 'dieu_phoi', 'ke_toan', 'tram_tron'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const { khoiLuongThucTe } = req.body;
    const dhCu = (await query<any[]>(`SELECT * FROM DonHang WHERE id = @idDonHang`, { idDonHang }))[0];
    const dh = await xacNhanDaGiao(idDonHang, khoiLuongThucTe);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'XAC_NHAN', 'DonHang', idDonHang,
      JSON.stringify(dhCu),
      JSON.stringify({ trangThaiDon: 'da_giao', khoiLuongThucTe }),
      ip);
    res.json({ success: true, message: 'Xác nhận giao hàng thành công', data: dh });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận giao hàng';
    res.status(400).json({ success: false, message });
  }
});

/** Xóa một lịch sản xuất cụ thể theo ID */
router.delete('/:id', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query(`DELETE FROM LichSanXuat WHERE id = @id`, { id });
    res.json({ success: true, message: 'Xóa lịch sản xuất thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

/**
 * Gỡ trạm trộn khỏi lịch sản xuất - reset sạch cờ giao/SX của trạm và
 * tự động tổng hợp lại trạng thái đơn hàng cho khớp với các trạm còn lại.
 *
 * Lý do reset sạch (không chỉ set idTramTron = NULL):
 *   - Trước đây chỉ set idTramTron = NULL, giữ nguyên trangThaiGiao/trangThai
 *     → frontend vẫn coi trạm là "đang giao" / "đã giao" → đơn kẹt ở "đang giao"
 *     dù các trạm khác đã giao xong (vd: A 5m³ + B 5m³ = đủ 10m³, C bị gỡ).
 *   - Sau khi gỡ, trạm đó không còn thuộc đơn nữa, phải xóa sạch mọi dấu vết
 *     giao hàng/SX để không ảnh hưởng đến việc tổng hợp và hiển thị.
 */
router.post('/go-tram-tron/:id', authMiddleware, requireRole('admin', 'dieu_phoi', 'giam_doc_kinh_doanh'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || isNaN(id)) {
      res.status(400).json({ success: false, message: 'ID lịch sản xuất không hợp lệ' });
      return;
    }
    // Lấy thông tin lịch cũ trước khi gỡ
    const [ls] = await query<{ idDonHang: number; idTramTron: number | null; trangThaiGiao: string | null; khoiLuongDaTron: number | null; khoiLuongGiaoThucTe: number | null }>(
      `SELECT idDonHang, idTramTron, trangThaiGiao, khoiLuongDaTron, khoiLuongGiaoThucTe FROM LichSanXuat WHERE id = @id`,
      { id },
    );
    if (!ls) {
      res.status(404).json({ success: false, message: 'Không tìm thấy lịch sản xuất' });
      return;
    }

    // Lưu lại KL đã giao của trạm bị gỡ (nếu có) - dùng cho tổng hợp lại đơn
    const klGiaoCuaTramBiGo = ls.khoiLuongGiaoThucTe || 0;
    const tramBiGoDaGiao = ls.trangThaiGiao === 'da_giao';

    // Reset sạch cờ giao/SX của trạm bị gỡ
    await query(
      `UPDATE LichSanXuat SET
         idTramTron = NULL,
         trangThai = N'chua_san_xuat',
         trangThaiGiao = NULL,
         khoiLuongDaTron = NULL,
         khoiLuongGiaoThucTe = NULL,
         ngayXacNhanGiao = NULL,
         ngayCapNhat = ${vnNow()}
       WHERE id = @id`,
      { id },
    );

    // Tổng hợp lại trạng thái đơn hàng sau khi gỡ trạm
    // (logic dùng chung - copy y hệt trong tai-xe-routes và kho-routes)
    let trangThaiDonMoi: string | null = null;
    try {
      const tramStatus = await query<{ tongTram: number; tramDaGiao: number; tramDaXong: number; tongKLGiao: number; tongKLDat: number }>(
        `SELECT
            (SELECT COUNT(*) FROM LichSanXuat WHERE idDonHang = @idDonHang AND idTramTron IS NOT NULL) as tongTram,
            (SELECT COUNT(*) FROM LichSanXuat WHERE idDonHang = @idDonHang AND idTramTron IS NOT NULL AND trangThaiGiao = N'da_giao') as tramDaGiao,
            (SELECT COUNT(*) FROM LichSanXuat WHERE idDonHang = @idDonHang AND idTramTron IS NOT NULL AND trangThai = N'da_xong') as tramDaXong,
            (SELECT ISNULL(SUM(khoiLuongGiaoThucTe), 0) FROM LichSanXuat WHERE idDonHang = @idDonHang AND idTramTron IS NOT NULL AND trangThaiGiao = N'da_giao') as tongKLGiao,
            (SELECT ISNULL(khoiLuongDat, 0) FROM DonHang WHERE id = @idDonHang) as tongKLDat`,
        { idDonHang: ls.idDonHang },
      );
      const ts = tramStatus[0];
      const tongTramConLai = ts?.tongTram || 0;
      const tramDaGiao = ts?.tramDaGiao || 0;
      const tramDaXong = ts?.tramDaXong || 0;
      const tongKLGiao = ts?.tongKLGiao || 0;
      const tongKLDat = ts?.tongKLDat || 0;

      // Đếm tổng KL đã giao thực tế = các trạm còn lại + trạm vừa bị gỡ (nếu nó đã giao)
      const tongKLGiaoTinhCaTramBiGo = tongKLGiao + (tramBiGoDaGiao ? klGiaoCuaTramBiGo : 0);

      if (tongTramConLai === 0) {
        // Không còn trạm nào gắn với đơn
        if (tramBiGoDaGiao && tongKLGiaoTinhCaTramBiGo >= tongKLDat && tongKLDat > 0) {
          // Trạm bị gỡ đã giao đủ KL đơn → đơn đã giao
          trangThaiDonMoi = 'da_giao';
        } else if (tramDaXong === 0) {
          // Chưa có trạm nào SX xong → về đang sản xuất
          trangThaiDonMoi = 'dang_san_xuat';
        }
        // Ngược lại: giữ nguyên (an toàn, không ép)
      } else if (tramDaGiao >= tongTramConLai) {
        // Tất cả trạm còn lại đều đã giao
        trangThaiDonMoi = 'da_giao';
      }
      // Ngược lại: giữ nguyên trạng thái đơn (có thể là dang_giao hoặc da_giao)

      if (trangThaiDonMoi) {
        const setExtras: string[] = [`trangThaiDon = N'${trangThaiDonMoi}'`, `ngayCapNhat = ${vnNow()}`];
        if (trangThaiDonMoi === 'da_giao') {
          setExtras.push(`khoiLuongThucTe = @kl`, `ngayGiao = ${vnNow()}`);
        }
        await query(
          `UPDATE DonHang SET ${setExtras.join(', ')} WHERE id = @idDonHang`,
          {
            idDonHang: ls.idDonHang,
            kl: tongKLGiaoTinhCaTramBiGo || null,
          },
        );
        const [don] = await query<{ maDonHang: string }>(
          `SELECT maDonHang FROM DonHang WHERE id = @id`,
          { id: ls.idDonHang },
        );
        if (don) {
          guiThongBao("ORDER_STATUS_CHANGED", {
            id: ls.idDonHang,
            maDonHang: don.maDonHang,
            trangThai: trangThaiDonMoi,
            trangThaiLabel: trangThaiDonMoi === 'da_giao' ? 'Đã giao' : 'Đang sản xuất',
          });
        }
      }
    } catch (tongHopErr) {
      // Lỗi tổng hợp không chặn response - gỡ trạm vẫn thành công
      console.error('[go-tram-tron] Lỗi tổng hợp trạng thái đơn:', tongHopErr);
    }

    res.json({
      success: true,
      message: 'Đã gỡ trạm trộn khỏi lịch sản xuất và tổng hợp lại trạng thái đơn',
      data: {
        id,
        idDonHang: ls.idDonHang,
        idTramTronCu: ls.idTramTron,
        trangThaiDonMoi,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi gỡ trạm trộn khỏi lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

/** Xóa lịch sản xuất theo đơn hàng */
router.delete('/don-hang/:idDonHang', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    await xoaLichSanXuatTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Xóa lịch sản xuất thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa lịch sản xuất';
    res.status(500).json({ success: false, message });
  }
});

export default router;
