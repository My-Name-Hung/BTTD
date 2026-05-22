import { useAuth } from './use-auth';

export type VaiTro = 'admin' | 'ke_toan' | 'dieu_phoi' | 'lanh_dao' | 'kho';

export const ROLE_LABELS: Record<VaiTro, string> = {
  admin: 'Quản trị viên',
  ke_toan: 'Kế toán',
  dieu_phoi: 'Điều phối',
  lanh_dao: 'Lãnh đạo',
  kho: 'Kho',
};

export const PERMISSIONS = {
  // === ROLE ACCESS ===
  'role': ['admin', 'ke_toan', 'dieu_phoi', 'lanh_dao'],

  // === DON HANG ===
  'donhang.create': ['admin', 'dieu_phoi'],
  'donhang.edit': ['admin', 'dieu_phoi'],
  'donhang.delete': ['admin'],
  'donhang.approve': ['admin', 'ke_toan'],
  'donhang.reject': ['admin', 'ke_toan'],
  'donhang.view': ['admin', 'ke_toan', 'dieu_phoi', 'lanh_dao'],

  // === DIEU PHOI ===
  'dieuphoi.access': ['admin', 'dieu_phoi'],
  'dieuphoi.create': ['admin', 'dieu_phoi'],
  'dieuphoi.edit': ['admin', 'dieu_phoi'],
  'dieuphoi.confirm': ['admin', 'dieu_phoi', 'ke_toan'],

  // === NGHIEM THU ===
  'nghiemthu.access': ['admin', 'ke_toan', 'dieu_phoi'],
  'nghiemthu.create': ['admin', 'ke_toan', 'dieu_phoi'],
  'nghiemthu.confirm': ['admin', 'ke_toan'],

  // === THANH TOAN ===
  'thanhtoan.access': ['admin', 'ke_toan'],
  'thanhtoan.create': ['admin', 'ke_toan'],

  // === CONG NO ===
  'congno.access': ['admin', 'ke_toan', 'dieu_phoi', 'lanh_dao'],
  'congno.view_detail': ['admin', 'ke_toan', 'lanh_dao'],

  // === KHACH HANG ===
  'khachhang.access': ['admin', 'ke_toan', 'dieu_phoi'],
  'khachhang.create': ['admin', 'ke_toan', 'dieu_phoi'],
  'khachhang.edit': ['admin', 'ke_toan'],
  'khachhang.delete': ['admin'],

  // === KHO ===
  'kho.access': ['admin', 'kho'],
  'kho.confirm_delivery': ['admin', 'kho'],
  'kho.confirm_complete': ['admin', 'kho'],

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
