import { useAuth } from './use-auth';

export type VaiTro = 'admin' | 'ke_toan' | 'dieu_phoi' | 'lanh_dao' | 'tram_tron' | 'sale' | 'tai_xe' | 'ky_thuat';

export const ROLE_LABELS: Record<VaiTro, string> = {
  admin: 'Quản trị viên',
  ke_toan: 'Kế toán',
  dieu_phoi: 'Điều phối',
  lanh_dao: 'Lãnh đạo',
  tram_tron: 'Trạm trộn',
  sale: 'Sales',
  tai_xe: 'Tài xế',
  ky_thuat: 'Kỹ thuật',
};

export const PERMISSIONS = {
  // === ROLE ACCESS ===
  'role': ['admin', 'ke_toan', 'dieu_phoi', 'lanh_dao', 'tram_tron', 'sale', 'tai_xe', 'ky_thuat'],

  // === DON HANG ===
  'donhang.create': ['admin', 'sale'],
  'donhang.edit': ['admin'],
  'donhang.delete': ['admin'],
  'donhang.approve': ['admin', 'ke_toan'],
  'donhang.reject': ['admin', 'ke_toan'],
  'donhang.view': ['admin', 'ke_toan', 'dieu_phoi', 'lanh_dao', 'sale', 'tai_xe', 'ky_thuat'],
  'donhang.view_own': ['sale', 'tai_xe', 'ky_thuat'],

  // === DIEU PHOI ===
  'dieuphoi.access': ['admin', 'dieu_phoi'],
  'dieuphoi.create': ['admin', 'dieu_phoi'],
  'dieuphoi.edit': ['admin', 'dieu_phoi'],
  'dieuphoi.confirm': ['admin', 'dieu_phoi', 'ke_toan'],

  // === NGHIEM THU ===
  'nghiemthu.access': ['admin', 'ke_toan', 'ky_thuat'],
  'nghiemthu.confirm': ['admin', 'ke_toan', 'ky_thuat'],

  // === THANH TOAN ===
  'thanhtoan.access': ['admin', 'ke_toan'],
  'thanhtoan.create': ['admin', 'ke_toan'],

  // === CONG NO ===
  'congno.access': ['admin', 'ke_toan', 'lanh_dao'],
  'congno.view_detail': ['admin', 'ke_toan', 'lanh_dao'],

  // === KHACH HANG ===
  'khachhang.access': ['admin', 'ke_toan', 'dieu_phoi', 'sale'],
  'khachhang.create': ['admin', 'sale'],
  'khachhang.edit': ['admin', 'ke_toan'],
  'khachhang.delete': ['admin'],

  // === TRAM TRON ===
  'tramtron.access': ['admin', 'tram_tron'],
  'tramtron.confirm_delivery': ['admin', 'tram_tron'],
  'tramtron.confirm_complete': ['admin', 'tram_tron'],

  // === TAI XE ===
  'taixe.access': ['admin', 'tai_xe'],
  'taixe.update_giao': ['admin', 'tai_xe'],

  // === KY THUAT ===
  'kythuat.access': ['admin', 'ky_thuat'],
  'kythuat.confirm': ['admin', 'ky_thuat'],

  // === THAM SO ===
  'thamso.access': ['admin'],
  'thamso.mac.create': ['admin'],
  'thamso.mac.edit': ['admin'],
  'thamso.xe.create': ['admin'],
  'thamso.xe.edit': ['admin', 'dieu_phoi'],
} as const;

export function usePageRole() {
  const { user } = useAuth();
  const vaiTro = user?.vaiTro as VaiTro | undefined;

  const hasPermission = (permission: keyof typeof PERMISSIONS): boolean => {
    if (!vaiTro) return false;
    const allowed = PERMISSIONS[permission];
    return allowed ? (allowed as unknown as string[]).includes(vaiTro) : false;
  };

  const hasAnyRole = (roles: VaiTro[]): boolean => {
    if (!vaiTro) return false;
    return roles.includes(vaiTro);
  };

  return { vaiTro, hasPermission, hasAnyRole };
}
