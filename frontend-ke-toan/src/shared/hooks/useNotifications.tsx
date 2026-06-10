import { useCallback, useEffect, useRef, useState } from "react";
import {
  NotificationPopup,
  PopupNotification,
} from "../components/notifications/NotificationPopup";
import {
  danhDauDaDocThongBao,
  resetThongBaoNgayCu,
} from "../services/api";
import { disconnectSocket, initSocket } from "../services/socket";

const NOTIFICATIONS_BASE_URL =
  import.meta.env.VITE_API_URL || "https://apibttd.ximangtaydo.vn/api";

// ─── Âm thanh thông báo ───
function playNotificationSound() {
  try {
    const audio = new Audio(
      "https://ik.imagekit.io/qyvtylv9p/audio_BTTD/notifi.mp3?updatedAt=1779174223765",
    );
    audio.volume = 0.7;
    audio.play().catch(() => {
      try {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 880;
        oscillator.type = "sine";
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + 0.5,
        );
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      } catch {
        /* silent */
      }
    });
  } catch {
    /* silent */
  }
}

interface UseNotificationsReturn {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  PopupContainer: () => JSX.Element | null;
  currentPopupId: number | null;
  dismissAndMarkRead: (notif: PopupNotification) => void;
  skipAll: () => void;
}

export function useNotifications(
  vaiTro: string,
  userId?: number,
): UseNotificationsReturn {
  const socketRef = useRef<ReturnType<typeof initSocket> | null>(null);

  // Trạng thái popup hiện tại
  const [current, setCurrent] = useState<PopupNotification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refs dùng trong closures (luôn fresh, không stale)
  const currentRef = useRef<PopupNotification | null>(null);
  const pendingRef = useRef<PopupNotification[]>([]);

  // ─── Lấy số thông báo chưa đọc từ API (source of truth) ───
  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = localStorage.getItem("bttd_token");
      const res = await fetch(`${NOTIFICATIONS_BASE_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const count = json?.data?.count;
      if (typeof count === "number") {
        setUnreadCount(count);
      }
    } catch (err) {
      console.error("[Notifications] Lỗi fetch unread count:", err);
    }
  }, []);

  // ─── Hiện popup tiếp theo trong queue ───
  const showNext = useCallback(() => {
    const pending = pendingRef.current;
    if (pending.length === 0) return;
    const [next, ...rest] = pending;
    pendingRef.current = rest;
    currentRef.current = next;
    setCurrent(next);
    playNotificationSound();
  }, []);

  // ─── Đóng popup hiện tại → hiện notification tiếp theo trong queue ───
  const handleClose = useCallback(() => {
    currentRef.current = null;
    setCurrent(null);
    showNext();
    fetchUnreadCount();
  }, [showNext, fetchUnreadCount]);

  // ─── Xem chi tiết: đánh dấu đã đọc + đóng popup + không re-show ───
  const dismissAndMarkRead = useCallback(
    (notif: PopupNotification) => {
      pendingRef.current = [];
      currentRef.current = null;
      setCurrent(null);

      if (typeof notif.id === "number" && notif.id <= 1_000_000_000) {
        danhDauDaDocThongBao(Number(notif.id)).catch(() => {
          console.error("[Notifications] Lỗi đánh dấu đã đọc:", notif.id);
        });
        fetchUnreadCount();
        window.dispatchEvent(new CustomEvent("bttd:notifications-refresh"));
      }
    },
    [fetchUnreadCount],
  );

  const refreshUnreadCount = fetchUnreadCount;

  // ─── Skip all: đóng popup hiện tại + xóa hàng đợi ───
  const skipAll = useCallback(() => {
    pendingRef.current = [];
    currentRef.current = null;
    setCurrent(null);
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // ─── Socket handler — xử lý notification mới ───
  const handleSocketNotification = useCallback(
    (data: Record<string, unknown>) => {
      const id =
        typeof data.id === "number" ? data.id : Date.now() + Math.random();

      const notif: PopupNotification = {
        id,
        tieuDe: String(data.tieuDe ?? "Thông báo"),
        noiDung: String(data.noiDung ?? ""),
        loai: String(data.loai ?? "INFO"),
        duongDan: data.duongDan ? String(data.duongDan) : "/thong-bao",
        ngayTao: data.ngayTao ? String(data.ngayTao) : new Date().toISOString(),
      };

      // Deduplicate: không queue trùng ID
      if (
        pendingRef.current.some((p) => p.id === id) ||
        currentRef.current?.id === id
      ) {
        console.log("[Notifications] Bỏ qua notification trùng lặp, id:", id);
        return;
      }

      if (!currentRef.current) {
        // Không có popup nào đang hiển thị → hiện ngay
        currentRef.current = notif;
        setCurrent(notif);
        playNotificationSound();
      } else {
        // Đang hiển thị popup → queue lại
        pendingRef.current = [...pendingRef.current, notif];
        console.log(
          "[Notifications] Popup đang bận, queue:",
          pendingRef.current.length,
        );
      }
    },
    [],
  );

  // ─── Khởi tạo Socket ───
  useEffect(() => {
    if (!vaiTro) return;

    const socket = initSocket(vaiTro, userId);
    socketRef.current = socket;

    socket.on("notification", handleSocketNotification);

    socket.on("connect", () => console.log("[Socket] Connected:", socket.id));
    socket.on("disconnect", (reason: string) =>
      console.log("[Socket] Disconnected:", reason),
    );
    socket.on("connect_error", (err: Error) =>
      console.error("[Socket] Connection error:", err.message),
    );

    return () => {
      disconnectSocket();
      socketRef.current = null;
    };
  }, [vaiTro, userId, handleSocketNotification]);

  // ─── Lấy unread count khi mount ───
  useEffect(() => {
    if (vaiTro) {
      fetchUnreadCount();
    }
  }, [vaiTro, fetchUnreadCount]);

  // ─── Auto reset thông báo khi ngày mới bắt đầu (23:59:59) ───
  const lastResetDateRef = useRef<string>('');

  useEffect(() => {
    function checkDailyReset() {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();

      if (
        h === 23 &&
        m === 59 &&
        s === 59 &&
        today !== lastResetDateRef.current
      ) {
        lastResetDateRef.current = today;
        resetThongBaoNgayCu()
          .then(({ deleted }) => {
            console.log(`[Notifications] Đã reset ${deleted} thông báo ngày cũ`);
            setUnreadCount(0);
            window.dispatchEvent(new CustomEvent('bttd:notifications-refresh'));
          })
          .catch((err) => {
            console.error('[Notifications] Lỗi reset thông báo:', err);
          });
      }
    }

    const interval = setInterval(checkDailyReset, 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── PopupContainer ───
  const PopupContainer = useCallback(() => {
    if (!current) return null;
    return (
      <div className="notification-popup-container">
        <NotificationPopup
          key={current.id}
          notification={current}
          onClose={handleClose}
          onViewDetails={() => dismissAndMarkRead(current)}
          onSkipAll={skipAll}
        />
      </div>
    );
  }, [current, handleClose, dismissAndMarkRead, skipAll]);

  // ─── Expose currentPopupId lên window ───
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__bttdCurrentPopupId =
      current?.id ?? null;
  }, [current?.id]);

  return {
    unreadCount,
    refreshUnreadCount,
    PopupContainer,
    currentPopupId: current?.id ?? null,
    dismissAndMarkRead,
    skipAll,
  };
}
