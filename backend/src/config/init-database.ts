import mssql from "mssql";
import { config } from "./index";

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
          trangThai NVARCHAR(20) DEFAULT N'hoat_dong',
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng NguoiDung đã tồn tại");
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
          tenKhachHang NVARCHAR(200) NOT NULL,
          diaChi NVARCHAR(500),
          soDienThoai NVARCHAR(20),
          email NVARCHAR(200),
          ghiChu NVARCHAR(MAX),
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng KhachHang đã tồn tại");
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
          daGuiKhach BIT DEFAULT 0,
          ngayGuiKhach DATETIME,
          ghiChu NVARCHAR(MAX),
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
    } else {
      console.log("  ✅ Bảng NghiemThu đã tồn tại");
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

    console.log("  ✅ Khởi tạo database hoàn tất!\n");
  } catch (error) {
    console.error(
      "  ❌ Lỗi khởi tạo database:",
      error instanceof Error ? error.message : error,
    );
    console.log("  ⚠ Backend sẽ tiếp tục chạy mà không có database.\n");
  }
}

export { initDatabase };
