import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { TramTronSelect } from "../components/TramTronSelect";
import { taoNguoiDung } from "../services/api";
import { useToast } from "../hooks";
import styles from "./QuanLyNguoiDungPage.module.css";

export default function TaoNguoiDungPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tenDangNhap: "",
    matKhau: "",
    hoTen: "",
    email: "",
    soDienThoai: "",
    vaiTro: "ke_toan",
    idTramTron: undefined as number | undefined,
  });

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
          <FiArrowLeft size={18} /> Quay lại
        </button>
        <div className={styles.pageHeaderTitle}>Thêm người dùng mới</div>
        <div className={styles.pageHeaderDesc}>Tạo tài khoản người dùng mới trong hệ thống</div>
      </div>

      <div className={styles.formCard}>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tên đăng nhập *</label>
            <input
              className={styles.formInput}
              value={form.tenDangNhap}
              onChange={(e) => setForm({ ...form, tenDangNhap: e.target.value })}
              placeholder="VD: nhanvien01"
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Mật khẩu *</label>
            <input
              type="password"
              className={styles.formInput}
              value={form.matKhau}
              onChange={(e) => setForm({ ...form, matKhau: e.target.value })}
              placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Họ tên *</label>
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
              <input
                type="email"
                className={styles.formInput}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>SĐT</label>
              <input
                className={styles.formInput}
                value={form.soDienThoai}
                onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Vai trò *</label>
            <select
              className={styles.formSelect}
              value={form.vaiTro}
              onChange={(e) => setForm({ ...form, vaiTro: e.target.value, idTramTron: undefined })}
            >
              <option value="admin">Quản trị — Toàn quyền hệ thống</option>
              <option value="lanh_dao">Lãnh đạo — Xem KPI & báo cáo</option>
              <option value="ke_toan">Kế toán — Duyệt đơn & thanh toán</option>
              <option value="dieu_phoi">Điều phối — Lên lịch & điều xe</option>
              <option value="tram_tron">Trạm trộn — Xác nhận sản xuất</option>
              <option value="sale">Sales — Tạo đơn hàng</option>
              <option value="tai_xe">Tài xế — Giao hàng</option>
              <option value="ky_thuat">Kỹ thuật — Nghiệm thu công trình</option>
            </select>
          </div>

          {form.vaiTro === "tram_tron" && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Trạm trộn *</label>
              <TramTronSelect
                value={form.idTramTron}
                onChange={(v) => setForm({ ...form, idTramTron: v })}
                placeholder="-- Chọn trạm trộn --"
              />
            </div>
          )}

          <div className={styles.formActions}>
            <button type="button" className="btn btn-cancel" onClick={() => navigate("/quan-ly/nguoi-dung")}>
              Hủy
            </button>
            <button type="submit" className="btn btn-save" disabled={loading}>
              {loading ? "Đang tạo..." : "Tạo người dùng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
