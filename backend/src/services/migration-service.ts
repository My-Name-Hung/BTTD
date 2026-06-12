import { query } from '../config/database';

/**
 * Chạy migrations tự động khi backend khởi động.
 * Kiểm tra và tạo/cập nhật các cột nếu chưa tồn tại.
 */
export async function runMigrations(): Promise<void> {
  console.log('[Migration] Bắt đầu kiểm tra và chạy migrations...');

  try {
    // 1. Cập nhật bienBanFile trong NghiemThu thành NVARCHAR(MAX) nếu cần
    await migrateNghiemThuBienBanFile();

    // 2. Thêm cột giamTru vào DonHang nếu chưa có
    await migrateDonHangGiamTru();

    // 3. Thêm cột giaNiemYet vào DonHang nếu chưa có
    await migrateDonHangGiaNiemYet();

    // 4. Tạo bảng LichSuTraLai nếu chưa có
    await migrateLichSuTraLai();

    console.log('[Migration] Hoàn tất migrations.');
  } catch (error) {
    console.error('[Migration] Lỗi khi chạy migrations:', error);
  }
}

/**
 * Đảm bảo cột bienBanFile trong NghiemThu có thể lưu JSON array (NVARCHAR/MAX)
 */
async function migrateNghiemThuBienBanFile(): Promise<void> {
  try {
    // Kiểm tra xem cột bienBanFile có tồn tại không
    const columns = await query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'NghiemThu' AND COLUMN_NAME = 'bienBanFile'`
    );

    if (columns.length === 0) {
      console.log('[Migration] Tạo cột bienBanFile trong NghiemThu...');
      await query(
        `ALTER TABLE NghiemThu ADD bienBanFile NVARCHAR(MAX) NULL`
      );
      console.log('[Migration] Đã tạo cột bienBanFile trong NghiemThu.');
    } else {
      console.log('[Migration] Cột bienBanFile đã tồn tại trong NghiemThu.');
    }
  } catch (error) {
    console.error('[Migration] Lỗi migrate NghiemThu.bienBanFile:', error);
  }
}

/**
 * Thêm cột giamTru vào DonHang nếu chưa có
 */
async function migrateDonHangGiamTru(): Promise<void> {
  try {
    const columns = await query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'DonHang' AND COLUMN_NAME = 'giamTru'`
    );

    if (columns.length === 0) {
      console.log('[Migration] Tạo cột giamTru trong DonHang...');
      await query(
        `ALTER TABLE DonHang ADD giamTru DECIMAL(18,2) DEFAULT 0`
      );
      console.log('[Migration] Đã tạo cột giamTru trong DonHang.');
    } else {
      console.log('[Migration] Cột giamTru đã tồn tại trong DonHang.');
    }
  } catch (error) {
    console.error('[Migration] Lỗi migrate DonHang.giamTru:', error);
  }
}

/**
 * Thêm cột giaNiemYet vào DonHang nếu chưa có
 */
async function migrateDonHangGiaNiemYet(): Promise<void> {
  try {
    const columns = await query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'DonHang' AND COLUMN_NAME = 'giaNiemYet'`
    );

    if (columns.length === 0) {
      console.log('[Migration] Tạo cột giaNiemYet trong DonHang...');
      await query(
        `ALTER TABLE DonHang ADD giaNiemYet DECIMAL(18,2) DEFAULT 0`
      );
      console.log('[Migration] Đã tạo cột giaNiemYet trong DonHang.');
    } else {
      console.log('[Migration] Cột giaNiemYet đã tồn tại trong DonHang.');
    }
  } catch (error) {
    console.error('[Migration] Lỗi migrate DonHang.giaNiemYet:', error);
  }
}

/**
 * Tạo bảng LichSuTraLai nếu chưa có
 */
async function migrateLichSuTraLai(): Promise<void> {
  try {
    const tables = await query<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_NAME = 'LichSuTraLai'`
    );

    if (tables.length === 0) {
      console.log('[Migration] Tạo bảng LichSuTraLai...');
      await query(`
        CREATE TABLE LichSuTraLai (
          id INT IDENTITY(1,1) PRIMARY KEY,
          idDonHang INT NOT NULL,
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
      console.log('[Migration] Đã tạo bảng LichSuTraLai.');
    } else {
      console.log('[Migration] Bảng LichSuTraLai đã tồn tại.');
    }
  } catch (error) {
    console.error('[Migration] Lỗi migrate LichSuTraLai:', error);
  }
}
