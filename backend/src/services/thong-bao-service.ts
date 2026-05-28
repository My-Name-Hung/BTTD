import { query } from '../config/database';
import { ThongBao, ThongBaoPayload, NotificationType, NOTIFICATION_MESSAGES } from '../models/thong-bao-model';
import { getSocketIO } from '../socket';

/**
 * Tạo và lưu thông báo vào DB, đồng thời gửi realtime qua Socket.IO
 */
export async function taoThongBao(payload: ThongBaoPayload): Promise<ThongBao> {
  const result = await query<ThongBao>(
    `INSERT INTO ThongBao (tieuDe, noiDung, role, loai, idThamChieu, duongDan, isRead, ngayTao)
     OUTPUT INSERTED.*
     VALUES (@tieuDe, @noiDung, @role, @loai, @idThamChieu, @duongDan, 0, GETDATE())`,
    {
      tieuDe: payload.tieuDe,
      noiDung: payload.noiDung,
      role: payload.role,
      loai: payload.loai,
      idThamChieu: payload.idThamChieu ?? null,
      duongDan: payload.duongDan ?? null,
    },
  );
  const thongBao = result[0];

  // Gửi realtime qua Socket.IO
  const io = getSocketIO();
  console.log('[ThongBao] taoThongBao — io exists:', !!io, 'role:', payload.role, 'tieuDe:', thongBao.tieuDe);
  if (io) {
    const rooms = io.sockets.adapter.rooms.get(`role:${payload.role}`);
    console.log('[ThongBao] Clients in role:role:', payload.role, '->', rooms ? rooms.size : 0, 'clients');
    io.to(`role:${payload.role}`).emit('notification', thongBao);
    console.log('[ThongBao] Đã emit notification cho role:', payload.role, 'data:', JSON.stringify(thongBao));
  } else {
    console.warn('[ThongBao] io is null — Socket.IO chưa khởi tạo!');
  }

  return thongBao;
}

/**
 * Gửi thông báo theo loại cho các role tương ứng
 */
export function guiThongBao(
  type: NotificationType,
  data: Record<string, unknown>,
): void {
  const { tieuDe, noiDung } = NOTIFICATION_MESSAGES[type](data);

  const roleMap: Record<NotificationType, string[]> = {
    NEW_ORDER: ['admin', 'ke_toan', 'lanh_dao'],
    ORDER_APPROVED: ['dieu_phoi', 'admin', 'lanh_dao'],
    ORDER_REJECTED: ['dieu_phoi', 'sale', 'admin', 'lanh_dao'],
    PAYMENT_RECEIVED: ['admin', 'ke_toan', 'lanh_dao'],
    SCHEDULE_UPDATED: ['ke_toan', 'kho', 'admin', 'lanh_dao'],
    ORDER_COMPLETED: ['admin', 'ke_toan', 'dieu_phoi', 'lanh_dao'],
    ORDER_LATE: ['admin', 'dieu_phoi', 'lanh_dao'],
    NEED_APPROVAL: ['ke_toan'],
    ACCEPTANCE_SUBMITTED: ['ke_toan', 'dieu_phoi', 'lanh_dao'],
    VOLUME_CONFIRMED: ['dieu_phoi', 'lanh_dao'],
    PAYMENT_NEEDED: ['ke_toan', 'lanh_dao'],
    DELIVERY_CONFIRMED: ['dieu_phoi', 'admin', 'lanh_dao', 'ky_thuat'],
    PRODUCTION_SCHEDULED: ['kho', 'admin', 'lanh_dao'],
    DELIVERY_STARTED: ['dieu_phoi', 'admin', 'lanh_dao'],
    DELIVERY_COMPLETED: ['dieu_phoi', 'admin', 'lanh_dao', 'ke_toan', 'ky_thuat'],
    ORDER_STATUS_CHANGED: ['admin', 'ke_toan', 'dieu_phoi', 'lanh_dao', 'kho', 'sale', 'tai_xe', 'ky_thuat'],
  };

  const roles = roleMap[type] || [];

  for (const role of roles) {
    const linkMap: Record<NotificationType, string> = {
      NEW_ORDER: `/quan-ly/don-hang`,
      ORDER_APPROVED: `/quan-ly/don-hang`,
      ORDER_REJECTED: `/quan-ly/don-hang`,
      PAYMENT_RECEIVED: `/thanh-toan`,
      SCHEDULE_UPDATED: `/dieu-phoi`,
      ORDER_COMPLETED: `/quan-ly/don-hang`,
      ORDER_LATE: `/canh-bao`,
      NEED_APPROVAL: `/quan-ly/don-hang`,
      ACCEPTANCE_SUBMITTED: `/nghiem-thu`,
      VOLUME_CONFIRMED: `/nghiem-thu`,
      PAYMENT_NEEDED: `/thanh-toan`,
      DELIVERY_CONFIRMED: `/dieu-phoi`,
      PRODUCTION_SCHEDULED: `/kho/lich-san-xuat`,
      DELIVERY_STARTED: `/dieu-phoi`,
      DELIVERY_COMPLETED: `/nghiem-thu`,
      ORDER_STATUS_CHANGED: `/quan-ly/don-hang`,
    };

    taoThongBao({
      tieuDe,
      noiDung,
      role,
      loai: type,
      idThamChieu: data.id as number | undefined,
      duongDan: linkMap[type],
    }).catch((err) => console.error(`Lỗi gửi thông báo ${type} → ${role}:`, err));
  }
}

