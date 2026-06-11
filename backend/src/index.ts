import cors from "cors";
import { createServer } from "http";
import express, { Application, NextFunction, Request, Response } from "express";
import path from "path";
import { config } from "./config";
import { initDatabase } from "./config/init-database";
import { ApiResponse } from "./models";
import { maintenanceMiddleware } from "./middleware/maintenance";
import { authMiddleware } from "./middleware/auth";

import authRoutes from "./routes/auth-routes";
import dashboardRoutes from "./routes/dashboard-routes";
import dashboardSummaryRoutes from "./routes/dashboard-summary-routes";
import dieuPhoiRoutes from "./routes/dieu-phoi-routes";
import donHangRoutes from "./routes/don-hang-routes";
import nghiemThuRoutes from "./routes/nghiem-thu-routes";
import quanLyRoutes from "./routes/quan-ly-routes";
import thamSoRoutes from "./routes/tham-so-routes";
import thanhToanRoutes from "./routes/thanh-toan-routes";
import hoaDonRoutes from "./routes/hoa-don-routes";
import thongBaoRoutes from "./routes/thong-bao-routes";
import cauHinhRoutes from "./routes/cau-hinh-routes";
import lanhDaoRoutes from "./routes/lanh-dao-routes";
import khoRoutes from "./routes/kho-routes";
import tramTrongRoutes from "./routes/tram-tron-routes";
import importRoutes from "./routes/import-routes";
import taiXeRoutes from "./routes/tai-xe-routes";
import kyThuatRoutes from "./routes/ky-thuat-routes";
import congNoKhachHangRoutes from "./routes/cong-no-khach-hang-routes";
import accessHistoryRoutes from "./routes/access-history-routes";
import exportRoutes from "./routes/export-routes";
import batchRoutes from "./routes/batch-routes";
import bangChungRoutes from "./routes/bang-chung-routes";

const app: Application = express();
const httpServer = createServer(app);

// CORS — cho phép frontend dev server truy cập
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "https://bttd.netlify.app",
      "https://quanlybetong.netlify.app",
      "https://quanlybetong.ximangtaydo.vn",
      "http://apibttd.ximangtaydo.vn",
      "https://apibttd.ximangtaydo.vn",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (biên bản nghiệm thu, etc.)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Health check - không cần auth
app.get("/api/health", (_req: Request, res: Response<ApiResponse>) => {
  res.json({ success: true, message: "API Bê Tông Tây Đô đang hoạt động" });
});

// Routes - tất cả đều qua maintenance middleware (sau auth)
app.use("/api/auth", authRoutes);
app.use("/api/don-hang", authMiddleware, maintenanceMiddleware, donHangRoutes);
app.use("/api/dashboard", authMiddleware, maintenanceMiddleware, dashboardRoutes);
app.use("/api/dashboard", authMiddleware, maintenanceMiddleware, dashboardSummaryRoutes);
app.use("/api/dieu-phoi", authMiddleware, maintenanceMiddleware, dieuPhoiRoutes);
app.use("/api/nghiem-thu", authMiddleware, maintenanceMiddleware, nghiemThuRoutes);
app.use("/api/thanh-toan", authMiddleware, maintenanceMiddleware, thanhToanRoutes);
app.use("/api/hoa-don", authMiddleware, maintenanceMiddleware, hoaDonRoutes);
app.use("/api/tham-so", authMiddleware, maintenanceMiddleware, thamSoRoutes);
app.use("/api/notifications", authMiddleware, maintenanceMiddleware, thongBaoRoutes);
app.use("/api/cau-hinh", cauHinhRoutes); // /trang-thai public, các route khác tự xử lý auth
app.use("/api/lanh-dao", authMiddleware, maintenanceMiddleware, lanhDaoRoutes);
app.use("/api/kho", authMiddleware, maintenanceMiddleware, khoRoutes); // kept for backward compat
app.use("/api/tram-tron", authMiddleware, maintenanceMiddleware, tramTrongRoutes);
app.use("/api/tai-xe", authMiddleware, maintenanceMiddleware, taiXeRoutes);
app.use("/api/ky-thuat", authMiddleware, maintenanceMiddleware, kyThuatRoutes);
app.use("/api", authMiddleware, maintenanceMiddleware, quanLyRoutes);
app.use("/api/import", authMiddleware, maintenanceMiddleware, importRoutes);
app.use("/api", authMiddleware, maintenanceMiddleware, congNoKhachHangRoutes);
app.use("/api/access-history", authMiddleware, maintenanceMiddleware, accessHistoryRoutes);
app.use("/api/export", authMiddleware, maintenanceMiddleware, exportRoutes);
app.use("/api/batch", authMiddleware, maintenanceMiddleware, batchRoutes);
app.use("/api/bang-chung", authMiddleware, maintenanceMiddleware, bangChungRoutes);

