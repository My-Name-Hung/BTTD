import { useCallback, useEffect, useState } from "react";
import { FiDownload, FiEdit2, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
  ConfirmModal,
  EmptyState,
  Loading,
  Modal,
  Pagination,
} from "../components/Common";
import { SearchableDropdown } from "../components/SearchableDropdown";
import { TramTronSelect } from "../components/TramTronSelect";
import { usePagination, useToast } from "../hooks";
import {
  exportNguoiDung,
  layDanhSachNguoiDung,
  suaNguoiDung,
  xoaNguoiDung,
} from "../services/api";
import { exportToExcel, formatDateForExport } from "../utils/exportData";
import { ApiResponseWithPagination, NguoiDung } from "../types";
import styles from "./QuanLyNguoiDungPage.module.css";

const VAI_TRO_SORT_ORDER: Record<string, number> = {
  admin: 1,
  lanh_dao: 2,
  ke_toan: 3,
  dieu_phoi: 4,
  tram_tron: 5,
  sale: 6,
  tai_xe: 7,
  ky_thuat: 8,
};

const VAI_TRO_LABELS: Record<string, string> = {
  admin: "Quản trị",
  ke_toan: "Kế toán",
  dieu_phoi: "Điều phối",
  lanh_dao: "Lãnh đạo",
  tram_tron: "Trạm trộn",
  sale: "Sales",
  tai_xe: "Tài xế",
  ky_thuat: "Kỹ thuật",
};

const VAI_TRO_CLASS: Record<string, string> = {
  admin: styles.roleBadgeAdmin,
  ke_toan: styles.roleBadgeKeToan,
  dieu_phoi: styles.roleBadgeDieuPhoi,
  lanh_dao: styles.roleBadgeLanhDao,
  tram_tron: styles.roleBadgeTramTron,
  sale: styles.roleBadgeSale,
  tai_xe: styles.roleBadgeTaiXe,
  ky_thuat: styles.roleBadgeKyThuat,
};

const VAI_TRO_COLORS: Record<string, string> = {
  admin: "#073ceb",
  ke_toan: "#047857",
  dieu_phoi: "#ea6b00",
  lanh_dao: "#7c3aed",
  tram_tron: "#0369a1",
  sale: "#dc2626",
  tai_xe: "#0d9488",
  ky_thuat: "#9333ea",
};

