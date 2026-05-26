import { Response, Router } from "express";
import { query } from "../config/database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { ApiResponse } from "../models";
import { xacNhanGiaoThanhCong } from "../services/don-hang-service";
import { guiThongBao } from "../services/thong-bao-service";

const router = Router();

/** Lấy đơn hàng của tài xế đang giao */
router.get(
  "/don-hang-cua-toi",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const idTaiXe = req.user.id;

      const data = await query<any>(
        `SELECT dh.* FROM DonHang dh
         INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
         WHERE ls.idTaiXe = @idTaiXe
           AND dh.trangThaiDon IN (N'dang_giao')
         ORDER BY dh.ngayGiao DESC`,
        { idTaiXe },
      );

      res.json({ success: true, message: "Lấy đơn giao thành công", data });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi lấy đơn giao";
      res.status(500).json({ success: false, message });
    }
  },
);

/** Tài xế thống kê đơn hàng */
router.get(
  "/thong-ke",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const idTaiXe = req.user.id;

      // Tổng số đơn đã nhận (có trong lịch sản xuất)
      const [tongRes, chuaGiaoRes, daGiaoRes] = await Promise.all([
        query<any>(
          `SELECT COUNT(*) as cnt FROM LichSanXuat WHERE idTaiXe = @idTaiXe`,
          { idTaiXe },
        ),
        query<any>(
          `SELECT COUNT(*) as cnt FROM DonHang dh
           INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
           WHERE ls.idTaiXe = @idTaiXe
             AND dh.trangThaiDon NOT IN (N'da_giao', N'hoan_thanh', N'da_thanh_toan')`,
          { idTaiXe },
        ),
        query<any>(
          `SELECT COUNT(*) as cnt FROM DonHang dh
           INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
           WHERE ls.idTaiXe = @idTaiXe
             AND dh.trangThaiDon IN (N'da_giao', N'hoan_thanh', N'da_thanh_toan', N'nghiem_thu')`,
          { idTaiXe },
        ),
      ]);

      const data = {
        tongDon: tongRes[0]?.cnt || 0,
        chuaGiao: chuaGiaoRes[0]?.cnt || 0,
        daGiao: daGiaoRes[0]?.cnt || 0,
      };

      res.json({ success: true, message: "Lấy thống kê thành công", data });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi lấy thống kê";
      res.status(500).json({ success: false, message });
    }
  },
);

/** Lịch sử giao hàng — đơn đã giao hoàn thành */
router.get(
  "/lich-su-giao",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const idTaiXe = req.user.id;

      const data = await query<any>(
        `SELECT dh.* FROM DonHang dh
         INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
         WHERE ls.idTaiXe = @idTaiXe
           AND dh.trangThaiDon IN (N'da_giao', N'hoan_thanh', N'da_thanh_toan', N'nghiem_thu')
         ORDER BY dh.ngayGiao DESC`,
        { idTaiXe },
      );

      res.json({ success: true, message: "Lấy lịch sử giao hàng thành công", data });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi lấy lịch sử giao hàng";
      res.status(500).json({ success: false, message });
    }
  },
);

/** Tài xế cập nhật trạng thái giao */
router.put(
  "/cap-nhat-giao/:idDonHang",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const idDonHang = parseInt(req.params.idDonHang, 10);
      const rawKltt = req.body.khoiLuongThucTe;
      const khoiLuongThucTe =
        rawKltt != null && rawKltt !== ""
          ? parseFloat(String(rawKltt))
          : undefined;

      const donHang = await query<any>(`SELECT * FROM DonHang WHERE id = @id`, {
        id: idDonHang,
      });

      if (donHang.length === 0) {
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy đơn hàng" });
        return;
      }

      if (req.body.trangThai === "da_giao") {
        const updated = await xacNhanGiaoThanhCong(idDonHang, khoiLuongThucTe);
        guiThongBao("DELIVERY_COMPLETED", {
          id: idDonHang,
          maDonHang: updated.maDonHang,
          khoiLuong: khoiLuongThucTe || updated.khoiLuongThucTe || 0,
        });
        res.json({
          success: true,
          message: "Xác nhận đã giao thành công",
          data: updated,
        });
      } else {
        await query(
          `UPDATE DonHang SET trangThaiDon = N'dang_giao', ngayCapNhat = GETDATE() WHERE id = @id`,
          { id: idDonHang },
        );
        const updated = (
          await query<any>(`SELECT * FROM DonHang WHERE id = @id`, {
            id: idDonHang,
          })
        )[0];
        res.json({
          success: true,
          message: "Đã cập nhật trạng thái đang giao",
          data: updated,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi cập nhật trạng thái giao";
      res.status(500).json({ success: false, message });
    }
  },
);

export default router;
