import cors from "cors";
import { createServer } from "http";
import express, { Application, NextFunction, Request, Response } from "express";
import { config } from "./config";
import { initDatabase } from "./config/init-database";
import { ApiResponse } from "./models";

import authRoutes from "./routes/auth-routes";
import dashboardRoutes from "./routes/dashboard-routes";
import dieuPhoiRoutes from "./routes/dieu-phoi-routes";
import donHangRoutes from "./routes/don-hang-routes";
import nghiemThuRoutes from "./routes/nghiem-thu-routes";
import quanLyRoutes from "./routes/quan-ly-routes";
import thamSoRoutes from "./routes/tham-so-routes";
import thanhToanRoutes from "./routes/thanh-toan-routes";
import thongBaoRoutes from "./routes/thong-bao-routes";
import lanhDaoRoutes from "./routes/lanh-dao-routes";
import importRoutes from "./routes/import-routes";

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
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (_req: Request, res: Response<ApiResponse>) => {
  res.json({ success: true, message: "API Bê Tông Tây Đô đang hoạt động" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/don-hang", donHangRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/dieu-phoi", dieuPhoiRoutes);
app.use("/api/nghiem-thu", nghiemThuRoutes);
app.use("/api/thanh-toan", thanhToanRoutes);
app.use("/api/tham-so", thamSoRoutes);
app.use("/api/notifications", thongBaoRoutes);
app.use("/api/lanh-dao", lanhDaoRoutes);
app.use("/api", quanLyRoutes);
app.use("/api/import", importRoutes);

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
  });
}

startServer();

export default app;
