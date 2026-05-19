/**
 * Script seed data mẫu - Bê Tông Tây Đô
 * Chạy: npx tsx src/scripts/seed-test-data.ts
 *
 * Tạo đầy đủ data mẫu để test chuẩn flow:
 * 1. Điều phối tạo đơn hàng
 * 2. Kế toán duyệt / từ chối
 * 3. Điều phối tạo lịch sản xuất
 * 4. Xác nhận giao hàng
 * 5. Nghiệm thu
 * 6. Thanh toán / công nợ
 *
 * Script tự động đọc config từ .env và seed vào đúng database.
 */

import mssql from 'mssql';
import bcrypt from 'bcryptjs';
import { config } from '../config/index';

const DB_OPTS = { encrypt: false, trustServerCertificate: true };

const DB_SERVER = config.db.server;
const DB_PORT = config.db.port;
const DB_NAME = config.db.database;
const DB_USER = config.db.user;
const DB_PASSWORD = config.db.password;

function sqlDate(offsetDay: number): string {
  const d = new Date(Date.now() + offsetDay * 86400000);
  return d.toISOString().split('T')[0];
}

// ─── 1. Init Database & Tables ─────────────────────────────────────────────

async function initDatabase(): Promise<void> {
  const master = await mssql.connect({
    server: DB_SERVER, port: DB_PORT, database: 'master',
    user: DB_USER, password: DB_PASSWORD, options: DB_OPTS,
  });

  const dbExists = await master.query<{ name: string }[]>(
    `SELECT name FROM sys.databases WHERE name = '${DB_NAME}'`
  );
  if (dbExists.recordset.length === 0) {
    await master.query(`CREATE DATABASE ${DB_NAME}`);
    console.log(`  ✓ Tạo database ${DB_NAME}`);
  } else {
    console.log(`  ✓ Database ${DB_NAME} đã tồn tại`);
  }
  await master.close();

  const db = await mssql.connect({
    server: DB_SERVER, port: DB_PORT, database: DB_NAME,
    user: DB_USER, password: DB_PASSWORD, options: DB_OPTS,
  });

  const create = async (name: string, ddl: string) => {
    const ex = await db.query<{ name: string }[]>(
      `SELECT name FROM sys.tables WHERE name = '${name}'`
    );
    if (ex.recordset.length === 0) {
      await db.query(ddl);
      console.log(`  ✓ Bảng ${name} đã tạo`);
    } else {
      console.log(`  ✓ Bảng ${name} đã tồn tại`);
    }
  };

  await create('NguoiDung', `CREATE TABLE NguoiDung (
    id INT IDENTITY(1,1) PRIMARY KEY, tenDangNhap NVARCHAR(100) NOT NULL UNIQUE,
    matKhau NVARCHAR(255) NOT NULL, hoTen NVARCHAR(200) NOT NULL,
    email NVARCHAR(200), soDienThoai NVARCHAR(20),
    vaiTro NVARCHAR(50) NOT NULL, trangThai NVARCHAR(20) DEFAULT N'hoat_dong',
    ngayTao DATETIME DEFAULT GETDATE(), ngayCapNhat DATETIME DEFAULT GETDATE())`);

  await create('KhachHang', `CREATE TABLE KhachHang (
    id INT IDENTITY(1,1) PRIMARY KEY, tenKhachHang NVARCHAR(200) NOT NULL,
    diaChi NVARCHAR(500), soDienThoai NVARCHAR(20), email NVARCHAR(200),
    ghiChu NVARCHAR(MAX), ngayTao DATETIME DEFAULT GETDATE(), ngayCapNhat DATETIME DEFAULT GETDATE())`);

  await create('MacBeTong', `CREATE TABLE MacBeTong (
    id INT IDENTITY(1,1) PRIMARY KEY, tenMac NVARCHAR(100) NOT NULL,
    donGia DECIMAL(18,2) NOT NULL DEFAULT 0, moTa NVARCHAR(500),
    trangThai NVARCHAR(20) DEFAULT N'hoat_dong', ngayTao DATETIME DEFAULT GETDATE())`);

  await create('TramTron', `CREATE TABLE TramTron (
    id INT IDENTITY(1,1) PRIMARY KEY, tenTram NVARCHAR(200) NOT NULL,
    diaChi NVARCHAR(500), soDienThoai NVARCHAR(20),
    trangThai NVARCHAR(20) DEFAULT N'hoat_dong', ngayTao DATETIME DEFAULT GETDATE())`);

  await create('Xe', `CREATE TABLE Xe (
    id INT IDENTITY(1,1) PRIMARY KEY, bienSo NVARCHAR(50) NOT NULL,
    tenTaiXe NVARCHAR(200), soDienThoaiTaiXe NVARCHAR(20),
    taiTrong DECIMAL(18,2), trangThai NVARCHAR(20) DEFAULT N'san_sang',
    ngayTao DATETIME DEFAULT GETDATE())`);

  await create('DonHang', `CREATE TABLE DonHang (
    id INT IDENTITY(1,1) PRIMARY KEY, maDonHang NVARCHAR(50) NOT NULL UNIQUE,
    idKhachHang INT, idMacBeTong INT, idTramTron INT,
    tenKhachHang NVARCHAR(200) NOT NULL, diaChiNhan NVARCHAR(500) NOT NULL,
    soDienThoai NVARCHAR(20) NOT NULL, tenMacBeTong NVARCHAR(100),
    khoiLuongDat DECIMAL(18,2) NOT NULL, khoiLuongThucTe DECIMAL(18,2),
    donGia DECIMAL(18,2) NOT NULL, thanhTien DECIMAL(18,2),
    thoiGianGiaoDuKien DATETIME, ngayTaoDon DATETIME DEFAULT GETDATE(),
    ngayDuyet DATETIME, ngayGiao DATETIME, ngayNghiemThu DATETIME,
    trangThaiDon NVARCHAR(50) DEFAULT N'cho_duyet',
    trangThaiHoanThanh NVARCHAR(50) DEFAULT N'chua_hoan_thanh',
    nguoiTaoId INT, nguoiDuyetId INT, ghiChu NVARCHAR(MAX),
    lyDoTuChoi NVARCHAR(500), daThanhToan DECIMAL(18,2) DEFAULT 0, conLai DECIMAL(18,2),
    ngayTao DATETIME DEFAULT GETDATE(), ngayCapNhat DATETIME DEFAULT GETDATE())`);

  await create('LichSanXuat', `CREATE TABLE LichSanXuat (
    id INT IDENTITY(1,1) PRIMARY KEY, idDonHang INT NOT NULL, idXe INT,
    kyThuatCongTrinh NVARCHAR(200), nguoiOmOng NVARCHAR(200), nguoiBatOng NVARCHAR(200),
    phuongAnDo NVARCHAR(500), bienSoXe NVARCHAR(50),
    thoiGianTron DATETIME, thoiGianXuatBen DATETIME, thoiGianDenCangDat DATETIME,
    thoiGianBatDauDo DATETIME, thoiGianKetThucDo DATETIME,
    ghiChu NVARCHAR(MAX), driveLink NVARCHAR(500),
    trangThai NVARCHAR(50) DEFAULT N'chua_san_xuat',
    ngayTao DATETIME DEFAULT GETDATE(), ngayCapNhat DATETIME DEFAULT GETDATE())`);

  await create('NghiemThu', `CREATE TABLE NghiemThu (
    id INT IDENTITY(1,1) PRIMARY KEY, idDonHang INT NOT NULL,
    khoiLuongXacNhan DECIMAL(18,2), khoiLuongThucTe DECIMAL(18,2),
    chatLuong NVARCHAR(100), bienBanFile NVARCHAR(500), bienBanSo NVARCHAR(100),
    ngayLapBienBan DATETIME, nguoiLap NVARCHAR(200), nguoiKy NVARCHAR(200),
    chucVu NVARCHAR(200), daGuiKhach BIT DEFAULT 0, ngayGuiKhach DATETIME,
    ghiChu NVARCHAR(MAX), ngayTao DATETIME DEFAULT GETDATE(), ngayCapNhat DATETIME DEFAULT GETDATE())`);

  await create('ThanhToan', `CREATE TABLE ThanhToan (
    id INT IDENTITY(1,1) PRIMARY KEY, idDonHang INT NOT NULL,
    soTien DECIMAL(18,2) NOT NULL, hinhThuc NVARCHAR(50),
    ngayThanhToan DATETIME DEFAULT GETDATE(), nguoiNhan NVARCHAR(200),
    ghiChu NVARCHAR(MAX), nguoiTaoId INT, ngayTao DATETIME DEFAULT GETDATE())`);

  await create('CongNo', `CREATE TABLE CongNo (
    id INT IDENTITY(1,1) PRIMARY KEY, idDonHang INT NOT NULL,
    tongTien DECIMAL(18,2) NOT NULL, daThanhToan DECIMAL(18,2) DEFAULT 0, conLai DECIMAL(18,2),
    ngayBatDau DATE, hanThanhToan DATE, trangThai NVARCHAR(50) DEFAULT N'chua_thanh_toan',
    ghiChu NVARCHAR(MAX), ngayTao DATETIME DEFAULT GETDATE(), ngayCapNhat DATETIME DEFAULT GETDATE())`);

  await create('ThongBao', `CREATE TABLE ThongBao (
    id INT IDENTITY(1,1) PRIMARY KEY, tieuDe NVARCHAR(255) NOT NULL,
    noiDung NVARCHAR(1000) NOT NULL, role NVARCHAR(50) NOT NULL,
    loai NVARCHAR(50) NOT NULL, idThamChieu INT, duongDan NVARCHAR(500),
    isRead BIT DEFAULT 0, ngayTao DATETIME DEFAULT GETDATE())`);

  await db.close();
}

