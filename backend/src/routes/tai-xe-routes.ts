import { Response, Router } from "express";
import { query, vnNow } from "../config/database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { ApiResponse } from "../models";
import { guiThongBao } from "../services/thong-bao-service";
import { ghiNhatKy } from "../services/access-history-service";

const router = Router();

/** Lấy đơn hàng của tài xế đang giao (admin xem tất cả) - 1 row / trạm (LichSanXuat) */
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
      const isGiamDoc = req.user.vaiTro === 'giam_doc_kinh_doanh';
      let data;

      if (isAdmin || isKyThuat || isGiamDoc) {
        // Admin/Kỹ thuật/GĐKD: xem tất cả đơn đang giao, 1 row / trạm
        data = await query<any>(
          `SELECT dh.*,
                  ls.id as idLichSanXuat,
                  ls.idTramTron,
                  ls.idTaiXe,
                  ls.bienSoXe as lsBienSoXe,
                  ls.trangThaiGiao,
                  ls.khoiLuongGiaoThucTe,
                  ls.ngayXacNhanGiao,
                  tt.tenTram,
                  nd.hoTen as tenTaiXe,
                  xe.bienSoXe as xeBienSoXe
             FROM DonHang dh
             INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang AND ls.idTramTron IS NOT NULL
             LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
             LEFT JOIN Xe xe ON ls.idXe = xe.id
             LEFT JOIN NguoiDung nd ON xe.idTaiKhoan = nd.id
             WHERE dh.trangThaiDon = N'dang_giao'
             ORDER BY dh.ngayGiao DESC, ls.id ASC`,
          {}
        );
      } else {
        // Tài xế: chỉ xem đơn có lịch giao của mình, 1 row / trạm
        const idTaiXe = req.user.id;
        data = await query<any>(
          `SELECT dh.*,
                  ls.id as idLichSanXuat,
                  ls.idTramTron,
                  ls.idTaiXe,
                  ls.bienSoXe as lsBienSoXe,
                  ls.trangThaiGiao,
                  ls.khoiLuongGiaoThucTe,
                  ls.ngayXacNhanGiao,
                  tt.tenTram,
                  nd.hoTen as tenTaiXe,
                  xe.bienSoXe as xeBienSoXe
             FROM DonHang dh
             INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang AND ls.idTramTron IS NOT NULL
             INNER JOIN Xe xe ON ls.idXe = xe.id
             LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
             LEFT JOIN NguoiDung nd ON xe.idTaiKhoan = nd.id
             WHERE xe.idTaiKhoan = @idTaiXe
               AND dh.trangThaiDon = N'dang_giao'
             ORDER BY dh.ngayGiao DESC, ls.id ASC`,
          { idTaiXe }
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
      const isGiamDoc = req.user.vaiTro === 'giam_doc_kinh_doanh';

      if (isAdmin || isKyThuat || isGiamDoc) {
        // Admin, Kỹ thuật và Giám đốc kinh doanh xem tất cả thống kê
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

/** Lấy đơn đã giao (tab "Đã giao") - 1 row / trạm */
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
      const isGiamDoc = req.user.vaiTro === 'giam_doc_kinh_doanh';
      let data;

      if (isAdmin || isKyThuat || isGiamDoc) {
        // Admin/Kỹ thuật/GĐKD: xem tất cả đơn đã giao, 1 row / trạm
        data = await query<any>(
          `SELECT dh.*,
                  ls.id as idLichSanXuat,
                  ls.idTramTron,
                  ls.idTaiXe,
                  ls.bienSoXe as lsBienSoXe,
                  ls.trangThaiGiao,
                  ls.khoiLuongGiaoThucTe,
                  ls.ngayXacNhanGiao,
                  tt.tenTram,
                  nd.hoTen as tenTaiXe,
                  xe.bienSoXe as xeBienSoXe
             FROM DonHang dh
             INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
               AND ls.idTramTron IS NOT NULL
               AND ls.trangThaiGiao = N'da_giao'
             LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
             LEFT JOIN Xe xe ON ls.idXe = xe.id
             LEFT JOIN NguoiDung nd ON xe.idTaiKhoan = nd.id
             WHERE dh.trangThaiDon IN (N'da_giao', N'dang_giao', N'da_nghiem_thu', N'da_thanh_toan', N'hoan_thanh')
             ORDER BY ls.ngayXacNhanGiao DESC, dh.ngayGiao DESC, ls.id ASC`,
          {}
        );
      } else {
        // Tài xế: chỉ xem đơn có lịch giao của mình, 1 row / trạm
        const idTaiXe = req.user.id;
        data = await query<any>(
          `SELECT dh.*,
                  ls.id as idLichSanXuat,
                  ls.idTramTron,
                  ls.idTaiXe,
                  ls.bienSoXe as lsBienSoXe,
                  ls.trangThaiGiao,
                  ls.khoiLuongGiaoThucTe,
                  ls.ngayXacNhanGiao,
                  tt.tenTram,
                  nd.hoTen as tenTaiXe,
                  xe.bienSoXe as xeBienSoXe
             FROM DonHang dh
             INNER JOIN LichSanXuat ls ON dh.id = ls.idDonHang
               AND ls.idTramTron IS NOT NULL
               AND ls.trangThaiGiao = N'da_giao'
             INNER JOIN Xe xe ON ls.idXe = xe.id
             LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
             LEFT JOIN NguoiDung nd ON xe.idTaiKhoan = nd.id
             WHERE xe.idTaiKhoan = @idTaiXe
               AND dh.trangThaiDon IN (N'da_giao', N'dang_giao', N'da_nghiem_thu', N'da_thanh_toan', N'hoan_thanh')
             ORDER BY ls.ngayXacNhanGiao DESC, dh.ngayGiao DESC, ls.id ASC`,
          { idTaiXe }
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
      const isGiamDoc = req.user.vaiTro === 'giam_doc_kinh_doanh';
      let data;

      if (isAdmin || isGiamDoc) {
        // Admin và Giám đốc kinh doanh xem tất cả lịch sử giao hàng - chỉ ĐÃ GIAO
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
      const idLichSanXuatRaw = req.body.idLichSanXuat;
      const idLichSanXuat =
        idLichSanXuatRaw != null && idLichSanXuatRaw !== ""
          ? parseInt(String(idLichSanXuatRaw), 10)
          : null;
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

      // Kiểm tra quyền - theo từng LichSanXuat (trạm) nếu có idLichSanXuat
      const isAdmin = req.user.vaiTro === 'admin';
      const isKyThuat = req.user.vaiTro === 'ky_thuat';
      if (!isAdmin && !isKyThuat) {
        if (idLichSanXuat == null) {
          res.status(400).json({
            success: false,
            message: "Vui lòng truyền idLichSanXuat để xác định trạm cần xác nhận",
          });
          return;
        }
        const lsCheck = await query<any>(
          `SELECT ls.id, ls.idTramTron, ls.trangThaiGiao, xe.idTaiKhoan
             FROM LichSanXuat ls
             INNER JOIN Xe xe ON ls.idXe = xe.id
             WHERE ls.id = @idLichSanXuat AND ls.idDonHang = @idDonHang`,
          { idLichSanXuat, idDonHang }
        );
        if (lsCheck.length === 0 || lsCheck[0].idTaiKhoan !== req.user.id) {
          res.status(403).json({ success: false, message: "Bạn không có quyền cập nhật trạm này" });
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
        // Ghi nhận trạm này đang giao (nếu có idLichSanXuat)
        if (idLichSanXuat != null) {
          await query(
            `UPDATE LichSanXuat SET trangThaiGiao = N'dang_giao', ngayXacNhanGiao = ${vnNow()} WHERE id = @idLichSanXuat`,
            { idLichSanXuat }
          );
        }
        const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
        await ghiNhatKy(req.user.id, 'XAC_NHAN', 'DonHang', idDonHang,
          JSON.stringify({ trangThaiDon: 'dang_san_xuat' }),
          JSON.stringify({ trangThaiDon: 'dang_giao', idLichSanXuat }),
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
        // Tài xế xác nhận đã giao: cập nhật theo từng trạm
        if (donHang[0].trangThaiDon !== "dang_giao" && donHang[0].trangThaiDon !== "dang_san_xuat") {
          res.status(400).json({ success: false, message: "Đơn hàng không ở trạng thái đang giao hoặc chờ giao" });
          return;
        }
        if (idLichSanXuat == null) {
          res.status(400).json({
            success: false,
            message: "Vui lòng truyền idLichSanXuat để xác nhận giao theo từng trạm",
          });
          return;
        }

        // 1. Cập nhật LichSanXuat: trạm này đã giao + lưu khối lượng thực tế
        await query(
          `UPDATE LichSanXuat
             SET trangThaiGiao = N'da_giao',
                 khoiLuongGiaoThucTe = @kl,
                 ngayXacNhanGiao = ${vnNow()}
             WHERE id = @idLichSanXuat`,
          { idLichSanXuat, kl: khoiLuongThucTe ?? null }
        );

        // 2. Tổng hợp khối lượng thực tế từ các trạm đã giao
        const tongRes = await query<{ tong: number | null }>(
          `SELECT ISNULL(SUM(khoiLuongGiaoThucTe), 0) as tong
             FROM LichSanXuat
             WHERE idDonHang = @idDonHang
               AND idTramTron IS NOT NULL
               AND trangThaiGiao = N'da_giao'
               AND khoiLuongGiaoThucTe IS NOT NULL`,
          { idDonHang }
        );
        const tongKLTong = tongRes[0]?.tong || 0;

        // 3. Kiểm tra tất cả các trạm đã giao chưa
        const tramStatus = await query<any>(
          `SELECT
              (SELECT COUNT(*) FROM LichSanXuat WHERE idDonHang = @idDonHang AND idTramTron IS NOT NULL) as tongTram,
              (SELECT COUNT(*) FROM LichSanXuat WHERE idDonHang = @idDonHang AND idTramTron IS NOT NULL AND trangThaiGiao = N'da_giao') as tramDaGiao`,
          { idDonHang }
        );
        const tongTram = tramStatus[0]?.tongTram || 0;
        const tramDaGiao = tramStatus[0]?.tramDaGiao || 0;
        const tatCaTramDaGiao = tongTram > 0 && tramDaGiao >= tongTram;

        // 4. Cập nhật DonHang theo kết quả tổng hợp
        if (tatCaTramDaGiao) {
          await query(
            `UPDATE DonHang
               SET trangThaiDon = N'da_giao',
                   khoiLuongThucTe = @kl,
                   ngayGiao = ${vnNow()},
                   ngayCapNhat = ${vnNow()}
             WHERE id = @id`,
            { id: idDonHang, kl: tongKLTong || khoiLuongThucTe || null }
          );
        } else {
          await query(
            `UPDATE DonHang
               SET khoiLuongThucTe = @kl,
                   ngayCapNhat = ${vnNow()}
             WHERE id = @id`,
            { id: idDonHang, kl: tongKLTong || khoiLuongThucTe || null }
          );
        }

        const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
        await ghiNhatKy(req.user.id, 'XAC_NHAN', 'DonHang', idDonHang,
          JSON.stringify({ trangThaiDon: 'dang_giao' }),
          JSON.stringify({
            trangThaiDon: tatCaTramDaGiao ? 'da_giao' : 'dang_giao',
            idLichSanXuat,
            khoiLuongThucTe,
            tramDaGiao,
            tongTram,
          }),
          ip);
        if (tatCaTramDaGiao) {
          const updated = (
            await query<any>(`SELECT * FROM DonHang WHERE id = @id`, {
              id: idDonHang,
            })
          )[0];
          guiThongBao("DELIVERY_COMPLETED", {
            id: idDonHang,
            maDonHang: updated.maDonHang,
            khoiLuong: khoiLuongThucTe || updated.khoiLuongThucTe || 0,
          });
        }
        res.json({
          success: true,
          message: tatCaTramDaGiao
            ? "Xác nhận giao hàng thành công - đơn hoàn tất"
            : `Đã xác nhận giao trạm này (còn ${tongTram - tramDaGiao} trạm chưa giao)`,
          data: {
            idDonHang,
            idLichSanXuat,
            tongTram,
            tramDaGiao,
            tatCaTramDaGiao,
            tongKhoiLuongThucTe: tongKLTong,
          },
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

/** Tài xế hoặc kỹ thuật báo trộn lại theo từng trạm (idLichSanXuat) */
router.post(
  "/tron-lai/:idDonHang",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const idDonHang = parseInt(req.params.idDonHang, 10);
      const { lyDo } = req.body;
      const idLichSanXuatRaw = req.body.idLichSanXuat;
      const idLichSanXuat =
        idLichSanXuatRaw != null && idLichSanXuatRaw !== ""
          ? parseInt(String(idLichSanXuatRaw), 10)
          : null;

      if (!lyDo || lyDo.trim() === "") {
        res.status(400).json({ success: false, message: "Vui lòng nhập lý do trộn lại" });
        return;
      }

      const donHang = await query<any>(`SELECT * FROM DonHang WHERE id = @id`, {
        id: idDonHang,
      });

      if (donHang.length === 0) {
        res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
        return;
      }

      // Kiểm tra đơn đang ở trạng thái đang giao hoặc chờ giao
      if (
        donHang[0].trangThaiDon !== "dang_giao" &&
        donHang[0].trangThaiDon !== "dang_san_xuat"
      ) {
        res.status(400).json({ success: false, message: "Chỉ có thể trộn lại khi đơn đang ở trạng thái đang giao hoặc chờ giao" });
        return;
      }

      // Lấy thông tin trạm + tài xế của LichSanXuat (nếu có)
      let tenTram: string | null = null;
      let tenTaiXe: string | null = null;
      let bienSoXe: string | null = null;
      let idTramTron: number | null = null;
      if (idLichSanXuat != null) {
        const lsInfo = await query<any>(
          `SELECT ls.idTramTron, ls.bienSoXe, tt.tenTram, nd.hoTen as tenTaiXe
             FROM LichSanXuat ls
             LEFT JOIN TramTron tt ON ls.idTramTron = tt.id
             LEFT JOIN Xe xe ON ls.idXe = xe.id
             LEFT JOIN NguoiDung nd ON xe.idTaiKhoan = nd.id
             WHERE ls.id = @idLichSanXuat AND ls.idDonHang = @idDonHang`,
          { idLichSanXuat, idDonHang }
        );
        if (lsInfo.length === 0) {
          res.status(404).json({ success: false, message: "Không tìm thấy lịch sản xuất" });
          return;
        }
        tenTram = lsInfo[0].tenTram || null;
        tenTaiXe = lsInfo[0].tenTaiXe || null;
        bienSoXe = lsInfo[0].bienSoXe || null;
        idTramTron = lsInfo[0].idTramTron || null;

        // Kiểm tra quyền: tài xế chỉ trộn lại được trạm của mình
        const isAdmin = req.user.vaiTro === 'admin';
        const isKyThuat = req.user.vaiTro === 'ky_thuat';
        if (!isAdmin && !isKyThuat) {
          const lsCheck = await query<any>(
            `SELECT xe.idTaiKhoan FROM LichSanXuat ls
               INNER JOIN Xe xe ON ls.idXe = xe.id
               WHERE ls.id = @idLichSanXuat`,
            { idLichSanXuat }
          );
          if (lsCheck.length === 0 || lsCheck[0].idTaiKhoan !== req.user.id) {
            res.status(403).json({ success: false, message: "Bạn không có quyền trộn lại trạm này" });
            return;
          }
        }
      } else {
        // Không truyền idLichSanXuat (backward compat) - admin/ky_thuat được phép trộn lại toàn đơn
        const isAdmin = req.user.vaiTro === 'admin';
        const isKyThuat = req.user.vaiTro === 'ky_thuat';
        if (!isAdmin && !isKyThuat) {
          res.status(400).json({
            success: false,
            message: "Vui lòng truyền idLichSanXuat để trộn lại theo từng trạm",
          });
          return;
        }
      }

      // Lưu lịch sử trả lại
      await query(
        `INSERT INTO LichSuTraLai (idDonHang, idLichSanXuat, idTramTron, tenTram, tenTaiXe, bienSoXe, lyDo, idNguoiTra, hoTen, vaiTro)
         VALUES (@idDonHang, @idLichSanXuat, @idTramTron, @tenTram, @tenTaiXe, @bienSoXe, @lyDo, @idNguoiTra, @hoTen, @vaiTro)`,
        {
          idDonHang,
          idLichSanXuat: idLichSanXuat ?? null,
          idTramTron,
          tenTram,
          tenTaiXe,
          bienSoXe,
          lyDo: lyDo.trim(),
          idNguoiTra: req.user.id,
          hoTen: req.user.hoTen,
          vaiTro: req.user.vaiTro,
        }
      );

      // Cập nhật trạng thái: LichSanXuat.trangThaiGiao = 'tron_lai' (chỉ trạm đó)
      // và đơn về dang_san_xuat để điều phối lập lại lịch
      if (idLichSanXuat != null) {
        await query(
          `UPDATE LichSanXuat SET trangThaiGiao = N'tron_lai' WHERE id = @idLichSanXuat`,
          { idLichSanXuat }
        );
      }
      await query(
        `UPDATE DonHang SET trangThaiDon = N'dang_san_xuat', ngayCapNhat = ${vnNow()} WHERE id = @id`,
        { id: idDonHang }
      );

      // Ghi nhật ký
      const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
      await ghiNhatKy(req.user.id, 'TRON_LAI', 'DonHang', idDonHang,
        JSON.stringify({ trangThaiDon: 'dang_giao' }),
        JSON.stringify({ trangThaiDon: 'dang_san_xuat', lyDo, idLichSanXuat, tenTram }),
        ip);

      // Thông báo cho điều phối
      guiThongBao("ORDER_RETURNED", {
        id: idDonHang,
        maDonHang: donHang[0].maDonHang,
        lyDo,
        nguoiTra: req.user.hoTen,
        tenTram,
      });

      const updated = (
        await query<any>(`SELECT * FROM DonHang WHERE id = @id`, {
          id: idDonHang,
        })
      )[0];

      res.json({
        success: true,
        message: tenTram
          ? `Đã ghi nhận trộn lại cho ${tenTram}. Đơn hàng quay về bước tạo lịch sản xuất.`
          : "Đã ghi nhận trộn lại. Đơn hàng quay về bước tạo lịch sản xuất.",
        data: updated,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi trộn lại đơn hàng";
      res.status(500).json({ success: false, message });
    }
  },
);

/** Lấy lịch sử trả lại của một đơn hàng */
router.get(
  "/lich-su-tra-lai/:idDonHang",
  authMiddleware,
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Chưa đăng nhập" });
        return;
      }

      const idDonHang = parseInt(req.params.idDonHang, 10);

      const lichSu = await query<any>(
        `SELECT * FROM LichSuTraLai
         WHERE idDonHang = @idDonHang
         ORDER BY ngayTra DESC`,
        { idDonHang }
      );

      res.json({
        success: true,
        message: "Lấy lịch sử trả lại thành công",
        data: lichSu,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi lấy lịch sử trả lại";
      res.status(500).json({ success: false, message });
    }
  },
);

export default router;