// Error handler
app.use(
  (
    err: Error,
    _req: Request,
    res: Response<ApiResponse>,
    _next: NextFunction,
  ) => {
    console.error("Lỗi server:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server nội bộ",
    });
  },
);

// 404 handler
app.use((_req: Request, res: Response<ApiResponse>) => {
  res
    .status(404)
    .json({ success: false, message: "API endpoint không tìm thấy" });
});

// ============================================================
// DEV ONLY — Test notification trực tiếp từ browser
// Gọi: fetch('/api/test-notification?role=ke_toan')
// ============================================================
app.get("/api/test-notification", async (req: Request, res: Response<ApiResponse>) => {
  try {
    const role = (req.query.role as string) || "ke_toan";
    const { taoThongBao } = await import("./services/thong-bao-service");
    const { getSocketIO } = await import("./socket");

    const thongBao = await taoThongBao({
      tieuDe: "🧪 Thông báo test",
      noiDung: `Đây là thông báo test gửi đến role: ${role}. Nếu bạn thấy popup này = Socket.IO hoạt động tốt!`,
      role,
      loai: "NEW_ORDER",
      duongDan: "/quan-ly/don-hang",
    });

    const io = getSocketIO();
    console.log('[TEST] io:', !!io, 'rooms:', io ? Array.from(io.sockets.adapter.rooms.keys()) : 'N/A');
    if (io) {
      const roomClients = io.sockets.adapter.rooms.get(`role:${role}`);
      console.log('[TEST] Clients in role:', role, '->', roomClients ? roomClients.size : 0);
      io.to(`role:${role}`).emit("notification", thongBao);
    }

    res.json({ success: true, message: "Đã gửi test notification", data: thongBao });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Lỗi";
    console.error('[TEST] Error:', msg);
    res.status(500).json({ success: false, message: msg });
  }
});

// Start server
async function startServer() {
  await initDatabase();

  // Khởi tạo Socket.IO sau khi database đã sẵn sàng
  const { initSocket } = await import("./socket");
  initSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(
      `🚀 Server Bê Tông Tây Đô đang chạy tại http://localhost:${config.port}`,
    );
    console.log(`📊 Health check: http://localhost:${config.port}/api/health`);
    console.log(
      `🔗 Database: ${config.db.server}:${config.db.port}/${config.db.database}\n`,
    );

    // ─── Cron: reset thông báo ngày cũ lúc 23:59:59 ───
    const SCHEDULE_HOUR = 23;
    const SCHEDULE_MINUTE = 59;
    const SCHEDULE_SECOND = 59;
    let lastResetDate = '';

    function checkAndReset() {
      const now = new Date();
      const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();

      if (
        h === SCHEDULE_HOUR &&
        m === SCHEDULE_MINUTE &&
        s === SCHEDULE_SECOND &&
        today !== lastResetDate
      ) {
        lastResetDate = today;
        // Gọi reset ngay lập tức
        import('./services/thong-bao-service')
          .then(({ resetThongBaoQuaHan }) => resetThongBaoQuaHan())
          .then((count) => {
            console.log(`[Cron] Đã xóa ${count} thông báo ngày cũ lúc ${now.toISOString()}`);
          })
          .catch((err) => {
            console.error('[Cron] Lỗi reset thông báo:', err);
          });
      }
    }

    setInterval(checkAndReset, 1000);
    console.log(
      `[Cron] Đã bật auto-reset thông báo: chạy lúc ${SCHEDULE_HOUR}:${SCHEDULE_MINUTE}:${SCHEDULE_SECOND} mỗi ngày`,
    );
  });
}

startServer();

export default app;
