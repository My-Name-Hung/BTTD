import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import { query, vnNow } from '../config/database';
import { saveUploadedFilesLocally } from '../services/local-file-service';
import {
  layBangChungTheoDonHang,
  themBangChungDonHang,
  xoaBangChungDonHang,
  BangChungDonHang,
} from '../services/bang-chung-service';
import { ghiNhatKy } from '../services/access-history-service';

const router = Router();

// Cấu hình multer
const uploadBangChung = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.doc', '.docx', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Loại file không được hỗ trợ. Chỉ chấp nhận: .doc, .docx, .pdf, .jpg, .jpeg, .png'));
    }
  },
});

// Lấy danh sách bằng chứng theo đơn hàng
router.get('/don-hang/:idDonHang', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const data = await layBangChungTheoDonHang(idDonHang);
    res.json({ success: true, message: 'Lấy danh sách bằng chứng thành công', data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi lấy bằng chứng';
    res.status(500).json({ success: false, message: msg });
  }
});

// Upload bằng chứng đơn hàng (file)
router.post('/upload/:idDonHang', authMiddleware, requireRole('admin', 'sale', 'ke_toan', 'dieu_phoi'), uploadBangChung.array('files', 10), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: 'Không có file nào được tải lên' });
      return;
    }

    const idDonHang = parseInt(req.params.idDonHang, 10);
    const nguoiTaoId = req.user?.id;

    // Lấy mã đơn hàng để tạo thư mục
    const donHangRow = (await query<{ maDonHang: string }>(
      `SELECT maDonHang FROM DonHang WHERE id = @idDonHang`,
      { idDonHang }
    ))[0];
    const maDonHang = donHangRow?.maDonHang || `DH${idDonHang}`;

    // Lưu file
    const fileUrls = await saveUploadedFilesLocally(files, `bangchung_${maDonHang}`);

    // Lưu vào DB
    const inserted: BangChungDonHang[] = [];
    for (const url of fileUrls) {
      const bc = await themBangChungDonHang(idDonHang, url, 'file', undefined, nguoiTaoId);
      inserted.push(bc);
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(nguoiTaoId ?? null, 'UPLOAD', 'BangChungDonHang', idDonHang, undefined,
      JSON.stringify({ files: fileUrls }), ip);

    res.json({
      success: true,
      message: `Đã tải lên ${files.length} file bằng chứng thành công`,
      data: inserted,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi tải bằng chứng';
    console.error('[Upload BangChungDonHang]', msg, error);
    res.status(500).json({ success: false, message: msg });
  }
});

// Upload bằng chứng từ camera (base64 image)
router.post('/camera/:idDonHang', authMiddleware, requireRole('admin', 'sale', 'ke_toan', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const { imageData } = req.body;
    if (!imageData) {
      res.status(400).json({ success: false, message: 'Không có dữ liệu ảnh' });
      return;
    }

    const idDonHang = parseInt(req.params.idDonHang, 10);
    const nguoiTaoId = req.user?.id;

    // Lấy mã đơn hàng
    const donHangRow = (await query<{ maDonHang: string }>(
      `SELECT maDonHang FROM DonHang WHERE id = @idDonHang`,
      { idDonHang }
    ))[0];
    const maDonHang = donHangRow?.maDonHang || `DH${idDonHang}`;

    // Decode base64 và lưu file
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `camera_${Date.now()}.jpg`;
    const path = require('path');
    const fs = require('fs');
    const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
    const orderFolder = path.join(UPLOAD_ROOT, `bangchung_${maDonHang}`);
    if (!fs.existsSync(orderFolder)) {
      fs.mkdirSync(orderFolder, { recursive: true });
    }
    const filepath = path.join(orderFolder, filename);
    fs.writeFileSync(filepath, buffer);

    const fileUrl = `/uploads/bangchung_${maDonHang}/${filename}`;

    // Lưu vào DB
    const bc = await themBangChungDonHang(idDonHang, fileUrl, 'camera', undefined, nguoiTaoId);

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(nguoiTaoId ?? null, 'UPLOAD_CAMERA', 'BangChungDonHang', idDonHang, undefined,
      JSON.stringify({ fileUrl }), ip);

    res.json({
      success: true,
      message: 'Đã chụp ảnh và lưu bằng chứng thành công',
      data: bc,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi lưu ảnh camera';
    console.error('[UploadCamera BangChungDonHang]', msg, error);
    res.status(500).json({ success: false, message: msg });
  }
});

// Xóa bằng chứng
router.delete('/:id', authMiddleware, requireRole('admin', 'sale', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = (await query<any[]>(
      `SELECT * FROM BangChungDonHang WHERE id = @id`,
      { id }
    ))[0];
    await xoaBangChungDonHang(id);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id ?? null, 'XOA', 'BangChungDonHang', id,
      JSON.stringify(existing), undefined, ip);
    res.json({ success: true, message: 'Xóa bằng chứng thành công' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi xóa bằng chứng';
    res.status(500).json({ success: false, message: msg });
  }
});

export default router;
