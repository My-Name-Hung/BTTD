import { useEffect, useRef } from "react";
import { layThongBaoChuaDoc } from "../services/api";

/**
 * Hook quản lý notification badge trên tab trình duyệt
 * Hiển thị số thông báo chưa đọc trên title
 */
export function useNotificationBadge() {
  const originalTitle = useRef(document.title);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateBadge = async () => {
    try {
      const notifications = await layThongBaoChuaDoc();
      const count = notifications.length;

      if (count > 0) {
        const newTitle = `(${count}) ${originalTitle.current}`;
        if (document.title !== newTitle) {
          document.title = newTitle;
        }
      } else {
        if (document.title !== originalTitle.current) {
          document.title = originalTitle.current;
        }
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật notification badge:", error);
    }
  };

  useEffect(() => {
    originalTitle.current = document.title;
    updateBadge();
    intervalRef.current = setInterval(updateBadge, 30000);

    const handleRefresh = () => updateBadge();
    window.addEventListener("bttd:notifications-refresh", handleRefresh);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener("bttd:notifications-refresh", handleRefresh);
      document.title = originalTitle.current;
    };
  }, []);
}
