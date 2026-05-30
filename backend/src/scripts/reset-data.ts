/**
 * Script reset data - Xóa toàn bộ data trong database
 * Chỉ giữ lại bảng NguoiDung (để login)
 *
 * Chạy: npx tsx src/scripts/reset-data.ts
 *
 * CẢNH BÁO: Script này sẽ xóa toàn bộ data thực tế!
 */

import mssql from 'mssql';
import { config } from '../config/index';

const DB_OPTS = { encrypt: false, trustServerCertificate: true };

async function resetData() {
  console.log('🔄 Kết nối database...\n');

  const pool = await mssql.connect({
    server: config.db.server,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    options: DB_OPTS,
  });

  // Các bảng cần xóa data (theo thứ tự để tránh vi phạm FK nếu có)
  const tables = [
    'NhatKyHeThong',
    'LichSuImport',
    'ThongBao',
    'NghiemThu',
    'LichSanXuat',
    'ThanhToan',
    'CongNo',
    'CongNoKhachHang',
    'DonHang',
    'KhachHang',
    'Xe',
    'LichSuTrangThai',
    'TramTron',
    'MacBeTong',
    'PhuongTien',
    'TaiKhoan',
  ];

  console.log('🗑️  Xóa data các bảng (giữ lại NguoiDung)...\n');

  for (const table of tables) {
    try {
      const result = await pool.query(`IF OBJECT_ID('${table}', 'U') IS NOT NULL BEGIN DECLARE @cnt INT = (SELECT COUNT(*) FROM ${table}); DELETE FROM ${table}; PRINT '  ✓ Đã xóa ' + CAST(@cnt AS VARCHAR) + ' dòng từ bảng ${table}'; END ELSE PRINT '  — Bảng ${table} không tồn tại, bỏ qua';`);
      if (result.rowsAffected[0] > 0) {
        // print done by SQL
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Lỗi xóa bảng ${table}: ${msg}`);
    }
  }

  // Kiểm tra NguoiDung còn đủ account không
  const users = await pool.query<{ id: number; hoTen: string; vaiTro: string }[]>(
    `SELECT id, hoTen, vaiTro FROM NguoiDung ORDER BY id`
  );
  console.log(`\n✅ Reset hoàn tất!`);
  console.log(`📋 ${users.recordset.length} tài khoản đang được giữ lại:`);
  users.recordset.forEach((u) => {
    console.log(`   - [${u.vaiTro}] ${u.hoTen} (ID: ${u.id})`);
  });

  await pool.close();
  process.exit(0);
}

resetData().catch((err) => {
  console.error('❌ Lỗi:', err instanceof Error ? err.message : err);
  process.exit(1);
});
