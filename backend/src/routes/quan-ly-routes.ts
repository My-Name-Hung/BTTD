import bcrypt from "bcryptjs";
import { Response, Router } from "express";
import { body } from "express-validator";
import { query, vnNow } from "../config/database";
import { query } from "../config/database";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { ApiResponse } from "../models";
import { ghiNhatKy } from "../services/access-history-service";

const router = Router();

// Lấy danh sách người dùng (phân trang)
router.get(
  "/quan-ly/nguoi-dung",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const page = parseInt(_req.query.page as string, 10) || 1;
      const limit = parseInt(_req.query.limit as string, 10) || 50;
      const offset = (page - 1) * limit;
      const tuKhoa = _req.query.tuKhoa as string | undefined;

      let whereClause = "";
      const params: Record<string, unknown> = { offset, limit };
      if (tuKhoa) {
        whereClause = "WHERE tenDangNhap LIKE @tuKhoa OR hoTen LIKE @tuKhoa";
        params.tuKhoa = `%${tuKhoa}%`;
      }

      const countResult = await query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM NguoiDung ${whereClause}`,
        params,
      );
      const total = countResult[0]?.cnt || 0;

      const result = await query<any[]>(
        `SELECT id, tenDangNhap, hoTen, email, soDienThoai, vaiTro, trangThai, ngayTao
       FROM NguoiDung ${whereClause}
       ORDER BY id DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
        params,
      );

      res.json({
        success: true,
        message: "Lấy danh sách người dùng thành công",
        data: result,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi lấy danh sách người dùng";
      res.status(500).json({ success: false, message });
    }
  },
);

// Tạo người dùng mới
router.post(
  "/quan-ly/nguoi-dung",
  authMiddleware,
  requireRole("admin"),
  [
    body("tenDangNhap")
      .trim()
      .notEmpty()
      .withMessage("Tên đăng nhập là bắt buộc"),
    body("matKhau")
      .isLength({ min: 6 })
      .withMessage("Mật khẩu phải ít nhất 6 ký tự"),
    body("hoTen").trim().notEmpty().withMessage("Họ tên là bắt buộc"),
    body("vaiTro")
      .isIn(["admin", "ke_toan", "dieu_phoi", "lanh_dao", "kho", "sale", "tai_xe", "ky_thuat"])
      .withMessage("Vai trò không hợp lệ"),
  ],
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const { tenDangNhap, matKhau, hoTen, email, soDienThoai, vaiTro } =
        req.body;
      const hashed = await bcrypt.hash(matKhau, 10);
      const result = await query<any>(
        `INSERT INTO NguoiDung (tenDangNhap, matKhau, hoTen, email, soDienThoai, vaiTro)
         OUTPUT INSERTED.id, INSERTED.tenDangNhap, INSERTED.hoTen, INSERTED.email, INSERTED.soDienThoai, INSERTED.vaiTro, INSERTED.trangThai, INSERTED.ngayTao
         VALUES (@tenDangNhap, @matKhau, @hoTen, @email, @soDienThoai, @vaiTro)`,
        {
          tenDangNhap,
          matKhau: hashed,
          hoTen,
          email: email || null,
          soDienThoai: soDienThoai || null,
          vaiTro,
        },
      );
      const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
      await ghiNhatKy(req.user?.id, 'TAO', 'NguoiDung', result[0]?.id, undefined,
        `Tạo tài khoản "${tenDangNhap}", vai trò: ${req.body.vaiTro}`, ip);
      res
        .status(201)
        .json({
          success: true,
          message: "Tạo người dùng thành công",
          data: result[0],
        });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi tạo người dùng";
      if (message.includes("UNIQUE")) {
        res
          .status(400)
          .json({ success: false, message: "Tên đăng nhập đã tồn tại" });
        return;
      }
      res.status(500).json({ success: false, message });
    }
  },
);

// Cập nhật người dùng
router.put(
  "/quan-ly/nguoi-dung/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { hoTen, email, soDienThoai, vaiTro, trangThai, matKhauMoi } =
        req.body;

      const params: Record<string, unknown> = {
        hoTen,
        email: email || null,
        soDienThoai: soDienThoai || null,
        vaiTro,
        trangThai: trangThai || "hoat_dong",
        id,
      };

      let sql = `UPDATE NguoiDung SET hoTen = @hoTen, email = @email, soDienThoai = @soDienThoai, vaiTro = @vaiTro, trangThai = @trangThai, ngayCapNhat = ${vnNow()} WHERE id = @id`;

      if (matKhauMoi) {
        const hashed = await bcrypt.hash(matKhauMoi, 10);
        sql = `UPDATE NguoiDung SET matKhau = @matKhau, hoTen = @hoTen, email = @email, soDienThoai = @soDienThoai, vaiTro = @vaiTro, trangThai = @trangThai, ngayCapNhat = ${vnNow()} WHERE id = @id`;
        params.matKhau = hashed;
      }

      await query(sql, params);
      const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
      await ghiNhatKy(req.user?.id, 'SUA', 'NguoiDung', id, undefined,
        `Sửa thông tin user #${id}`, ip);

      const result = await query<any[]>(
        `SELECT id, tenDangNhap, hoTen, email, soDienThoai, vaiTro, trangThai, ngayTao FROM NguoiDung WHERE id = @id`,
        { id },
      );
      if (!result[0]) {
        res
          .status(404)
          .json({ success: false, message: "Không tìm thấy người dùng" });
        return;
      }
      res.json({
        success: true,
        message: "Cập nhật người dùng thành công",
        data: result[0],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi cập nhật người dùng";
      res.status(500).json({ success: false, message });
    }
  },
);

// Xóa người dùng
router.delete(
  "/quan-ly/nguoi-dung/:id",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (id === req.user?.id) {
        res
          .status(400)
          .json({
            success: false,
            message: "Không thể xóa tài khoản của chính bạn",
          });
        return;
      }
      const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
      await ghiNhatKy(req.user?.id, 'XOA', 'NguoiDung', id, undefined,
        `Xóa tài khoản user #${id}`, ip);
      await query("DELETE FROM NguoiDung WHERE id = @id", { id });
      res.json({ success: true, message: "Xóa người dùng thành công" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Lỗi xóa người dùng";
      res.status(500).json({ success: false, message });
    }
  },
);

export default router;
