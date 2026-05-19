import { io, Socket } from 'socket.io-client';
import { PopupNotification } from '../components/NotificationPopup/NotificationPopup';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function getToken(): string | null {
  return localStorage.getItem('bttd_token');
}

export function initSocket(vaiTro: string, userId?: number): Socket {
  const token = getToken();
  const wsUrl = import.meta.env.VITE_API_WS_URL || 'http://localhost:5000';
  console.log('[Socket] Init — URL:', wsUrl, 'vaiTro:', vaiTro, 'token exists:', !!token, 'userId:', userId);

  if (socket?.connected) {
    socket.disconnect();
  }

  socket = io(wsUrl, {
    auth: { token },
    query: { vaiTro, userId: userId?.toString() },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
    reconnectAttempts = 0;
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    reconnectAttempts++;
    console.error(`[Socket] Connection error (attempt ${reconnectAttempts}):`, error.message, error);
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Socket] Max reconnect attempts reached');
    }
  });

  socket.on('error', (error) => {
    console.error('[Socket] Error:', error);
  });

  // Keep-alive ping
  const pingInterval = setInterval(() => {
    if (socket?.connected) {
      socket.emit('ping');
    }
  }, 30000);

  socket.on('disconnect', () => {
    clearInterval(pingInterval);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function emitTestNotification(): void {
  if (socket?.connected) {
    const mock: PopupNotification = {
      id: Date.now(),
      tieuDe: 'Thông báo test',
      noiDung: 'Kết nối Socket.IO hoạt động tốt!',
      loai: 'NEW_ORDER',
    };
    socket.emit('notification', mock);
  }
}