// ─── 2. Seed Data ───────────────────────────────────────────────────────────

async function seedData(): Promise<void> {
  const pool = await mssql.connect({
    server: DB_SERVER, port: DB_PORT, database: DB_NAME,
    user: DB_USER, password: DB_PASSWORD, options: DB_OPTS,
  });

  const getIds = async (sqls: string[]): Promise<number[]> => {
    const ids: number[] = [];
    for (const s of sqls) {
      const r = await pool.request().query(s + '; SELECT SCOPE_IDENTITY() AS id;');
      ids.push(Number(r.recordset[0].id));
    }
    return ids;
  };

  // ── Xóa dữ liệu cũ ────────────────────────────────────────────────────
  console.log('\n🔴 XÓA DỮ LIỆU CŨ...');
  for (const t of ['ThanhToan','CongNo','NghiemThu','LichSanXuat','DonHang','Xe','TramTron','MacBeTong','KhachHang','ThongBao','NguoiDung']) {
    await pool.request().query(`DELETE FROM ${t}`);
    if (['ThongBao','KhachHang','MacBeTong','TramTron','Xe','DonHang','NguoiDung'].includes(t)) {
      await pool.request().query(`DBCC CHECKIDENT ('${t}', RESEED, 0)`);
    }
  }
  console.log('  ✓ Đã xóa sạch\n');

  // ── Người dùng ──────────────────────────────────────────────────────────
  console.log('🟢 SEED NGƯỜI DÙNG...');
  const adminPass = bcrypt.hashSync('Admin@123', 10);
  const keToanPass = bcrypt.hashSync('Ketoan@123', 10);
  const dieuPhoiPass = bcrypt.hashSync('Dieuphoi@123', 10);
  const lanhDaoPass = bcrypt.hashSync('Lanhdao@123', 10);

  const userIds = await getIds([
    `INSERT NguoiDung (tenDangNhap,matKhau,hoTen,email,soDienThoai,vaiTro,trangThai) VALUES
     ('admin','${adminPass}',N'Nguyễn Văn Admin','admin@bttd.com','0901000001','admin','hoat_dong')`,
    `INSERT NguoiDung (tenDangNhap,matKhau,hoTen,email,soDienThoai,vaiTro,trangThai) VALUES
     ('ketoan','${keToanPass}',N'Trần Thị Kế Toán','ketoan@bttd.com','0901000002','ke_toan','hoat_dong')`,
    `INSERT NguoiDung (tenDangNhap,matKhau,hoTen,email,soDienThoai,vaiTro,trangThai) VALUES
     ('dieuphoi','${dieuPhoiPass}',N'Lê Văn Điều Phối','dieuphoi@bttd.com','0901000003','dieu_phoi','hoat_dong')`,
    `INSERT NguoiDung (tenDangNhap,matKhau,hoTen,email,soDienThoai,vaiTro,trangThai) VALUES
     ('lanhdao','${lanhDaoPass}',N'Phạm Văn Lãnh Đạo','lanhdao@bttd.com','0901000004','lanh_dao','hoat_dong')`,
  ]);
  const [_adminId, keToanId, dieuPhoiId, _lanhDaoId] = userIds;
  console.log(`  ✓ 4 tài khoản: admin, ketoan(id=${keToanId}), dieuphoi(id=${dieuPhoiId}), lanhdao\n`);

  // ── Khách hàng ──────────────────────────────────────────────────────────
  console.log('🟢 SEED KHÁCH HÀNG...');
  const khIds = await getIds([
    `INSERT KhachHang (tenKhachHang,diaChi,soDienThoai,email,ghiChu) VALUES
     (N'Công Ty TNHH Xây Dựng Minh Tiến',N'123 Đường 3/2, Q.Ninh Kiều, Cần Thơ','0902000001','minhtien@xd.com',N'Khách VIP, thanh toán chậm 30 ngày')`,
    `INSERT KhachHang (tenKhachHang,diaChi,soDienThoai,email,ghiChu) VALUES
     (N'Ông Trần Văn B',N'456 Đường Nguyễn Văn Cừ, Q.Bình Thủy, Cần Thơ','0902000002','travanb@gmail.com',N'Khách lẻ, thanh toán ngay')`,
    `INSERT KhachHang (tenKhachHang,diaChi,soDienThoai,email,ghiChu) VALUES
     (N'Công Ty CP Đầu Tư Hùng Vương',N'789 Đường Mậu Thân, Q.Cái Khế, Cần Thơ','0902000003','hungvuong@dautu.vn',N'Công trình lớn, cần nghiệm thu kỹ')`,
    `INSERT KhachHang (tenKhachHang,diaChi,soDienThoai,email,ghiChu) VALUES
     (N'Bà Nguyễn Thị C',N'321 Đường Lê Lợi, Q.Ô Môn, Cần Thơ','0902000004','nguyenthic@yahoo.com',N'Khách quen, giao nhiều lần')`,
    `INSERT KhachHang (tenKhachHang,diaChi,soDienThoai,email,ghiChu) VALUES
     (N'Công Ty TNHH MTV XD Thành Đạt',N'555 Đường Phạm Ngũ Lão, Q.Ninh Kiều, Cần Thơ','0902000005','thanhdat@xd.vn',N'Khách mới, cần theo dõi')`,
  ]);
  console.log(`  ✓ 5 khách hàng: ids ${khIds.join(', ')}\n`);

  // ── Mác bê tông ─────────────────────────────────────────────────────────
  console.log('🟢 SEED MÁC BÊ TÔNG...');
  const macIds = await getIds([
    `INSERT MacBeTong (tenMac,donGia,moTa,trangThai) VALUES ('M250',1200000,N'Mác 250 - Bê tông tươi thông dụng','hoat_dong')`,
    `INSERT MacBeTong (tenMac,donGia,moTa,trangThai) VALUES ('M300',1300000,N'Mác 300 - Bê tông cường độ cao','hoat_dong')`,
    `INSERT MacBeTong (tenMac,donGia,moTa,trangThai) VALUES ('M350',1400000,N'Mác 350 - Bê tông cường độ cao hơn','hoat_dong')`,
    `INSERT MacBeTong (tenMac,donGia,moTa,trangThai) VALUES ('M400',1500000,N'Mác 400 - Bê tông chịu lực cao','hoat_dong')`,
    `INSERT MacBeTong (tenMac,donGia,moTa,trangThai) VALUES ('M450',1600000,N'Mác 450 - Bê tông đặc biệt','hoat_dong')`,
  ]);
  console.log(`  ✓ 5 mác bê tông: ids ${macIds.join(', ')}\n`);

  // ── Trạm trộn ───────────────────────────────────────────────────────────
  console.log('🟢 SEED TRẠM TRỘN...');
  const tramIds = await getIds([
    `INSERT TramTron (tenTram,diaChi,soDienThoai,trangThai) VALUES
     (N'Trạm Trộn số 1 - Ninh Kiều',N'Km 5+200 QL1A, P.An Bình, Q.Ninh Kiều, Cần Thơ','02923800101','hoat_dong')`,
    `INSERT TramTron (tenTram,diaChi,soDienThoai,trangThai) VALUES
     (N'Trạm Trộn số 2 - Bình Thủy',N'Đường Bùi Hữu Nghĩa, P.Bình Thủy, Q.Bình Thủy, Cần Thơ','02923800202','hoat_dong')`,
    `INSERT TramTron (tenTram,diaChi,soDienThoai,trangThai) VALUES
     (N'Trạm Trộn số 3 - Ô Môn',N'QL91, P.Phước Thới, Q.Ô Môn, Cần Thơ','02923800303','hoat_dong')`,
  ]);
  console.log(`  ✓ 3 trạm trộn: ids ${tramIds.join(', ')}\n`);

  // ── Xe ──────────────────────────────────────────────────────────────────
  console.log('🟢 SEED XE...');
  const xeIds = await getIds([
    `INSERT Xe (bienSo,tenTaiXe,soDienThoaiTaiXe,taiTrong,trangThai) VALUES
     ('59C1-1234',N'Nguyễn Văn Tài','0903000001',10.0,'san_sang')`,
    `INSERT Xe (bienSo,tenTaiXe,soDienThoaiTaiXe,taiTrong,trangThai) VALUES
     ('59C2-2345',N'Trần Văn Lái','0903000002',12.0,'san_sang')`,
    `INSERT Xe (bienSo,tenTaiXe,soDienThoaiTaiXe,taiTrong,trangThai) VALUES
     ('59C3-3456',N'Lê Văn Xe','0903000003',10.0,'dang_giao')`,
    `INSERT Xe (bienSo,tenTaiXe,soDienThoaiTaiXe,taiTrong,trangThai) VALUES
     ('59C4-4567',N'Phạm Văn Bánh','0903000004',8.0,'san_sang')`,
  ]);
  console.log(`  ✓ 4 xe: ids ${xeIds.join(', ')}\n`);

  // ── Đơn hàng ─────────────────────────────────────────────────────────────
  const D = sqlDate;
  console.log('🟢 SEED ĐƠN HÀNG...');
  const dhIds = await getIds([
    `INSERT DonHang (maDonHang,idKhachHang,idMacBeTong,idTramTron,tenKhachHang,diaChiNhan,soDienThoai,tenMacBeTong,khoiLuongDat,donGia,thanhTien,thoiGianGiaoDuKien,ngayTaoDon,trangThaiDon,trangThaiHoanThanh,nguoiTaoId,ghiChu,daThanhToan,conLai)
     VALUES ('DH-TEST-001',${khIds[0]},${macIds[1]},${tramIds[0]},N'Công Ty TNHH Xây Dựng Minh Tiến',N'123 Đường 3/2, Q.Ninh Kiều, Cần Thơ','0902000001','M300',20.0,1300000,26000000,'${D(1)}','${D(0)}','cho_duyet','chua_hoan_thanh',${dieuPhoiId},N'Đơn mới - chờ kế toán duyệt',0,26000000)`,

    `INSERT DonHang (maDonHang,idKhachHang,idMacBeTong,idTramTron,tenKhachHang,diaChiNhan,soDienThoai,tenMacBeTong,khoiLuongDat,donGia,thanhTien,thoiGianGiaoDuKien,ngayTaoDon,ngayDuyet,trangThaiDon,trangThaiHoanThanh,nguoiTaoId,nguoiDuyetId,ghiChu,daThanhToan,conLai)
     VALUES ('DH-TEST-002',${khIds[1]},${macIds[0]},${tramIds[1]},N'Ông Trần Văn B',N'456 Đường Nguyễn Văn Cừ, Q.Bình Thủy, Cần Thơ','0902000002','M250',15.0,1200000,18000000,'${D(0)}','${D(-2)}','${D(-1)}','dang_san_xuat','dang_hoan_thanh',${dieuPhoiId},${keToanId},N'Đơn đã duyệt - cần điều phối xe',0,18000000)`,

    `INSERT DonHang (maDonHang,idKhachHang,idMacBeTong,idTramTron,tenKhachHang,diaChiNhan,soDienThoai,tenMacBeTong,khoiLuongDat,donGia,thanhTien,thoiGianGiaoDuKien,ngayTaoDon,ngayDuyet,trangThaiDon,trangThaiHoanThanh,nguoiTaoId,nguoiDuyetId,ghiChu,daThanhToan,conLai)
     VALUES ('DH-TEST-003',${khIds[2]},${macIds[2]},${tramIds[0]},N'Công Ty CP Đầu Tư Hùng Vương',N'789 Đường Mậu Thân, Q.Cái Khế, Cần Thơ','0902000003','M350',30.0,1400000,42000000,'${D(0)}','${D(-5)}','${D(-4)}','dang_giao','dang_hoan_thanh',${dieuPhoiId},${keToanId},N'Xe đang giao, chờ khách xác nhận',0,42000000)`,

    `INSERT DonHang (maDonHang,idKhachHang,idMacBeTong,idTramTron,tenKhachHang,diaChiNhan,soDienThoai,tenMacBeTong,khoiLuongDat,khoiLuongThucTe,donGia,thanhTien,thoiGianGiaoDuKien,ngayTaoDon,ngayDuyet,ngayGiao,trangThaiDon,trangThaiHoanThanh,nguoiTaoId,nguoiDuyetId,ghiChu,daThanhToan,conLai)
     VALUES ('DH-TEST-004',${khIds[3]},${macIds[3]},${tramIds[2]},N'Bà Nguyễn Thị C',N'321 Đường Lê Lợi, Q.Ô Môn, Cần Thơ','0902000004','M400',25.0,25.5,1500000,38250000,'${D(-3)}','${D(-10)}','${D(-9)}','${D(-6)}','nghiem_thu','dang_hoan_thanh',${dieuPhoiId},${keToanId},N'Đã giao, chờ nghiệm thu',0,38250000)`,

    `INSERT DonHang (maDonHang,idKhachHang,idMacBeTong,idTramTron,tenKhachHang,diaChiNhan,soDienThoai,tenMacBeTong,khoiLuongDat,khoiLuongThucTe,donGia,thanhTien,thoiGianGiaoDuKien,ngayTaoDon,ngayDuyet,ngayGiao,ngayNghiemThu,trangThaiDon,trangThaiHoanThanh,nguoiTaoId,nguoiDuyetId,ghiChu,daThanhToan,conLai)
     VALUES ('DH-TEST-005',${khIds[0]},${macIds[4]},${tramIds[1]},N'Công Ty TNHH Xây Dựng Minh Tiến',N'123 Đường 3/2, Q.Ninh Kiều, Cần Thơ','0902000001','M450',18.0,18.2,1600000,29120000,'${D(-7)}','${D(-15)}','${D(-14)}','${D(-10)}','${D(-5)}','da_thanh_toan','dang_hoan_thanh',${dieuPhoiId},${keToanId},N'Đã nghiệm thu - công nợ 29.120.000đ',0,29120000)`,

    `INSERT DonHang (maDonHang,idKhachHang,idMacBeTong,idTramTron,tenKhachHang,diaChiNhan,soDienThoai,tenMacBeTong,khoiLuongDat,khoiLuongThucTe,donGia,thanhTien,thoiGianGiaoDuKien,ngayTaoDon,ngayDuyet,ngayGiao,ngayNghiemThu,trangThaiDon,trangThaiHoanThanh,nguoiTaoId,nguoiDuyetId,ghiChu,daThanhToan,conLai)
     VALUES ('DH-TEST-006',${khIds[4]},${macIds[0]},${tramIds[0]},N'Công Ty TNHH MTV XD Thành Đạt',N'555 Đường Phạm Ngũ Lão, Q.Ninh Kiều, Cần Thơ','0902000005','M250',10.0,10.0,1200000,12000000,'${D(-10)}','${D(-20)}','${D(-19)}','${D(-15)}','${D(-12)}','da_thanh_toan','da_hoan_thanh',${dieuPhoiId},${keToanId},N'Hoàn thành - đã thanh toán đủ',12000000,0)`,

    `INSERT DonHang (maDonHang,idKhachHang,idMacBeTong,idTramTron,tenKhachHang,diaChiNhan,soDienThoai,tenMacBeTong,khoiLuongDat,donGia,thanhTien,thoiGianGiaoDuKien,ngayTaoDon,trangThaiDon,trangThaiHoanThanh,nguoiTaoId,lyDoTuChoi,daThanhToan,conLai)
     VALUES ('DH-TEST-007',${khIds[1]},${macIds[2]},${tramIds[1]},N'Ông Trần Văn B',N'456 Đường Nguyễn Văn Cừ, Q.Bình Thủy, Cần Thơ','0902000002','M350',8.0,1400000,11200000,'${D(2)}','${D(-1)}','tu_choi','chua_hoan_thanh',${dieuPhoiId},N'Kế toán từ chối: Khách hàng chưa thanh toán đơn cũ',0,0)`,

    `INSERT DonHang (maDonHang,idKhachHang,idMacBeTong,idTramTron,tenKhachHang,diaChiNhan,soDienThoai,tenMacBeTong,khoiLuongDat,khoiLuongThucTe,donGia,thanhTien,thoiGianGiaoDuKien,ngayTaoDon,ngayDuyet,ngayGiao,ngayNghiemThu,trangThaiDon,trangThaiHoanThanh,nguoiTaoId,nguoiDuyetId,ghiChu,daThanhToan,conLai)
     VALUES ('DH-TEST-008',${khIds[0]},${macIds[1]},${tramIds[0]},N'Công Ty TNHH Xây Dựng Minh Tiến',N'123 Đường 3/2, Q.Ninh Kiều, Cần Thơ','0902000001','M300',40.0,40.0,1300000,52000000,'${D(-60)}','${D(-90)}','${D(-89)}','${D(-80)}','${D(-70)}','da_thanh_toan','da_hoan_thanh',${dieuPhoiId},${keToanId},N'Đơn cũ quá hạn thanh toán',5000000,47000000)`,
  ]);
  const [dhId1, dhId2, dhId3, dhId4, dhId5, dhId6, dhId7, dhId8] = dhIds;
  console.log(`  ✓ 8 đơn hàng: ids ${dhIds.join(', ')}\n`);

  // ── Lịch sản xuất ───────────────────────────────────────────────────────
  console.log('🟢 SEED LỊCH SẢN XUẤT...');
  await getIds([
    `INSERT LichSanXuat (idDonHang,idXe,kyThuatCongTrinh,nguoiOmOng,nguoiBatOng,phuongAnDo,bienSoXe,thoiGianTron,trangThai,ghiChu)
     VALUES (${dhId2},${xeIds[0]},N'KS. Hoàng Minh Quang',N'Nguyễn Thanh Phong',N'Trần Văn Mạnh',N'Đổ bằng bơm, cao độ 3.5m','59C1-1234','${D(0)} 07:00:00','dang_san_xuat',N'Xe chờ xuất bến')`,
    `INSERT LichSanXuat (idDonHang,idXe,kyThuatCongTrinh,nguoiOmOng,nguoiBatOng,phuongAnDo,bienSoXe,thoiGianTron,thoiGianXuatBen,thoiGianDenCangDat,thoiGianBatDauDo,trangThai,ghiChu)
     VALUES (${dhId3},${xeIds[1]},N'KS. Lê Hồng Sơn',N'Phạm Văn Tèo',N'Võ Văn Đực',N'Đổ cột, dùng cần trục','59C2-2345','${D(0)} 06:30:00','${D(0)} 07:30:00','${D(0)} 08:00:00','${D(0)} 08:15:00','dang_san_xuat',N'Xe đang vận chuyển đến công trình')`,
    `INSERT LichSanXuat (idDonHang,idXe,kyThuatCongTrinh,nguoiOmOng,nguoiBatOng,phuongAnDo,bienSoXe,thoiGianTron,thoiGianXuatBen,thoiGianDenCangDat,thoiGianBatDauDo,thoiGianKetThucDo,trangThai,ghiChu)
     VALUES (${dhId4},${xeIds[3]},N'KS. Đặng Văn Hùng',N'Bùi Thị Lan',N'Lý Văn Còi',N'Đổ sàn, mặt bằng rộng','59C4-4567','${D(-6)} 06:00:00','${D(-6)} 07:00:00','${D(-6)} 07:30:00','${D(-6)} 08:00:00','${D(-6)} 10:00:00','da_xong',N'Hoàn thành, chờ nghiệm thu')`,
    `INSERT LichSanXuat (idDonHang,idXe,kyThuatCongTrinh,nguoiOmOng,nguoiBatOng,phuongAnDo,bienSoXe,thoiGianTron,thoiGianXuatBen,thoiGianDenCangDat,thoiGianBatDauDo,thoiGianKetThucDo,trangThai,ghiChu,driveLink)
     VALUES (${dhId5},${xeIds[0]},N'KS. Trần Văn Nam',N'Huỳnh Minh Tuấn',N'Đặng Văn Cao',N'Đổ móng, cần bơm dài','59C1-1234','${D(-5)} 06:30:00','${D(-5)} 07:30:00','${D(-5)} 08:00:00','${D(-5)} 08:30:00','${D(-5)} 11:00:00','da_xong',N'Hoàn thành','https://drive.google.com/drive/folders/EXAMPLE_LSX_005')`,
    `INSERT LichSanXuat (idDonHang,idXe,kyThuatCongTrinh,nguoiOmOng,nguoiBatOng,phuongAnDo,bienSoXe,thoiGianTron,thoiGianXuatBen,thoiGianDenCangDat,thoiGianBatDauDo,thoiGianKetThucDo,trangThai,ghiChu)
     VALUES (${dhId6},${xeIds[2]},N'KS. Nguyễn Thị Hương',N'Trịnh Văn Hòa',N'Phan Thị Sen',N'Đổ đà kiềng','59C3-3456','${D(-12)} 07:00:00','${D(-12)} 08:00:00','${D(-12)} 08:30:00','${D(-12)} 09:00:00','${D(-12)} 10:30:00','da_xong',N'Hoàn thành tốt')`,
  ]);
  console.log('  ✓ 5 lịch sản xuất\n');

  // ── Nghiệm thu ──────────────────────────────────────────────────────────
  console.log('🟢 SEED NGHIỆM THU...');
  await getIds([
    `INSERT NghiemThu (idDonHang,khoiLuongXacNhan,khoiLuongThucTe,chatLuong,bienBanSo,ngayLapBienBan,nguoiLap,nguoiKy,chucVu,daGuiKhach,ghiChu)
     VALUES (${dhId4},25.5,25.5,'dat','BB-2026-004','${D(-4)}',N'KS. Đặng Văn Hùng',N'Ông Nguyễn Văn X',N'Giám đốc công trình',0,N'Chờ khách ký xác nhận')`,
    `INSERT NghiemThu (idDonHang,khoiLuongXacNhan,khoiLuongThucTe,chatLuong,bienBanSo,ngayLapBienBan,nguoiLap,nguoiKy,chucVu,daGuiKhach,ngayGuiKhach,ghiChu)
     VALUES (${dhId5},18.2,18.2,'dat','BB-2026-005','${D(-6)}',N'KS. Trần Văn Nam',N'Bà Trần Thị Y',N'Kế toán công ty',1,'${D(-5)}',N'Đã gửi khách qua Zalo, chờ thanh toán')`,
    `INSERT NghiemThu (idDonHang,khoiLuongXacNhan,khoiLuongThucTe,chatLuong,bienBanSo,ngayLapBienBan,nguoiLap,nguoiKy,chucVu,daGuiKhach,ngayGuiKhach,ghiChu)
     VALUES (${dhId6},10.0,10.0,'dat','BB-2026-006','${D(-13)}',N'KS. Nguyễn Thị Hương',N'Ông Lê Văn Z',N'Chủ đầu tư',1,'${D(-13)}',N'Hoàn thành - thanh toán ngay')`,
  ]);
  console.log('  ✓ 3 nghiệm thu\n');

  // ── Công nợ ─────────────────────────────────────────────────────────────
  console.log('🟢 SEED CÔNG NỢ...');
  await getIds([
    `INSERT CongNo (idDonHang,tongTien,daThanhToan,conLai,ngayBatDau,hanThanhToan,trangThai,ghiChu)
     VALUES (${dhId5},29120000,0,29120000,'${D(-5)}','${D(25)}','chua_thanh_toan',N'Khách xin gia hạn 30 ngày')`,
    `INSERT CongNo (idDonHang,tongTien,daThanhToan,conLai,ngayBatDau,hanThanhToan,trangThai,ghiChu)
     VALUES (${dhId6},12000000,12000000,0,'${D(-12)}','${D(-2)}','da_thanh_toan',N'Thanh toán ngay sau nghiệm thu')`,
    `INSERT CongNo (idDonHang,tongTien,daThanhToan,conLai,ngayBatDau,hanThanhToan,trangThai,ghiChu)
     VALUES (${dhId8},52000000,5000000,47000000,'${D(-70)}','${D(-40)}','qua_han',N'Quá hạn 30 ngày - cần thu hồi công nợ')`,
  ]);
  console.log('  ✓ 3 công nợ\n');

  // ── Thanh toán ──────────────────────────────────────────────────────────
  console.log('🟢 SEED THANH TOÁN...');
  await getIds([
    `INSERT ThanhToan (idDonHang,soTien,hinhThuc,ngayThanhToan,nguoiNhan,ghiChu,nguoiTaoId)
     VALUES (${dhId6},12000000,'chuyen_khoan','${D(-12)}',N'Trần Thị Kế Toán',N'Thanh toán chuyển khoản BIDV',${keToanId})`,
    `INSERT ThanhToan (idDonHang,soTien,hinhThuc,ngayThanhToan,nguoiNhan,ghiChu,nguoiTaoId)
     VALUES (${dhId8},5000000,'tien_mat','${D(-65)}',N'Lê Văn Điều Phối',N'Trả trước 5 triệu, còn nợ 47 triệu',${dieuPhoiId})`,
  ]);
  console.log('  ✓ 2 thanh toán\n');

  // ── Thông báo ──────────────────────────────────────────────────────────
  console.log('🟢 SEED THÔNG BÁO...');
  await getIds([
    `INSERT ThongBao (tieuDe,noiDung,role,loai,idThamChieu,duongDan,isRead,ngayTao)
     VALUES (N'Đơn hàng mới chờ duyệt',N'Đơn DH-TEST-001 từ Công Ty TNHH Xây Dựng Minh Tiến - 20m³ M300 chờ kế toán duyệt','ke_toan','NEW_ORDER',${dhId1},'/don-hang',0,'${D(0)} 09:00:00')`,
    `INSERT ThongBao (tieuDe,noiDung,role,loai,idThamChieu,duongDan,isRead,ngayTao)
     VALUES (N'Đơn đã duyệt - cần điều phối',N'Đơn DH-TEST-002 đã duyệt, cần tạo lịch sản xuất và xe giao','dieu_phoi','ORDER_APPROVED',${dhId2},'/dieu-phoi',0,'${D(-1)} 14:00:00')`,
    `INSERT ThongBao (tieuDe,noiDung,role,loai,idThamChieu,duongDan,isRead,ngayTao)
     VALUES (N'Xe đã xuất bến - giao hàng',N'Đơn DH-TEST-003 xe 59C2-2345 đang giao đến Công Ty CP Đầu Tư Hùng Vương','dieu_phoi','DELIVERY_CONFIRMED',${dhId3},'/dieu-phoi',0,'${D(0)} 08:00:00')`,
    `INSERT ThongBao (tieuDe,noiDung,role,loai,idThamChieu,duongDan,isRead,ngayTao)
     VALUES (N'Chờ nghiệm thu - đơn DH-TEST-004',N'Đơn đã giao 25.5m³ M400, cần lập biên bản nghiệm thu','dieu_phoi','ACCEPTANCE_SUBMITTED',${dhId4},'/nghiem-thu',0,'${D(-5)} 17:00:00')`,
    `INSERT ThongBao (tieuDe,noiDung,role,loai,idThamChieu,duongDan,isRead,ngayTao)
     VALUES (N'Công nợ cần thu - 29.120.000đ',N'Đơn DH-TEST-005 đã nghiệm thu, khách hàng nợ 29.120.000đ','ke_toan','PAYMENT_NEEDED',${dhId5},'/thanh-toan',0,'${D(-4)} 08:00:00')`,
    `INSERT ThongBao (tieuDe,noiDung,role,loai,idThamChieu,duongDan,isRead,ngayTao)
     VALUES (N'Cảnh báo: Công nợ quá hạn 30 ngày!',N'Đơn DH-TEST-008 quá hạn thanh toán, còn nợ 47.000.000đ','lanh_dao','ORDER_LATE',${dhId8},'/thanh-toan',0,'${D(-2)} 09:00:00')`,
    `INSERT ThongBao (tieuDe,noiDung,role,loai,idThamChieu,duongDan,isRead,ngayTao)
     VALUES (N'Đơn hàng bị từ chối',N'Đơn DH-TEST-007 đã bị kế toán từ chối: Chưa thanh toán đơn cũ','dieu_phoi','ORDER_REJECTED',${dhId7},'/don-hang',1,'${D(0)} 10:00:00')`,
  ]);
  console.log('  ✓ 7 thông báo\n');

  // ── Tổng kết ─────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ SEED HOÀN TẤT! (database: ${DB_NAME})\n`);
  console.log('📋 TÀI KHOẢN ĐĂNG NHẬP:');
  console.log('   admin     / Admin@123     → Quản trị viên');
  console.log('   ketoan    / Ketoan@123   → Kế toán');
  console.log('   dieuphoi  / Dieuphoi@123 → Điều phối');
  console.log('   lanhdao   / Lanhdao@123  → Lãnh đạo\n');
  console.log('📦 ĐƠN HÀNG THEO TRẠNG THÁI:');
  console.log('   cho_duyet      : DH-TEST-001  - đơn mới, chờ duyệt');
  console.log('   dang_san_xuat  : DH-TEST-002  - cần lịch SX');
  console.log('   dang_giao      : DH-TEST-003  - đang vận chuyển');
  console.log('   nghiem_thu     : DH-TEST-004  - cần nghiệm thu');
  console.log('   da_thanh_toan  : DH-TEST-005  - công nợ 29.1M');
  console.log('   da_thanh_toan  : DH-TEST-006  - hoàn thành');
  console.log('   tu_choi        : DH-TEST-007  - bị từ chối');
  console.log('   da_thanh_toan  : DH-TEST-008  - QUÁ HẠN 47M\n');
  console.log('🔗 TEST FLOW:');
  console.log('   1. Login ketoan    → Duyệt DH-TEST-001');
  console.log('   2. Login dieuphoi  → Tạo lịch SX cho DH-TEST-002');
  console.log('   3. Xác nhận giao DH-TEST-003');
  console.log('   4. Nghiệm thu DH-TEST-004');
  console.log('   5. Thanh toán DH-TEST-005');
  console.log('═══════════════════════════════════════════════════════\n');

  await pool.close();
}

// ─── Entry Point ────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 KHỞI TẠO DATABASE & BẢNG (${DB_NAME})...`);
  await initDatabase();

  console.log('\n🌱 SEED DỮ LIỆU MẪU...');
  await seedData();

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ LỖI:', err instanceof Error ? err.message : err);
  process.exit(1);
});
