import { Router, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  importDonHang,
  importKhachHang,
  importNguoiDung,
  importPhuongTien,
  layLichSuImport,
} from '../services/import-service';

const router = Router();

// Cấu hình multer để lưu file tạm
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file .xlsx, .xls, .csv'));
    }
  },
});

// Parse Excel/CSV buffer → array of objects
function parseExcel(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
}

// Lấy lịch sử import
router.get('/lich-su', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const loai = req.query.loai as string || 'don_hang';
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const tuNgay = req.query.tuNgay as string | undefined;
    const denNgay = req.query.denNgay as string | undefined;

    const { data, total } = await layLichSuImport(loai, page, limit, tuNgay, denNgay);
    res.json({
      success: true,
      message: 'Lấy lịch sử import thành công',
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy lịch sử import';
    res.status(500).json({ success: false, message });
  }
});

// Import đơn hàng
router.post(
  '/don-hang',
  authMiddleware,
  requireRole('admin', 'ke_toan', 'dieu_phoi'),
  upload.single('file'),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn file Excel' });
        return;
      }
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
        return;
      }

      const rows = parseExcel(req.file.buffer);
      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'File không có dữ liệu' });
        return;
      }

      const result = await importDonHang(rows, req.user.id, req.file.originalname);
      console.log('[IMPORT DON HANG] Raw rows headers:', Object.keys(rows[0] || {}));
      console.log('[IMPORT DON HANG] First row:', JSON.stringify(rows[0]));
      console.log('[IMPORT DON HANG] Result:', JSON.stringify(result));
      res.json({
        success: true,
        message: `Import thành công ${result.success}/${result.total} dòng`,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi import đơn hàng';
      res.status(500).json({ success: false, message });
    }
  }
);

// Import khách hàng
router.post(
  '/khach-hang',
  authMiddleware,
  requireRole('admin', 'ke_toan', 'dieu_phoi'),
  upload.single('file'),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn file Excel' });
        return;
      }
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
        return;
      }

      const rows = parseExcel(req.file.buffer);
      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'File không có dữ liệu' });
        return;
      }

      const result = await importKhachHang(rows, req.user.id, req.file.originalname);
      res.json({
        success: true,
        message: `Import thành công ${result.success}/${result.total} dòng`,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi import khách hàng';
      res.status(500).json({ success: false, message });
    }
  }
);

// Import người dùng
router.post(
  '/nguoi-dung',
  authMiddleware,
  requireRole('admin'),
  upload.single('file'),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn file Excel' });
        return;
      }
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
        return;
      }

      const rows = parseExcel(req.file.buffer);
      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'File không có dữ liệu' });
        return;
      }

      const result = await importNguoiDung(rows, req.user.id, req.file.originalname);
      res.json({
        success: true,
        message: `Import thành công ${result.success}/${result.total} dòng`,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi import người dùng';
      res.status(500).json({ success: false, message });
    }
  }
);

// Import phương tiện
router.post(
  '/phuong-tien',
  authMiddleware,
  requireRole('admin'),
  upload.single('file'),
  async (req: AuthRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn file Excel' });
        return;
      }
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
        return;
      }

      const rows = parseExcel(req.file.buffer);
      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'File không có dữ liệu' });
        return;
      }

      const result = await importPhuongTien(rows, req.user.id, req.file.originalname);
      res.json({
        success: true,
        message: `Import thành công ${result.success}/${result.total} dòng`,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi import phương tiện';
      res.status(500).json({ success: false, message });
    }
  }
);

export default router;
