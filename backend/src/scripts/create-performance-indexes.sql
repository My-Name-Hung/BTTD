-- ============================================================
-- SQL PERFORMANCE OPTIMIZATION - BÊ TÔNG TÂY ĐÔ
-- Created: 2026-06-05
-- Purpose: Tạo indexes để tăng tốc độ truy vấn
-- ============================================================

-- ============================================================
-- 1. DON HANG INDEXES
-- ============================================================

-- Index cho phân trang theo ngày tạo và trạng thái
CREATE NONCLUSTERED INDEX IX_DonHang_NgayTao_TrangThai
ON DonHang(ngayTao DESC, trangThaiDon)
INCLUDE (idKhachHang, tongTien, thanhTien, conLai, maDonHang, tenKhachHang);

-- Index cho tìm kiếm theo trạng thái (dashboard counts)
CREATE NONCLUSTERED INDEX IX_DonHang_TrangThai
ON DonHang(trangThaiDon)
INCLUDE (id);

-- Index cho tìm kiếm theo khách hàng
CREATE NONCLUSTERED INDEX IX_DonHang_KhachHang
ON DonHang(idKhachHang)
INCLUDE (ngayTao, trangThaiDon, tongTien, thanhTien);

-- Index cho tìm kiếm theo mã đơn hàng
CREATE NONCLUSTERED INDEX IX_DonHang_MaDonHang
ON DonHang(maDonHang);

-- Index cho tìm kiếm theo người tạo (sales xem đơn của mình)
CREATE NONCLUSTERED INDEX IX_DonHang_NguoiTao
ON DonHang(nguoiTaoId)
INCLUDE (ngayTao, trangThaiDon);

-- Index cho tìm kiếm theo trạm trộn
CREATE NONCLUSTERED INDEX IX_DonHang_TramTron
ON DonHang(idTramTron)
INCLUDE (ngayTao, trangThaiDon);

-- Index cho tìm kiếm theo ngày tạo (doanh thu theo tháng)
CREATE NONCLUSTERED INDEX IX_DonHang_NgayTao
ON DonHang(ngayTao DESC)
INCLUDE (trangThaiDon, thanhTien, tenMacBeTong);

-- Index cho tìm kiếm theo trạng thái hoàn thành
CREATE NONCLUSTERED INDEX IX_DonHang_TrangThaiHoanThanh
ON DonHang(trangThaiHoanThanh)
INCLUDE (id);

-- ============================================================
-- 2. LICH SAN XUAT INDEXES
-- ============================================================

-- Index cho tìm lịch sử theo đơn hàng (đã optimize để thay thế correlated subquery)
CREATE NONCLUSTERED INDEX IX_LichSanXuat_DonHang_Ngay
ON LichSanXuat(idDonHang, ngayTao DESC)
INCLUDE (idXe, idTaiXe, idTramTron, trangThai, bienSoXe);

-- Index cho tìm kiếm theo ngày
CREATE NONCLUSTERED INDEX IX_LichSanXuat_NgayTao
ON LichSanXuat(ngayTao DESC)
INCLUDE (idDonHang, idXe);

-- Index cho tìm kiếm theo xe
CREATE NONCLUSTERED INDEX IX_LichSanXuat_Xe
ON LichSanXuat(idXe)
INCLUDE (idDonHang, ngayTao);

-- ============================================================
-- 3. CONG NO INDEXES
-- ============================================================

-- Index cho tìm công nợ theo đơn hàng
CREATE NONCLUSTERED INDEX IX_CongNo_DonHang
ON CongNo(idDonHang)
INCLUDE (soTien, conLai, ngayThanhToan, loaiThanhToan, trangThai);

-- Index cho tìm công nợ theo trạng thái
CREATE NONCLUSTERED INDEX IX_CongNo_TrangThai
ON CongNo(trangThai)
INCLUDE (id, idDonHang, conLai);

-- ============================================================
-- 4. THANH TOAN INDEXES
-- ============================================================

-- Index cho tìm thanh toán theo đơn hàng
CREATE NONCLUSTERED INDEX IX_ThanhToan_DonHang
ON ThanhToan(idDonHang, ngayThanhToan DESC)
INCLUDE (soTien, loaiThanhToan, ghiChu);

-- ============================================================
-- 5. HOA DON INDEXES
-- ============================================================

-- Index cho tìm hóa đơn theo đơn hàng
CREATE NONCLUSTERED INDEX IX_HoaDon_DonHang
ON HoaDon(idDonHang)
INCLUDE (ngayTao, tongTien, thue, giamTru);

-- ============================================================
-- 6. NGHIEM THU INDEXES
-- ============================================================

-- Index cho tìm nghiệm thu theo đơn hàng
CREATE NONCLUSTERED INDEX IX_NghiemThu_DonHang
ON NghiemThu(idDonHang)
INCLUDE (ngayNghiemThu, ketQua, tenNguoiNghiemThu);

-- ============================================================
-- 7. NGUOI DUNG INDEXES
-- ============================================================

-- Index cho tìm người dùng theo vai trò
CREATE NONCLUSTERED INDEX IX_NguoiDung_VaiTro
ON NguoiDung(vaiTro)
INCLUDE (id, hoTen, tenDangNhap);

-- ============================================================
-- 8. XE INDEXES
-- ============================================================

-- Index cho tìm xe theo trạm trộn
CREATE NONCLUSTERED INDEX IX_Xe_TramTron
ON Xe(idTramTron)
INCLUDE (bienSo, tenTaiXe);

-- ============================================================
-- 9. THONG BAO INDEXES
-- ============================================================

-- Index cho tìm thông báo theo người dùng và trạng thái đọc
CREATE NONCLUSTERED INDEX IX_ThongBao_NguoiDung_DaDoc
ON ThongBao(idNguoiNhan, daDoc, ngayTao DESC)
INCLUDE (id, tieuDe, noiDung, loai);

-- ============================================================
-- 10. LOGIN SESSION INDEXES
-- ============================================================

-- Index cho tìm session theo người dùng
CREATE NONCLUSTERED INDEX IX_LoginSession_NguoiDung
ON LoginSession(idNguoiDung, ngayDangNhap DESC)
INCLUDE (id, diaChiIP, userAgent);

-- ============================================================
-- 11. NHAT KY HE THONG INDEXES
-- ============================================================

-- Index cho tìm nhật ký theo người dùng và thời gian
CREATE NONCLUSTERED INDEX IX_NhatKy_NguoiDung_Ngay
ON NhatKyHeThong(idNguoiDung, ngayTao DESC)
INCLUDE (id, hanhDong, bang, idBang);

-- ============================================================
-- KẾT QUẢ
-- ============================================================
-- Sau khi chạy script này, các truy vấn sẽ:
-- 1. Sử dụng index seek thay vì table scan
-- 2. Correlated subquery trong layDonHangGiaoHang sẽ nhanh hơn nhờ index trên LichSanXuat
-- 3. GROUP BY và ORDER BY sẽ được hỗ trợ bởi indexes
-- 4. JOINs sẽ hiệu quả hơn với included columns
