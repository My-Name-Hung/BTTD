import { Response, Router } from "express";
import { query, vnNow } from "../config/database";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { LichSanXuat } from "../models";
import { ghiNhatKy } from "../services/access-history-service";
import {
  layDonHangTheoId,
  xacNhanGiaoThanhCong,
} from "../services/don-hang-service";
import { guiThongBao } from "../services/thong-bao-service";

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
  tenTaiXe?: string | null;
}

// Lấy danh sách lịch sản xuất - chỉ đơn thuộc trạm của user đăng nhập
router.get(
  "/lich-san-xuat",
  authMiddleware,
  requireRole("tram_tron", "admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(String(req.query.page || "1"), 10);
      const limit = parseInt(String(req.query.limit || "50"), 10);
      const offset = (page - 1) * limit;

      const isAdmin = req.user?.vaiTro === "admin";
      const idTram = req.user?.idTramTron ?? null;

      let whereClause = "";
      let params: Record<string, any> = { offset, limit };

      if (!isAdmin && !idTram) {
        res
          .status(403)
          .json({
            success: false,
            message: "Tài khoản chưa được gắn trạm trộn nào",
          });
        return;
      }

      if (isAdmin) {
        // Admin xem tất cả - bao gồm cả đơn đã duyệt (đã lên lịch sx) và đang sản xuất, đang giao, đã giao
        const countResult = await query<{ total: number }>(
          `SELECT COUNT(DISTINCT dh.id) as total FROM LichSanXuat ls
         INNER JOIN DonHang dh ON ls.idDonHang = dh.id
         WHERE dh.trangThaiDon IN (N'da_duyet', N'dang_san_xuat', N'dang_giao', N'da_giao')`,
          {},
        );
        const total = countResult[0]?.total || 0;

        const data = await query<any[]>(
          `SELECT 
              dh.id as idDonHang,
              dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong, dh.khoiLuongDat, dh.trangThaiDon, dh.ngayTao as ngayTaoDon, dh.ngayGiao,
              ls.id, ls.idTramTron, ls.trangThai, ls.thoiGianTron, ls.thoiGianBatDauDo, ls.khoiLuongDaTron, ls.ghiChuXe,
              ISNULL(tt.tenTram, N'Không xác định') as tenTram,
              nd.hoTen as tenTaiXe, ls.bienSoXe,
              -- Tính tổng số khối đã trộn của tất cả trạm cho đơn này
              (SELECT ISNULL(SUM(ls2.khoiLuongDaTron), 0) FROM LichSanXuat ls2 WHERE ls2.idDonHang = dh.id AND ls2.trangThai = N'da_xong') as tongKhoiLuongDaTron
         FROM LichSanXuat ls
         INNER JOIN DonHang dh ON ls.idDonHang = dh.id
         LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
         LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
         WHERE dh.trangThaiDon IN (N'da_duyet', N'dang_san_xuat', N'dang_giao', N'da_giao')
         ORDER BY ls.ngayCapNhat DESC`,
          {},
        );

        res.json({
          success: true,
          message: "Lấy danh sách lịch sản xuất thành công",
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
        return;
      }

      // tram_tron chỉ xem đơn của trạm mình - bao gồm đã duyệt (đã lên lịch sx) và đang sản xuất, đang giao, đã giao
      const countResult = await query<{ total: number }>(
        `SELECT COUNT(DISTINCT dh.id) as total FROM LichSanXuat ls
       INNER JOIN DonHang dh ON ls.idDonHang = dh.id
       WHERE dh.trangThaiDon IN (N'da_duyet', N'dang_san_xuat', N'dang_giao', N'da_giao')
         AND ls.idTramTron = @idTram`,
        { idTram },
      );
      const total = countResult[0]?.total || 0;

      const data = await query<any[]>(
        `SELECT 
            dh.id as idDonHang,
            dh.maDonHang, dh.tenKhachHang, dh.diaChiNhan, dh.tenMacBeTong, dh.khoiLuongDat, dh.trangThaiDon, dh.ngayTao as ngayTaoDon, dh.ngayGiao,
            ls.id, ls.idTramTron, ls.trangThai, ls.thoiGianTron, ls.thoiGianBatDauDo, ls.khoiLuongDaTron, ls.ghiChuXe,
            ISNULL(tt.tenTram, N'Không xác định') as tenTram,
            nd.hoTen as tenTaiXe, ls.bienSoXe,
            -- Tính tổng số khối đã trộn của tất cả trạm cho đơn này
            (SELECT ISNULL(SUM(ls2.khoiLuongDaTron), 0) FROM LichSanXuat ls2 WHERE ls2.idDonHang = dh.id AND ls2.trangThai = N'da_xong') as tongKhoiLuongDaTron
         FROM LichSanXuat ls
         INNER JOIN DonHang dh ON ls.idDonHang = dh.id
         LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
         LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
         WHERE dh.trangThaiDon IN (N'da_duyet', N'dang_san_xuat', N'dang_giao', N'da_giao')
           AND ls.idTramTron = @idTram
         ORDER BY ls.ngayCapNhat DESC`,
        { idTram },
      );

      res.json({
        success: true,
        message: "Lấy danh sách lịch sản xuất thành công",
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Lỗi lấy danh sách lịch sản xuất";
      res.status(500).json({ success: false, message });
    }
  },
);

// Lấy chi tiết đơn hàng - đơn có lịch sản xuất (tram_tron, dieu_phoi, admin)
router.get(
  "/don-hang/:id",
  authMiddleware,
  requireRole("tram_tron", "admin", "dieu_phoi"),
  async (req: AuthRequest, res: Response) => {
    try {
      const idDonHang = parseInt(req.params.id, 10);
      const isAdmin = req.user?.vaiTro?.replace(/_/g, '').toLowerCase() === 'admin';
      const isDieuPhoi = req.user?.vaiTro === 'dieu_phoi';

      // Nếu không phải admin hoặc dieu_phoi, kiểm tra quyền trạm
      if (!isAdmin && !isDieuPhoi) {
        const idTram = req.user?.idTramTron ?? null;

        if (!idTram) {
          res
            .status(403)
            .json({
              success: false,
              message: "Tài khoản chưa được gắn trạm trộn nào",
            });
          return;
        }

        // Lấy tất cả lịch sản xuất của đơn hàng thuộc trạm này
        const lichSanXuatList = await query<any[]>(
          `SELECT ls.*,
                nd.hoTen as tenTaiXe
         FROM LichSanXuat ls
         LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
         WHERE ls.idDonHang = @idDonHang AND ls.idTramTron = @idTram`,
          { idDonHang, idTram },
        );

        if (lichSanXuatList.length === 0) {
          res
            .status(403)
            .json({
              success: false,
              message: "Đơn hàng không thuộc quyền truy cập của trạm này",
            });
          return;
        }

        const donHang = await layDonHangTheoId(idDonHang);
        // Trả về tất cả lịch sản xuất của trạm này cho đơn hàng
        res.json({
          success: true,
          message: "Lấy chi tiết đơn hàng thành công",
          data: { donHang, lichSanXuat: lichSanXuatList },
        });
        return;
      }

      // Admin và dieu_phoi: xem đơn hàng bất kỳ - lấy tất cả lịch sản xuất
      const lichSanXuatList = await query<any[]>(
        `SELECT ls.*,
              nd.hoTen as tenTaiXe
       FROM LichSanXuat ls
       LEFT JOIN NguoiDung nd ON ls.idTaiXe = nd.id
       WHERE ls.idDonHang = @idDonHang`,
        { idDonHang },
      );

      if (lichSanXuatList.length === 0) {
        res.status(404).json({
          success: false,
          message: "Không tìm thấy lịch sản xuất cho đơn hàng này",
        });
        return;
      }

      const donHang = await layDonHangTheoId(idDonHang);
      res.json({
        success: true,
        message: "Lấy chi tiết đơn hàng thành công",
        data: { donHang, lichSanXuat: lichSanXuatList },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi lấy chi tiết đơn hàng";
      res.status(500).json({ success: false, message });
    }
  },
);

// Xác nhận sản xuất xong - trạm xác nhận đã sản xuất xong (dang_san_xuat -> dang_giao)
router.put(
  "/xac-nhan-bat-dau-giao/:idDonHang",
  authMiddleware,
  requireRole("tram_tron"),
  async (req: AuthRequest, res: Response) => {
    try {
      const idDonHang = parseInt(req.params.idDonHang, 10);
      const idTram = req.user?.idTramTron ?? null;

      if (!idTram) {
        res
          .status(403)
          .json({
            success: false,
            message: "Tài khoản chưa được gắn trạm trộn nào",
          });
        return;
      }

      // Kiểm tra đơn hàng có lịch sản xuất thuộc trạm này
      const donHang = await query<{ trangThaiDon: string }>(
        `SELECT dh.trangThaiDon FROM DonHang dh
       INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
       WHERE dh.id = @id AND ls.idTramTron = @idTram`,
        { id: idDonHang, idTram },
      );

      if (donHang.length === 0) {
        res
          .status(404)
          .json({
            success: false,
            message:
              "Không tìm thấy đơn hàng hoặc đơn không thuộc trạm của bạn",
          });
        return;
      }

      if (donHang[0].trangThaiDon !== "dang_san_xuat") {
        res
          .status(400)
          .json({
            success: false,
            message: "Chỉ có thể xác nhận sản xuất xong đơn hàng đang sản xuất",
          });
        return;
      }

      const lichSanXuat = await query<LichSanXuat[]>(
        `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang AND idTramTron = @idTram`,
        { idDonHang, idTram },
      );

      if (lichSanXuat.length === 0) {
        res
          .status(403)
          .json({
            success: false,
            message: "Đơn hàng này không có lịch sản xuất cho trạm của bạn",
          });
        return;
      }

      await query(
        `UPDATE DonHang SET trangThaiDon = N'dang_giao', ngayCapNhat = ${vnNow()} WHERE id = @id`,
        { id: idDonHang },
      );

      const updatedDonHang = await layDonHangTheoId(idDonHang);

      guiThongBao("ORDER_STATUS_CHANGED", {
        id: idDonHang,
        maDonHang: updatedDonHang.maDonHang,
        trangThai: "dang_giao",
        trangThaiLabel: "Đang giao",
      });

      const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "";
      await ghiNhatKy(
        req.user?.id ?? 0,
        "XAC_NHAN",
        "DonHang",
        idDonHang,
        JSON.stringify({ trangThaiDon: "dang_san_xuat" }),
        JSON.stringify({ trangThaiDon: "dang_giao" }),
        ip,
      );

      res.json({
        success: true,
        message: "Xác nhận sản xuất xong thành công",
        data: updatedDonHang,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi xác nhận sản xuất xong";
      res.status(400).json({ success: false, message });
    }
  },
);

// Xác nhận giao hàng thành công - trạm xác nhận đã giao xong (dang_giao -> da_giao)
router.put(
  "/xac-nhan-giao/:idDonHang",
  authMiddleware,
  requireRole("tram_tron"),
  async (req: AuthRequest, res: Response) => {
    try {
      const idDonHang = parseInt(req.params.idDonHang, 10);
      const { khoiLuongThucTe } = req.body;
      const idTram = req.user?.idTramTron ?? null;

      if (!idTram) {
        res
          .status(403)
          .json({
            success: false,
            message: "Tài khoản chưa được gắn trạm trộn nào",
          });
        return;
      }

      // Kiểm tra đơn hàng có lịch sản xuất thuộc trạm này
      const donHang = await query<{ trangThaiDon: string }>(
        `SELECT dh.trangThaiDon FROM DonHang dh
       INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
       WHERE dh.id = @id AND ls.idTramTron = @idTram`,
        { id: idDonHang, idTram },
      );

      if (donHang.length === 0) {
        res
          .status(404)
          .json({
            success: false,
            message:
              "Không tìm thấy đơn hàng hoặc đơn không thuộc trạm của bạn",
          });
        return;
      }

      if (donHang[0].trangThaiDon !== "dang_giao") {
        res
          .status(400)
          .json({
            success: false,
            message:
              "Chỉ có thể xác nhận giao hàng thành công đơn hàng đang giao",
          });
        return;
      }

      const lichSanXuat = await query<LichSanXuat[]>(
        `SELECT * FROM LichSanXuat WHERE idDonHang = @idDonHang AND idTramTron = @idTram`,
        { idDonHang, idTram },
      );

      if (lichSanXuat.length === 0) {
        res
          .status(403)
          .json({
            success: false,
            message: "Đơn hàng này không có lịch sản xuất cho trạm của bạn",
          });
        return;
      }

      const updatedDonHang = await xacNhanGiaoThanhCong(
        idDonHang,
        khoiLuongThucTe,
      );

      guiThongBao("DELIVERY_COMPLETED", {
        id: idDonHang,
        maDonHang: updatedDonHang.maDonHang,
        khoiLuong: khoiLuongThucTe || updatedDonHang.khoiLuongThucTe || 0,
      });

      const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "";
      await ghiNhatKy(
        req.user?.id ?? 0,
        "XAC_NHAN",
        "DonHang",
        idDonHang,
        JSON.stringify({ trangThaiDon: "dang_giao" }),
        JSON.stringify({ trangThaiDon: "da_giao", khoiLuongThucTe }),
        ip,
      );

      res.json({
        success: true,
        message: "Xác nhận giao hàng thành công",
        data: updatedDonHang,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi xác nhận giao hàng";
      res.status(400).json({ success: false, message });
    }
  },
);

export default router;