export default function QuanLyNguoiDungPage() {
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 50);
  const userVaiTro = JSON.parse(
    localStorage.getItem("bttd_user") || "{}",
  )?.vaiTro;
  const canDelete = ["admin"].includes(userVaiTro);

  const [data, setData] = useState<ApiResponseWithPagination<NguoiDung[]>>({
    success: true,
    message: "",
    data: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState("");
  const [vaiTroFilter, setVaiTroFilter] = useState("");
  const [trangThaiFilter, setTrangThaiFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<NguoiDung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NguoiDung | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({
    tenDangNhap: "",
    matKhau: "",
    hoTen: "",
    email: "",
    soDienThoai: "",
    vaiTro: "ke_toan",
    trangThai: "hoat_dong",
    idTramTron: undefined as number | undefined,
  });

  const filteredUsers = (data.data?.filter((u) => {
    const matchVaiTro = !vaiTroFilter || u.vaiTro === vaiTroFilter;
    const matchTrangThai = !trangThaiFilter || u.trangThai === trangThaiFilter;
    return matchVaiTro && matchTrangThai;
  }) ?? []).sort((a, b) => (VAI_TRO_SORT_ORDER[a.vaiTro] ?? 99) - (VAI_TRO_SORT_ORDER[b.vaiTro] ?? 99));

  const hasFilters = !!vaiTroFilter || !!trangThaiFilter || !!tuKhoa;

  const clearFilters = () => {
    setVaiTroFilter("");
    setTrangThaiFilter("");
    setTuKhoa("");
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layDanhSachNguoiDung(page, 50, tuKhoa || undefined);
      setData(res);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [page, tuKhoa, showToast]);

  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEdit = (u: NguoiDung) => {
    setEditingUser(u);
    const f = {
      tenDangNhap: u.tenDangNhap,
      matKhau: "",
      hoTen: u.hoTen,
      email: u.email || "",
      soDienThoai: u.soDienThoai || "",
      vaiTro: u.vaiTro,
      trangThai: u.trangThai,
      idTramTron: u.idTramTron ?? undefined,
    };
    setForm(f);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.hoTen.trim()) {
      showToast("Vui lòng nhập họ tên", "error");
      return;
    }
    setFormLoading(true);
    try {
      await suaNguoiDung(editingUser!.id, {
        hoTen: form.hoTen,
        email: form.email || undefined,
        soDienThoai: form.soDienThoai || undefined,
        vaiTro: form.vaiTro,
        trangThai: form.trangThai,
        matKhauMoi: form.matKhau || undefined,
        idTramTron: form.idTramTron,
      });
      setModalOpen(false);
      setShowSuccess(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi", "error");
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      tenDangNhap: "",
      matKhau: "",
      hoTen: "",
      email: "",
      soDienThoai: "",
      vaiTro: "ke_toan",
      trangThai: "hoat_dong",
      idTramTron: undefined as number | undefined,
    });
    setEditingUser(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await xoaNguoiDung(deleteTarget.id);
      showToast("Xóa người dùng thành công");
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const allData = await exportNguoiDung();

      const vaiTroLabels: Record<string, string> = {
        admin: "Quản trị",
        ke_toan: "Kế toán",
        dieu_phoi: "Điều phối",
        sale: "Sales",
        tai_xe: "Tài xế",
        ky_thuat: "Kỹ thuật",
        tram_tron: "Trạm trộn",
        lanh_dao: "Lãnh đạo",
      };

      const headers: { key: string; label: string; width: number }[] = [
        { key: "id", label: "ID", width: 8 },
        { key: "tenDangNhap", label: "Tên đăng nhập", width: 20 },
        { key: "hoTen", label: "Họ tên", width: 25 },
        { key: "email", label: "Email", width: 28 },
        { key: "soDienThoai", label: "SĐT", width: 14 },
        { key: "vaiTro", label: "Vai trò", width: 16 },
        { key: "trangThai", label: "Trạng thái", width: 14 },
        { key: "ngayTao", label: "Ngày tạo", width: 16 },
      ];

      const rows = allData.map((nd) => ({
        id: nd.id,
        tenDangNhap: nd.tenDangNhap,
        hoTen: nd.hoTen || "",
        email: nd.email || "",
        soDienThoai: nd.soDienThoai || "",
        vaiTro: vaiTroLabels[nd.vaiTro] || nd.vaiTro,
        trangThai: nd.trangThai === "hoat_dong" ? "Hoạt động" : "Khóa",
        ngayTao: formatDateForExport(nd.ngayTao),
      }));

      await exportToExcel("BÁO CÁO NGƯỜI DÙNG", headers, rows, `BaoCaoNguoiDung_${new Date().toISOString().slice(0, 10)}.xlsx`, "Người dùng");
      showToast("Xuất báo cáo thành công!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xuất báo cáo", "error");
    } finally {
      setExporting(false);
    }
  };

  // Pagination helpers
  const totalPages = data.pagination.totalPages;
  const total = data.pagination.total;
  const LIMIT = 50;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Quản lý người dùng</div>
          <div className={styles.pageHeaderDesc}>
            Quản lý tài khoản và phân quyền người dùng hệ thống
          </div>
        </div>
        <div className={styles.pageHeaderActions}>
          <button className="btn btn-export" onClick={handleExportExcel} disabled={exporting}>
            <FiDownload /> {exporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
          <button className="btn btn-add" onClick={() => navigate("/quan-ly/nguoi-dung/tao")}>
            <FiPlus /> Thêm người dùng
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrap}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm tên đăng nhập, họ tên..."
            value={tuKhoa}
            onChange={(e) => {
              setTuKhoa(e.target.value);
              resetPage();
            }}
          />
        </div>

        {/* Vai trò filter */}
        <div className={`${styles.filterDropdown} ${vaiTroFilter ? styles.activeFilterDropdown : ""}`}>
          <SearchableDropdown
            value={vaiTroFilter}
            onChange={(val) => { setVaiTroFilter(String(val)); resetPage(); }}
            placeholder="Tất cả vai trò"
            options={[
              { id: "admin", label: "Quản trị" },
              { id: "ke_toan", label: "Kế toán" },
              { id: "dieu_phoi", label: "Điều phối" },
              { id: "lanh_dao", label: "Lãnh đạo" },
              { id: "tram_tron", label: "Trạm trộn" },
              { id: "sale", label: "Sales" },
              { id: "tai_xe", label: "Tài xế" },
              { id: "ky_thuat", label: "Kỹ thuật" },
            ]}
          />
        </div>

        {/* Trạng thái filter */}
        <div className={`${styles.filterDropdown} ${trangThaiFilter ? styles.activeFilterDropdown : ""}`}>
          <SearchableDropdown
            value={trangThaiFilter}
            onChange={(val) => { setTrangThaiFilter(String(val)); resetPage(); }}
            placeholder="Tất cả trạng thái"
            options={[
              { id: "hoat_dong", label: "Hoạt động" },
              { id: "khong_hoat_dong", label: "Không hoạt động" },
            ]}
          />
        </div>

        {hasFilters && (
          <button className={styles.filterClearBtn} onClick={clearFilters}>
            <FiX size={13} /> Xóa lọc
          </button>
        )}
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{filteredUsers.length}</span> tài khoản
            {hasFilters && <> / {total} tổng</>}
          </div>
          <div className={styles.statDot} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>
              {filteredUsers.filter((u) => u.trangThai === "hoat_dong").length}
            </span>{" "}
            hoạt động
          </div>
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <Loading />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon="👤"
              text={
                hasFilters
                  ? "Không có người dùng phù hợp với bộ lọc"
                  : "Chưa có người dùng nào"
              }
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>SĐT</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className={styles.tableName}>{u.tenDangNhap}</span>
                    </td>
                    <td>{u.hoTen}</td>
                    <td className={styles.tableEmail}>
                      {u.email || <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td className={styles.tablePhone}>
                      {u.soDienThoai || <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td>
                      <span
                        className={`${styles.roleBadge} ${VAI_TRO_CLASS[u.vaiTro] || ""}`}
                      >
                        <span
                          className={styles.roleDot}
                          style={{ backgroundColor: VAI_TRO_COLORS[u.vaiTro] || "#888" }}
                        />
                        {VAI_TRO_LABELS[u.vaiTro] || u.vaiTro}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${u.trangThai === "hoat_dong" ? styles.statusHoatDong : styles.statusKhongHoatDong}`}
                      >
                        {u.trangThai === "hoat_dong"
                          ? "Hoạt động"
                          : "Không hoạt động"}
                      </span>
                    </td>
                    <td className={styles.tableDate}>
                      {u.ngayTao
                        ? new Date(u.ngayTao).toLocaleDateString("vi-VN")
                        : "—"}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                          onClick={() => openEdit(u)}
                          title="Sửa"
                        >
                          <FiEdit2 size={14} />
                        </button>
                        {canDelete && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                            onClick={() => setDeleteTarget(u)}
                            title="Xóa"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination — centered, show when > 10 items */}
        {!loading && total > 10 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            onPageChange={goToPage}
          />
        )}
      </div>

      {/* Modal chỉ dùng để sửa */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="Sửa người dùng"
        footer={
          <>
            <button className="btn btn-cancel" onClick={closeModal} disabled={formLoading}>
              Hủy
            </button>
            <button className="btn btn-save" onClick={handleSubmit} disabled={formLoading}>
              {formLoading ? "Đang lưu..." : "Cập nhật"}
            </button>
          </>
        }
      >
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Đổi mật khẩu mới</label>
          <input
            type="password"
            className={styles.formInput}
            value={form.matKhau}
            onChange={(e) => setForm({ ...form, matKhau: e.target.value })}
            placeholder="Để trống nếu không đổi"
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
          <SearchableDropdown
            value={form.vaiTro}
            onChange={(val) => setForm({ ...form, vaiTro: String(val) })}
            placeholder="-- Chọn vai trò --"
            options={[
              { id: "admin", label: "Quản trị", subLabel: "Toàn quyền hệ thống" },
              { id: "lanh_dao", label: "Lãnh đạo", subLabel: "Xem KPI & báo cáo" },
              { id: "ke_toan", label: "Kế toán", subLabel: "Duyệt đơn & thanh toán" },
              { id: "dieu_phoi", label: "Điều phối", subLabel: "Lên lịch & điều xe" },
              { id: "tram_tron", label: "Trạm trộn", subLabel: "Xác nhận sản xuất" },
              { id: "sale", label: "Sales", subLabel: "Tạo đơn hàng" },
              { id: "tai_xe", label: "Tài xế", subLabel: "Giao hàng" },
              { id: "ky_thuat", label: "Kỹ thuật", subLabel: "Nghiệm thu công trình" },
            ]}
          />
        </div>
        {form.vaiTro === "tram_tron" && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Trạm trộn *</label>
            <TramTronSelect value={form.idTramTron} onChange={(v) => setForm({ ...form, idTramTron: v })} />
          </div>
        )}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Trạng thái</label>
          <select
            className={styles.formSelect}
            value={form.trangThai}
            onChange={(e) => setForm({ ...form, trangThai: e.target.value })}
          >
            <option value="hoat_dong">Hoạt động</option>
            <option value="khong_hoat_dong">Không hoạt động</option>
          </select>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa người dùng"
        message={`Bạn có chắc muốn xóa người dùng "${deleteTarget?.hoTen}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        loading={deleteLoading}
      />

      <ConfirmModal
        isOpen={showSuccess}
        onClose={() => { setShowSuccess(false); loadData(); resetForm(); }}
        onConfirm={() => { setShowSuccess(false); loadData(); resetForm(); }}
        message={editingUser ? "Cập nhật người dùng thành công!" : "Tạo người dùng thành công!"}
        confirmText="Đồng ý"
        cancelText=""
        title="Thành công"
        type="success"
      />

      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${t.type === "error" ? styles.toastError : styles.toastSuccess}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
