import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  taoNghiemThu,
  layNghiemThuTheoDonHang,
  capNhatNghiemThu,
  xacNhanNghiemThu,
  xoaNghiemThu,
} from '../services/nghiem-thu-service';
import { query } from '../config/database';
import { NghiemThu } from '../models';

const router = Router();

// Thư mục lưu file — đảm bảo tồn tại
const BIEN_BAN_DIR = path.join(process.cwd(), 'uploads', 'bien-ban');
if (!fs.existsSync(BIEN_BAN_DIR)) {
  fs.mkdirSync(BIEN_BAN_DIR, { recursive: true });
}

// Cấu hình multer để lưu file biên bản nghiệm thu
const uploadBienBan = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, BIEN_BAN_DIR);
    },
    filename: (_req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `bien-ban-${unique}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.doc', '.docx', '.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file .doc, .docx, .pdf, .jpg, .png'));
    }
  },
});

router.post('/', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const nghiemThu = await taoNghiemThu(req.body);
    res.status(201).json({ success: true, message: 'Tạo biên bản nghiệm thu thành công', data: nghiemThu });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo biên bản nghiệm thu';
    res.status(500).json({ success: false, message });
  }
});

router.get('/don-hang/:idDonHang', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const data = await layNghiemThuTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Lấy nghiệm thu thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy nghiệm thu';
    res.status(500).json({ success: false, message });
  }
});

router.put('/:id', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const nghiemThu = await capNhatNghiemThu(id, req.body);
    res.json({ success: true, message: 'Cập nhật nghiệm thu thành công', data: nghiemThu });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật nghiệm thu';
    res.status(400).json({ success: false, message });
  }
});

router.put('/xac-nhan/:idDonHang', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const loai = (req.query.loai as string) === 'chua' ? 'chua' : 'da';
    const dh = await xacNhanNghiemThu(idDonHang, loai);
    res.json({ success: true, message: 'Xác nhận nghiệm thu thành công', data: dh });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận nghiệm thu';
    res.status(400).json({ success: false, message });
  }
});

// Upload file biên bản nghiệm thu (tùy chọn)
router.post('/upload/:idDonHang', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), uploadBienBan.single('file'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Không có file được tải lên' });
      return;
    }

    const idDonHang = parseInt(req.params.idDonHang, 10);
    const fileUrl = `/uploads/bien-ban/${req.file.filename}`;

    const existing = await query<NghiemThu>(
      `SELECT * FROM NghiemThu WHERE idDonHang = @idDonHang`,
      { idDonHang }
    );

    if (existing.length === 0) {
      await query(
        `INSERT INTO NghiemThu (idDonHang, chatLuong, bienBanFile, ngayTao)
         VALUES (@idDonHang, N'dat', @bienBanFile, GETDATE())`,
        { idDonHang, bienBanFile: fileUrl }
      );
    } else {
      await query(
        `UPDATE NghiemThu SET bienBanFile = @bienBanFile, ngayCapNhat = GETDATE() WHERE idDonHang = @idDonHang`,
        { idDonHang, bienBanFile: fileUrl }
      );
    }

    res.json({ success: true, message: 'Tải file thành công', data: { bienBanFile: fileUrl } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tải file';
    res.status(500).json({ success: false, message });
  }
});

// Xác nhận nghiệm thu kèm upload file trong 1 request
router.post('/xac-nhan-upload/:idDonHang', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), uploadBienBan.single('file'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const fileUrl = req.file ? `/uploads/bien-ban/${req.file.filename}` : undefined;

    const dh = await xacNhanNghiemThu(idDonHang, 'da', fileUrl);

    res.json({
      success: true,
      message: 'Xác nhận nghiệm thu thành công',
      data: { donHang: dh, bienBanFile: fileUrl },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận nghiệm thu';
    res.status(400).json({ success: false, message });
  }
});

// Xóa nghiệm thu
router.delete('/:id', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    await xoaNghiemThu(id);
    res.json({ success: true, message: 'Xóa biên bản nghiệm thu thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa biên bản nghiệm thu';
    res.status(400).json({ success: false, message });
  }
});

export default router;
