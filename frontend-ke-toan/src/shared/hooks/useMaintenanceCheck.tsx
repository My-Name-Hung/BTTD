/**
 * Hook kiểm tra trạng thái bảo trì
 * - Lắng nghe Socket.IO event 'maintenance' để cập nhật trạng thái
 * - Expose trạng thái để App.tsx render MaintenanceBlockPage
 */
import { useEffect, useState } from 'react';
import { layTrangThaiBaoTri } from "../services/api";
import { MaintenanceStatus } from "../types";
import { initSocket, getSocket } from "../services/socket";

interface MaintenanceCheckReturn {
  maintenanceStatus: MaintenanceStatus | null;
  loading: boolean;
}

export function useMaintenanceCheck(): MaintenanceCheckReturn {
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Lấy trạng thái ban đầu
    layTrangThaiBaoTri()
      .then((status) => setMaintenanceStatus(status))
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false));

    // Lắng nghe Socket.IO event maintenance
    let socket = getSocket();
    if (!socket) {
      // Nếu chưa có socket (vì user chưa login), bỏ qua
      return;
    }

    const onMaintenance = (payload: {
      loai: string;
      noiDung?: string;
      thoiGianKetThuc?: string | null;
    }) => {
      setMaintenanceStatus({
        isMaintenance: true,
        noiDung: payload.noiDung ?? null,
        thoiGianBatDau: new Date().toISOString(),
        thoiGianKetThuc: payload.thoiGianKetThuc ?? null,
        daLich: !!payload.thoiGianKetThuc,
      });
    };

    const onMaintenanceEnd = () => {
      setMaintenanceStatus({
        isMaintenance: false,
        noiDung: null,
        thoiGianBatDau: null,
        thoiGianKetThuc: null,
        daLich: false,
      });
    };

    socket.on('maintenance', onMaintenance);
    socket.on('maintenance_end', onMaintenanceEnd);

    return () => {
      socket?.off('maintenance', onMaintenance);
      socket?.off('maintenance_end', onMaintenanceEnd);
    };
  }, []);

  return { maintenanceStatus, loading };
}
