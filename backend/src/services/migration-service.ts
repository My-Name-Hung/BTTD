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

    // 5. Thêm cột theo dõi trộn lại theo từng trạm (idLichSanXuat, idTramTron, tenTram, tenTaiXe, bienSoXe)
    await migrateLichSuTraLaiPerTram();

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

/**
 * Thêm các cột theo dõi trộn lại theo từng trạm vào LichSuTraLai
 * (idLichSanXuat, idTramTron, tenTram, tenTaiXe, bienSoXe)
 * Để lịch sử trộn lại hiển thị chính xác theo trạm + tài xế tương ứng.
 */
async function migrateLichSuTraLaiPerTram(): Promise<void> {
  try {
    const tables = await query<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_NAME = 'LichSuTraLai'`
    );
    if (tables.length === 0) return;

    const cols = [
      { name: 'idLichSanXuat', ddl: 'INT NULL' },
      { name: 'idTramTron', ddl: 'INT NULL' },
      { name: 'tenTram', ddl: 'NVARCHAR(200) NULL' },
      { name: 'tenTaiXe', ddl: 'NVARCHAR(100) NULL' },
      { name: 'bienSoXe', ddl: 'NVARCHAR(50) NULL' },
    ];

    for (const col of cols) {
      const existing = await query<{ COLUMN_NAME: string }>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME = 'LichSuTraLai' AND COLUMN_NAME = @c`,
        { c: col.name }
      );
      if (existing.length === 0) {
        console.log(`[Migration] Tạo cột ${col.name} trong LichSuTraLai...`);
        await query(`ALTER TABLE LichSuTraLai ADD ${col.name} ${col.ddl}`);
        console.log(`[Migration] Đã tạo cột ${col.name}.`);
      } else {
        console.log(`[Migration] Cột ${col.name} đã tồn tại trong LichSuTraLai.`);
      }
    }
  } catch (error) {
    console.error('[Migration] Lỗi migrate LichSuTraLai theo trạm:', error);
  }
}
