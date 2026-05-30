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
  importMacBeTong,
  importCongNo,
  importCongNoKhachHang,
  layLichSuImport,
} from '../services/import-service';
import { ghiNhatKy } from '../services/access-history-service';

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

function getIp(req: AuthRequest): string {
  return req.ip || req.headers['x-forwarded-for'] as string || '';
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

// Debug: check actual column names in DonHang table
router.get('/debug-columns', authMiddleware, requireRole('admin'), async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const { query } = await import('../config/database');
    const cols = await query<{ COLUMN_NAME: string }[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'DonHang' ORDER BY ORDINAL_POSITION`
    );
    res.json({ success: true, data: { columns: cols.map(c => c.COLUMN_NAME) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi debug';
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

      const nguoiTaiId = req.user.id ?? 1;
      const result = await importDonHang(rows, nguoiTaiId, req.file.originalname);
      await ghiNhatKy(req.user.id, 'IMPORT', 'DonHang', undefined, undefined,
        `Import đơn hàng từ file "${req.file.originalname}" (${result.success}/${result.total} dòng thành công)`, getIp(req));
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
      await ghiNhatKy(req.user.id, 'IMPORT', 'KhachHang', undefined, undefined,
        `Import khách hàng từ file "${req.file.originalname}" (${result.success}/${result.total} dòng thành công)`, getIp(req));
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
      await ghiNhatKy(req.user.id, 'IMPORT', 'NguoiDung', undefined, undefined,
        `Import người dùng từ file "${req.file.originalname}" (${result.success}/${result.total} dòng thành công)`, getIp(req));
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
      await ghiNhatKy(req.user.id, 'IMPORT', 'Xe', undefined, undefined,
        `Import phương tiện từ file "${req.file.originalname}" (${result.success}/${result.total} dòng thành công)`, getIp(req));
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

// Import mác bê tông
router.post(
  '/mac-be-tong',
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

      const result = await importMacBeTong(rows, req.user.id, req.file.originalname);
      await ghiNhatKy(req.user.id, 'IMPORT', 'MacBeTong', undefined, undefined,
        `Import mác bê tông từ file "${req.file.originalname}" (${result.success}/${result.total} dòng thành công)`, getIp(req));
      res.json({
        success: true,
        message: `Import thành công ${result.success}/${result.total} dòng`,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi import mác bê tông';
      res.status(500).json({ success: false, message });
    }
  }
);

// Import công nợ
router.post(
  '/cong-no',
  authMiddleware,
  requireRole('admin', 'ke_toan'),
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

      const result = await importCongNo(rows, req.user.id, req.file.originalname);
      await ghiNhatKy(req.user.id, 'IMPORT', 'CongNo', undefined, undefined,
        `Import công nợ từ file "${req.file.originalname}" (${result.success}/${result.total} dòng thành công)`, getIp(req));
      res.json({
        success: true,
        message: `Import thành công ${result.success}/${result.total} dòng`,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi import công nợ';
      res.status(500).json({ success: false, message });
    }
  }
);

// Import công nợ theo khách hàng (Bravo)
router.post(
  '/cong-no-khach-hang',
  authMiddleware,
  requireRole('admin', 'ke_toan'),
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

      const result = await importCongNoKhachHang(rows, req.user.id, req.file.originalname);
      await ghiNhatKy(req.user.id, 'IMPORT', 'CongNoKhachHang', undefined, undefined,
        `Import công nợ khách hàng từ file "${req.file.originalname}" (${result.success}/${result.total} dòng thành công)`, getIp(req));
      res.json({
        success: true,
        message: `Import thành công ${result.success}/${result.total} dòng`,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi import công nợ';
      res.status(500).json({ success: false, message });
    }
  }
);

export default router;
