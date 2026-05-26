import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth';
import { ApiResponse } from '../models';
import {
  layTatCaKhachHang,
  taoKhachHang,
  suaKhachHang,
  xoaKhachHang,
  layTatCaMacBeTong,
  taoMacBeTong,
  suaMacBeTong,
  layTatCaTramTron,
  layTatCaXe,
  taoXe,
  suaXe,
  xoaXe,
} from '../services/tham-so-service';
import { query } from '../config/database';

const router = Router();

// Khách hàng
router.get('/khach-hang', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const tuKhoa = req.query.tuKhoa as string | undefined;
    const result = await layTatCaKhachHang(page, limit, tuKhoa);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy khách hàng';
    res.status(500).json({ success: false, message });
  }
});

router.post('/khach-hang', authMiddleware, requireRole('admin', 'ke_toan', 'dieu_phoi', 'sale'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const kh = await taoKhachHang(req.body);
    res.status(201).json({ success: true, message: 'Tạo khách hàng thành công', data: kh });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo khách hàng';
    res.status(500).json({ success: false, message });
  }
});

router.put('/khach-hang/:id', authMiddleware, requireRole('admin', 'ke_toan'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const kh = await suaKhachHang(id, req.body);
    res.json({ success: true, message: 'Cập nhật khách hàng thành công', data: kh });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật khách hàng';
    res.status(400).json({ success: false, message });
  }
});

router.delete('/khach-hang/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    await xoaKhachHang(id);
    res.json({ success: true, message: 'Xóa khách hàng thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa khách hàng';
    res.status(400).json({ success: false, message });
  }
});

// Mác bê tông
router.get('/mac-be-tong', authMiddleware, async (_req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const data = await layTatCaMacBeTong();
    res.json({ success: true, message: 'Lấy danh sách mác bê tông thành công', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy mác bê tông';
    res.status(500).json({ success: false, message });
  }
});

router.post('/mac-be-tong', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const mac = await taoMacBeTong(req.body);
    res.status(201).json({ success: true, message: 'Tạo mác bê tông thành công', data: mac });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo mác bê tông';
    res.status(500).json({ success: false, message });
  }
});

router.put('/mac-be-tong/:id', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const mac = await suaMacBeTong(id, req.body);
    res.json({ success: true, message: 'Cập nhật mác bê tông thành công', data: mac });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật mác bê tông';
    res.status(400).json({ success: false, message });
  }
});

// Trạm trộn
router.get('/tram-tron', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const tuKhoa = req.query.tuKhoa as string | undefined;
    const trangThai = req.query.trangThai as string | undefined;
    const result = await layTatCaTramTron(tuKhoa, trangThai, page, limit);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy trạm trộn';
    res.status(500).json({ success: false, message });
  }
});

router.post('/tram-tron', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const { tenTram, diaChi, soDienThoai } = req.body;
    const result = await query(
      `INSERT INTO TramTron (tenTram, diaChi, soDienThoai)
       OUTPUT INSERTED.id, INSERTED.tenTram, INSERTED.diaChi, INSERTED.soDienThoai, INSERTED.trangThai
       VALUES (@tenTram, @diaChi, @soDienThoai)`,
      { tenTram, diaChi: diaChi || null, soDienThoai: soDienThoai || null }
    );
    res.status(201).json({ success: true, message: 'Tạo trạm trộn thành công', data: result[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo trạm trộn';
    res.status(500).json({ success: false, message });
  }
});

router.put('/tram-tron/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { tenTram, diaChi, soDienThoai, trangThai } = req.body;
    await query(
      `UPDATE TramTron SET tenTram = @tenTram, diaChi = @diaChi, soDienThoai = @soDienThoai, trangThai = @trangThai WHERE id = @id`,
      { tenTram, diaChi: diaChi || null, soDienThoai: soDienThoai || null, trangThai: trangThai || 'hoat_dong', id }
    );
    const result = await query<any[]>(`SELECT * FROM TramTron WHERE id = @id`, { id });
    if (!result[0]) {
      res.status(404).json({ success: false, message: 'Không tìm thấy trạm trộn' });
      return;
    }
    res.json({ success: true, message: 'Cập nhật trạm trộn thành công', data: result[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật trạm trộn';
    res.status(500).json({ success: false, message });
  }
});

router.delete('/tram-tron/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM TramTron WHERE id = @id', { id });
    res.json({ success: true, message: 'Xóa trạm trộn thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa trạm trộn';
    res.status(500).json({ success: false, message });
  }
});

// Xe
router.get('/xe', authMiddleware, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const trangThai = req.query.trangThai as string | undefined;
    const result = await layTatCaXe(trangThai, page, limit);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách xe';
    res.status(500).json({ success: false, message });
  }
});

router.post('/xe', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const xe = await taoXe(req.body);
    res.status(201).json({ success: true, message: 'Tạo xe thành công', data: xe });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi tạo xe';
    res.status(500).json({ success: false, message });
  }
});

router.put('/xe/:id', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    const xe = await suaXe(id, req.body);
    res.json({ success: true, message: 'Cập nhật xe thành công', data: xe });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cập nhật xe';
    res.status(400).json({ success: false, message });
  }
});

router.delete('/xe/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    await xoaXe(id);
    res.json({ success: true, message: 'Xóa xe thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa xe';
    res.status(500).json({ success: false, message });
  }
});

router.delete('/mac-be-tong/:id', authMiddleware, requireRole('admin', 'dieu_phoi'), async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM MacBeTong WHERE id = @id', { id });
    res.json({ success: true, message: 'Xóa mác bê tông thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi xóa mác bê tông';
    res.status(500).json({ success: false, message });
  }
});

export default router;
