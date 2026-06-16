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
        ls.id, ls.idTramTron, ls.trangThai, ls.trangThaiGiao, ls.thoiGianTron, ls.thoiGianBatDauDo, ls.khoiLuongDaTron, ls.khoiLuongGiaoThucTe, ls.ngayXacNhanGiao, ls.ghiChuXe,
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
router.get('/don-hang/:id', authMiddleware, requireRole('admin', 'tram_tron', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
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
    const { khoiLuongDaTron, ngayGioDo, idXe, bienSoXe, ghiChuXe, idLichSanXuat } = req.body;

    // Kiểm tra đơn hàng tồn tại
    const donHang = await query<DonHang>(
      `SELECT * FROM DonHang WHERE id = @id`,
      { id: idDonHang }
    );

    if (donHang.length === 0) {
      res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      return;
    }

    // Cho phép xác nhận SX khi:
    // - Đơn đang "dang_san_xuat" (chưa giao), HOẶC
    // - Đơn đang "dang_giao"/"da_giao" mà có lịch trạm đang "chua_san_xuat" (sau khi trộn lại 1 trạm)
    const trangThaiHopLe = ['dang_san_xuat', 'dang_giao', 'da_giao'];
    if (!trangThaiHopLe.includes(donHang[0].trangThaiDon)) {
      res.status(400).json({ success: false, message: 'Chỉ có thể xác nhận sản xuất xong khi đơn đang sản xuất / đang giao / đã giao' });
      return;
    }

    // Xác định danh sách lịch cần cập nhật
    let lichCanCapNhatList: LichSanXuat[] = [];

    if (idLichSanXuat) {
      // Có chọn lịch cụ thể: chỉ cập nhật lịch đó
      const lich = await query<LichSanXuat>(
        `SELECT * FROM LichSanXuat WHERE id = @id AND idDonHang = @idDonHang`,
        { id: idLichSanXuat, idDonHang }
      );
      if (lich.length === 0) {
        res.status(400).json({ success: false, message: 'Không tìm thấy lịch sản xuất đã chọn' });
        return;
      }
      lichCanCapNhatList = [lich[0]];
    } else {
      // Không có idLichSanXuat: lấy theo trạm của user (tram_tron) hoặc tất cả (admin/dieu_phoi)
      const idTram = req.user?.idTramTron ?? null;
      let lichQuery = `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang`;
      let lichParams: any = { idDonHang };

      if (!['admin', 'dieu_phoi'].includes(req.user?.vaiTro || '')) {
        // tram_tron: chỉ lấy lịch của trạm mình
        lichQuery += ` AND idTramTron = @idTram`;
        lichParams.idTram = idTram;
      }

      const lichSanXuatList = await query<LichSanXuat>(lichQuery, lichParams);

      if (lichSanXuatList.length === 0) {
        res.status(403).json({ success: false, message: 'Đơn hàng này không có lịch sản xuất cho trạm của bạn' });
        return;
      }

      // Nếu đơn chỉ có 1 lịch: cập nhật lịch đó (không cần chọn)
      // Nếu nhiều lịch (admin/dieu_phoi): yêu cầu chọn lịch cụ thể
      if (lichSanXuatList.length === 1) {
        lichCanCapNhatList = lichSanXuatList;
      } else {
        res.status(400).json({
          success: false,
          message: 'Đơn hàng có nhiều trạm trộn, vui lòng chọn trạm cụ thể để xác nhận sản xuất xong',
        });
        return;
      }
    }

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

    // Validate tổng KL sau khi cộng dồn không vượt quá KL đặt của đơn
    // - Tính tổng KL đã trộn của CÁC LỊCH KHÁC (không thuộc danh sách update)
    // - Tính tổng KL cộng dồn của các lịch được update (cũ + mới)
    // - Tổng 2 phần này phải <= KL đặt
    if (khoiLuongDaTron != null && khoiLuongDaTron > 0) {
      const idLichParams: Record<string, number> = {};
      const idLichInClause = lichCanCapNhatList.length > 0
        ? lichCanCapNhatList.map((l, i) => {
            idLichParams[`idLich_${i}`] = l.id;
            return `@idLich_${i}`;
          }).join(',')
        : '0';
      const validateTong = await query<{ tongKhoiLuongCacLichKhac: number; khoiLuongDat: number }>(
        `SELECT
          (SELECT ISNULL(SUM(khoiLuongDaTron), 0) FROM LichSanXuat
            WHERE idDonHang = @idDonHang
              AND trangThai = N'da_xong'
              AND khoiLuongDaTron IS NOT NULL
              AND id NOT IN (${idLichInClause})) as tongKhoiLuongCacLichKhac,
          (SELECT ISNULL(khoiLuongDat, 0) FROM DonHang WHERE id = @idDonHang) as khoiLuongDat`,
        { idDonHang, ...idLichParams },
      );
      const tongCacLichKhac = validateTong[0]?.tongKhoiLuongCacLichKhac || 0;
      const khoiLuongDatDH = validateTong[0]?.khoiLuongDat || 0;
      const tongLichChonCu = lichCanCapNhatList.reduce(
        (sum, l: any) => sum + (l.khoiLuongDaTron || 0),
        0,
      );
      const tongSauKhiUpdate =
        tongCacLichKhac + tongLichChonCu + khoiLuongDaTron;
      const maxChoPhepLanNay =
        Math.max(0, khoiLuongDatDH - tongCacLichKhac - tongLichChonCu);
      if (khoiLuongDatDH > 0 && tongSauKhiUpdate > khoiLuongDatDH) {
        res.status(400).json({
          success: false,
          message: `Tổng khối lượng sau khi cộng dồn (${tongSauKhiUpdate} m³) vượt quá khối lượng đặt (${khoiLuongDatDH} m³). Lần trộn này chỉ được nhập tối đa ${maxChoPhepLanNay} m³.`,
        });
        return;
      }
    }

    // Cập nhật các lịch sản xuất được chọn (chỉ lịch cụ thể, không ghi đè các trạm khác)
    for (const lichCanCapNhatRaw of lichCanCapNhatList) {
      const lichCanCapNhat = lichCanCapNhatRaw as any;
      // Nếu lịch trạm đang ở trạng thái "chua_giao" (do trộn lại) → reset về NULL
      // để tài xế thấy lại đơn và bấm "Đang giao" trên TaiXeGiaoHangPage.
      // Còn lại giữ nguyên (NULL = chờ giao lần đầu).
      const resetTrangThaiGiao =
        lichCanCapNhat.trangThaiGiao === 'chua_giao'
          ? null
          : lichCanCapNhat.trangThaiGiao;
      // Cho phép cùng 1 trạm trộn nhiều lần: cộng dồn khoiLuongDaTron
      // thay vì ghi đè. VD: trạm A trộn 2m³, sau đó trộn tiếp 3m³
      // → khoiLuongDaTron = 2 + 3 = 5m³.
      // - Nếu lần đầu hoặc giá trị cũ NULL → SET bằng giá trị mới
      // - Nếu đã có giá trị → cộng dồn
      const khoiLuongDaTronCu = lichCanCapNhat.khoiLuongDaTron || 0;
      const khoiLuongDaTronMoi = (khoiLuongDaTronCu + (khoiLuongDaTron || 0));
      await query(
        `UPDATE LichSanXuat SET
          khoiLuongDaTron = @khoiLuongDaTron,
          thoiGianBatDauDo = @thoiGianBatDauDo,
          idXe = @idXe,
          bienSoXe = @bienSoXe,
          ghiChuXe = @ghiChuXe,
          idTaiXe = @idTaiXe,
          trangThai = N'da_xong',
          trangThaiGiao = @trangThaiGiao,
          ngayCapNhat = ${vnNow()}
         WHERE id = @id`,
        {
          id: lichCanCapNhat.id,
          khoiLuongDaTron: khoiLuongDaTron != null ? khoiLuongDaTronMoi : lichCanCapNhat.khoiLuongDaTron,
          thoiGianBatDauDo: ngayGioDo || null,
          idXe: idXe || null,
          bienSoXe: bienSoXe || null,
          ghiChuXe: ghiChuXe || null,
          idTaiXe: idTaiXeValue,
          trangThaiGiao: resetTrangThaiGiao,
        }
      );
    }

    // Tính tổng số khối đã trộn của TẤT CẢ các trạm cho đơn này
    const tongKhoiLuongDaTron = await query<{ tong: number }>(
      `SELECT SUM(khoiLuongDaTron) as tong FROM LichSanXuat WHERE idDonHang = @idDonHang AND trangThai = N'da_xong' AND khoiLuongDaTron IS NOT NULL`,
      { idDonHang }
    );

    const tongDaTron = tongKhoiLuongDaTron[0]?.tong || 0;
    const khoiLuongDat = donHang[0].khoiLuongDat || 0;
    const conLai = Math.max(0, khoiLuongDat - tongDaTron);

    // Xác định trạng thái mới cho đơn hàng dựa trên khối lượng
    // - Nếu tổng đã trộn >= khối lượng đặt: chuyển sang "đang giao"
    // - Nếu tổng đã trộn < khối lượng đặt: giữ nguyên "đang sản xuất" để trạm khác tiếp tục trộn
    const newTrangThai = conLai > 0 ? 'dang_san_xuat' : 'dang_giao';
    let message = conLai > 0
      ? `Đã xác nhận sản xuất xong ${khoiLuongDaTron} m³. Còn lại ${conLai} m³, đơn tiếp tục ở trạng thái đang sản xuất.`
      : 'Đã xác nhận sản xuất xong. Đơn hàng chuyển sang trạng thái đang giao.';

    // Nếu đơn đã sản xuất đủ khối lượng: tự động xóa các lịch sản xuất
    // của các trạm chưa trộn gì (khoiLuongDaTron = 0 hoặc NULL) để đơn có
    // thể chuyển sang giao hàng / nghiệm thu mà không bị kẹt bởi trạm thừa.
    let dsLichDaXoa: LichSanXuat[] = [];
    if (conLai <= 0) {
      dsLichDaXoa = await query<LichSanXuat[]>(
        `SELECT * FROM LichSanXuat
         WHERE idDonHang = @idDonHang
           AND (khoiLuongDaTron IS NULL OR khoiLuongDaTron = 0)`,
        { idDonHang },
      );
      if (dsLichDaXoa.length > 0) {
        await query(
          `DELETE FROM LichSanXuat
           WHERE idDonHang = @idDonHang
             AND (khoiLuongDaTron IS NULL OR khoiLuongDaTron = 0)`,
          { idDonHang },
        );
      }
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
      JSON.stringify({ trangThai: newTrangThai, tongDaTron }),
      ip);

    // Ghi nhật ký cho từng lịch sản xuất bị tự động xóa do đã đủ khối lượng
    if (dsLichDaXoa.length > 0) {
      for (const ls of dsLichDaXoa) {
        await ghiNhatKy(
          req.user?.id ?? 0,
          'XOA',
          'LichSanXuat',
          ls.id,
          JSON.stringify(ls),
          JSON.stringify({ lyDo: 'Đã đủ khối lượng đơn hàng - tự động xóa lịch thừa' }),
          ip,
        );
      }
      message += ` Đã tự động xóa ${dsLichDaXoa.length} lịch trạm thừa.`;
    }

    res.json({
      success: true,
      message,
      data: {
        donHang: updatedDonHang,
        tongKhoiLuongDaTron: tongDaTron,
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

    // Tính tổng khối lượng giao thực tế của các trạm đã xác nhận giao
    const tongGiaoResult = await query<{ tong: number; khoiLuongDat: number }>(
      `SELECT
        (SELECT ISNULL(SUM(khoiLuongGiaoThucTe), 0) FROM LichSanXuat
          WHERE idDonHang = @idDonHang
            AND khoiLuongGiaoThucTe IS NOT NULL
            AND (trangThaiGiao = N'da_giao' OR trangThaiGiao = N'dang_giao')) as tong,
        (SELECT khoiLuongDat FROM DonHang WHERE id = @idDonHang) as khoiLuongDat`,
      { idDonHang },
    );
    const tongDaGiao = tongGiaoResult[0]?.tong || 0;
    const khoiLuongDat = tongGiaoResult[0]?.khoiLuongDat || 0;

    // Cleanup: xóa các lịch trạm thừa có khoiLuongDaTron = 0 (chưa trộn gì).
    // Thực hiện ở đây để xử lý cả các đơn đã chuyển sang dang_giao từ trước
    // mà lịch thừa vẫn còn (do logic cleanup chưa có ở các phiên bản trước).
    let dsLichDaXoa: LichSanXuat[] = [];
    dsLichDaXoa = await query<LichSanXuat[]>(
      `SELECT * FROM LichSanXuat
       WHERE idDonHang = @idDonHang
         AND (khoiLuongDaTron IS NULL OR khoiLuongDaTron = 0)`,
      { idDonHang },
    );
    if (dsLichDaXoa.length > 0) {
      await query(
        `DELETE FROM LichSanXuat
         WHERE idDonHang = @idDonHang
           AND (khoiLuongDaTron IS NULL OR khoiLuongDaTron = 0)`,
        { idDonHang },
      );
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

    // Ghi nhật ký cho từng lịch trạm thừa bị tự động xóa
    if (dsLichDaXoa.length > 0) {
      for (const ls of dsLichDaXoa) {
        await ghiNhatKy(
          req.user?.id ?? 0,
          'XOA',
          'LichSanXuat',
          ls.id,
          JSON.stringify(ls),
          JSON.stringify({ lyDo: 'Lịch trạm thừa khoiLuongDaTron = 0 - tự động xóa khi xác nhận giao' }),
          ip,
        );
      }
    }

    let message = 'Xác nhận giao hàng thành công';
    if (dsLichDaXoa.length > 0) {
      message += ` (đã xóa ${dsLichDaXoa.length} lịch trạm thừa)`;
    }

    res.json({ success: true, message, data: updatedDonHang });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận giao hàng';
    res.status(400).json({ success: false, message });
  }
});

export default router;
