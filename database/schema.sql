# ============================================================
# DATABASE SCHEMA – BÊ TÔNG TÂY ĐÔ
# ============================================================
-- Chạy script này trên SQL Server để tạo database nếu server lỗi

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'DBXMTD')
BEGIN
    CREATE DATABASE DBXMTD;
END
GO

USE DBXMTD;
GO

-- ============================================================
-- Bảng người dùng
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NguoiDung')
BEGIN
    CREATE TABLE NguoiDung (
        id INT IDENTITY(1,1) PRIMARY KEY,
        tenDangNhap NVARCHAR(100) NOT NULL UNIQUE,
        matKhau NVARCHAR(255) NOT NULL,
        hoTen NVARCHAR(200) NOT NULL,
        email NVARCHAR(200),
        soDienThoai NVARCHAR(20),
        vaiTro NVARCHAR(50) NOT NULL, -- 'admin', 'ke_toan', 'dieu_phoi', 'lanh_dao'
        trangThai NVARCHAR(20) DEFAULT N'hoat_dong', -- 'hoat_dong', 'khong_hoat_dong'
        ngayTao DATETIME DEFAULT GETDATE(),
        ngayCapNhat DATETIME DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- Bảng khách hàng
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'KhachHang')
BEGIN
    CREATE TABLE KhachHang (
        id INT IDENTITY(1,1) PRIMARY KEY,
        tenKhachHang NVARCHAR(200) NOT NULL,
        diaChi NVARCHAR(500),
        soDienThoai NVARCHAR(20),
        email NVARCHAR(200),
        ghiChu NVARCHAR(MAX),
        ngayTao DATETIME DEFAULT GETDATE(),
        ngayCapNhat DATETIME DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- Bảng mác bê tông
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MacBeTong')
BEGIN
    CREATE TABLE MacBeTong (
        id INT IDENTITY(1,1) PRIMARY KEY,
        tenMac NVARCHAR(100) NOT NULL, -- VD: M250, M300, M350
        donGia DECIMAL(18,2) NOT NULL DEFAULT 0,
        moTa NVARCHAR(500),
        trangThai NVARCHAR(20) DEFAULT N'hoat_dong',
        ngayTao DATETIME DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- Bảng trạm trộn
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tram Tron')
BEGIN
    CREATE TABLE TramTron (
        id INT IDENTITY(1,1) PRIMARY KEY,
        tenTram NVARCHAR(200) NOT NULL,
        diaChi NVARCHAR(500),
        soDienThoai NVARCHAR(20),
        trangThai NVARCHAR(20) DEFAULT N'hoat_dong',
        ngayTao DATETIME DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- Bảng xe
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Xe')
BEGIN
    CREATE TABLE Xe (
        id INT IDENTITY(1,1) PRIMARY KEY,
        bienSo NVARCHAR(50) NOT NULL,
        tenTaiXe NVARCHAR(200),
        soDienThoaiTaiXe NVARCHAR(20),
        taiTrong DECIMAL(18,2), -- tấn
        trangThai NVARCHAR(20) DEFAULT N'hoat_dong', -- 'san_sang', 'dang_giao', 'bao_tri'
        ngayTao DATETIME DEFAULT GETDATE()
    );
END
GO

-- ============================================================
-- Bảng đơn hàng
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DonHang')
BEGIN
    CREATE TABLE DonHang (
        id INT IDENTITY(1,1) PRIMARY KEY,
        maDonHang NVARCHAR(50) NOT NULL UNIQUE,
        idKhachHang INT,
        idMacBeTong INT,
        idTramTron INT,

        -- Thông tin đơn
        tenKhachHang NVARCHAR(200) NOT NULL,
        diaChiNhan NVARCHAR(500) NOT NULL,
        soDienThoai NVARCHAR(20) NOT NULL,

        -- Sản phẩm
        tenMacBeTong NVARCHAR(100),
        khoiLuongDat DECIMAL(18,2) NOT NULL, -- khối lượng đặt (m3)
        khoiLuongThucTe DECIMAL(18,2), -- khối lượng thực tế
        donGia DECIMAL(18,2) NOT NULL,
        thanhTien DECIMAL(18,2),

        -- Thời gian
        thoiGianGiaoDuKien DATETIME,
        ngayTaoDon DATETIME DEFAULT GETDATE(),
        ngayDuyet DATETIME,
        ngayGiao DATETIME,
        ngayNghiemThu DATETIME,

        -- Trạng thái đơn
        trangThaiDon NVARCHAR(50) DEFAULT N'cho_duyet',
        -- 'cho_duyet' -> 'da_duyet' -> 'dang_san_xuat' -> 'dang_giao' -> 'da_giao' -> 'nghiem_thu' -> 'da_thanh_toan'
        trangThaiHoanThanh NVARCHAR(50) DEFAULT N'chua_hoan_thanh',
        -- 'chua_hoan_thanh', 'dang_hoan_thanh', 'da_hoan_thanh'

        -- Phê duyệt
        nguoiTaoId INT,
        nguoiDuyetId INT,
        ghiChu NVARCHAR(MAX),
        lyDoTuChoi NVARCHAR(500),

        -- Công nợ
        daThanhToan DECIMAL(18,2) DEFAULT 0,
        conLai DECIMAL(18,2),

        ngayTao DATETIME DEFAULT GETDATE(),
        ngayCapNhat DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (idKhachHang) REFERENCES KhachHang(id),
        FOREIGN KEY (idMacBeTong) REFERENCES MacBeTong(id),
        FOREIGN KEY (idTramTron) REFERENCES TramTron(id),
        FOREIGN KEY (nguoiTaoId) REFERENCES NguoiDung(id),
        FOREIGN KEY (nguoiDuyetId) REFERENCES NguoiDung(id)
    );
END
GO

-- ============================================================
-- Bảng lịch sản xuất
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LichSanXuat')
BEGIN
    CREATE TABLE LichSanXuat (
        id INT IDENTITY(1,1) PRIMARY KEY,
        idDonHang INT NOT NULL,
        idXe INT,

        -- Kỹ thuật
        kyThuatCongTrinh NVARCHAR(200),
        nguoiOmOng NVARCHAR(200),
        nguoiBatOng NVARCHAR(200),
        phuongAnDo NVARCHAR(500),

        -- Thông tin xe
        bienSoXe NVARCHAR(50),

        -- Thời gian
        thoiGianTron DATETIME,
        thoiGianXuatBen DATETIME,
        thoiGianDenCangDat DATETIME,
        thoiGianBatDauDo DATETIME,
        thoiGianKetThucDo DATETIME,

        -- Ghi chú
        ghiChu NVARCHAR(MAX),

        -- Google Drive link
        driveLink NVARCHAR(500),

        trangThai NVARCHAR(50) DEFAULT N'chua_san_xuat',
        -- 'chua_san_xuat', 'dang_san_xuat', 'da_xong'

        ngayTao DATETIME DEFAULT GETDATE(),
        ngayCapNhat DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (idDonHang) REFERENCES DonHang(id),
        FOREIGN KEY (idXe) REFERENCES Xe(id)
    );
END
GO

-- ============================================================
-- Bảng nghiệm thu
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NghiemThu')
BEGIN
    CREATE TABLE NghiemThu (
        id INT IDENTITY(1,1) PRIMARY KEY,
        idDonHang INT NOT NULL,

        -- Khối lượng
        khoiLuongXacNhan DECIMAL(18,2),
        khoiLuongThucTe DECIMAL(18,2),
        chatLuong NVARCHAR(100), -- 'dat', 'khong_dat'

        -- Biên bản
        bienBanFile NVARCHAR(500), -- đường dẫn file
        bienBanSo NVARCHAR(100),
        ngayLapBienBan DATETIME,

        -- Người ký
        nguoiLap NVARCHAR(200),
        nguoiKy NVARCHAR(200),
        chucVu NVARCHAR(200),

        -- Xác nhận
        daGuiKhach BIT DEFAULT 0,
        ngayGuiKhach DATETIME,

        ghiChu NVARCHAR(MAX),
        ngayTao DATETIME DEFAULT GETDATE(),
        ngayCapNhat DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (idDonHang) REFERENCES DonHang(id)
    );
END
GO

-- ============================================================
-- Bảng thanh toán
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ThanhToan')
BEGIN
    CREATE TABLE ThanhToan (
        id INT IDENTITY(1,1) PRIMARY KEY,
        idDonHang INT NOT NULL,

        soTien DECIMAL(18,2) NOT NULL,
        hinhThuc NVARCHAR(50), -- 'tien_mat', 'chuyen_khoan', 'truct_hop_dong'
        ngayThanhToan DATETIME DEFAULT GETDATE(),
        nguoiNhan NVARCHAR(200),
        ghiChu NVARCHAR(MAX),

        nguoiTaoId INT,
        ngayTao DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (idDonHang) REFERENCES DonHang(id),
        FOREIGN KEY (nguoiTaoId) REFERENCES NguoiDung(id)
    );
END
GO

-- ============================================================
-- Bảng công nợ
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CongNo')
BEGIN
    CREATE TABLE CongNo (
        id INT IDENTITY(1,1) PRIMARY KEY,
        idDonHang INT NOT NULL,

        tongTien DECIMAL(18,2) NOT NULL,
        daThanhToan DECIMAL(18,2) DEFAULT 0,
        conLai DECIMAL(18,2),

        ngayBatDau DATE,
        hanThanhToan DATE,
        trangThai NVARCHAR(50) DEFAULT N'chua_thanh_toan',
        -- 'chua_thanh_toan', 'dang_thanh_toan', 'da_thanh_toan', 'qua_han'

        ghiChu NVARCHAR(MAX),
        ngayTao DATETIME DEFAULT GETDATE(),
        ngayCapNhat DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (idDonHang) REFERENCES DonHang(id)
    );
END
GO

-- ============================================================
-- Bảng nhật ký hệ thống
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NhatKyHeThong')
BEGIN
    CREATE TABLE NhatKyHeThong (
        id INT IDENTITY(1,1) PRIMARY KEY,
        idNguoiDung INT,
        hanhDong NVARCHAR(200) NOT NULL,
        bangDuocTacDong NVARCHAR(100),
        banGhiId INT,
        noiDungCu NVARCHAR(MAX),
        noiDungMoi NVARCHAR(MAX),
        ipAddress NVARCHAR(50),
        thoiGian DATETIME DEFAULT GETDATE(),

        FOREIGN KEY (idNguoiDung) REFERENCES NguoiDung(id)
    );
END
GO

-- ============================================================
-- INSERT DỮ LIỆU MẪU
-- ============================================================

-- Người dùng mặc định (mật khẩu: Admin@123)
INSERT INTO NguoiDung (tenDangNhap, matKhau, hoTen, email, vaiTro)
VALUES
(N'admin', 'Admin@123', N'Quản trị viên', 'thanhhung11112002@gmail.com', 'admin'),
(N'ketoan', 'Ketoan@123', N'Nguyễn Thị Kế Toán', 'ketoan@betongtaydo.com', 'ke_toan'),
(N'dieuphoi', 'Dieuphoi@123', N'Trần Văn Điều Phối', 'dieuphoi@betongtaydo.com', 'dieu_phoi'),
(N'lanhdao', 'Lanhdao@123', N'Giám đốc Lãnh Đạo', 'lanhdao@betongtaydo.com', 'lanh_dao');

-- Mác bê tông mẫu
INSERT INTO MacBeTong (tenMac, donGia, moTa)
VALUES
(N'M250', 1200000, N'Mác bê tông 250 - Công trình dân dụng'),
(N'M300', 1300000, N'Mác bê tông 300 - Công trình dân dụng cao cấp'),
(N'M350', 1400000, N'Mác bê tông 350 - Công trình công nghiệp'),
(N'M400', 1500000, N'Mác bê tông 400 - Công trình nặng'),
(N'M450', 1600000, N'Mác bê tông 450 - Công trình đặc biệt');

-- Trạm trộn mẫu
INSERT INTO TramTron (tenTram, diaChi, soDienThoai)
VALUES
(N'Trạm trộn số 1', N'123 Đường ABC, Quận 1, TP.HCM', N'02812345678'),
(N'Trạm trộn số 2', N'456 Đường XYZ, Quận 2, TP.HCM', N'02823456789'),
(N'Trạm trộn số 3', N'789 Đường DEF, Quận 9, TP.HCM', N'02834567890');

-- Xe mẫu
INSERT INTO Xe (bienSo, tenTaiXe, soDienThoaiTaiXe, taiTrong, trangThai)
VALUES
(N'59C1-12345', N'Lê Văn Tài', N'0901234567', 10, N'san_sang'),
(N'59C2-23456', N'Phạm Văn Xe', N'0902345678', 12, N'san_sang'),
(N'59C3-34567', N'Hoàng Văn Lái', N'0903456789', 8, N'dang_giao'),
(N'59C4-45678', N'Nguyễn Văn Chauffeur', N'0904567890', 10, N'san_sang');
