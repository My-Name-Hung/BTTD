-- ImportHistory table
CREATE TABLE ImportHistory (
  id INT IDENTITY(1,1) PRIMARY KEY,
  loai NVARCHAR(50) NOT NULL,
  tenFile NVARCHAR(255) NOT NULL,
  tongSo INT NOT NULL DEFAULT 0,
  thanhCong INT NOT NULL DEFAULT 0,
  thatBai INT NOT NULL DEFAULT 0,
  nguoiTaiId INT NOT NULL,
  ngayTai DATETIME NOT NULL DEFAULT GETDATE()
);

-- DonHang table indexes
CREATE NONCLUSTERED INDEX IX_DonHang_trangThaiDon ON DonHang(trangThaiDon);
CREATE NONCLUSTERED INDEX IX_DonHang_ngayTao ON DonHang(ngayTao DESC);
CREATE NONCLUSTERED INDEX IX_DonHang_trangThaiDon_ngayTao ON DonHang(trangThaiDon, ngayTao DESC);

-- CongNo indexes
CREATE NONCLUSTERED INDEX IX_CongNo_trangThai ON CongNo(trangThai);

-- LichSanXuat indexes
CREATE NONCLUSTERED INDEX IX_LichSanXuat_idDonHang ON LichSanXuat(idDonHang);
CREATE NONCLUSTERED INDEX IX_LichSanXuat_trangThai ON LichSanXuat(trangThai);

-- Composite for dashboard
CREATE NONCLUSTERED INDEX IX_DonHang_trangThaiDon_thanhtien ON DonHang(trangThaiDon) INCLUDE (thanhTien, conLai);