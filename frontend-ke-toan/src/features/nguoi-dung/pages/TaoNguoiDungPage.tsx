import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiUser, FiLock, FiMail, FiPhone, FiShield } from "react-icons/fi";
import { TramTronSelect } from "../../../shared/components/forms/TramTronSelect";
import { taoNguoiDung } from "../../../shared/services/api";
import { useToast } from "../../../shared/hooks";
import styles from "./TaoNguoiDungPage.module.css";

const VAI_TRO_OPTIONS = [
  { value: "admin", label: "Quản trị", desc: "Toàn quyền hệ thống", color: "#073ceb" },
  { value: "lanh_dao", label: "Lãnh đạo", desc: "Xem KPI & báo cáo", color: "#7c3aed" },
  { value: "ke_toan", label: "Kế toán", desc: "Duyệt đơn & thanh toán", color: "#047857" },
  { value: "dieu_phoi", label: "Điều phối", desc: "Lên lịch & điều xe", color: "#ea6b00" },
  { value: "tram_tron", label: "Trạm trộn", desc: "Xác nhận sản xuất", color: "#0369a1" },
  { value: "sale", label: "Sales", desc: "Tạo đơn hàng", color: "#dc2626" },
  { value: "tai_xe", label: "Tài xế", desc: "Giao hàng", color: "#0d9488" },
  { value: "ky_thuat", label: "Kỹ thuật", desc: "Nghiệm thu công trình", color: "#9333ea" },
];

export default function TaoNguoiDungPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    tenDangNhap: "",
    matKhau: "",
    hoTen: "",
    email: "",
    soDienThoai: "",
    vaiTro: "ke_toan",
    idTramTron: undefined as number | undefined,
  });

  const selectedRole = VAI_TRO_OPTIONS.find(r => r.value === form.vaiTro);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenDangNhap.trim()) { showToast("Vui lòng nhập tên đăng nhập", "error"); return; }
    if (!form.matKhau.trim() || form.matKhau.length < 6) { showToast("Mật khẩu phải ít nhất 6 ký tự", "error"); return; }
    if (!form.hoTen.trim()) { showToast("Vui lòng nhập họ tên", "error"); return; }
    if (form.vaiTro === "tram_tron" && !form.idTramTron) { showToast("Vui lòng chọn trạm trộn", "error"); return; }

    setLoading(true);
    try {
      await taoNguoiDung({
        tenDangNhap: form.tenDangNhap.trim(),
        matKhau: form.matKhau,
        hoTen: form.hoTen.trim(),
        email: form.email || undefined,
        soDienThoai: form.soDienThoai || undefined,
        vaiTro: form.vaiTro,
        idTramTron: form.idTramTron,
      });
      showToast("Tạo người dùng thành công!");
      navigate("/quan-ly/nguoi-dung");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi tạo người dùng", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <button className={styles.backBtn} onClick={() => navigate("/quan-ly/nguoi-dung")}>
          <FiArrowLeft size={18} />
        </button>
        <div>
          <h1 className={styles.pageTitle}>Thêm người dùng mới</h1>
          <p className={styles.pageDesc}>Tạo tài khoản người dùng trong hệ thống</p>
        </div>
      </div>

      <div className={styles.formCard}>
        <form onSubmit={handleSubmit}>
          {/* Tài khoản */}
          <div className={styles.sectionTitle}>
            <FiUser size={16} /> Thông tin tài khoản
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tên đăng nhập <span className={styles.required}>*</span></label>
            <div className={styles.inputWrapper}>
              <FiUser className={styles.inputIcon} size={16} />
              <input
                className={styles.formInput}
                value={form.tenDangNhap}
                onChange={(e) => setForm({ ...form, tenDangNhap: e.target.value })}
                placeholder="VD: nhanvien01"
                autoFocus
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Mật khẩu <span className={styles.required}>*</span></label>
            <div className={styles.inputWrapper}>
              <FiLock className={styles.inputIcon} size={16} />
              <input
                type={showPassword ? "text" : "password"}
                className={styles.formInput}
                value={form.matKhau}
                onChange={(e) => setForm({ ...form, matKhau: e.target.value })}
                placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </div>

          {/* Thông tin cá nhân */}
          <div className={styles.sectionTitle}>
            <FiUser size={16} /> Thông tin cá nhân
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Họ tên <span className={styles.required}>*</span></label>
            <input
              className={styles.formInput}
              value={form.hoTen}
              onChange={(e) => setForm({ ...form, hoTen: e.target.value })}
              placeholder="VD: Nguyễn Văn A"
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email</label>
              <div className={styles.inputWrapper}>
                <FiMail className={styles.inputIcon} size={16} />
                <input
                  type="email"
                  className={styles.formInput}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Số điện thoại</label>
              <div className={styles.inputWrapper}>
                <FiPhone className={styles.inputIcon} size={16} />
                <input
                  className={styles.formInput}
                  value={form.soDienThoai}
                  onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })}
                  placeholder="0909 xxx xxx"
                />
              </div>
            </div>
          </div>

          {/* Vai trò */}
          <div className={styles.sectionTitle}>
            <FiShield size={16} /> Phân quyền
          </div>

          <div className={styles.roleGrid}>
            {VAI_TRO_OPTIONS.map((role) => (
              <div
                key={role.value}
                className={`${styles.roleCard} ${form.vaiTro === role.value ? styles.roleCardActive : ""}`}
                style={form.vaiTro === role.value ? { borderColor: role.color, background: `${role.color}08` } : {}}
                onClick={() => setForm({ ...form, vaiTro: role.value, idTramTron: undefined })}
              >
                <div className={styles.roleLabel} style={form.vaiTro === role.value ? { color: role.color } : {}}>
                  {role.label}
                </div>
                <div className={styles.roleDesc}>{role.desc}</div>
              </div>
            ))}
          </div>

          {form.vaiTro === "tram_tron" && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Trạm trộn <span className={styles.required}>*</span></label>
              <TramTronSelect
                value={form.idTramTron}
                onChange={(v) => setForm({ ...form, idTramTron: v })}
                placeholder="-- Chọn trạm trộn --"
              />
            </div>
          )}

          <div className={styles.formActions}>
            <button type="button" className={styles.btnCancel} onClick={() => navigate("/quan-ly/nguoi-dung")}>
              Hủy bỏ
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? "Đang tạo..." : "Tạo người dùng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
