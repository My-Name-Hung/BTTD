import mssql from "mssql";
import { config } from "./index";
import { xoaLichSuImportCu } from "../services/import-service";

async function initDatabase(): Promise<void> {
  console.log("\n📦 Đang khởi tạo database...");

  try {
    const pool = await mssql.connect({
      server: config.db.server,
      port: config.db.port,
      database: "master",
      user: config.db.user,
      password: config.db.password,
      options: {
        encrypt: config.db.encrypt,
        trustServerCertificate: config.db.trustServerCertificate,
      },
    });

    const request = pool.request();

    // Tạo database nếu chưa có
    console.log("  🔄 Kiểm tra database DBXMTD...");
    const dbExists = await request.query<{ name: string }[]>(
      `SELECT name FROM sys.databases WHERE name = 'DBXMTD'`,
    );

    if (dbExists.recordset.length === 0) {
      console.log("  ➕ Tạo database DBXMTD...");
      await request.query("CREATE DATABASE DBXMTD");
    } else {
      console.log("  ✅ Database DBXMTD đã tồn tại");
    }

    await pool.close();

    // Kết nối vào DBXMTD để tạo bảng
    const dbPool = await mssql.connect({
      server: config.db.server,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      options: {
        encrypt: config.db.encrypt,
        trustServerCertificate: config.db.trustServerCertificate,
      },
    });

    const db = dbPool;

    console.log("  🔄 Kiểm tra bảng hệ thống...");

    // Tạo bảng NguoiDung
    const nguoiDungExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'NguoiDung'`,
    );
    if (nguoiDungExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng NguoiDung...");
      await db.query(`
        CREATE TABLE NguoiDung (
          id INT IDENTITY(1,1) PRIMARY KEY,
          tenDangNhap NVARCHAR(100) NOT NULL UNIQUE,
          matKhau NVARCHAR(255) NOT NULL,
          hoTen NVARCHAR(200) NOT NULL,
          email NVARCHAR(200),
          soDienThoai NVARCHAR(20),
          vaiTro NVARCHAR(50) NOT NULL,
          idTramTron INT NULL,
          trangThai NVARCHAR(20) DEFAULT N'hoat_dong',
          bannedIp NVARCHAR(500) NULL,
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng NguoiDung đã tồn tại");
      // Migration: thêm cột idTramTron nếu chưa có
      const colTram = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'idTramTron'`,
      );
      if (colTram.recordset.length === 0) {
        await db.query(`ALTER TABLE NguoiDung ADD idTramTron INT NULL`);
        console.log("  + Cột idTramTron đã thêm vào NguoiDung");
      }
      // Migration: thêm cột bannedIp nếu chưa có
      const colBan = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'bannedIp'`,
      );
      if (colBan.recordset.length === 0) {
        await db.query(`ALTER TABLE NguoiDung ADD bannedIp NVARCHAR(500) NULL`);
        console.log("  + Cột bannedIp đã thêm vào NguoiDung");
      }
    }

    // Tạo bảng LoginSession (lịch sử đăng nhập)
    const lsExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'LoginSession'`,
    );
    if (lsExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng LoginSession...");
      await db.query(`
        CREATE TABLE LoginSession (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idNguoiDung INT NOT NULL,
          tokenHash NVARCHAR(255),
          ipAddress NVARCHAR(45),
          userAgent NVARCHAR(500),
          thaoTac NVARCHAR(20) NOT NULL,
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayKetThuc DATETIME,
          FOREIGN KEY (idNguoiDung) REFERENCES NguoiDung(id)
        )
      `);
      console.log("  ✅ Bảng LoginSession đã tạo");
    } else {
      console.log("  ✅ Bảng LoginSession đã tồn tại");
    }

    // Tạo bảng NhatKyHeThong (log thao tác)
    const nkExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'NhatKyHeThong'`,
    );
    if (nkExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng NhatKyHeThong...");
      await db.query(`
        CREATE TABLE NhatKyHeThong (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idNguoiDung INT,
          hanhDong NVARCHAR(100) NOT NULL,
          bangDuocTacDong NVARCHAR(100),
          banGhiId INT,
          noiDungCu NVARCHAR(MAX),
          noiDungMoi NVARCHAR(MAX),
          ipAddress NVARCHAR(45),
          thoiGian DATETIME DEFAULT GETDATE()
        )
      `);
      console.log("  ✅ Bảng NhatKyHeThong đã tạo");
    } else {
      console.log("  ✅ Bảng NhatKyHeThong đã tồn tại");
    }

    // Tạo bảng KhachHang
    const khachHangExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'KhachHang'`,
    );
    if (khachHangExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng KhachHang...");
      await db.query(`
        CREATE TABLE KhachHang (
          id INT IDENTITY(1,1) PRIMARY KEY,
          maKhachHang NVARCHAR(50),
          tenKhachHang NVARCHAR(200) NOT NULL,
          diaChi NVARCHAR(500),
          soDienThoai NVARCHAR(20),
          email NVARCHAR(200),
          ghiChu NVARCHAR(MAX),
          nhom NVARCHAR(200),
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng KhachHang đã tồn tại");
      // Migration: thêm cột maKhachHang nếu chưa có
      const colMaKH = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('KhachHang') AND name = 'maKhachHang'`,
      );
      if (colMaKH.recordset.length === 0) {
        await db.query(`ALTER TABLE KhachHang ADD maKhachHang NVARCHAR(50)`);
        console.log("  + Cột maKhachHang đã thêm vào KhachHang");
      }
      // Migration: thêm cột nhom nếu chưa có
      const colNhom = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('KhachHang') AND name = 'nhom'`,
      );
      if (colNhom.recordset.length === 0) {
        await db.query(`ALTER TABLE KhachHang ADD nhom NVARCHAR(200)`);
        console.log("  + Cột nhom đã thêm vào KhachHang");
      }
    }

    // Tạo bảng CauHinh (key/value store cho cấu hình hệ thống)
    const cauHinhExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'CauHinh'`,
    );
    if (cauHinhExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng CauHinh...");
      await db.query(`
        CREATE TABLE CauHinh (
          id INT IDENTITY(1,1) PRIMARY KEY,
          khoa NVARCHAR(100) NOT NULL UNIQUE,
          giaTri NVARCHAR(MAX) NOT NULL,
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
      console.log("  ✅ Bảng CauHinh đã tạo");
    } else {
      console.log("  ✅ Bảng CauHinh đã tồn tại");
    }

    // Tạo bảng MacBeTong
    const macBeTongExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'MacBeTong'`,
    );
    if (macBeTongExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng MacBeTong...");
      await db.query(`
        CREATE TABLE MacBeTong (
          id INT IDENTITY(1,1) PRIMARY KEY,
          tenMac NVARCHAR(100) NOT NULL,
          donGia DECIMAL(18,2) NOT NULL DEFAULT 0,
          chiPhiPhatSinh DECIMAL(18,2) NOT NULL DEFAULT 0,
          buVanChuyen DECIMAL(18,2) NOT NULL DEFAULT 0,
          moTa NVARCHAR(500),
          trangThai NVARCHAR(20) DEFAULT N'hoat_dong',
          ngayTao DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng MacBeTong đã tồn tại");
      // Thêm cột mới nếu chưa có (cho DB đã tồn tại)
      try {
        const cols = await db.query<{ COLUMN_NAME: string }[]>(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MacBeTong'`,
        );
        const colNames = cols.recordset.map((c) => c.COLUMN_NAME.toLowerCase());
        if (!colNames.includes("dongia")) {
          await db.query(
            `ALTER TABLE MacBeTong ADD donGia DECIMAL(18,2) NOT NULL DEFAULT 0`,
          );
          console.log("  ➕ Thêm cột donGia vào MacBeTong");
        }
        if (!colNames.includes("chiphiphatsinh")) {
          await db.query(
            `ALTER TABLE MacBeTong ADD chiPhiPhatSinh DECIMAL(18,2) NOT NULL DEFAULT 0`,
          );
          console.log("  ➕ Thêm cột chiPhiPhatSinh vào MacBeTong");
        }
        if (!colNames.includes("buvanchuyen")) {
          await db.query(
            `ALTER TABLE MacBeTong ADD buVanChuyen DECIMAL(18,2) NOT NULL DEFAULT 0`,
          );
          console.log("  ➕ Thêm cột buVanChuyen vào MacBeTong");
        }
      } catch (e) {
        /* columns may already exist */
      }
    }

    // Tạo bảng TramTron
    const tramTronExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'TramTron'`,
    );
    if (tramTronExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng TramTron...");
      await db.query(`
        CREATE TABLE TramTron (
          id INT IDENTITY(1,1) PRIMARY KEY,
          tenTram NVARCHAR(200) NOT NULL,
          diaChi NVARCHAR(500),
          soDienThoai NVARCHAR(20),
          trangThai NVARCHAR(20) DEFAULT N'hoat_dong',
          ngayTao DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng TramTron đã tồn tại");
    }

    // Tạo bảng Xe
    const xeExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'Xe'`,
    );
    if (xeExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng Xe...");
      await db.query(`
        CREATE TABLE Xe (
          id INT IDENTITY(1,1) PRIMARY KEY,
          bienSo NVARCHAR(50) NOT NULL,
          tenTaiXe NVARCHAR(200),
          soDienThoaiTaiXe NVARCHAR(20),
          taiTrong DECIMAL(18,2),
          trangThai NVARCHAR(20) DEFAULT N'san_sang',
          ngayTao DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng Xe đã tồn tại");
      // Migration: thêm cột idTaiKhoan nếu chưa có
      try {
        await db.query(`ALTER TABLE Xe ADD idTaiKhoan INT`);
        console.log("  ➕ Cột idTaiKhoan đã được thêm vào bảng Xe");
      } catch {
        // đã có rồi, bỏ qua
      }
      // Migration: thêm cột idTaiXe vào LichSanXuat nếu chưa có
      try {
        await db.query(`ALTER TABLE LichSanXuat ADD idTaiXe INT`);
        console.log("  ➕ Cột idTaiXe đã được thêm vào bảng LichSanXuat");
      } catch {
        // đã có rồi, bỏ qua
      }

      // Fix dữ liệu cũ: cập nhật idTaiXe trong LichSanXuat từ bảng Xe
      try {
        await db.query(`
          UPDATE ls SET ls.idTaiXe = xe.idTaiKhoan
          FROM LichSanXuat ls
          INNER JOIN Xe xe ON ls.idXe = xe.id
          WHERE ls.idTaiXe IS NULL AND xe.idTaiKhoan IS NOT NULL
        `);
        console.log("  🔧 Đã fix idTaiXe cho các lịch sản xuất cũ");
      } catch {
        // lỗi thì bỏ qua
      }
    }

    // Tạo bảng DonHang
    const donHangExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'DonHang'`,
    );
    if (donHangExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng DonHang...");
      await db.query(`
        CREATE TABLE DonHang (
          id INT IDENTITY(1,1) PRIMARY KEY,
          maDonHang NVARCHAR(50) NOT NULL UNIQUE,
          idKhachHang INT,
          idMacBeTong INT,
          idTramTron INT,
          tenKhachHang NVARCHAR(200) NOT NULL,
          diaChiNhan NVARCHAR(500) NOT NULL,
          soDienThoai NVARCHAR(20) NOT NULL,
          tenMacBeTong NVARCHAR(100),
          khoiLuongDat DECIMAL(18,2) NOT NULL,
          khoiLuongThucTe DECIMAL(18,2),
          donGia DECIMAL(18,2) NOT NULL,
          chiPhiPhatSinh DECIMAL(18,2) NOT NULL DEFAULT 0,
          buVanChuyen DECIMAL(18,2) NOT NULL DEFAULT 0,
          thanhTien DECIMAL(18,2),
          thoiGianGiaoDuKien DATETIME,
          ngayTaoDon DATETIME DEFAULT GETDATE(),
          ngayDuyet DATETIME,
          ngayGiao DATETIME,
          ngayNghiemThu DATETIME,
          trangThaiDon NVARCHAR(50) DEFAULT N'cho_duyet',
          trangThaiHoanThanh NVARCHAR(50) DEFAULT N'chua_hoan_thanh',
          nguoiTaoId INT,
          nguoiDuyetId INT,
          ghiChu NVARCHAR(MAX),
          lyDoTuChoi NVARCHAR(500),
          daThanhToan DECIMAL(18,2) DEFAULT 0,
          conLai DECIMAL(18,2),
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng DonHang đã tồn tại");
      // Log column names for debugging
      const dhCols = await db.query<{ COLUMN_NAME: string }[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'DonHang' ORDER BY ORDINAL_POSITION`,
      );
      console.log(
        "  📋 DonHang columns:",
        dhCols.recordset.map((c) => c.COLUMN_NAME).join(", "),
      );

      // Migration: fix column name if wrong (l -> I)
      const hasNguoiTaold = dhCols.recordset.some(
        (c) => c.COLUMN_NAME === "nguoiTaold",
      );
      const hasNguoiTaoId = dhCols.recordset.some(
        (c) => c.COLUMN_NAME === "nguoiTaoId",
      );
      if (hasNguoiTaold && !hasNguoiTaoId) {
        console.log("  🔧 Fixing column name: nguoiTaold -> nguoiTaoId");
        await db.query(
          `EXEC sp_rename 'DonHang.nguoiTaold', 'nguoiTaoId', 'COLUMN'`,
        );
        console.log("  ✅ Column renamed successfully");
      }

      // Migration: thêm cột chiPhiPhatSinh và buVanChuyen nếu chưa có
      const colNamesDh = dhCols.recordset.map((c) =>
        c.COLUMN_NAME.toLowerCase(),
      );
      if (!colNamesDh.includes("chiphiphatsinh")) {
        await db.query(
          `ALTER TABLE DonHang ADD chiPhiPhatSinh DECIMAL(18,2) NOT NULL DEFAULT 0`,
        );
        console.log("  ➕ Thêm cột chiPhiPhatSinh vào DonHang");
      }
      if (!colNamesDh.includes("buvanchuyen")) {
        await db.query(
          `ALTER TABLE DonHang ADD buVanChuyen DECIMAL(18,2) NOT NULL DEFAULT 0`,
        );
        console.log("  ➕ Thêm cột buVanChuyen vào DonHang");
      }
    }

    // Tạo bảng LichSanXuat
    const lichSanXuatExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'LichSanXuat'`,
    );
    if (lichSanXuatExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng LichSanXuat...");
      await db.query(`
        CREATE TABLE LichSanXuat (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idDonHang INT NOT NULL,
          idXe INT,
          idTramTron INT NULL,
          idTaiXe INT NULL,
          kyThuatCongTrinh NVARCHAR(200),
          nguoiOmOng NVARCHAR(200),
          nguoiBatOng NVARCHAR(200),
          phuongAnDo NVARCHAR(500),
          bienSoXe NVARCHAR(50),
          thoiGianTron DATETIME,
          thoiGianXuatBen DATETIME,
          thoiGianDenCangDat DATETIME,
          thoiGianBatDauDo DATETIME,
          thoiGianKetThucDo DATETIME,
          ghiChu NVARCHAR(MAX),
          driveLink NVARCHAR(500),
          trangThai NVARCHAR(50) DEFAULT N'chua_san_xuat',
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng LichSanXuat đã tồn tại");
      // Migration: thêm cột idTramTron nếu chưa có
      const colTram = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('LichSanXuat') AND name = 'idTramTron'`,
      );
      if (colTram.recordset.length === 0) {
        await db.query(`ALTER TABLE LichSanXuat ADD idTramTron INT NULL`);
        console.log("  + Cột idTramTron đã thêm vào LichSanXuat");
      }
      // Migration: thêm cột idTaiXe nếu chưa có
      const colTaiXe = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('LichSanXuat') AND name = 'idTaiXe'`,
      );
      if (colTaiXe.recordset.length === 0) {
        await db.query(`ALTER TABLE LichSanXuat ADD idTaiXe INT NULL`);
        console.log("  + Cột idTaiXe đã thêm vào LichSanXuat");
      }
      // Fix dữ liệu cũ: cập nhật idTramTron từ DonHang
      try {
        await db.query(`
          UPDATE ls SET ls.idTramTron = dh.idTramTron
          FROM LichSanXuat ls
          INNER JOIN DonHang dh ON ls.idDonHang = dh.id
          WHERE ls.idTramTron IS NULL AND dh.idTramTron IS NOT NULL
        `);
        console.log("  🔧 Đã fix idTramTron cho các lịch sản xuất cũ");
      } catch {
        // lỗi thì bỏ qua
      }
    }

    // Tạo bảng NghiemThu
    const nghiemThuExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'NghiemThu'`,
    );
    if (nghiemThuExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng NghiemThu...");
      await db.query(`
        CREATE TABLE NghiemThu (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idDonHang INT NOT NULL,
          khoiLuongXacNhan DECIMAL(18,2),
          khoiLuongThucTe DECIMAL(18,2),
          chatLuong NVARCHAR(100),
          bienBanFile NVARCHAR(500),
          bienBanSo NVARCHAR(100),
          ngayLapBienBan DATETIME,
          nguoiLap NVARCHAR(200),
          nguoiKy NVARCHAR(200),
          chucVu NVARCHAR(200),
          tenNguoiNghiemThu NVARCHAR(200),
          ngayNghiemThu DATETIME,
          ketQua NVARCHAR(50),
          daGuiKhach BIT DEFAULT 0,
          ngayGuiKhach DATETIME,
          ghiChu NVARCHAR(MAX),
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng NghiemThu đã tồn tại");
      // Migration: thêm cột tenNguoiNghiemThu nếu chưa có
      const colExists1 = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('NghiemThu') AND name = 'tenNguoiNghiemThu'`,
      );
      if (colExists1.recordset.length === 0) {
        console.log("  ➕ Thêm cột tenNguoiNghiemThu vào NghiemThu...");
        await db.query(`ALTER TABLE NghiemThu ADD tenNguoiNghiemThu NVARCHAR(200)`);
      }
      // Migration: thêm cột ngayNghiemThu nếu chưa có
      const colExists2 = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('NghiemThu') AND name = 'ngayNghiemThu'`,
      );
      if (colExists2.recordset.length === 0) {
        console.log("  ➕ Thêm cột ngayNghiemThu vào NghiemThu...");
        await db.query(`ALTER TABLE NghiemThu ADD ngayNghiemThu DATETIME`);
      }
      // Migration: thêm cột ketQua nếu chưa có
      const colExists3 = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('NghiemThu') AND name = 'ketQua'`,
      );
      if (colExists3.recordset.length === 0) {
        console.log("  ➕ Thêm cột ketQua vào NghiemThu...");
        await db.query(`ALTER TABLE NghiemThu ADD ketQua NVARCHAR(50)`);
      }
    }

    // Tạo bảng HoaDon
    const hoaDonExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'HoaDon'`,
    );
    if (hoaDonExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng HoaDon...");
      await db.query(`
        CREATE TABLE HoaDon (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idDonHang INT NOT NULL,
          maHoaDon NVARCHAR(100),
          soHoaDon NVARCHAR(100),
          ngayLap DATETIME,
          khachHang NVARCHAR(200),
          loaiXiMang NVARCHAR(100),
          gioDo NVARCHAR(100),
          phuongThucThanhToan NVARCHAR(50),
          ghiChu NVARCHAR(MAX),
          tienBeTong DECIMAL(18,2) DEFAULT 0,
          buuVanChuyen DECIMAL(18,2) DEFAULT 0,
          phiPhatSinh DECIMAL(18,2) DEFAULT 0,
          giamTru DECIMAL(18,2) DEFAULT 0,
          tongCong DECIMAL(18,2) DEFAULT 0,
          soTienThanhToan DECIMAL(18,2) DEFAULT 0,
          loaiThanhToan NVARCHAR(20),
          hanTraCongNo DATETIME,
          nguoiTaoId INT,
          ngayTao DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng HoaDon đã tồn tại");
    }

    // Tạo bảng ThanhToan
    const thanhToanExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'ThanhToan'`,
    );
    if (thanhToanExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng ThanhToan...");
      await db.query(`
        CREATE TABLE ThanhToan (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idDonHang INT NOT NULL,
          soTien DECIMAL(18,2) NOT NULL,
          hinhThuc NVARCHAR(50),
          ngayThanhToan DATETIME DEFAULT GETDATE(),
          nguoiNhan NVARCHAR(200),
          ghiChu NVARCHAR(MAX),
          nguoiTaoId INT,
          ngayTao DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng ThanhToan đã tồn tại");
      const ttCols = await db.query<{ COLUMN_NAME: string }[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ThanhToan' ORDER BY ORDINAL_POSITION`,
      );
      console.log(
        "  📋 ThanhToan columns:",
        ttCols.recordset.map((c) => c.COLUMN_NAME).join(", "),
      );
      const hasTTTaold = ttCols.recordset.some(
        (c) => c.COLUMN_NAME === "nguoiTaold",
      );
      const hasTTTaoId = ttCols.recordset.some(
        (c) => c.COLUMN_NAME === "nguoiTaoId",
      );
      if (hasTTTaold && !hasTTTaoId) {
        console.log("  🔧 Fixing ThanhToan column: nguoiTaold -> nguoiTaoId");
        await db.query(
          `EXEC sp_rename 'ThanhToan.nguoiTaold', 'nguoiTaoId', 'COLUMN'`,
        );
        console.log("  ✅ ThanhToan column renamed successfully");
      }
    }

    // Tạo bảng CongNo
    const congNoExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'CongNo'`,
    );
    if (congNoExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng CongNo...");
      await db.query(`
        CREATE TABLE CongNo (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idDonHang INT NOT NULL,
          tongTien DECIMAL(18,2) NOT NULL,
          daThanhToan DECIMAL(18,2) DEFAULT 0,
          conLai DECIMAL(18,2),
          ngayBatDau DATE,
          hanThanhToan DATE,
          trangThai NVARCHAR(50) DEFAULT N'chua_thanh_toan',
          ghiChu NVARCHAR(MAX),
          nhom NVARCHAR(200),
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng CongNo đã tồn tại");
      // Migration: thêm cột nhom nếu chưa có
      const colExists = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('CongNo') AND name = 'nhom'`,
      );
      if (colExists.recordset.length === 0) {
        console.log("  ➕ Thêm cột nhom vào CongNo...");
        await db.query(`ALTER TABLE CongNo ADD nhom NVARCHAR(200) NULL`);
        console.log("  ✅ Đã thêm cột nhom");
      } else {
        console.log("  ✅ Cột nhom đã tồn tại trong CongNo");
      }
      // Migration: thêm cột trangThai nếu chưa có
      const colTrangThai = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('CongNo') AND name = 'trangThai'`,
      );
      if (colTrangThai.recordset.length === 0) {
        console.log("  ➕ Thêm cột trangThai vào CongNo...");
        await db.query(`ALTER TABLE CongNo ADD trangThai NVARCHAR(50) DEFAULT N'chua_thanh_toan'`);
        console.log("  ✅ Đã thêm cột trangThai");
      }
    }

    // Tạo bảng CongNoKhachHang (theo khách hàng, giống Bravo)
    const cnkExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'CongNoKhachHang'`,
    );
    if (cnkExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng CongNoKhachHang...");
      await db.query(`
        CREATE TABLE CongNoKhachHang (
          id INT IDENTITY(1,1) PRIMARY KEY,
          maKhachHang NVARCHAR(100),
          tenKhachHang NVARCHAR(500) NOT NULL,
          duDauNo DECIMAL(18,2) DEFAULT 0,
          duDauCo DECIMAL(18,2) DEFAULT 0,
          phatSinhNo DECIMAL(18,2) DEFAULT 0,
          phatSinhCo DECIMAL(18,2) DEFAULT 0,
          duCuoiNo DECIMAL(18,2) DEFAULT 0,
          duCuoiCo DECIMAL(18,2) DEFAULT 0,
          nhom NVARCHAR(200),
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
      console.log("  ✅ Bảng CongNoKhachHang đã tạo");
    } else {
      // Migration: đảm bảo các cột mới có đủ
      console.log("  ✅ Bảng CongNoKhachHang đã tồn tại");
      const colCheck = async (col: string, def: string) => {
        const c = await db.query<{ name: string }[]>(
          `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('CongNoKhachHang') AND name = '${col}'`,
        );
        if (c.recordset.length === 0) {
          await db.query(`ALTER TABLE CongNoKhachHang ADD ${col} ${def}`);
        }
      };
      await colCheck("duDauNo", "DECIMAL(18,2) DEFAULT 0");
      await colCheck("duDauCo", "DECIMAL(18,2) DEFAULT 0");
      await colCheck("phatSinhNo", "DECIMAL(18,2) DEFAULT 0");
      await colCheck("phatSinhCo", "DECIMAL(18,2) DEFAULT 0");
      await colCheck("duCuoiNo", "DECIMAL(18,2) DEFAULT 0");
      await colCheck("duCuoiCo", "DECIMAL(18,2) DEFAULT 0");
    }

    // Tạo bảng ThongBao
    const thongBaoExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'ThongBao'`,
    );
    if (thongBaoExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng ThongBao...");
      await db.query(`
        CREATE TABLE ThongBao (
          id INT IDENTITY(1,1) PRIMARY KEY,
          tieuDe NVARCHAR(255) NOT NULL,
          noiDung NVARCHAR(1000) NOT NULL,
          role NVARCHAR(50) NOT NULL,
          loai NVARCHAR(50) NOT NULL,
          idThamChieu INT,
          duongDan NVARCHAR(500),
          isRead BIT DEFAULT 0,
          ngayTao DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng ThongBao đã tồn tại");
    }

    await dbPool.close();

    // ===== MIGRATIONS: Cập nhật các cột mới =====
    try {
      const migPool = await mssql.connect({
        server: config.db.server,
        port: config.db.port,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
        options: {
          encrypt: config.db.encrypt,
          trustServerCertificate: config.db.trustServerCertificate,
        },
      });

      const migReq = migPool.request();

      // 1. DonHang: thêm cột giaNiemYet
      const colGiaNiemYet = await migReq.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('DonHang') AND name = 'giaNiemYet'`
      );
      if (colGiaNiemYet.recordset.length === 0) {
        await migReq.query(`ALTER TABLE DonHang ADD giaNiemYet DECIMAL(18,2) DEFAULT 0`);
        console.log("  ➕ Đã thêm cột giaNiemYet vào DonHang");
      } else {
        console.log("  ✅ Cột giaNiemYet đã tồn tại trong DonHang");
      }

      // 2. DonHang: thêm cột giamTru
      const colGiamTru = await migReq.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('DonHang') AND name = 'giamTru'`
      );
      if (colGiamTru.recordset.length === 0) {
        await migReq.query(`ALTER TABLE DonHang ADD giamTru DECIMAL(18,2) DEFAULT 0`);
        console.log("  ➕ Đã thêm cột giamTru vào DonHang");
      } else {
        console.log("  ✅ Cột giamTru đã tồn tại trong DonHang");
      }

      // 3. NghiemThu: đảm bảo bienBanFile là NVARCHAR(MAX)
      const colBienBanFile = await migReq.query<{ name: string; system_type_id: number }[]>(
        `SELECT name, system_type_id FROM sys.columns WHERE object_id = OBJECT_ID('NghiemThu') AND name = 'bienBanFile'`
      );
      if (colBienBanFile.recordset.length === 0) {
        await migReq.query(`ALTER TABLE NghiemThu ADD bienBanFile NVARCHAR(MAX) NULL`);
        console.log("  ➕ Đã thêm cột bienBanFile vào NghiemThu");
      } else {
        const typeId = colBienBanFile.recordset[0].system_type_id;
        // type_id 231 = nvarchar, 1 = sysname (which is also nvarchar)
        // type_id 35 = text (legacy), 99 = ntext (legacy) — these can't hold JSON well
        if (typeId === 35 || typeId === 99) {
          await migReq.query(`ALTER TABLE NghiemThu ALTER COLUMN bienBanFile NVARCHAR(MAX) NULL`);
          console.log("  🔄 Đã chuyển bienBanFile sang NVARCHAR(MAX) trong NghiemThu");
        } else {
          console.log("  ✅ Cột bienBanFile đã đúng kiểu trong NghiemThu");
        }
      }

      await migPool.close();
      console.log("  ✅ Migrations hoàn tất!");
    } catch (error) {
      console.error("  ⚠️  Lỗi migrations:", error instanceof Error ? error.message : error);
    }
    // ===== END MIGRATIONS =====

    // ===== CREATE PERFORMANCE INDEXES (sử dụng dbPool) =====
    console.log("  🔄 Đang tạo performance indexes...");
    try {
      // Tạo connection riêng để tránh bị đóng
      const indexPool = await mssql.connect({
        server: config.db.server,
        port: config.db.port,
        database: config.db.database,
        user: config.db.user,
        password: config.db.password,
        options: {
          encrypt: config.db.encrypt,
          trustServerCertificate: config.db.trustServerCertificate,
        },
      });

      await createPerformanceIndexes(indexPool);
      await indexPool.close();
    } catch (error) {
      console.error("  ⚠️  Lỗi tạo indexes:", error instanceof Error ? error.message : error);
    }
    // ===== END CREATE INDEXES =====

    // Xóa lịch sử import quá 2 ngày
    try {
      const deleted = await xoaLichSuImportCu();
      if (deleted > 0) console.log(`  🗑️  Đã xóa ${deleted} dòng lịch sử import quá 2 ngày`);
    } catch { /* ignore if table doesn't exist yet */ }

    console.log("  ✅ Khởi tạo database hoàn tất!\n");
  } catch (error) {
    console.error(
      "  ❌ Lỗi khởi tạo database:",
      error instanceof Error ? error.message : error,
    );
    console.log("  ⚠ Backend sẽ tiếp tục chạy mà không có database.\n");
  }
}

