// Backend Notification model — thông báo realtime

export interface ThongBao {
  id: number;
  tieuDe: string;
  noiDung: string;
  role: string;
  loai: string;
  idThamChieu?: number;
  duongDan?: string;
  isRead: boolean;
  ngayTao: Date;
}

export interface ThongBaoPayload {
  tieuDe: string;
  noiDung: string;
  role: string;
  loai: string;
  idThamChieu?: number;
  duongDan?: string;
}

export type NotificationType =
  | 'NEW_ORDER'
  | 'ORDER_APPROVED'
  | 'ORDER_REJECTED'
  | 'PAYMENT_RECEIVED'
  | 'SCHEDULE_UPDATED'
  | 'ORDER_COMPLETED'
  | 'ORDER_LATE'
  | 'NEED_APPROVAL'
  | 'ACCEPTANCE_SUBMITTED'
  | 'VOLUME_CONFIRMED'
  | 'PAYMENT_NEEDED'
  | 'DELIVERY_CONFIRMED';

export type UserRole = 'admin' | 'ke_toan' | 'dieu_phoi' | 'lanh_dao';

export const NOTIFICATION_MESSAGES: Record<NotificationType, (data: Record<string, unknown>) => { tieuDe: string; noiDung: string }> = {
  NEW_ORDER: (d) => ({
    tieuDe: 'Đơn hàng mới được tạo',
    noiDung: `Đơn hàng ${d.maDonHang || ''} vừa được tạo cho khách hàng ${d.tenKhachHang || ''}.`,
  }),
  ORDER_APPROVED: (d) => ({
    tieuDe: 'Đơn hàng đã được duyệt',
    noiDung: `Đơn hàng ${d.maDonHang || ''} đã được kế toán duyệt.`,
  }),
  ORDER_REJECTED: (d) => ({
    tieuDe: 'Đơn hàng bị từ chối',
    noiDung: `Đơn hàng ${d.maDonHang || ''} đã bị kế toán từ chối. Lý do: ${d.lyDo || 'Không có'}`
  }),
  PAYMENT_RECEIVED: (d) => ({
    tieuDe: 'Khách hàng đã thanh toán',
    noiDung: `Khách hàng ${d.tenKhachHang || ''} đã thanh toán ${d.soTien || 0}đ cho đơn hàng ${d.maDonHang || ''}.`,
  }),
  SCHEDULE_UPDATED: (d) => ({
    tieuDe: 'Lịch trạm trộn được cập nhật',
    noiDung: `Điều phối đã cập nhật lịch cho trạm trộn ${d.tenTram || ''}.`,
  }),
  ORDER_COMPLETED: (d) => ({
    tieuDe: 'Đơn hàng đã hoàn thành',
    noiDung: `Đơn hàng ${d.maDonHang || ''} đã được giao và nghiệm thu thành công.`,
  }),
  ORDER_LATE: (d) => ({
    tieuDe: 'Cảnh báo: Đơn hàng bị trễ',
    noiDung: `Đơn hàng ${d.maDonHang || ''} đang bị trễ tiến độ giao hàng.`,
  }),
  NEED_APPROVAL: (d) => ({
    tieuDe: 'Có đơn hàng mới cần duyệt',
    noiDung: `Đơn hàng ${d.maDonHang || ''} từ khách hàng ${d.tenKhachHang || ''} đang chờ bạn duyệt.`,
  }),
  ACCEPTANCE_SUBMITTED: (d) => ({
    tieuDe: 'Kỹ thuật gửi biên bản nghiệm thu',
    noiDung: `Biên bản nghiệm thu cho đơn hàng ${d.maDonHang || ''} đã được gửi.`,
  }),
  VOLUME_CONFIRMED: (d) => ({
    tieuDe: 'Khách hàng xác nhận khối lượng',
    noiDung: `Khối lượng đơn hàng ${d.maDonHang || ''} đã được khách xác nhận: ${d.khoiLuong || 0}m³.`,
  }),
  PAYMENT_NEEDED: (d) => ({
    tieuDe: 'Cần xác nhận thanh toán',
    noiDung: `Đơn hàng ${d.maDonHang || ''} cần được xác nhận thanh toán.`,
  }),
  DELIVERY_CONFIRMED: (d) => ({
    tieuDe: 'Xe đã giao xong',
    noiDung: `Xe ${d.bienSoXe || ''} đã giao xong đơn hàng ${d.maDonHang || ''}.`,
  }),
};
