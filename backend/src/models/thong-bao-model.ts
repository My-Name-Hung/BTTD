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
  | 'DELIVERY_CONFIRMED'
  | 'PRODUCTION_SCHEDULED'
  | 'DELIVERY_STARTED'
  | 'DELIVERY_COMPLETED'
  | 'ORDER_STATUS_CHANGED';

export type UserRole = 'admin' | 'ke_toan' | 'dieu_phoi' | 'lanh_dao' | 'kho' | 'sale' | 'tai_xe' | 'ky_thuat';

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
    tieuDe: 'Đơn hàng đã nghiệm thu',
    noiDung: `Kế toán đã xác nhận nghiệm thu đơn hàng ${d.maDonHang || ''} — chờ thanh toán.`,
  }),
  PAYMENT_NEEDED: (d) => ({
    tieuDe: 'Cần xác nhận thanh toán',
    noiDung: `Đơn hàng ${d.maDonHang || ''} cần được xác nhận thanh toán.`,
  }),
  DELIVERY_CONFIRMED: (d) => ({
    tieuDe: 'Xe đã giao xong',
    noiDung: `Xe ${d.bienSoXe || ''} đã giao xong đơn hàng ${d.maDonHang || ''}.`,
  }),
  PRODUCTION_SCHEDULED: (d) => ({
    tieuDe: 'Có đơn hàng cần giao',
    noiDung: `Điều phối đã tạo lịch sản xuất cho đơn hàng ${d.maDonHang || ''} (${d.tenKhachHang || ''}). Khối lượng: ${d.khoiLuong || 0}m³.`,
  }),
  DELIVERY_STARTED: (d) => ({
    tieuDe: 'Đơn hàng bắt đầu giao',
    noiDung: `Kho đã xác nhận bắt đầu giao đơn hàng ${d.maDonHang || ''}. Xe ${d.bienSoXe || ''} đang trên đường giao.`,
  }),
  DELIVERY_COMPLETED: (d) => ({
    tieuDe: 'Đơn hàng chờ nghiệm thu',
    noiDung: `Kho đã xác nhận giao thành công đơn hàng ${d.maDonHang || ''}. Khối lượng thực tế: ${d.khoiLuong || 0}m³. Vui lòng nghiệm thu.`,
  }),
  ORDER_STATUS_CHANGED: (d) => ({
    tieuDe: `Cập nhật: ${d.trangThaiLabel || 'Trạng thái đơn hàng'}`,
    noiDung: `Đơn hàng ${d.maDonHang || ''} đã chuyển sang bước: ${d.trangThaiLabel || d.trangThai || ''}.`,
  }),
};
