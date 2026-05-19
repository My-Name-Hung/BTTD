import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from './middleware/auth';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "https://bttd.netlify.app",
      ],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware: xác thực JWT từ query param hoặc handshake
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth as { token?: string })?.token ||
      (socket.handshake.query as { token?: string })?.token;

    if (!token) {
      console.log('[Socket.IO] Middleware — Không có token!');
      return next(new Error('Không có token xác thực'));
    }

    try {
      const decoded = verifyToken(token);
      (socket as Socket & { userId?: number; vaiTro?: string }).userId = decoded.id;
      (socket as Socket & { userId?: number; vaiTro?: string }).vaiTro = decoded.vaiTro;
      console.log('[Socket.IO] Middleware — Token OK, userId:', decoded.id, 'vaiTro:', decoded.vaiTro);
      next();
    } catch (err) {
      const e = err as Error;
      console.log('[Socket.IO] Middleware — Token lỗi:', e.message, '| Token prefix:', token.slice(0, 20) + '...');
      next(new Error('Token không hợp lệ hoặc đã hết hạn'));
    }
  });

  io.on('connection', (socket: Socket & { userId?: number; vaiTro?: string }) => {
    const { userId, vaiTro } = socket;

    console.log(`[Socket.IO] Client connected: userId=${userId}, vaiTro=${vaiTro}, socketId=${socket.id}`);

    // Tham gia room theo role
    if (vaiTro) {
      socket.join(`role:${vaiTro}`);
      console.log(`[Socket.IO] User ${userId} joined room: role:${vaiTro}`);
    }

    // Tham gia room theo userId (nhận thông báo cá nhân)
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[Socket.IO] User ${userId} joined room: user:${userId}`);
    }

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: userId=${userId}, reason=${reason}`);
    });

    // Ping để giữ kết nối alive
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });

  console.log('[Socket.IO] Server initialized');
  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}
