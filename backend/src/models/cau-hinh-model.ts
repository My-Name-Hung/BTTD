/**
 * Cấu hình hệ thống — key/value store
 * Dùng cho: trạng thái bảo trì, logo, footer, v.v.
 */

export interface CauHinh {
  id: number;
  khoa: string;   // unique key, ví dụ: "dang_bao_tri"
  giaTri: string; // JSON string cho object, plain string cho scalar
  ngayCapNhat: Date | string;
}

export interface MaintenanceStatus {
  isMaintenance: boolean;
  noiDung: string | null;
  thoiGianBatDau: string | null;
  thoiGianKetThuc: string | null;
  daLich: boolean;
}
