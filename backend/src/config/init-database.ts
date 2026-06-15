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
      // Migration: thêm cột mstCccd nếu chưa có
      const colMstCccd = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('KhachHang') AND name = 'mstCccd'`,
      );
      if (colMstCccd.recordset.length === 0) {
        await db.query(`ALTER TABLE KhachHang ADD mstCccd NVARCHAR(50)`);
        console.log("  + Cột mstCccd đã thêm vào KhachHang");
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

      // Phát hiện cột trùng tên (do lỗi migration cũ) bằng sys.columns
      // sys.columns trả về cả những cột mà INFORMATION_SCHEMA có thể ẩn
      const duplicateCols = await db.query<{ name: string; cnt: number }[]>(
        `SELECT name, COUNT(*) as cnt
         FROM sys.columns
         WHERE object_id = OBJECT_ID('DonHang')
         GROUP BY name
         HAVING COUNT(*) > 1`,
      );
      if (duplicateCols.recordset.length > 0) {
        console.log(
          "  ⚠ Phát hiện cột trùng tên trong DonHang:",
          duplicateCols.recordset.map((c) => `${c.name} (x${c.cnt})`).join(", "),
        );
        for (const dup of duplicateCols.recordset) {
          // Lấy danh sách tất cả cột trùng, giữ lại 1 cái đầu tiên (id nhỏ nhất), xóa các cái còn lại
          // Validate tên cột chỉ chứa ký tự an toàn để tránh SQL injection khi nhúng vào template
          const safeColName = dup.name.replace(/[^a-zA-Z0-9_]/g, "");
          if (!safeColName || safeColName !== dup.name) {
            console.log(`  ⚠ Bỏ qua cột có tên không hợp lệ: ${dup.name}`);
            continue;
          }
          const dups = await db.query<{ column_id: number; name: string }[]>(
            `SELECT column_id, name FROM sys.columns
             WHERE object_id = OBJECT_ID('DonHang') AND name = '${safeColName}'
             ORDER BY column_id`,
          );
          // Xóa tất cả trừ cột đầu tiên (giữ lại bản gốc)
          for (let i = 1; i < dups.recordset.length; i++) {
            const dropColName = dups.recordset[i].name;
            try {
              // Dùng dynamic SQL với tên cột escape
              const escapedName = dropColName.replace(/]/g, "]]");
              await db.query(
                `ALTER TABLE DonHang DROP COLUMN [${escapedName}]`,
              );
              console.log(
                `  🗑 Đã xóa cột trùng: DonHang.${dropColName} (column_id=${dups.recordset[i].column_id})`,
              );
            } catch (dropErr) {
              console.log(
                `  ⚠ Không thể xóa cột trùng ${dropColName}:`,
                dropErr,
              );
            }
          }
        }
      }

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
      // Dùng sys.columns (đáng tin cậy hơn INFORMATION_SCHEMA) để check cột đã tồn tại chưa
      const sysColsDh = await db.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('DonHang')`,
      );
      const existingColsDh = new Set(
        sysColsDh.recordset.map((c) => c.name.toLowerCase()),
      );
      // Giữ colNamesDh để tương thích với phần còn lại (nếu cần)
      const colNamesDh = Array.from(existingColsDh);

      // Helper: thêm cột nếu chưa tồn tại, an toàn (không crash nếu lỗi)
      const safeAddColumn = async (
        colName: string,
        ddl: string,
      ): Promise<void> => {
        if (existingColsDh.has(colName.toLowerCase())) return;
        try {
          await db.query(ddl);
          console.log(`  ➕ Thêm cột ${colName} vào DonHang`);
          existingColsDh.add(colName.toLowerCase());
        } catch (e) {
          console.log(`  ⚠ Không thể thêm cột ${colName}:`, e);
        }
      };

      await safeAddColumn(
        "chiPhiPhatSinh",
        `ALTER TABLE DonHang ADD chiPhiPhatSinh DECIMAL(18,2) NOT NULL DEFAULT 0`,
      );
      await safeAddColumn(
        "buVanChuyen",
        `ALTER TABLE DonHang ADD buVanChuyen DECIMAL(18,2) NOT NULL DEFAULT 0`,
      );
      await safeAddColumn(
        "hangMuc",
        `ALTER TABLE DonHang ADD hangMuc NVARCHAR(500)`,
      );
      await safeAddColumn(
        "phuongPhapDo",
        `ALTER TABLE DonHang ADD phuongPhapDo NVARCHAR(50)`,
      );
      await safeAddColumn(
        "loaiBom",
        `ALTER TABLE DonHang ADD loaiBom NVARCHAR(50)`,
      );
      await safeAddColumn(
        "chieuDaiBom",
        `ALTER TABLE DonHang ADD chieuDaiBom DECIMAL(10,2)`,
      );
      await safeAddColumn(
        "kieuNoi",
        `ALTER TABLE DonHang ADD kieuNoi NVARCHAR(50)`,
      );
      await safeAddColumn(
        "chieuDaiNoi",
        `ALTER TABLE DonHang ADD chieuDaiNoi DECIMAL(10,2)`,
      );
      await safeAddColumn(
        "nguoiNhanHang",
        `ALTER TABLE DonHang ADD nguoiNhanHang NVARCHAR(200)`,
      );
      await safeAddColumn(
        "giaTienTamTinh",
        `ALTER TABLE DonHang ADD giaTienTamTinh DECIMAL(18,2)`,
      );
      await safeAddColumn(
        "nguoiTuChoiId",
        `ALTER TABLE DonHang ADD nguoiTuChoiId INT`,
      );
      await safeAddColumn(
        "buocTuChoi",
        `ALTER TABLE DonHang ADD buocTuChoi INT`,
      );
      await safeAddColumn(
        "phuongThucThanhToan",
        `ALTER TABLE DonHang ADD phuongThucThanhToan NVARCHAR(50) DEFAULT N'tra_het'`,
      );
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

    // Tạo bảng BangChungDonHang - lưu bằng chứng đơn hàng sau thanh toán
    const bangChungExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'BangChungDonHang'`,
    );
    if (bangChungExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng BangChungDonHang...");
      await db.query(`
        CREATE TABLE BangChungDonHang (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idDonHang INT NOT NULL,
          loai NVARCHAR(50) NOT NULL DEFAULT 'file',
          fileUrl NVARCHAR(500),
          moTa NVARCHAR(255),
          nguoiTaoId INT,
          ngayTao DATETIME DEFAULT GETDATE(),
          ngayCapNhat DATETIME DEFAULT GETDATE()
        )
      `);
      console.log("  ✅ Bảng BangChungDonHang đã tạo");
    } else {
      console.log("  ✅ Bảng BangChungDonHang đã tồn tại");
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

    // Tạo bảng LichSuTraLai (lịch sử trả lại đơn hàng - trộn lại)
    const lichSuTraLaiExists = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = 'LichSuTraLai'`,
    );
    if (lichSuTraLaiExists.recordset.length === 0) {
      console.log("  ➕ Tạo bảng LichSuTraLai...");
      await db.query(`
        CREATE TABLE LichSuTraLai (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idDonHang INT NOT NULL,
          idLichSanXuat INT NULL,
          idTramTron INT NULL,
          tenTram NVARCHAR(200) NULL,
          tenTaiXe NVARCHAR(100) NULL,
          bienSoXe NVARCHAR(50) NULL,
          lyDo NVARCHAR(500) NOT NULL,
          idNguoiTra INT,
          hoTen NVARCHAR(100),
          vaiTro NVARCHAR(50),
          ngayTra DATETIME DEFAULT GETDATE(),
          daXuLy BIT DEFAULT 0,
          ngayXuLy DATETIME,
          ghiChu NVARCHAR(MAX),
          createdAt DATETIME DEFAULT GETDATE(),
          updatedAt DATETIME
        )
      `);
      console.log("  ✅ Bảng LichSuTraLai đã tạo");
    } else {
      console.log("  ✅ Bảng LichSuTraLai đã tồn tại");
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

      // 3. DonHang: thêm cột nguoiDuyetGDKDId (cho Giám đốc kinh doanh và Trưởng phòng duyệt bước 1)
      const colNguoiDuyetGDKD = await migReq.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('DonHang') AND name = 'nguoiDuyetGDKDId'`
      );
      if (colNguoiDuyetGDKD.recordset.length === 0) {
        await migReq.query(`ALTER TABLE DonHang ADD nguoiDuyetGDKDId INT NULL`);
        console.log("  ➕ Đã thêm cột nguoiDuyetGDKDId vào DonHang");
      } else {
        console.log("  ✅ Cột nguoiDuyetGDKDId đã tồn tại trong DonHang");
      }

      // 4. NghiemThu: đảm bảo bienBanFile là NVARCHAR(MAX)
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

      // 5. LichSanXuat: thêm cột khoiLuongDaTron (số khối đã trộn của trạm)
      const colKhoiLuongDaTron = await migReq.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('LichSanXuat') AND name = 'khoiLuongDaTron'`
      );
      if (colKhoiLuongDaTron.recordset.length === 0) {
        await migReq.query(`ALTER TABLE LichSanXuat ADD khoiLuongDaTron DECIMAL(18,2) NULL`);
        console.log("  ➕ Đã thêm cột khoiLuongDaTron vào LichSanXuat");
      } else {
        console.log("  ✅ Cột khoiLuongDaTron đã tồn tại trong LichSanXuat");
      }

      // 6. LichSanXuat: thêm cột ghiChuXe (ghi chú xe giao)
      const colGhiChuXe = await migReq.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('LichSanXuat') AND name = 'ghiChuXe'`
      );
      if (colGhiChuXe.recordset.length === 0) {
        await migReq.query(`ALTER TABLE LichSanXuat ADD ghiChuXe NVARCHAR(MAX) NULL`);
        console.log("  ➕ Đã thêm cột ghiChuXe vào LichSanXuat");
      } else {
        console.log("  ✅ Cột ghiChuXe đã tồn tại trong LichSanXuat");
      }

      // 7. LichSanXuat: thêm cột trangThaiGiao (trạng thái giao hàng theo từng trạm)
      //    - 'dang_giao' (mặc định): trạm đang giao
      //    - 'da_giao': tài xế trạm này đã xác nhận giao xong
      //    - 'tron_lai': tài xế yêu cầu trộn lại cho trạm này
      const colTrangThaiGiao = await migReq.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('LichSanXuat') AND name = 'trangThaiGiao'`
      );
      if (colTrangThaiGiao.recordset.length === 0) {
        await migReq.query(`ALTER TABLE LichSanXuat ADD trangThaiGiao NVARCHAR(50) NULL`);
        console.log("  ➕ Đã thêm cột trangThaiGiao vào LichSanXuat");
      } else {
        console.log("  ✅ Cột trangThaiGiao đã tồn tại trong LichSanXuat");
      }

      // 8. LichSanXuat: thêm cột khoiLuongGiaoThucTe (khối lượng thực tế giao của từng trạm)
      const colKLGT = await migReq.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('LichSanXuat') AND name = 'khoiLuongGiaoThucTe'`
      );
      if (colKLGT.recordset.length === 0) {
        await migReq.query(`ALTER TABLE LichSanXuat ADD khoiLuongGiaoThucTe DECIMAL(18,2) NULL`);
        console.log("  ➕ Đã thêm cột khoiLuongGiaoThucTe vào LichSanXuat");
      } else {
        console.log("  ✅ Cột khoiLuongGiaoThucTe đã tồn tại trong LichSanXuat");
      }

      // 9. LichSanXuat: thêm cột ngayXacNhanGiao (ngày tài xế xác nhận đã giao của trạm)
      const colNgayXNG = await migReq.query<{ name: string }[]>(
        `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('LichSanXuat') AND name = 'ngayXacNhanGiao'`
      );
      if (colNgayXNG.recordset.length === 0) {
        await migReq.query(`ALTER TABLE LichSanXuat ADD ngayXacNhanGiao DATETIME NULL`);
        console.log("  ➕ Đã thêm cột ngayXacNhanGiao vào LichSanXuat");
      } else {
        console.log("  ✅ Cột ngayXacNhanGiao đã tồn tại trong LichSanXuat");
      }

      // 10. LichSuTraLai: thêm các cột theo dõi trộn lại theo từng trạm
      //     (idLichSanXuat, idTramTron, tenTram, tenTaiXe, bienSoXe) — bắt buộc cho endpoint /tai-xe/tron-lai
      const lichSuTraLaiCols: Array<{ name: string; ddl: string }> = [
        { name: 'idLichSanXuat', ddl: 'INT NULL' },
        { name: 'idTramTron', ddl: 'INT NULL' },
        { name: 'tenTram', ddl: 'NVARCHAR(200) NULL' },
        { name: 'tenTaiXe', ddl: 'NVARCHAR(100) NULL' },
        { name: 'bienSoXe', ddl: 'NVARCHAR(50) NULL' },
      ];
      for (const col of lichSuTraLaiCols) {
        const existingCol = await migReq.query<{ name: string }[]>(
          `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('LichSuTraLai') AND name = '${col.name}'`
        );
        if (existingCol.recordset.length === 0) {
          await migReq.query(`ALTER TABLE LichSuTraLai ADD ${col.name} ${col.ddl}`);
          console.log(`  ➕ Đã thêm cột ${col.name} vào LichSuTraLai`);
        } else {
          console.log(`  ✅ Cột ${col.name} đã tồn tại trong LichSuTraLai`);
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

    // LichSuTraLai indexes
    {
      name: 'IX_LichSuTraLai_DonHang',
      sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LichSuTraLai_DonHang' AND object_id = OBJECT_ID('LichSuTraLai'))
            CREATE NONCLUSTERED INDEX IX_LichSuTraLai_DonHang ON LichSuTraLai(idDonHang, ngayTra DESC)`
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
