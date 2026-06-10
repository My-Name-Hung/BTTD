import { Router, Response } from 'express';
import multer from 'multer';
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
import { saveUploadedFilesLocally } from '../services/local-file-service';
import { NghiemThu } from '../models';
import { ghiNhatKy } from '../services/access-history-service';

const router = Router();

// Cấu hình multer lưu file tạm vào memory, sau đó ghi xuống ổ đĩa local
const uploadBienBan = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 }, // 50MB mỗi file, tối đa 10 file
  fileFilter: (_req, file, cb) => {
    const allowed = ['.doc', '.docx', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
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
    await ghiNhatKy(req.user?.id ?? null, 'TAO', 'NghiemThu', nghiemThu.id, undefined,
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
    await ghiNhatKy(req.user?.id ?? null, 'SUA', 'NghiemThu', id,
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
    await ghiNhatKy(req.user?.id ?? null, 'XAC_NHAN', 'NghiemThu', idDonHang,
      JSON.stringify(dhCu),
      JSON.stringify({ loai, trangThaiDon: 'nghiem_thu' }),
      ip);
    res.json({ success: true, message: 'Xác nhận nghiệm thu thành công', data: dh });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi tải file nghiệm thu lên máy chủ';
    console.error('[XacNhanUpload NghiemThu]', msg, error);
    res.status(500).json({ success: false, message: msg });
  }
});

// Upload file biên bản nghiệm thu lên máy chủ local
router.post('/upload/:idDonHang', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), uploadBienBan.array('files', 10), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: 'Không có file nào được tải lên' });
      return;
    }

    const idDonHang = parseInt(req.params.idDonHang, 10);

    // Lấy mã đơn hàng để tạo thư mục
    const donHangRow = (await query<{ maDonHang: string }>(`SELECT maDonHang FROM DonHang WHERE id = @idDonHang`, { idDonHang }))[0];
    const maDonHang = donHangRow?.maDonHang || `DH${idDonHang}`;

    // Lưu từng file vào local filesystem
    const fileUrls = await saveUploadedFilesLocally(files, maDonHang);

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
      const existingFiles: string[] = existing[0].bienBanFile
        ? JSON.parse(existing[0].bienBanFile as unknown as string)
        : [];
      const allFiles = [...existingFiles, ...fileUrls];
      await query(
        `UPDATE NghiemThu SET bienBanFile = @bienBanFile, ngayCapNhat = ${vnNow()} WHERE idDonHang = @idDonHang`,
        { idDonHang, bienBanFile: JSON.stringify(allFiles) }
      );
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id ?? null, 'UPLOAD', 'NghiemThu', idDonHang, undefined,
      JSON.stringify({ bienBanFiles: fileUrls }), ip);

    res.json({ success: true, message: `Đã tải lên ${files.length} file thành công`, data: { bienBanFiles: fileUrls } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi tải file nghiệm thu lên máy chủ';
    console.error('[Upload NghiemThu]', msg, error);
    res.status(500).json({ success: false, message: msg });
  }
});

// Xác nhận nghiệm thu kèm upload file lên máy chủ local
router.post('/xac-nhan-upload/:idDonHang', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), uploadBienBan.array('files', 10), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const files = req.files as Express.Multer.File[];
    const idDonHang = parseInt(req.params.idDonHang, 10);

    // Lấy mã đơn hàng
    const donHangRow = (await query<{ maDonHang: string }>(`SELECT maDonHang FROM DonHang WHERE id = @idDonHang`, { idDonHang }))[0];
    const maDonHang = donHangRow?.maDonHang || `DH${idDonHang}`;

    const fileUrls: string[] = [];
    if (files && files.length > 0) {
      const urls = await saveUploadedFilesLocally(files, maDonHang);
      fileUrls.push(...urls);
    }

    const dhCu = (await query<any[]>(`SELECT * FROM DonHang WHERE id = @idDonHang`, { idDonHang }))[0];
    const dh = await xacNhanNghiemThu(idDonHang, 'da', fileUrls.length > 0 ? JSON.stringify(fileUrls) : undefined);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id ?? null, 'XAC_NHAN', 'NghiemThu', idDonHang,
      JSON.stringify(dhCu),
      JSON.stringify({ loai: 'da', bienBanFiles: fileUrls }),
      ip);

    res.json({
      success: true,
      message: `Xác nhận nghiệm thu thành công${files ? `, đã tải lên ${files.length} file` : ''}`,
      data: { donHang: dh, bienBanFiles: fileUrls },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi tải file nghiệm thu lên máy chủ';
    console.error('[XacNhanUpload NghiemThu]', msg, error);
    res.status(500).json({ success: false, message: msg });
  }
});

// Xóa nghiệm thu
router.delete('/:id', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = (await query<any[]>(`SELECT * FROM NghiemThu WHERE id = @id`, { id }))[0];
    await xoaNghiemThu(id);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id ?? null, 'XOA', 'NghiemThu', id,
      JSON.stringify(existing), undefined, ip);
    res.json({ success: true, message: 'Xóa biên bản nghiệm thu thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa biên bản nghiệm thu';
    res.status(400).json({ success: false, message });
  }
});

// Cập nhật thông tin nghiệm thu (kỹ thuật, ôm ống, bắt ống) vào LichSanXuat
router.put('/thong-tin/:idDonHang', authMiddleware, requireRole('admin', 'ke_toan', 'ky_thuat'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const idDonHang = parseInt(req.params.idDonHang, 10);
    const { kyThuatCongTrinh, nguoiOmOng, nguoiBatOng } = req.body;

    // Cập nhật vào bảng LichSanXuat (lấy record đầu tiên của đơn hàng)
    const rows = await query<{ id: number }>(`SELECT id FROM LichSanXuat WHERE idDonHang = @idDonHang`, { idDonHang });
    const lichSXId = rows[0]?.id;
    if (!lichSXId) {
      res.status(404).json({ success: false, message: 'Không tìm thấy lịch sản xuất cho đơn hàng này' });
      return;
    }

    const updates: string[] = [];
    const params: Record<string, unknown> = { idDonHang };

    if (kyThuatCongTrinh !== undefined) {
      updates.push('kyThuatCongTrinh = @kyThuatCongTrinh');
      params.kyThuatCongTrinh = kyThuatCongTrinh || null;
    }
    if (nguoiOmOng !== undefined) {
      updates.push('nguoiOmOng = @nguoiOmOng');
      params.nguoiOmOng = nguoiOmOng || null;
    }
    if (nguoiBatOng !== undefined) {
      updates.push('nguoiBatOng = @nguoiBatOng');
      params.nguoiBatOng = nguoiBatOng || null;
    }

    if (updates.length > 0) {
      updates.push('ngayCapNhat = GETDATE()');
      await query(
        `UPDATE LichSanXuat SET ${updates.join(', ')} WHERE idDonHang = @idDonHang`,
        params
      );
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    await ghiNhatKy(req.user?.id ?? null, 'SUA', 'LichSanXuat', lichSXId,
      undefined,
      JSON.stringify({ kyThuatCongTrinh, nguoiOmOng, nguoiBatOng }),
      ip);

    res.json({ success: true, message: 'Cập nhật thông tin nghiệm thu thành công', data: { kyThuatCongTrinh, nguoiOmOng, nguoiBatOng } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật thông tin nghiệm thu';
    res.status(500).json({ success: false, message });
  }
});

export default router;
