import { useAuth } from './useAuth';

export type VaiTro = 'admin' | 'giam_doc_kinh_doanh' | 'ke_toan' | 'dieu_phoi' | 'lanh_dao' | 'tram_tron' | 'sale' | 'tai_xe' | 'ky_thuat';

export const ROLE_LABELS: Record<VaiTro, string> = {
  admin: 'Quản trị viên',
  giam_doc_kinh_doanh: 'Giám đốc kinh doanh',
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
  'donhang.create': ['admin', 'sale', 'dieu_phoi'],
  'donhang.edit': ['admin'],
  'donhang.delete': ['admin'],
  'donhang.approve': ['admin', 'giam_doc_kinh_doanh', 'ke_toan'],
  'donhang.reject': ['admin', 'giam_doc_kinh_doanh', 'ke_toan'],
  'donhang.approve_gdkd': ['admin', 'giam_doc_kinh_doanh'],
  'donhang.approve_ke_toan': ['admin', 'ke_toan'],
  'donhang.view': ['admin', 'giam_doc_kinh_doanh', 'ke_toan', 'dieu_phoi', 'lanh_dao', 'sale', 'tai_xe', 'ky_thuat'],
  'donhang.view_own': ['sale', 'tai_xe', 'ky_thuat'],

  // === DIEU PHOI ===
  'dieuphoi.access': ['admin', 'giam_doc_kinh_doanh', 'dieu_phoi'],
  'dieuphoi.create': ['admin', 'dieu_phoi'],
  'dieuphoi.edit': ['admin', 'dieu_phoi'],
  'dieuphoi.confirm': ['admin', 'dieu_phoi', 'giam_doc_kinh_doanh', 'ke_toan'],

  // === NGHIEM THU ===
  'nghiemthu.access': ['admin', 'giam_doc_kinh_doanh', 'ke_toan', 'ky_thuat'],
  'nghiemthu.confirm': ['admin', 'giam_doc_kinh_doanh', 'ke_toan', 'ky_thuat'],

  // === THANH TOAN ===
  'thanhtoan.access': ['admin', 'giam_doc_kinh_doanh', 'ke_toan'],
  'thanhtoan.create': ['admin', 'giam_doc_kinh_doanh', 'ke_toan'],

  // === CONG NO ===
  'congno.access': ['admin', 'giam_doc_kinh_doanh', 'ke_toan', 'lanh_dao'],
  'congno.view_detail': ['admin', 'giam_doc_kinh_doanh', 'ke_toan', 'lanh_dao'],

  // === KHACH HANG ===
  'khachhang.access': ['admin', 'giam_doc_kinh_doanh', 'ke_toan', 'dieu_phoi', 'sale'],
  'khachhang.create': ['admin', 'sale'],
  'khachhang.edit': ['admin', 'giam_doc_kinh_doanh', 'ke_toan'],
  'khachhang.delete': ['admin'],

  // === TRAM TRON ===
  'tramtron.access': ['admin', 'giam_doc_kinh_doanh', 'tram_tron'],
  'tramtron.confirm_delivery': ['admin', 'tram_tron'],
  'tramtron.confirm_complete': ['admin', 'tram_tron'],

  // === TAI XE ===
  'taixe.access': ['admin', 'giam_doc_kinh_doanh', 'tai_xe', 'ky_thuat'],
  'taixe.update_giao': ['admin', 'tai_xe', 'ky_thuat'],

  // === KY THUAT ===
  'kythuat.access': ['admin', 'ky_thuat'],
  'kythuat.confirm': ['admin', 'ky_thuat'],

  // === THAM SO ===
  'thamso.access': ['admin'],
  'thamso.mac.create': ['admin', 'giam_doc_kinh_doanh', 'dieu_phoi', 'sale'],
  'thamso.mac.edit': ['admin', 'giam_doc_kinh_doanh', 'dieu_phoi', 'sale'],
  'thamso.xe.create': ['admin'],
  'thamso.xe.edit': ['admin', 'dieu_phoi'],
  'thamso.mac.view': ['admin', 'giam_doc_kinh_doanh', 'ke_toan', 'dieu_phoi', 'lanh_dao', 'sale', 'tai_xe', 'ky_thuat', 'tram_tron'],
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
