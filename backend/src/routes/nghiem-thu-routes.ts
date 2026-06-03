import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, vnNow } from '../config/database';
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
import { ghiNhatKy } from '../services/access-history-service';

const router = Router();

// Thư mục lưu file — đảm bảo tồn tại
const BIEN_BAN_DIR = path.join(process.cwd(), 'uploads', 'bien-ban');
if (!fs.existsSync(BIEN_BAN_DIR)) {
  fs.mkdirSync(BIEN_BAN_DIR, { recursive: true });
}

// Cấu hình multer để lưu file biên bản nghiệm thu (nhiều file)
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
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }, // 50MB mỗi file, tối đa 10 file
  fileFilter: (_req, file, cb) => {
    const allowed = ['.doc', '.docx', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file .doc, .docx, .pdf, .jpg, .jpeg, .png, .gif, .webp'));
    }
  },
});

router.post('/', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const nghiemThu = await taoNghiemThu(req.body);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'TAO', 'NghiemThu', nghiemThu.id, undefined,
      JSON.stringify(req.body), ip);
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
    const existing = (await query<any[]>(`SELECT * FROM NghiemThu WHERE id = @id`, { id }))[0];
    const nghiemThu = await capNhatNghiemThu(id, req.body);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'SUA', 'NghiemThu', id,
      JSON.stringify(existing),
      JSON.stringify(req.body),
      ip);
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
    const dhCu = (await query<any[]>(`SELECT * FROM DonHang WHERE id = @idDonHang`, { idDonHang }))[0];
    const dh = await xacNhanNghiemThu(idDonHang, loai);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'XAC_NHAN', 'NghiemThu', idDonHang,
      JSON.stringify(dhCu),
      JSON.stringify({ loai, trangThaiDon: 'nghiem_thu' }),
      ip);
    res.json({ success: true, message: 'Xác nhận nghiệm thu thành công', data: dh });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xác nhận nghiệm thu';
    res.status(400).json({ success: false, message });
  }
});

// Upload file biên bản nghiệm thu (nhiều file)
router.post('/upload/:idDonHang', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), uploadBienBan.array('files', 10), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: 'Không có file nào được tải lên' });
      return;
    }

    const idDonHang = parseInt(req.params.idDonHang, 10);
    const fileUrls = files.map(f => `/uploads/bien-ban/${f.filename}`);

    const existing = await query<NghiemThu>(
      `SELECT * FROM NghiemThu WHERE idDonHang = @idDonHang`,
      { idDonHang }
    );

    if (existing.length === 0) {
      await query(
        `INSERT INTO NghiemThu (idDonHang, chatLuong, bienBanFile, ngayTao)
         VALUES (@idDonHang, N'dat', @bienBanFile, ${vnNow()})`,
        { idDonHang, bienBanFile: JSON.stringify(fileUrls) }
      );
    } else {
      // Merge file cũ và mới
      const existingFiles = existing[0].bienBanFile ? JSON.parse(existing[0].bienBanFile as unknown as string) : [];
      const allFiles = [...existingFiles, ...fileUrls];
      await query(
        `UPDATE NghiemThu SET bienBanFile = @bienBanFile, ngayCapNhat = ${vnNow()} WHERE idDonHang = @idDonHang`,
        { idDonHang, bienBanFile: JSON.stringify(allFiles) }
      );
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'UPLOAD', 'NghiemThu', idDonHang, undefined,
      JSON.stringify({ bienBanFiles: fileUrls }), ip);

    res.json({ success: true, message: `Đã tải lên ${files.length} file thành công`, data: { bienBanFiles: fileUrls } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tải file';
    res.status(500).json({ success: false, message });
  }
});

// Xác nhận nghiệm thu kèm upload file trong 1 request (nhiều file)
router.post('/xac-nhan-upload/:idDonHang', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), uploadBienBan.array('files', 10), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const files = req.files as Express.Multer.File[];
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const fileUrls = files?.map(f => `/uploads/bien-ban/${f.filename}`) || [];

    const dhCu = (await query<any[]>(`SELECT * FROM DonHang WHERE id = @idDonHang`, { idDonHang }))[0];
    const dh = await xacNhanNghiemThu(idDonHang, 'da', fileUrls.length > 0 ? JSON.stringify(fileUrls) : undefined);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'XAC_NHAN', 'NghiemThu', idDonHang,
      JSON.stringify(dhCu),
      JSON.stringify({ loai: 'da', bienBanFiles: fileUrls }),
      ip);

    res.json({
      success: true,
      message: `Xác nhận nghiệm thu thành công${files ? `, đã tải lên ${files.length} file` : ''}`,
      data: { donHang: dh, bienBanFiles: fileUrls },
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
    const existing = (await query<any[]>(`SELECT * FROM NghiemThu WHERE id = @id`, { id }))[0];
    await xoaNghiemThu(id);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id, 'XOA', 'NghiemThu', id,
      JSON.stringify(existing), undefined, ip);
    res.json({ success: true, message: 'Xóa biên bản nghiệm thu thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa biên bản nghiệm thu';
    res.status(400).json({ success: false, message });
  }
});

export default router;