/**
 * Lấy danh sách thông báo theo role với phân trang
 */
export async function layDanhSachThongBao(
  role: string,
  page: number = 1,
  limit: number = 20,
  isRead?: boolean,
): Promise<{ data: ThongBao[]; total: number }> {
  const offset = (page - 1) * limit;
  const conditions: string[] = ['role = @role'];
  const params: Record<string, unknown> = { role, offset, limit };

  if (isRead !== undefined) {
    conditions.push('isRead = @isRead');
    params.isRead = isRead;
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await query<{ total: number }[]>(
    `SELECT COUNT(*) as total FROM ThongBao WHERE ${whereClause}`,
    params,
  );
  const total = countResult[0]?.total || 0;

  const data = await query<ThongBao[]>(
    `SELECT * FROM ThongBao WHERE ${whereClause}
     ORDER BY ngayTao DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params,
  );

  return { data, total };
}

/**
 * Lấy số thông báo chưa đọc theo role
 */
export async function laySoThongBaoChuaDoc(role: string): Promise<number> {
  const result = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM ThongBao WHERE role = @role AND isRead = 0`,
    { role },
  );
  return result[0]?.count || 0;
}

/**
 * Đánh dấu thông báo đã đọc
 */
export async function danhDauDaDoc(id: number): Promise<void> {
  await query(
    `UPDATE ThongBao SET isRead = 1 WHERE id = @id`,
    { id },
  );
}

/**
 * Đánh dấu tất cả thông báo của role là đã đọc
 */
export async function danhDauTatCaDaDoc(role: string): Promise<void> {
  await query(
    `UPDATE ThongBao SET isRead = 1 WHERE role = @role`,
    { role },
  );
}

/**
 * Xóa thông báo theo id
 */
export async function xoaThongBao(id: number): Promise<void> {
  await query(`DELETE FROM ThongBao WHERE id = @id`, { id });
}

/**
 * Xóa tất cả thông báo của ngày hôm qua (chạy tự động lúc 23:59:59)
 * Trả về số bản ghi đã xóa
 */
export async function resetThongBaoQuaHan(): Promise<number> {
  // Đếm trước
  const countResult = await query<{ deleted: number }[]>(
    `SELECT COUNT(*) as deleted FROM ThongBao WHERE CAST(ngayTao AS DATE) < CAST(GETDATE() AS DATE)`,
    {}
  );
  const count = countResult[0]?.deleted ?? 0;
  // Xóa
  await query(
    `DELETE FROM ThongBao WHERE CAST(ngayTao AS DATE) < CAST(GETDATE() AS DATE)`,
    {}
  );
  return count;
}
