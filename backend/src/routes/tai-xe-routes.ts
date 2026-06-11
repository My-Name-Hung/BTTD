import { Response, Router } from "express";
import { query, vnNow } from "../config/database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { ApiResponse } from "../models";
import { xacNhanGiaoThanhCong } from "../services/don-hang-service";
import { guiThongBao } from "../services/thong-bao-service";
import { ghiNhatKy } from "../services/access-history-service";

const router = Router();

/** Lấy đơn hàng của tài xế đang giao (admin xem tất cả) - chỉ trạng thái DANG_GIAO */
router.get(
  "/don-hang-cua-toi",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const isAdmin = req.user.vaiTro === 'admin';
      const isKyThuat = req.user.vaiTro === 'ky_thuat';
      let data;

      if (isAdmin || isKyThuat) {
        // Admin và Kỹ thuật xem tất cả đơn đang giao
        data = await query<any>(
          `SELECT dh.* FROM DonHang dh
           WHERE dh.trangThaiDon = N'dang_giao'
           ORDER BY dh.ngayGiao DESC`,
          {}
        );
      } else {
        // Tài xế chỉ xem đơn của mình
        const idTaiXe = req.user.id;
        data = await query<any>(
          `SELECT dh.* FROM DonHang dh
           INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
           INNER JOIN Xe xe ON ls.idXe = xe.id
           WHERE xe.idTaiKhoan = @idTaiXe
             AND dh.trangThaiDon = N'dang_giao'
           ORDER BY dh.ngayGiao DESC`,
          { idTaiXe },
        );
      }

      res.json({ success: true, message: "Lấy đơn giao thành công", data });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi lấy đơn giao";
      res.status(500).json({ success: false, message });
    }
  },
);

/** Tài xế thống kê đơn hàng (admin xem tất cả) */
router.get(
  "/thong-ke",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const isAdmin = req.user.vaiTro === 'admin';
      const isKyThuat = req.user.vaiTro === 'ky_thuat';

      if (isAdmin || isKyThuat) {
        // Admin và Kỹ thuật xem tất cả thống kê
        const [tongRes, chuaGiaoRes, daGiaoRes] = await Promise.all([
          query<any>(`SELECT COUNT(*) as cnt FROM DonHang dh`, {}),
          query<any>(
            `SELECT COUNT(*) as cnt FROM DonHang dh
             WHERE dh.trangThaiDon IN (N'dang_san_xuat')`,
            {}
          ),
          query<any>(
            `SELECT COUNT(*) as cnt FROM DonHang dh
             WHERE dh.trangThaiDon = N'da_giao'`,
            {}
          ),
        ]);

        const data = {
          tongDon: tongRes[0]?.cnt || 0,
          chuaGiao: chuaGiaoRes[0]?.cnt || 0,
          daGiao: daGiaoRes[0]?.cnt || 0,
        };
        res.json({ success: true, message: "Lấy thống kê thành công", data });
      } else {
        // Tài xế chỉ xem thống kê của mình
        const idTaiXe = req.user.id;
        const [tongRes, chuaGiaoRes, daGiaoRes] = await Promise.all([
          query<any>(
            `SELECT COUNT(*) as cnt FROM LichSanXuat ls
             INNER JOIN Xe xe ON ls.idXe = xe.id
             WHERE xe.idTaiKhoan = @idTaiXe`,
            { idTaiXe },
          ),
          query<any>(
            `SELECT COUNT(*) as cnt FROM DonHang dh
             INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
             INNER JOIN Xe xe ON ls.idXe = xe.id
             WHERE xe.idTaiKhoan = @idTaiXe
               AND dh.trangThaiDon = N'dang_giao'`,
            { idTaiXe },
          ),
          query<any>(
            `SELECT COUNT(*) as cnt FROM DonHang dh
             INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
             INNER JOIN Xe xe ON ls.idXe = xe.id
             WHERE xe.idTaiKhoan = @idTaiXe
               AND dh.trangThaiDon = N'da_giao'`,
            { idTaiXe },
          ),
        ]);

        const data = {
          tongDon: tongRes[0]?.cnt || 0,
          chuaGiao: chuaGiaoRes[0]?.cnt || 0,
          daGiao: daGiaoRes[0]?.cnt || 0,
        };
        res.json({ success: true, message: "Lấy thống kê thành công", data });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi lấy thống kê";
      res.status(500).json({ success: false, message });
    }
  },
);

