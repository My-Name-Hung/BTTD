/**
 * Script xóa data mẫu - Giữ lại bảng NguoiDung
 * Chạy: npx ts-node src/scripts/clean-data.ts
 */

import mssql from "mssql";
import { config } from "../config";

async function cleanData() {
  console.log("🧹 Bắt đầu xóa data mẫu...\n");

  const pool = await mssql.connect({
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

  const db = pool;
  const request = db.request();

  try {
    // Lấy số lượng user trước khi xóa
    const userCount = await request.query<{ cnt: number }[]>(
      "SELECT COUNT(*) as cnt FROM NguoiDung"
    );
    console.log(`👥 Số lượng người dùng hiện tại: ${userCount.recordset[0].cnt}`);
    console.log("✅ Giữ lại toàn bộ dữ liệu bảng NguoiDung\n");

    // Các bảng cần xóa (theo thứ tự để tránh vi phạm ràng buộc FK)
    const tables = [
      // Xóa bảng con trước, bảng cha sau
      "ThongBao",           // Thông báo
      "CongNoKhachHang",     // Công nợ khách hàng
      "CongNo",              // Công nợ
      "HoaDon",              // Hóa đơn
      "ThanhToan",           // Thanh toán
      "NghiemThu",           // Nghiệm thu
      "LichSanXuat",         // Lịch sử sản xuất
      "DonHang",             // Đơn hàng
      "Xe",                  // Xe
      "TramTron",            // Trạm trộn
      "MacBeTong",           // Mác bê tông
      "KhachHang",           // Khách hàng
      "CauHinh",             // Cấu hình
      "NhatKyHeThong",       // Nhật ký hệ thống
      "LoginSession",        // Phiên đăng nhập
    ];

    console.log("📋 Các bảng sẽ xóa dữ liệu:");
    for (const table of tables) {
      const countBefore = await request.query<{ cnt: number }[]>(
        `SELECT COUNT(*) as cnt FROM ${table}`
      );
      if (countBefore.recordset[0].cnt > 0) {
        console.log(`   - ${table}: ${countBefore.recordset[0].cnt} dòng`);
      }
    }
    console.log("");

    // Xác nhận trước khi xóa
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (text: string): Promise<string> =>
      new Promise((resolve) => rl.question(text, resolve));

    const confirm = await question(
      "⚠️  Bạn có chắc muốn xóa toàn bộ data mẫu? (y/n): "
    );
    rl.close();

    if (confirm.toLowerCase() !== "y") {
      console.log("❌ Đã hủy thao tác xóa data.");
      await pool.close();
      return;
    }

    console.log("\n🗑️  Đang xóa dữ liệu...\n");

    for (const table of tables) {
      try {
        // Kiểm tra bảng có tồn tại không
        const tableExists = await request.query<{ name: string }[]>(
          `SELECT name FROM sys.tables WHERE name = '${table}'`
        );

        if (tableExists.recordset.length === 0) {
          console.log(`   ⏭️  Bảng ${table} không tồn tại, bỏ qua`);
          continue;
        }

        // Xóa dữ liệu
        await request.query(`DELETE FROM ${table}`);
        console.log(`   ✅ Đã xóa dữ liệu bảng ${table}`);

        // Reset identity nếu có
        try {
          await request.query(`DBCC CHECKIDENT ('${table}', RESEED, 0)`);
        } catch {
          // Bỏ qua lỗi nếu không có identity
        }
      } catch (err) {
        console.log(`   ⚠️  Lỗi khi xóa bảng ${table}: ${err}`);
      }
    }

    console.log("\n📊 Kết quả sau khi xóa:");
    console.log("--------------------------------------------");

    // Kiểm tra lại số lượng
    for (const table of ["NguoiDung", ...tables]) {
      try {
        const countAfter = await request.query<{ cnt: number }[]>(
          `SELECT COUNT(*) as cnt FROM ${table}`
        );
        const status = countAfter.recordset[0].cnt === 0 ? "✅" : "📌";
        console.log(`${status} ${table}: ${countAfter.recordset[0].cnt} dòng`);
      } catch {
        console.log(`❌ ${table}: lỗi kiểm tra`);
      }
    }

    console.log("\n🎉 Hoàn tất xóa data mẫu!");
    console.log("📌 Lưu ý: Bảng NguoiDung vẫn giữ nguyên dữ liệu.");

  } catch (error) {
    console.error("❌ Lỗi:", error);
    throw error;
  } finally {
    await pool.close();
  }
}

// Chạy script
cleanData()
  .then(() => {
    console.log("\n✅ Script hoàn thành");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Script thất bại:", err);
    process.exit(1);
  });