// ============================================================
// PERFORMANCE INDEXES
// ============================================================
async function createPerformanceIndexes(db: mssql.ConnectionPool): Promise<void> {
  const indexes = [
    // DonHang indexes
    {
      name: 'IX_DonHang_NgayTao_TrangThai',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DonHang_NgayTao_TrangThai' AND object_id = OBJECT_ID('DonHang'))
            CREATE NONCLUSTERED INDEX IX_DonHang_NgayTao_TrangThai ON DonHang(ngayTao DESC, trangThaiDon)`
    },
    {
      name: 'IX_DonHang_TrangThai',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DonHang_TrangThai' AND object_id = OBJECT_ID('DonHang'))
            CREATE NONCLUSTERED INDEX IX_DonHang_TrangThai ON DonHang(trangThaiDon)`
    },
    {
      name: 'IX_DonHang_KhachHang',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DonHang_KhachHang' AND object_id = OBJECT_ID('DonHang'))
            CREATE NONCLUSTERED INDEX IX_DonHang_KhachHang ON DonHang(idKhachHang)`
    },
    {
      name: 'IX_DonHang_MaDonHang',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DonHang_MaDonHang' AND object_id = OBJECT_ID('DonHang'))
            CREATE NONCLUSTERED INDEX IX_DonHang_MaDonHang ON DonHang(maDonHang)`
    },
    {
      name: 'IX_DonHang_NguoiTao',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DonHang_NguoiTao' AND object_id = OBJECT_ID('DonHang'))
            CREATE NONCLUSTERED INDEX IX_DonHang_NguoiTao ON DonHang(nguoiTaoId)`
    },
    {
      name: 'IX_DonHang_TramTron',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DonHang_TramTron' AND object_id = OBJECT_ID('DonHang'))
            CREATE NONCLUSTERED INDEX IX_DonHang_TramTron ON DonHang(idTramTron)`
    },

    // LichSanXuat indexes
    {
      name: 'IX_LichSanXuat_DonHang_Ngay',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LichSanXuat_DonHang_Ngay' AND object_id = OBJECT_ID('LichSanXuat'))
            CREATE NONCLUSTERED INDEX IX_LichSanXuat_DonHang_Ngay ON LichSanXuat(idDonHang, ngayTao DESC)`
    },
    {
      name: 'IX_LichSanXuat_NgayTao',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LichSanXuat_NgayTao' AND object_id = OBJECT_ID('LichSanXuat'))
            CREATE NONCLUSTERED INDEX IX_LichSanXuat_NgayTao ON LichSanXuat(ngayTao DESC)`
    },
    {
      name: 'IX_LichSanXuat_Xe',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LichSanXuat_Xe' AND object_id = OBJECT_ID('LichSanXuat'))
            CREATE NONCLUSTERED INDEX IX_LichSanXuat_Xe ON LichSanXuat(idXe)`
    },

    // CongNo indexes
    {
      name: 'IX_CongNo_DonHang',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CongNo_DonHang' AND object_id = OBJECT_ID('CongNo'))
            CREATE NONCLUSTERED INDEX IX_CongNo_DonHang ON CongNo(idDonHang)`
    },
    {
      name: 'IX_CongNo_TrangThai',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CongNo_TrangThai' AND object_id = OBJECT_ID('CongNo'))
            CREATE NONCLUSTERED INDEX IX_CongNo_TrangThai ON CongNo(trangThai)`
    },

    // ThanhToan indexes
    {
      name: 'IX_ThanhToan_DonHang',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ThanhToan_DonHang' AND object_id = OBJECT_ID('ThanhToan'))
            CREATE NONCLUSTERED INDEX IX_ThanhToan_DonHang ON ThanhToan(idDonHang, ngayThanhToan DESC)`
    },

    // HoaDon indexes
    {
      name: 'IX_HoaDon_DonHang',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HoaDon_DonHang' AND object_id = OBJECT_ID('HoaDon'))
            CREATE NONCLUSTERED INDEX IX_HoaDon_DonHang ON HoaDon(idDonHang)`
    },

    // NghiemThu indexes
    {
      name: 'IX_NghiemThu_DonHang',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_NghiemThu_DonHang' AND object_id = OBJECT_ID('NghiemThu'))
            CREATE NONCLUSTERED INDEX IX_NghiemThu_DonHang ON NghiemThu(idDonHang)`
    },

    // NguoiDung indexes
    {
      name: 'IX_NguoiDung_VaiTro',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_NguoiDung_VaiTro' AND object_id = OBJECT_ID('NguoiDung'))
            CREATE NONCLUSTERED INDEX IX_NguoiDung_VaiTro ON NguoiDung(vaiTro)`
    },

    // Xe indexes - bảng Xe: bienSo, tenTaiXe, soDienThoaiTaiXe, taiTrong, trangThai, ngayTao, idTaiKhoan
    // (không có tramTron - xe không liên kết trực tiếp với trạm)
    {
      name: 'IX_Xe_BienSo',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Xe_BienSo' AND object_id = OBJECT_ID('Xe'))
            CREATE NONCLUSTERED INDEX IX_Xe_BienSo ON Xe(bienSo)`
    },
    {
      name: 'IX_Xe_TrangThai',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Xe_TrangThai' AND object_id = OBJECT_ID('Xe'))
            CREATE NONCLUSTERED INDEX IX_Xe_TrangThai ON Xe(trangThai)`
    },

    // ThongBao indexes - bảng ThongBao: tieuDe, noiDung, role, loai, idThamChieu, duongDan, isRead, ngayTao
    // (không có idNguoiNhan - dùng role để gửi thông báo theo vai trò)
    {
      name: 'IX_ThongBao_Role_Doc',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ThongBao_Role_Doc' AND object_id = OBJECT_ID('ThongBao'))
            CREATE NONCLUSTERED INDEX IX_ThongBao_Role_Doc ON ThongBao(role, isRead, ngayTao DESC)`
    },
    {
      name: 'IX_ThongBao_NgayTao',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ThongBao_NgayTao' AND object_id = OBJECT_ID('ThongBao'))
            CREATE NONCLUSTERED INDEX IX_ThongBao_NgayTao ON ThongBao(ngayTao DESC)`
    },

    // LoginSession indexes - bảng LoginSession: idNguoiDung, tokenHash, ipAddress, userAgent, thaoTac, ngayTao, ngayKetThuc
    // (không có ngayDangNhap - dùng ngayTao)
    {
      name: 'IX_LoginSession_NguoiDung_NgayTao',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoginSession_NguoiDung_NgayTao' AND object_id = OBJECT_ID('LoginSession'))
            CREATE NONCLUSTERED INDEX IX_LoginSession_NguoiDung_NgayTao ON LoginSession(idNguoiDung, ngayTao DESC)`
    },
    {
      name: 'IX_LoginSession_ThaoTac',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoginSession_ThaoTac' AND object_id = OBJECT_ID('LoginSession'))
            CREATE NONCLUSTERED INDEX IX_LoginSession_ThaoTac ON LoginSession(thaoTac, ngayTao DESC)`
    },
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const idx of indexes) {
    try {
      // SQL đã có IF NOT EXISTS, chỉ cần execute
      await db.query(idx.sql);
      console.log(`    ✅ ${idx.name}`);
      createdCount++;
    } catch (error) {
      // Kiểm tra xem có phải lỗi "index already exists" không
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('already exists') || errMsg.includes('duplicate')) {
        skippedCount++;
      } else {
        console.log(`    ⚠️  Lỗi ${idx.name}: ${errMsg}`);
      }
    }
  }

  console.log(`  ✅ Performance indexes: ${createdCount - skippedCount} tạo mới, ${skippedCount} đã tồn tại`);
}

export { initDatabase };