/** Lấy đơn đã giao (tab "Đã giao" trong trang giao hàng) */
router.get(
  "/don-hang-da-giao",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const isAdmin = req.user.vaiTro === 'admin';
      const isKyThuat = req.user.vaiTro === 'ky_thuat';
      let data;

      if (isAdmin || isKyThuat) {
        // Admin và Kỹ thuật xem tất cả đơn đã giao
        data = await query<any>(
          `SELECT dh.* FROM DonHang dh
           WHERE dh.trangThaiDon = N'da_giao'
           ORDER BY dh.ngayGiao DESC`,
          {}
        );
      } else {
        // Tài xế chỉ xem đơn của mình
        const idTaiXe = req.user.id;
        data = await query<any>(
          `SELECT dh.* FROM DonHang dh
           INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
           INNER JOIN Xe xe ON ls.idXe = xe.id
           WHERE xe.idTaiKhoan = @idTaiXe
             AND dh.trangThaiDon = N'da_giao'
           ORDER BY dh.ngayGiao DESC`,
          { idTaiXe },
        );
      }

      res.json({ success: true, message: "Lấy đơn đã giao thành công", data });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi lấy đơn đã giao";
      res.status(500).json({ success: false, message });
    }
  },
);

/** Lịch sử giao hàng — chỉ trạng thái ĐÃ GIAO */
router.get(
  "/lich-su-giao",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const isAdmin = req.user.vaiTro === 'admin';
      let data;

      if (isAdmin) {
        // Admin xem tất cả lịch sử giao hàng - chỉ ĐÃ GIAO
        data = await query<any>(
          `SELECT dh.* FROM DonHang dh
           WHERE dh.trangThaiDon = N'da_giao'
           ORDER BY dh.ngayGiao DESC`,
          {}
        );
      } else {
        // Tài xế chỉ xem đơn của mình - chỉ ĐÃ GIAO
        const idTaiXe = req.user.id;
        data = await query<any>(
          `SELECT dh.* FROM DonHang dh
           INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
           INNER JOIN Xe xe ON ls.idXe = xe.id
           WHERE xe.idTaiKhoan = @idTaiXe
             AND dh.trangThaiDon = N'da_giao'
           ORDER BY dh.ngayGiao DESC`,
          { idTaiXe },
        );
      }

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

      // Kiểm tra tài xế có phải người được giao đơn này không (admin và kỹ thuật được phép tất cả)
      const isAdmin = req.user.vaiTro === 'admin';
      const isKyThuat = req.user.vaiTro === 'ky_thuat';
      if (!isAdmin && !isKyThuat) {
        const ls = await query<any>(
          `SELECT ls.*, xe.idTaiKhoan FROM LichSanXuat ls
           INNER JOIN Xe xe ON ls.idXe = xe.id
           WHERE ls.idDonHang = @idDonHang`,
          { idDonHang }
        );
        if (ls.length === 0 || ls[0].idTaiKhoan !== req.user.id) {
          res.status(403).json({ success: false, message: "Bạn không có quyền cập nhật đơn hàng này" });
          return;
        }
      }

      // Tài xế xác nhận đang giao: dang_san_xuat -> dang_giao
      if (req.body.trangThai === "dang_giao") {
        if (donHang[0].trangThaiDon !== "dang_san_xuat") {
          res.status(400).json({ success: false, message: "Đơn hàng không ở trạng thái chờ giao" });
          return;
        }
        await query(
          `UPDATE DonHang SET trangThaiDon = N'dang_giao', ngayCapNhat = ${vnNow()} WHERE id = @id`,
          { id: idDonHang },
        );
        const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
        await ghiNhatKy(req.user.id, 'XAC_NHAN', 'DonHang', idDonHang,
          JSON.stringify({ trangThaiDon: 'dang_san_xuat' }),
          JSON.stringify({ trangThaiDon: 'dang_giao' }),
          ip);
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
      } else if (req.body.trangThai === "da_giao") {
        // Tài xế xác nhận đã giao: dang_giao -> da_giao
        if (donHang[0].trangThaiDon !== "dang_giao") {
          res.status(400).json({ success: false, message: "Đơn hàng không ở trạng thái đang giao" });
          return;
        }
        const updated = await xacNhanGiaoThanhCong(idDonHang, khoiLuongThucTe);
        const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
        await ghiNhatKy(req.user.id, 'XAC_NHAN', 'DonHang', idDonHang,
          JSON.stringify({ trangThaiDon: 'dang_giao' }),
          JSON.stringify({ trangThaiDon: 'da_giao', khoiLuongThucTe }),
          ip);
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
        res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi cập nhật trạng thái giao";
      res.status(500).json({ success: false, message });
    }
  },
);

export default router;
